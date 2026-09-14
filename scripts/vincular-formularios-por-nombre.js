// One-off: re-vincula respuestas_formulario a pacientes por nombre.
//
// Contexto: reset-migracion.js desvincula respuestas_formulario.paciente_id
// antes de borrar pacientes (esa FK no tiene cascade/set null) — después de
// re-migrar, los pacientes tienen id nuevo y quedan 215+ respuestas
// "sin asignar" que Mai ya había matcheado a mano antes. Este script
// recupera automáticamente los casos donde el nombre de la respuesta
// (pregunta "Nombre y apellido" del form, ver CAMPO_NOMBRE en
// Formularios.tsx) coincide con el nombre de un paciente ya migrado.
//
// Solo toca respuestas con paciente_id null — nunca pisa un match que ya
// esté cargado (a mano o de una corrida anterior de este mismo script).
// El match es por nombre normalizado (sin tildes, mayúsculas/espacios de
// más) pero EXACTO — no aproximado/difuso: dos nombres parecidos pero
// distintos no se linkean solos, eso arriesga mezclar a dos pacientes.
//
// Casos que se reportan pero NO se tocan (piden revisión manual, ver
// Formularios.tsx / la pantalla de Pacientes):
//   - Respuesta sin la pregunta "Nombre y apellido" respondida.
//   - Nombre que no matchea ningún paciente.
//   - Nombre que matchea MÁS DE UN paciente (nombres repetidos en el
//     catálogo) — no se adivina cuál es, mejor asignarlo a mano.
//
// Uso:
//   node --env-file=.env.local scripts/vincular-formularios-por-nombre.js            (simulación)
//   node --env-file=.env.local scripts/vincular-formularios-por-nombre.js --commit   (escribe, re-ejecutable)

import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — correr con --env-file=.env.local')
  process.exit(1)
}
globalThis.WebSocket ??= class {}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// misma pregunta que usa Formularios.tsx (CAMPO_NOMBRE) para mostrar el
// nombre de cada respuesta
const CAMPO_NOMBRE = 'Nombre y apellido'

function normalizar(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes/diacríticos
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

async function fetchAll(table, select) {
  const rows = []
  let from = 0
  const PAGE_SIZE = 1000
  for (;;) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
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
  console.log(COMMIT ? '=== Vincular formularios por nombre: modo COMMIT ===' : '=== Vincular formularios por nombre: modo SIMULACIÓN ===')

  const pacientes = await fetchAll('pacientes', 'id, nombre_completo')
  const todas = await fetchAll('respuestas_formulario', 'id, paciente_id, respuestas')
  const sinAsignar = todas.filter((r) => r.paciente_id === null)

  // nombre normalizado -> lista de pacientes con ese nombre (para detectar ambigüedad)
  const pacientesPorNombre = new Map()
  for (const p of pacientes) {
    const key = normalizar(p.nombre_completo)
    if (!pacientesPorNombre.has(key)) pacientesPorNombre.set(key, [])
    pacientesPorNombre.get(key).push(p)
  }

  console.log(`\n${sinAsignar.length} respuesta(s) sin asignar de ${todas.length} totales. ${pacientes.length} pacientes en el catálogo.`)

  const paraVincular = []
  const sinNombre = []
  const sinMatch = []
  const ambiguas = []

  for (const r of sinAsignar) {
    const nombreRaw = r.respuestas?.[CAMPO_NOMBRE]?.trim()
    if (!nombreRaw) {
      sinNombre.push(r)
      continue
    }
    const candidatos = pacientesPorNombre.get(normalizar(nombreRaw)) ?? []
    if (candidatos.length === 0) {
      sinMatch.push({ id: r.id, nombre: nombreRaw })
    } else if (candidatos.length > 1) {
      ambiguas.push({ id: r.id, nombre: nombreRaw, pacientes: candidatos })
    } else {
      paraVincular.push({ respuestaId: r.id, nombre: nombreRaw, pacienteId: candidatos[0].id })
    }
  }

  console.log(`\nSe pueden vincular: ${paraVincular.length}`)
  console.log(`Sin la pregunta "${CAMPO_NOMBRE}" respondida: ${sinNombre.length}`)
  console.log(`Sin ningún paciente con ese nombre: ${sinMatch.length}`)
  if (sinMatch.length > 0) {
    console.log('  (nombres, para revisar a mano si hace falta):')
    for (const s of sinMatch) console.log(`    - "${s.nombre}" (respuesta ${s.id})`)
  }
  console.log(`Ambiguas (más de un paciente con ese nombre — no se adivina cuál): ${ambiguas.length}`)
  if (ambiguas.length > 0) {
    for (const a of ambiguas) {
      console.log(`    - "${a.nombre}" (respuesta ${a.id}) matchea ${a.pacientes.length} pacientes: ${a.pacientes.map((p) => p.id).join(', ')}`)
    }
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada. Correr de nuevo con --commit para aplicar.')
    return
  }

  let vinculadas = 0
  for (const { respuestaId, pacienteId } of paraVincular) {
    const { error } = await supabase.from('respuestas_formulario').update({ paciente_id: pacienteId }).eq('id', respuestaId)
    if (error) {
      console.error(`  respuesta ${respuestaId}: error al vincular — ${error.message}`)
      continue
    }
    vinculadas += 1
  }
  console.log(`\nVinculadas: ${vinculadas} / ${paraVincular.length}`)
}

main()
