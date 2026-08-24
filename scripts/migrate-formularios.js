// Migración one-off de las respuestas del Google Form (planilla vieja) a
// respuestas_formulario en Supabase.
//
// Uso:
//   1. Export la pestaña de respuestas del form vieja como TSV a
//      scripts/data/formularios.tsv (encabezados incluidos, copiar/pegar
//      directo desde Sheets ya da TSV). scripts/data/pacientes.tsv tiene que
//      seguir estando ahí — es lo que ya usó migrate-sheets.js — porque acá
//      se reusa para mapear PacienteRef (el id viejo) a un nombre, y de ahí
//      a un paciente ya migrado en Supabase por nombre_completo exacto.
//   2. Simulación (no escribe nada, solo reporta problemas):
//        node --env-file=.env.local scripts/migrate-formularios.js
//   3. Recién cuando el reporte esté limpio, correr de verdad:
//        node --env-file=.env.local scripts/migrate-formularios.js --commit
//
// Todo lo que no matchea un paciente (PacienteRef vacío, no encontrado en
// pacientes.tsv, o nombre sin match exacto / ambiguo en Supabase) igual se
// importa con paciente_id null — se asigna a mano después desde
// /formularios o el perfil del paciente, mismo espíritu que el resto de
// esta migración: nada se pierde en silencio.

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

// no son preguntas del form — PacienteRef es el id del paciente viejo,
// ImagenUser es un avatar decorativo de la UI vieja, Marca temporal se usa
// para created_at en vez de vivir dentro de respuestas. '' cubre columnas
// vacías al final de la fila (típico al pegar de Sheets con celdas de más).
const COLUMNAS_EXCLUIDAS = new Set(['PacienteRef', 'ImagenUser', 'Marca temporal', ''])

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
    // headers[i], no cells[i], como clave: dos columnas de más al final con
    // el mismo header vacío ('') solo deben quedar como un único par
    // pregunta/respuesta al armar respuestas, no perderse silenciosamente
    return headers.map((h, i) => [h, (cells[i] ?? '').trim()])
  })
}

// "22/04/2025 18:45:00" (hora Argentina, UTC-3 fijo) -> ISO en UTC — igual
// que en migrate-sheets.js
function parseFechaArg(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(s.trim())
  if (!m) return null
  const [, d, mo, y, hh, mm, ss] = m.map(Number)
  return new Date(Date.UTC(y, mo - 1, d, hh + 3, mm, ss ?? 0)).toISOString()
}

// El form repite preguntas literales (ej. "Cuál/es?" aparece 5 veces, una
// por cada antecedente sí/no) — un objeto keyed por texto de pregunta
// pisaría todas menos la última. Desambigua prefijando con la pregunta
// anterior ("Intervenciones quirúrgicas — Cuál/es?"), que es justo el
// contexto que le da sentido a esa respuesta puntual.
function buildRespuestasUnicas(pares) {
  const counts = new Map()
  for (const [pregunta] of pares) counts.set(pregunta, (counts.get(pregunta) ?? 0) + 1)

  const out = {}
  let anterior = null
  for (const [pregunta, respuesta] of pares) {
    const key = (counts.get(pregunta) ?? 0) > 1 && anterior ? `${anterior} — ${pregunta}` : pregunta
    out[key] = respuesta
    anterior = pregunta
  }
  return out
}

async function main() {
  console.log(COMMIT ? '=== Migración formularios: modo COMMIT ===' : '=== Migración formularios: modo SIMULACIÓN ===')

  const pacientesRows = parseTSV('pacientes.tsv').map((pares) => Object.fromEntries(pares))
  const formulariosRows = parseTSV('formularios.tsv')
  console.log(`Leídos: ${pacientesRows.length} pacientes (referencia), ${formulariosRows.length} respuestas de formulario`)

  // oldId (PacienteRef) -> nombre, sale de la misma planilla que ya usó
  // migrate-sheets.js para crear los pacientes actuales
  const nombrePorIdViejo = new Map()
  for (const r of pacientesRows) {
    if (r.IdPaciente && r.NombreApellidoPaciente) nombrePorIdViejo.set(r.IdPaciente, r.NombreApellidoPaciente)
  }

  // nombre (normalizado) -> [ids nuevos], para resolver por nombre exacto
  // contra los pacientes ya migrados en Supabase
  const { data: pacientesActuales, error: pacientesError } = await supabase.from('pacientes').select('id, nombre_completo')
  if (pacientesError) {
    console.error('No se pudo leer pacientes de Supabase:', pacientesError.message)
    process.exit(1)
  }
  const idsPorNombre = new Map()
  for (const p of pacientesActuales) {
    const key = p.nombre_completo.trim().toLowerCase()
    idsPorNombre.set(key, [...(idsPorNombre.get(key) ?? []), p.id])
  }

  let insertadas = 0
  let asignadas = 0

  for (const [i, pares] of formulariosRows.entries()) {
    const fila = Object.fromEntries(pares)
    const filaNum = i + 2 // +1 por índice base 1, +1 por la fila de encabezados

    const oldId = fila.PacienteRef
    let pacienteId = null

    if (!oldId) {
      reportIssue(`Fila ${filaNum}: sin PacienteRef — se importa sin asignar.`)
    } else {
      const nombre = nombrePorIdViejo.get(oldId)
      if (!nombre) {
        reportIssue(`Fila ${filaNum}: PacienteRef "${oldId}" no está en pacientes.tsv — se importa sin asignar.`)
      } else {
        const candidatos = idsPorNombre.get(nombre.trim().toLowerCase()) ?? []
        if (candidatos.length === 1) {
          pacienteId = candidatos[0]
        } else if (candidatos.length === 0) {
          reportIssue(`Fila ${filaNum}: "${nombre}" (PacienteRef ${oldId}) no matchea ningún paciente en Supabase por nombre — se importa sin asignar.`)
        } else {
          reportIssue(`Fila ${filaNum}: "${nombre}" (PacienteRef ${oldId}) matchea ${candidatos.length} pacientes con el mismo nombre — se importa sin asignar, asignar a mano.`)
        }
      }
    }

    const createdAt = fila['Marca temporal'] ? parseFechaArg(fila['Marca temporal']) : null
    if (fila['Marca temporal'] && !createdAt) {
      reportIssue(`Fila ${filaNum}: "Marca temporal" no se pudo parsear ("${fila['Marca temporal']}") — se importa con la fecha de hoy.`)
    }

    const paresRespuestas = pares.filter(([h]) => !COLUMNAS_EXCLUIDAS.has(h))
    const respuestas = buildRespuestasUnicas(paresRespuestas)

    if (COMMIT) {
      const { error: insertError } = await supabase.from('respuestas_formulario').insert({
        paciente_id: pacienteId,
        respuestas,
        ...(createdAt ? { created_at: createdAt } : {}),
      })
      if (insertError) {
        reportIssue(`Fila ${filaNum}: error al insertar — ${insertError.message}`)
        continue
      }
    }
    insertadas += 1
    if (pacienteId) asignadas += 1
  }

  console.log(`\nRespuestas procesadas: ${insertadas} / ${formulariosRows.length} (${asignadas} asignadas a un paciente, ${insertadas - asignadas} sin asignar)`)

  if (issues.length > 0) {
    console.log(`\n${issues.length} problema(s) encontrados:`)
    for (const i of issues) console.log(' - ' + i)
  } else {
    console.log('\nSin problemas detectados.')
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada en Supabase. Revisá el reporte y corré de nuevo con --commit cuando esté OK (las filas sin asignar se pueden resolver después desde /formularios, no hace falta que el reporte quede en cero).')
  }
}

main()
