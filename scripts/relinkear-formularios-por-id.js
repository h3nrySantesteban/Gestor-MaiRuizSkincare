// One-off: re-vincula respuestas_formulario ya existentes usando el
// PacienteRef (id del paciente en el sistema viejo) de la planilla
// original — más confiable que matchear por nombre (vincular-formularios-
// por-nombre.js), porque no depende de que el nombre esté tipeado igual.
//
// A DIFERENCIA de migrate-formularios.js (que inserta filas nuevas), este
// script ACTUALIZA filas que ya están en Supabase: son las que
// reset-migracion.js desvinculó (paciente_id -> null) antes de borrar
// pacientes, y siguen ahí con el mismo contenido/fecha de siempre — no se
// vuelven a insertar, se re-conecta el paciente_id que ya tenían.
//
// El emparejamiento fila-TSV <-> fila-Supabase es por created_at exacto
// (viene de "Marca temporal", parseado igual que migrate-formularios.js) —
// no hay otro id en común entre la planilla vieja y respuestas_formulario.
// Con eso alcanza: dos respuestas en el mismo segundo exacto es
// prácticamente imposible, y si pasara se reporta como ambigua, no se
// adivina.
//
// Solo toca respuestas con paciente_id null Y google_response_id null (las
// del lote histórico — las que sí tienen google_response_id son
// respuestas en vivo del webhook, no están en esta planilla vieja).
//
// Uso:
//   node --env-file=.env.local scripts/relinkear-formularios-por-id.js            (simulación)
//   node --env-file=.env.local scripts/relinkear-formularios-por-id.js --commit   (escribe, re-ejecutable)

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
globalThis.WebSocket ??= class {}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

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

// "22/04/2025 18:45:00" (hora Argentina, UTC-3 fijo) -> ISO en UTC — mismo
// parseo que usó migrate-formularios.js para setear created_at, tiene que
// ser idéntico para que el match por timestamp funcione
function parseFechaArg(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s.trim())
  if (!m) return null
  const [, d, mo, y, hh, mm, ss] = m.map(Number)
  return new Date(Date.UTC(y, mo - 1, d, hh + 3, mm, ss ?? 0)).toISOString()
}

async function fetchAll(table, select, filtro) {
  const rows = []
  let from = 0
  const PAGE_SIZE = 1000
  for (;;) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (filtro) query = filtro(query)
    const { data, error } = await query
    if (error) {
      console.error(`Error leyendo ${table}: ${error.message}`)
      process.exit(1)
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function main() {
  console.log(COMMIT ? '=== Relinkear formularios por PacienteRef: modo COMMIT ===' : '=== Relinkear formularios por PacienteRef: modo SIMULACIÓN ===')

  const pacientesRows = parseTSV('pacientes.tsv')
  const formulariosRows = parseTSV('formularios.tsv')
  console.log(`Leídos: ${pacientesRows.length} pacientes (referencia), ${formulariosRows.length} filas de formulario`)

  // oldId (PacienteRef) -> nombre — misma planilla que ya usó migrate-sheets.js
  const nombrePorIdViejo = new Map()
  for (const r of pacientesRows) {
    if (r.IdPaciente && r.NombreApellidoPaciente) nombrePorIdViejo.set(r.IdPaciente, r.NombreApellidoPaciente)
  }

  // nombre (normalizado simple) -> [ids nuevos] en Supabase
  const pacientesActuales = await fetchAll('pacientes', 'id, nombre_completo')
  const idsPorNombre = new Map()
  for (const p of pacientesActuales) {
    const key = p.nombre_completo.trim().toLowerCase()
    idsPorNombre.set(key, [...(idsPorNombre.get(key) ?? []), p.id])
  }

  // filas de Supabase del lote histórico (sin google_response_id) que
  // siguen sin paciente asignado — son las candidatas a reparar acá
  const respuestasAReparar = await fetchAll('respuestas_formulario', 'id, created_at', (q) =>
    q.is('google_response_id', null).is('paciente_id', null),
  )
  // clave por epoch (ms), no por el string crudo — Postgres devuelve
  // "...+00:00" y Date#toISOString() da "...Z" (+ milisegundos siempre
  // presentes): mismo instante, string distinto, así que comparar texto
  // nunca matcheaba
  const porCreatedAt = new Map()
  for (const r of respuestasAReparar) {
    const key = new Date(r.created_at).getTime()
    if (!porCreatedAt.has(key)) porCreatedAt.set(key, [])
    porCreatedAt.get(key).push(r)
  }
  console.log(`${respuestasAReparar.length} respuesta(s) en Supabase sin paciente (lote histórico) a reparar.`)

  const paraActualizar = []
  const sinPacienteRef = []
  const pacienteRefNoEncontrado = []
  const nombreSinMatch = []
  const nombreAmbiguo = []
  const sinFechaValida = []
  const sinFilaEnSupabase = []
  const timestampAmbiguo = []

  for (const [i, fila] of formulariosRows.entries()) {
    const filaNum = i + 2
    const oldId = fila.PacienteRef
    if (!oldId) {
      sinPacienteRef.push(filaNum)
      continue
    }
    const nombre = nombrePorIdViejo.get(oldId)
    if (!nombre) {
      pacienteRefNoEncontrado.push({ fila: filaNum, oldId })
      continue
    }
    const candidatos = idsPorNombre.get(nombre.trim().toLowerCase()) ?? []
    if (candidatos.length === 0) {
      nombreSinMatch.push({ fila: filaNum, nombre })
      continue
    }
    if (candidatos.length > 1) {
      nombreAmbiguo.push({ fila: filaNum, nombre, candidatos })
      continue
    }

    const createdAt = fila['Marca temporal'] ? parseFechaArg(fila['Marca temporal']) : null
    if (!createdAt) {
      sinFechaValida.push({ fila: filaNum, marcaTemporal: fila['Marca temporal'] })
      continue
    }
    const enSupabase = porCreatedAt.get(new Date(createdAt).getTime()) ?? []
    if (enSupabase.length === 0) {
      // no es un problema en sí: puede ser una respuesta que ya tiene
      // paciente_id asignado (por el script de nombre, o a mano) o que no
      // es del lote histórico — no hace falta tocarla
      sinFilaEnSupabase.push({ fila: filaNum, createdAt })
      continue
    }
    if (enSupabase.length > 1) {
      timestampAmbiguo.push({ fila: filaNum, createdAt, respuestaIds: enSupabase.map((r) => r.id) })
      continue
    }
    paraActualizar.push({ respuestaId: enSupabase[0].id, pacienteId: candidatos[0], nombre })
  }

  console.log(`\nSe pueden actualizar: ${paraActualizar.length}`)
  console.log(`Sin PacienteRef en la fila: ${sinPacienteRef.length}`)
  console.log(`PacienteRef no encontrado en pacientes.tsv: ${pacienteRefNoEncontrado.length}`)
  console.log(`Nombre sin match en Supabase: ${nombreSinMatch.length}`)
  console.log(`Nombre ambiguo (>1 paciente con ese nombre): ${nombreAmbiguo.length}`)
  console.log(`"Marca temporal" no parseable: ${sinFechaValida.length}`)
  console.log(`Sin fila correspondiente pendiente en Supabase (ya asignada o no es del lote histórico): ${sinFilaEnSupabase.length}`)
  if (timestampAmbiguo.length > 0) {
    console.log(`⚠️  Timestamp con más de una respuesta en Supabase (no se adivina cuál): ${timestampAmbiguo.length}`)
    for (const t of timestampAmbiguo) console.log(`    - fila ${t.fila}, ${t.createdAt}: ${t.respuestaIds.join(', ')}`)
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada. Correr de nuevo con --commit para aplicar.')
    return
  }

  let actualizadas = 0
  for (const { respuestaId, pacienteId } of paraActualizar) {
    const { error } = await supabase.from('respuestas_formulario').update({ paciente_id: pacienteId }).eq('id', respuestaId)
    if (error) {
      console.error(`  respuesta ${respuestaId}: error al actualizar — ${error.message}`)
      continue
    }
    actualizadas += 1
  }
  console.log(`\nActualizadas: ${actualizadas} / ${paraActualizar.length}`)
}

main()
