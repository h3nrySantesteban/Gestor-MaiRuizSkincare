// One-off: "Limpieza Facial" no se cuenta como tratamiento aparte cuando el
// turno tiene además otro tratamiento — la limpieza es el paso previo de casi
// cualquier procedimiento (peeling, dermaplaning, etc.), no un ítem que Mai
// cobre o cuente por separado en ese caso. Solo queda como tratamiento propio
// cuando es lo único del turno.
//
// Este script borra la línea de "Limpieza Facial" de turno_tratamientos en
// todo turno que tenga esa línea Y al menos otra más. No toca ningún precio:
// ni turnos.precio (el ingreso real) ni el precio_aplicado de las otras
// líneas — solo elimina la fila redundante.
//
// Aplica a TODOS los turnos, sin importar estado ni fecha. Es re-ejecutable
// (si no queda nada por limpiar, no hace nada).
//
// El mismo criterio está incorporado en split-tratamientos-combinados.js
// (no reinserta "Limpieza Facial" al separar un combo), así que una
// re-migración limpia no necesita correr esto de nuevo — queda igual como
// red de seguridad para turnos cargados a mano desde la app.
//
// Uso:
//   node --env-file=.env.local scripts/quitar-limpieza-facial-de-combinados.js            (simulación)
//   node --env-file=.env.local scripts/quitar-limpieza-facial-de-combinados.js --commit   (escribe, re-ejecutable)

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

const NOMBRE_LIMPIEZA = 'Limpieza Facial'

async function main() {
  console.log(COMMIT ? '=== Quitar Limpieza Facial combinada: modo COMMIT ===' : '=== Quitar Limpieza Facial combinada: modo SIMULACIÓN ===')

  const { data: tratamientos, error: tratamientosError } = await supabase.from('tratamientos').select('id, nombre')
  if (tratamientosError) {
    console.error('No se pudo leer tratamientos:', tratamientosError.message)
    process.exit(1)
  }
  const limpieza = tratamientos.find((t) => t.nombre === NOMBRE_LIMPIEZA)
  if (!limpieza) {
    console.error(`No existe un tratamiento llamado "${NOMBRE_LIMPIEZA}" en el catálogo — abortando.`)
    process.exit(1)
  }

  // todas las líneas de todos los turnos, para saber cuántos tratamientos
  // tiene cada turno (el volumen de este negocio entra de sobra en memoria)
  const { data: lineas, error: lineasError } = await supabase
    .from('turno_tratamientos')
    .select('turno_id, tratamiento_id')
  if (lineasError) {
    console.error('No se pudo leer turno_tratamientos:', lineasError.message)
    process.exit(1)
  }

  const conteoPorTurno = new Map()
  for (const l of lineas) conteoPorTurno.set(l.turno_id, (conteoPorTurno.get(l.turno_id) ?? 0) + 1)

  const turnosAFixear = [
    ...new Set(
      lineas
        .filter((l) => l.tratamiento_id === limpieza.id && (conteoPorTurno.get(l.turno_id) ?? 0) > 1)
        .map((l) => l.turno_id),
    ),
  ]

  console.log(`\nTurnos con "${NOMBRE_LIMPIEZA}" + otro tratamiento: ${turnosAFixear.length}`)
  if (turnosAFixear.length === 0) {
    console.log('Nada para hacer.')
    return
  }

  if (COMMIT) {
    const { error } = await supabase
      .from('turno_tratamientos')
      .delete()
      .eq('tratamiento_id', limpieza.id)
      .in('turno_id', turnosAFixear)
    if (error) {
      console.error('Error al borrar las líneas de Limpieza Facial:', error.message)
      process.exit(1)
    }
    console.log(`Borradas ${turnosAFixear.length} línea(s) de "${NOMBRE_LIMPIEZA}".`)
  } else {
    console.log('\nEsto fue una simulación — no se escribió nada en Supabase. Correr de nuevo con --commit para aplicar.')
  }
}

main()
