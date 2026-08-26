// One-off: la app vieja solo permitía UN tratamiento por turno, así que
// combinaciones frecuentes se cargaban como un solo tratamiento de catálogo
// con nombre concatenado (ej. "Limpieza + Peeling"). Ahora que un turno
// soporta varios tratamientos de verdad (turno_tratamientos), esos combos
// son redundantes y ensucian el catálogo y el ranking de "Top tratamientos"
// de Analytics (todo el ingreso del turno queda atribuido a un tratamiento
// falso en vez de a los reales).
//
// Este script:
//   1. Crea los tratamientos individuales que todavía no existen en el
//      catálogo (Peeling, Dermaplaning, Exosomas, Retinoico — precio $0,
//      Mai lo ajusta después desde la pantalla de Tratamientos).
//   2. Por cada turno que tenía un combo asignado, borra esa línea de
//      turno_tratamientos y la reemplaza por una línea por cada componente
//      real, repartiendo el precio_aplicado original en partes iguales
//      (no afecta turno.precio, que es lo que cuenta como ingreso).
//   3. Borra los 8 tratamientos-combo del catálogo (turno_tratamientos.tratamiento_id
//      es "on delete restrict", así que recién se puede borrar cuando ya no
//      los referencia ningún turno).
//
// Uso:
//   node --env-file=.env.local scripts/split-tratamientos-combinados.js            (simulación)
//   node --env-file=.env.local scripts/split-tratamientos-combinados.js --commit   (escribe, una sola vez)

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

// tratamientos individuales que hacen falta y todavía no existen en el catálogo
const NUEVOS_TRATAMIENTOS = ['Peeling', 'Dermaplaning', 'Exosomas', 'Retinoico']

// combo (nombre exacto en el catálogo) -> componentes reales (nombres exactos,
// ya sea existentes o de NUEVOS_TRATAMIENTOS de arriba)
const MAPEO_COMBOS = {
  'Limpieza + Peeling': ['Limpieza Facial', 'Peeling'],
  'Limpieza + peeling + dermaplaning': ['Limpieza Facial', 'Peeling', 'Dermaplaning'],
  'Limpieza + dermaplaning + dermapen': ['Limpieza Facial', 'Dermaplaning', 'DermaPen'],
  'Limpieza + dermaplaning + radiofrecuencia': ['Limpieza Facial', 'Dermaplaning', 'Radio Frecuencia'],
  'Limpieza + dermaplaning': ['Limpieza Facial', 'Dermaplaning'],
  'Glowing Skin + dermaplaning': ['Glowing Skin', 'Dermaplaning'],
  'Dermaplaning + exosomas': ['Dermaplaning', 'Exosomas'],
  'Limpieza + peeling + retinoico': ['Limpieza Facial', 'Peeling', 'Retinoico'],
}

async function main() {
  console.log(COMMIT ? '=== Split combos: modo COMMIT ===' : '=== Split combos: modo SIMULACIÓN ===')

  const { data: tratamientos, error: tratamientosError } = await supabase.from('tratamientos').select('id, nombre')
  if (tratamientosError) {
    console.error('No se pudo leer tratamientos:', tratamientosError.message)
    process.exit(1)
  }
  const idPorNombre = new Map(tratamientos.map((t) => [t.nombre, t.id]))

  // ---------- paso 1: crear los tratamientos que faltan ----------
  for (const nombre of NUEVOS_TRATAMIENTOS) {
    if (idPorNombre.has(nombre)) continue
    console.log(`Crear tratamiento: "${nombre}" ($0)`)
    if (COMMIT) {
      const { data, error } = await supabase.from('tratamientos').insert({ nombre, precio: 0 }).select('id').single()
      if (error) {
        console.error(`  error al crear "${nombre}": ${error.message}`)
        process.exit(1)
      }
      idPorNombre.set(nombre, data.id)
    } else {
      idPorNombre.set(nombre, `<simulado:${nombre}>`)
    }
  }

  // valida que todos los componentes del mapeo existan (ya sea de antes o recién creados)
  for (const [combo, componentes] of Object.entries(MAPEO_COMBOS)) {
    for (const c of componentes) {
      if (!idPorNombre.has(c)) {
        console.error(`Componente "${c}" (del combo "${combo}") no existe en el catálogo — abortando.`)
        process.exit(1)
      }
    }
  }

  // ---------- paso 2: reemplazar cada línea de combo por sus componentes ----------
  let turnosResueltos = 0
  let lineasSalteadasPorDuplicado = 0

  for (const [comboNombre, componentes] of Object.entries(MAPEO_COMBOS)) {
    const comboId = idPorNombre.get(comboNombre)
    if (!comboId || comboId.startsWith?.('<simulado')) {
      // el combo en sí ya existe siempre (viene del catálogo real), esto
      // solo puede pasar si el nombre no matcheó — lo reportamos y seguimos
      console.error(`No se encontró el tratamiento-combo "${comboNombre}" en el catálogo — se salteó.`)
      continue
    }

    const { data: lineas, error: lineasError } = await supabase
      .from('turno_tratamientos')
      .select('turno_id, precio_aplicado')
      .eq('tratamiento_id', comboId)
    if (lineasError) {
      console.error(`No se pudo leer turno_tratamientos de "${comboNombre}": ${lineasError.message}`)
      continue
    }

    console.log(`\n${comboNombre}: ${lineas.length} turno(s) -> [${componentes.join(', ')}]`)

    for (const linea of lineas) {
      const componenteIds = componentes.map((c) => idPorNombre.get(c))
      const precioBase = Math.round(linea.precio_aplicado / componentes.length)

      // evita el choque de PK (turno_id, tratamiento_id): si el turno ya
      // tenía por separado alguno de estos componentes cargado, no se
      // duplica esa línea — el combo igual se borra
      const { data: existentes } = await supabase
        .from('turno_tratamientos')
        .select('tratamiento_id')
        .eq('turno_id', linea.turno_id)
        .in('tratamiento_id', componenteIds)
      const yaPresentes = new Set((existentes ?? []).map((r) => r.tratamiento_id))

      const nuevasLineas = componenteIds
        .filter((id) => !yaPresentes.has(id))
        .map((id) => ({ turno_id: linea.turno_id, tratamiento_id: id, precio_aplicado: precioBase }))
      lineasSalteadasPorDuplicado += componenteIds.length - nuevasLineas.length

      if (COMMIT) {
        const { error: deleteError } = await supabase
          .from('turno_tratamientos')
          .delete()
          .eq('turno_id', linea.turno_id)
          .eq('tratamiento_id', comboId)
        if (deleteError) {
          console.error(`  turno ${linea.turno_id}: error al borrar la línea del combo — ${deleteError.message}`)
          continue
        }
        if (nuevasLineas.length > 0) {
          const { error: insertError } = await supabase.from('turno_tratamientos').insert(nuevasLineas)
          if (insertError) {
            console.error(`  turno ${linea.turno_id}: error al insertar componentes — ${insertError.message}`)
            continue
          }
        }
      }
      turnosResueltos += 1
    }
  }

  console.log(`\nLíneas de combo resueltas: ${turnosResueltos}`)
  if (lineasSalteadasPorDuplicado > 0) {
    console.log(`Componentes no insertados por ya estar presentes en ese turno: ${lineasSalteadasPorDuplicado}`)
  }

  // ---------- paso 3: borrar los tratamientos-combo del catálogo ----------
  console.log('\nBorrar del catálogo:')
  for (const comboNombre of Object.keys(MAPEO_COMBOS)) {
    const comboId = idPorNombre.get(comboNombre)
    console.log(`  ${comboNombre}`)
    if (COMMIT && comboId) {
      const { error } = await supabase.from('tratamientos').delete().eq('id', comboId)
      if (error) console.error(`    error al borrar "${comboNombre}": ${error.message}`)
    }
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada en Supabase. Correr de nuevo con --commit para aplicar.')
  }
}

main()
