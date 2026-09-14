// One-off: completa telefono/email de pacientes a partir de las respuestas
// de formulario ya vinculadas — hace falta porque
// vincular-formularios-por-nombre.js y relinkear-formularios-por-id.js
// solo setearon paciente_id directo contra Supabase, sin pasar por
// completarContactoDesdeFormulario (src/lib/formularioContacto.ts), que es
// lo que la app SÍ llama cuando Mai asigna una respuesta a mano desde
// /formularios. Este script aplica esa misma lógica, en lote, contra todo
// lo que ya quedó vinculado.
//
// Mismo criterio que completarContactoDesdeFormulario: NUNCA pisa un
// telefono/email que el paciente ya tenga cargado (a mano o de antes) —
// solo completa lo que está vacío. Si un paciente tiene más de una
// respuesta vinculada, se usa la primera que traiga un dato válido.
//
// Uso:
//   node --env-file=.env.local scripts/completar-contacto-desde-formularios.js            (simulación)
//   node --env-file=.env.local scripts/completar-contacto-desde-formularios.js --commit   (escribe, re-ejecutable)

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

// mismos campos/normalización que src/lib/formularioContacto.ts — hay que
// mantenerlos idénticos si ese archivo cambia
const CAMPO_TELEFONO = 'Teléfono'
const CAMPO_EMAIL = 'Dirección de correo electrónico'

function normalizarTelefonoArgentino(raw) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('549')) return digits.length === 13 ? digits : null
  if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 11 && digits.startsWith('9')) digits = digits.slice(1)
  return digits.length === 10 ? `549${digits}` : null
}

function contactoDesdeFormulario(respuestas) {
  const telefonoRaw = respuestas[CAMPO_TELEFONO]?.trim()
  const emailRaw = respuestas[CAMPO_EMAIL]?.trim()
  return {
    telefono: telefonoRaw ? normalizarTelefonoArgentino(telefonoRaw) : null,
    email: emailRaw || null,
  }
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
  console.log(COMMIT ? '=== Completar contacto desde formularios: modo COMMIT ===' : '=== Completar contacto desde formularios: modo SIMULACIÓN ===')

  const pacientes = await fetchAll('pacientes', 'id, nombre_completo, telefono, email')
  const pacientesPorId = new Map(pacientes.map((p) => [p.id, p]))

  const respuestas = await fetchAll('respuestas_formulario', 'id, paciente_id, respuestas', (q) => q.not('paciente_id', 'is', null))
  console.log(`${respuestas.length} respuesta(s) vinculadas a un paciente, ${pacientes.length} pacientes en el catálogo.`)

  // acumula por paciente el primer telefono/email válido que aparezca entre
  // sus respuestas — no pisa lo que ya tenga cargado
  const completarPorPaciente = new Map() // pacienteId -> { telefono, email }
  for (const r of respuestas) {
    const paciente = pacientesPorId.get(r.paciente_id)
    if (!paciente) continue // no debería pasar, pero por las dudas
    const contacto = contactoDesdeFormulario(r.respuestas ?? {})
    const actual = completarPorPaciente.get(r.paciente_id) ?? { telefono: null, email: null }
    if (!paciente.telefono && !actual.telefono && contacto.telefono) actual.telefono = contacto.telefono
    if (!paciente.email && !actual.email && contacto.email) actual.email = contacto.email
    completarPorPaciente.set(r.paciente_id, actual)
  }

  let conTelefonoNuevo = 0
  let conEmailNuevo = 0
  const cambios = []
  for (const [pacienteId, { telefono, email }] of completarPorPaciente) {
    if (!telefono && !email) continue
    const paciente = pacientesPorId.get(pacienteId)
    cambios.push({ pacienteId, nombre: paciente.nombre_completo, telefono, email })
    if (telefono) conTelefonoNuevo += 1
    if (email) conEmailNuevo += 1
  }

  console.log(`\nPacientes a completar: ${cambios.length} (${conTelefonoNuevo} con teléfono nuevo, ${conEmailNuevo} con email nuevo)`)
  for (const c of cambios) {
    const partes = []
    if (c.telefono) partes.push(`telefono -> ${c.telefono}`)
    if (c.email) partes.push(`email -> ${c.email}`)
    console.log(`  - ${c.nombre}: ${partes.join(', ')}`)
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada. Correr de nuevo con --commit para aplicar.')
    return
  }

  let actualizados = 0
  for (const c of cambios) {
    const update = {}
    if (c.telefono) update.telefono = c.telefono
    if (c.email) update.email = c.email
    const { error } = await supabase.from('pacientes').update(update).eq('id', c.pacienteId)
    if (error) {
      console.error(`  ${c.nombre}: error al actualizar — ${error.message}`)
      continue
    }
    actualizados += 1
  }
  console.log(`\nActualizados: ${actualizados} / ${cambios.length}`)
}

main()
