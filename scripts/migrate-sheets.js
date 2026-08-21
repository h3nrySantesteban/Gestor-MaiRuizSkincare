// Migración one-off de las planillas viejas (Google Sheets) a Supabase.
//
// Uso:
//   1. Exportá/copiá cada pestaña (Pacientes, Tratamientos, Turnos) como TSV
//      (tab-separated) a scripts/data/pacientes.tsv, tratamientos.tsv,
//      turnos.tsv — con la fila de encabezados incluida. Copiar/pegar
//      directo desde Google Sheets a un archivo de texto ya da TSV.
//   2. Simulación (no escribe nada, solo reporta problemas):
//        node --env-file=.env.local scripts/migrate-sheets.js
//   3. Recién cuando el reporte esté limpio, correr de verdad:
//        node --env-file=.env.local scripts/migrate-sheets.js --commit
//
// Requiere SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL en .env.local
// (mismas variables que usa server/supabaseAdmin.ts) — bypassa RLS a
// propósito, es un script de administración de confianza, no un request
// de usuario.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

const COMMIT = process.argv.includes('--commit')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — correr con --env-file=.env.local')
  process.exit(1)
}
// @supabase/supabase-js exige un WebSocket global para su cliente realtime
// (Node < 22 no lo trae nativo) aunque este script nunca lo usa — un stub
// vacío alcanza para pasar esa validación sin agregar una dependencia nueva.
globalThis.WebSocket ??= class {}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// id del tratamiento "No definido" en el sistema viejo — es un centinela
// ("se usa cuando el paciente no elige tratamiento"), no un tratamiento
// real: no se importa a la tabla tratamientos, y los turnos que lo
// referencian quedan sin ningún tratamiento asociado.
const NO_DEFINIDO_ID = '432835cd'

const ESTADOS_VALIDOS = ['Finalizado', 'Agendado', 'Cancelado', 'Otro']
const MEDIOS_PAGO_VALIDOS = ['Efectivo', 'Transferencia', 'Credito', 'Debito']

const issues = []
function reportIssue(msg) {
  issues.push(msg)
}

function parseTSV(filename) {
  const filePath = path.join(DATA_DIR, filename)
  let text
  try {
    text = readFileSync(filePath, 'utf-8')
  } catch {
    console.error(`No se pudo leer ${filePath} — ¿existe el archivo?`)
    process.exit(1)
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const headers = lines[0].split('\t').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split('\t')
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim()
    })
    return row
  })
}

// "22/04/2025 18:45:00" (hora Argentina, UTC-3 fijo) -> ISO en UTC
function parseFechaArg(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s.trim())
  if (!m) return null
  const [, d, mo, y, hh, mm, ss] = m.map(Number)
  return new Date(Date.UTC(y, mo - 1, d, hh + 3, mm, ss ?? 0)).toISOString()
}

function parseBool(s) {
  return String(s ?? '').trim().toUpperCase() === 'TRUE'
}

function parsePrecio(raw) {
  const n = Number(String(raw ?? '0').trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function normalizeEnum(raw, valid) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { value: null, ok: true }
  const match = valid.find((v) => v.toLowerCase() === trimmed.toLowerCase())
  return match ? { value: match, ok: true } : { value: trimmed, ok: false }
}

async function main() {
  console.log(COMMIT ? '=== Migración: modo COMMIT (va a escribir en Supabase) ===' : '=== Migración: modo SIMULACIÓN (no escribe nada) ===')

  const pacientesRows = parseTSV('pacientes.tsv')
  const tratamientosRows = parseTSV('tratamientos.tsv')
  const turnosRows = parseTSV('turnos.tsv')

  console.log(`Leídos: ${pacientesRows.length} pacientes, ${tratamientosRows.length} tratamientos, ${turnosRows.length} turnos`)

  // ---------- Tratamientos ----------
  const tratamientosAImportar = tratamientosRows.filter((r) => r.IdTratamiento !== NO_DEFINIDO_ID)
  if (tratamientosRows.length !== tratamientosAImportar.length) {
    console.log(`Excluido "No definido" (${NO_DEFINIDO_ID}) — no se importa como tratamiento real.`)
  }

  const tratamientoIdMap = new Map() // old IdTratamiento -> new uuid
  for (const r of tratamientosAImportar) {
    if (!r.Nombre) {
      reportIssue(`Tratamiento ${r.IdTratamiento}: sin Nombre, se salteó.`)
      continue
    }
    if (COMMIT) {
      const { data, error } = await supabase
        .from('tratamientos')
        .insert({ nombre: r.Nombre, precio: parsePrecio(r.Precio), descripcion: r.Descripcion || null })
        .select('id')
        .single()
      if (error) {
        reportIssue(`Tratamiento ${r.IdTratamiento} (${r.Nombre}): error al insertar — ${error.message}`)
        continue
      }
      tratamientoIdMap.set(r.IdTratamiento, data.id)
    } else {
      tratamientoIdMap.set(r.IdTratamiento, `<simulado:${r.IdTratamiento}>`)
    }
  }

  // ---------- Pacientes ----------
  const pacienteIdMap = new Map() // old IdPaciente -> new uuid
  for (const r of pacientesRows) {
    if (!r.NombreApellidoPaciente) {
      reportIssue(`Paciente ${r.IdPaciente}: sin nombre, se salteó.`)
      continue
    }
    const createdAt = r.FechaRegistro ? parseFechaArg(r.FechaRegistro) : null
    if (r.FechaRegistro && !createdAt) {
      reportIssue(`Paciente ${r.IdPaciente} (${r.NombreApellidoPaciente}): FechaRegistro no se pudo parsear ("${r.FechaRegistro}").`)
    }
    // se migra tal cual viene de la planilla vieja — esa app ya tenía el
    // botón de WhatsApp andando bien con este mismo formato, no se toca
    const telefono = r.TelefonoPaciente || null

    if (COMMIT) {
      const { data, error } = await supabase
        .from('pacientes')
        .insert({
          nombre_completo: r.NombreApellidoPaciente,
          telefono,
          instagram: r.InstagramPaciente || null,
          ...(createdAt ? { created_at: createdAt } : {}),
        })
        .select('id')
        .single()
      if (error) {
        reportIssue(`Paciente ${r.IdPaciente} (${r.NombreApellidoPaciente}): error al insertar — ${error.message}`)
        continue
      }
      pacienteIdMap.set(r.IdPaciente, data.id)
    } else {
      pacienteIdMap.set(r.IdPaciente, `<simulado:${r.IdPaciente}>`)
    }
  }

  // ---------- Turnos ----------
  let turnosCreados = 0
  let turnosConTratamiento = 0
  const now = new Date().toISOString()

  for (const r of turnosRows) {
    const fecha = parseFechaArg(r.FechaTurno)
    if (!fecha) {
      reportIssue(`Turno ${r.IdTurno}: FechaTurno no se pudo parsear ("${r.FechaTurno}") — se salteó.`)
      continue
    }
    const pacienteId = pacienteIdMap.get(r.PacienteTurno)
    if (!pacienteId) {
      reportIssue(`Turno ${r.IdTurno}: PacienteTurno "${r.PacienteTurno}" no matchea ningún paciente — se salteó.`)
      continue
    }
    const estado = normalizeEnum(r.EstadoTurno, ESTADOS_VALIDOS)
    if (!estado.ok || !estado.value) {
      reportIssue(`Turno ${r.IdTurno}: EstadoTurno "${r.EstadoTurno}" no matchea ninguno de ${ESTADOS_VALIDOS.join('/')} — se salteó.`)
      continue
    }
    const medioPago = normalizeEnum(r.MedioDePago, MEDIOS_PAGO_VALIDOS)
    if (!medioPago.ok) {
      reportIssue(`Turno ${r.IdTurno}: MedioDePago "${r.MedioDePago}" no matchea ninguno de ${MEDIOS_PAGO_VALIDOS.join('/')} — se dejó null.`)
    }

    const precio = parsePrecio(r.Precio)
    const giftCard = parseBool(r.GiftCard)
    const senado = parseBool(r.Señado)

    // el sistema viejo permite un solo tratamiento por turno (o ninguno,
    // vía el centinela "No definido")
    let tratamientoId = null
    if (r.Tratamiento && r.Tratamiento !== NO_DEFINIDO_ID) {
      tratamientoId = tratamientoIdMap.get(r.Tratamiento) ?? null
      if (!tratamientoId) {
        reportIssue(`Turno ${r.IdTurno}: Tratamiento "${r.Tratamiento}" no matchea ningún tratamiento importado — el turno se crea sin tratamiento.`)
      }
    }

    if (COMMIT) {
      const { data: turno, error: turnoError } = await supabase
        .from('turnos')
        .insert({
          fecha,
          paciente_id: pacienteId,
          precio,
          gift_card: giftCard,
          medio_pago: medioPago.value,
          senado,
          estado: estado.value,
          // evita que el cron de recordatorios le mande WhatsApp a un
          // paciente real por un turno agendado migrado de otro sistema
          reminder_sent_at: estado.value === 'Agendado' ? now : null,
        })
        .select('id')
        .single()
      if (turnoError) {
        reportIssue(`Turno ${r.IdTurno}: error al insertar — ${turnoError.message}`)
        continue
      }
      if (tratamientoId) {
        const { error: relError } = await supabase
          .from('turno_tratamientos')
          .insert({ turno_id: turno.id, tratamiento_id: tratamientoId, precio_aplicado: precio })
        if (relError) {
          reportIssue(`Turno ${r.IdTurno}: turno creado pero falló el link a turno_tratamientos — ${relError.message}`)
        } else {
          turnosConTratamiento += 1
        }
      }
    } else if (tratamientoId) {
      turnosConTratamiento += 1
    }
    turnosCreados += 1
  }

  console.log(`\nTratamientos importados: ${tratamientoIdMap.size} / ${tratamientosRows.length}`)
  console.log(`Pacientes importados: ${pacienteIdMap.size} / ${pacientesRows.length}`)
  console.log(`Turnos procesados: ${turnosCreados} / ${turnosRows.length} (${turnosConTratamiento} con tratamiento asociado)`)

  if (issues.length > 0) {
    console.log(`\n${issues.length} problema(s) encontrados:`)
    for (const i of issues) console.log(' - ' + i)
  } else {
    console.log('\nSin problemas detectados.')
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada en Supabase. Revisá los problemas de arriba y corré de nuevo con --commit cuando esté limpio.')
  }
}

main()
