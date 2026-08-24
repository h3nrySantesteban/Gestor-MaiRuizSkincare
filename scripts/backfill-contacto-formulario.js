// One-off: completa teléfono/email en pacientes que ya tienen un formulario
// asignado (los 213 que la migración de respuestas_formulario asignó
// directo en la base, sin pasar por el flujo nuevo de
// src/lib/formularioContacto.ts que hace esto mismo al asignar desde la UI
// de ahora en más). Mismo criterio: solo completa lo que esté vacío, nunca
// pisa un teléfono/email que el paciente ya tenía cargado.
//
// Uso:
//   node --env-file=.env.local scripts/backfill-contacto-formulario.js            (simulación)
//   node --env-file=.env.local scripts/backfill-contacto-formulario.js --commit   (escribe)

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

const CAMPO_TELEFONO = 'Teléfono'
const CAMPO_EMAIL = 'Dirección de correo electrónico'

// mismo criterio que src/lib/formularioContacto.ts: el form da el teléfono
// en formato local, pero variable — sin nada, con el 0 de área a la vieja
// usanza ("03415100880"), o con el 9 de celular ("93416611332"). Si después
// de sacar esos prefijos no quedan justo 10 dígitos, el número está
// incompleto o mal tipeado — mejor no adivinar que guardar algo que no sirve.
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

async function main() {
  console.log(COMMIT ? '=== Backfill contacto: modo COMMIT ===' : '=== Backfill contacto: modo SIMULACIÓN ===')

  const { data: respuestas, error: respuestasError } = await supabase
    .from('respuestas_formulario')
    .select('id, paciente_id, respuestas')
    .not('paciente_id', 'is', null)
  if (respuestasError) {
    console.error('No se pudo leer respuestas_formulario:', respuestasError.message)
    process.exit(1)
  }

  const { data: pacientes, error: pacientesError } = await supabase.from('pacientes').select('id, nombre_completo, telefono, email')
  if (pacientesError) {
    console.error('No se pudo leer pacientes:', pacientesError.message)
    process.exit(1)
  }
  const pacientePorId = new Map(pacientes.map((p) => [p.id, p]))

  let actualizados = 0
  let sinCambios = 0
  let telefonosCompletados = 0
  let emailsCompletados = 0

  for (const r of respuestas) {
    const paciente = pacientePorId.get(r.paciente_id)
    if (!paciente) continue // no debería pasar, pero no es motivo para frenar el resto

    const contacto = contactoDesdeFormulario(r.respuestas ?? {})
    const telefono = paciente.telefono ?? contacto.telefono
    const email = paciente.email ?? contacto.email

    if (telefono === paciente.telefono && email === paciente.email) {
      sinCambios += 1
      continue
    }

    const cambios = []
    if (telefono !== paciente.telefono) {
      cambios.push(`teléfono: "${paciente.telefono ?? ''}" -> "${telefono}"`)
      telefonosCompletados += 1
    }
    if (email !== paciente.email) {
      cambios.push(`email: "${paciente.email ?? ''}" -> "${email}"`)
      emailsCompletados += 1
    }
    console.log(`${paciente.nombre_completo}: ${cambios.join(', ')}`)

    if (COMMIT) {
      const { error: updateError } = await supabase.from('pacientes').update({ telefono, email }).eq('id', paciente.id)
      if (updateError) {
        console.error(`  error al actualizar ${paciente.nombre_completo}: ${updateError.message}`)
        continue
      }
      // evita procesar dos veces si el mismo paciente tiene más de un formulario asignado
      paciente.telefono = telefono
      paciente.email = email
    }
    actualizados += 1
  }

  console.log(`\nPacientes con formulario asignado: ${respuestas.length}`)
  console.log(`Actualizados: ${actualizados} (${telefonosCompletados} teléfonos, ${emailsCompletados} emails) — sin cambios: ${sinCambios}`)

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada en Supabase. Correr de nuevo con --commit para aplicar.')
  }
}

main()
