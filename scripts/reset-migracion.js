// One-off: borra turnos + pacientes + tratamientos para volver a correr
// migrate-sheets.js (y después split-tratamientos-combinados.js) desde cero,
// sin quedar con datos duplicados de una corrida anterior.
//
// Alcance — SOLO estas 3 tablas (lo que migrate-sheets.js repuebla):
//   - turnos (turno_tratamientos cascadea solo)
//   - pacientes
//   - tratamientos
// NO toca gastos, ingresos_extra, notificaciones "resumen" (turno_id null,
// ej. turnos_sin_tratamiento/formulario_nuevo), google_calendar_conexion ni
// respuestas_formulario — nada de eso lo repuebla la migración, así que no
// tiene sentido borrarlo acá.
//
// Antes de borrar, reporta (siempre, incluso en simulación):
//   1. Turnos/pacientes cuyo created_at es POSTERIOR a la migración masiva
//      (heurística: creados en los últimos N días antes de correr esto) —
//      son los que se cargaron a mano después y NO están en la planilla
//      vieja; se pierden si no los anotás para recargarlos aparte.
//   2. Turnos con google_event_id (ya sincronizados a Google Calendar) —
//      borrarlos acá NO borra el evento real del calendario de Mai, queda
//      huérfano. Bórralos a mano ahí si te importa, esto no lo hace.
//
// notificaciones.turno_id es "on delete cascade" — el historial de
// notificaciones de esos turnos (confirmado/cancelado/etc.) se pierde junto
// con ellos, es esperado.
//
// Orden de borrado (obligatorio por las foreign keys):
//   turnos (turno_tratamientos cascadea) -> pacientes -> tratamientos
//   (pacientes.id tiene "on delete restrict" desde turnos.paciente_id, así
//   que no se puede borrar un paciente mientras le queden turnos)
//
// Uso:
//   node --env-file=.env.local scripts/reset-migracion.js                                 (simulación — solo reporta)
//   node --env-file=.env.local scripts/reset-migracion.js --commit --confirmo-borrado-total (borra de verdad)
//
// Requiere las dos flags juntas a propósito — un "--commit" solo, tipeado
// de apuro, no alcanza para esto.

import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit') && process.argv.includes('--confirmo-borrado-total')
const SOLO_COMMIT_SIN_CONFIRMAR = process.argv.includes('--commit') && !process.argv.includes('--confirmo-borrado-total')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — correr con --env-file=.env.local')
  process.exit(1)
}
if (SOLO_COMMIT_SIN_CONFIRMAR) {
  console.error('Falta --confirmo-borrado-total junto con --commit — no se borra nada así nomás.')
  process.exit(1)
}
globalThis.WebSocket ??= class {}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// heurística: cualquier fila creada después de este momento se reporta como
// "posiblemente cargada a mano, no viene de la migración" — ajustá la fecha
// si tu última corrida de migrate-sheets.js fue en otra.
const CORTE_MIGRACION_MASIVA = '2026-08-22T00:00:00Z'

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
  console.log(COMMIT ? '=== Reset migración: modo COMMIT (va a borrar de verdad) ===' : '=== Reset migración: modo SIMULACIÓN (no borra nada) ===')

  const turnos = await fetchAll('turnos', 'id, created_at, fecha, estado, precio, paciente_id, google_event_id')
  const pacientes = await fetchAll('pacientes', 'id, nombre_completo, created_at')
  const tratamientos = await fetchAll('tratamientos', 'id, nombre')

  console.log(`\nA borrar: ${turnos.length} turnos, ${pacientes.length} pacientes, ${tratamientos.length} tratamientos`)

  // ---------- aviso 1: filas posiblemente cargadas a mano después de la migración ----------
  const turnosSospechosos = turnos.filter((t) => t.created_at > CORTE_MIGRACION_MASIVA)
  const pacientesSospechosos = pacientes.filter((p) => p.created_at > CORTE_MIGRACION_MASIVA)
  if (turnosSospechosos.length > 0 || pacientesSospechosos.length > 0) {
    console.log(`\n⚠️  ${turnosSospechosos.length} turno(s) y ${pacientesSospechosos.length} paciente(s) con created_at posterior a ${CORTE_MIGRACION_MASIVA}:`)
    console.log('   (no vienen de la planilla vieja — anotalos para recargarlos a mano si hace falta)')
    for (const t of turnosSospechosos) {
      console.log(`   - turno ${t.id}: creado ${t.created_at}, fecha ${t.fecha}, ${t.estado}, $${t.precio}, paciente_id ${t.paciente_id}`)
    }
    for (const p of pacientesSospechosos) {
      console.log(`   - paciente ${p.id}: "${p.nombre_completo}", creado ${p.created_at}`)
    }
  }

  // ---------- aviso 2: turnos ya sincronizados a Google Calendar ----------
  const turnosConCalendar = turnos.filter((t) => t.google_event_id)
  if (turnosConCalendar.length > 0) {
    console.log(`\n⚠️  ${turnosConCalendar.length} turno(s) con evento en Google Calendar — al borrarlos acá, el evento real NO se borra del calendario de Mai (queda huérfano).`)
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se borró nada. Correr con --commit --confirmo-borrado-total para borrar de verdad.')
    return
  }

  // ---------- borrado, en el orden que exigen las foreign keys ----------
  console.log('\nBorrando turnos (turno_tratamientos y notificaciones asociadas cascadean solas)...')
  const { error: turnosError } = await supabase.from('turnos').delete().not('id', 'is', null)
  if (turnosError) {
    console.error('Error borrando turnos:', turnosError.message)
    process.exit(1)
  }

  console.log('Borrando pacientes...')
  const { error: pacientesError } = await supabase.from('pacientes').delete().not('id', 'is', null)
  if (pacientesError) {
    console.error('Error borrando pacientes:', pacientesError.message)
    process.exit(1)
  }

  console.log('Borrando tratamientos...')
  const { error: tratamientosError } = await supabase.from('tratamientos').delete().not('id', 'is', null)
  if (tratamientosError) {
    console.error('Error borrando tratamientos:', tratamientosError.message)
    process.exit(1)
  }

  console.log('\nListo — turnos, pacientes y tratamientos borrados. Ahora podés correr migrate-sheets.js --commit.')
}

main()
