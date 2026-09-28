// One-off: completa el mail que faltó en respuestas_formulario para las
// respuestas afectadas por el bug de enviarRespuestaAlWebhook (Apps Script
// atado al Google Form) — ese script solo leía e.response.getItemResponses(),
// que no incluye el mail cuando el Form lo recolecta con su función nativa
// "Recopilar direcciones de correo electrónico" en modo verificado (ahí
// Google lo entrega aparte, en e.response.getRespondentEmail()). Ya se
// corrigió el script para leer también esa función, pero deja huérfanas las
// respuestas que ya habían llegado sin la clave "Dirección de correo
// electrónico" en el jsonb (no vacía: directamente ausente).
//
// El mail real de esas respuestas se saca aparte, a mano, corriendo una vez
// esta función en el editor de Apps Script del Form:
//
//   function backfillEmailsFaltantes() {
//     const idsFaltantes = [ ...pegar los google_response_id de abajo... ]
//     const idsSet = new Set(idsFaltantes)
//     const resultado = {}
//     FormApp.getActiveForm().getResponses().forEach(function (r) {
//       const id = r.getId()
//       if (idsSet.has(id)) resultado[id] = r.getRespondentEmail() || null
//     })
//     Logger.log(JSON.stringify(resultado, null, 2))
//   }
//
// y pegando el JSON que imprime (Ver > Registros) en EMAILS_POR_RESPUESTA
// más abajo, antes de correr esto.
//
// Dos cosas en un solo paso, mismo criterio que
// src/lib/formularioContacto.ts:
//   1) agrega la clave de email al jsonb de respuestas_formulario, para que
//      /formularios deje de mostrar un hueco ahí.
//   2) completa pacientes.email SOLO si el paciente todavía no tiene uno
//      cargado — nunca pisa un email ya cargado a mano.
//
// Uso:
//   node --env-file=.env.local scripts/backfill-email-nativo.js            (simulación)
//   node --env-file=.env.local scripts/backfill-email-nativo.js --commit   (escribe)

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

const CAMPO_EMAIL = 'Dirección de correo electrónico'

// Ya se corrió y aplicó contra Supabase el 2026-09-28 (23 respuestas, 19
// pacientes completados) — el mapeo real (con mails de pacientes en texto
// plano) se vació después a propósito para no dejar PII de pacientes
// permanentemente en el repo/historia de git. Si hace falta re-correr esto
// para un caso nuevo, pegar de nuevo acá el JSON de
// backfillEmailsFaltantes() (Apps Script) — ver el bloque de comentarios de
// arriba — y NO commitear con los valores reales adentro: correr, confirmar
// con --commit, y recién ahí vaciar el objeto de vuelta antes de commitear.
const EMAILS_POR_RESPUESTA = {}

async function main() {
  console.log(COMMIT ? '=== Backfill email nativo: modo COMMIT ===' : '=== Backfill email nativo: modo SIMULACIÓN ===')

  const ids = Object.keys(EMAILS_POR_RESPUESTA)
  if (ids.length === 0) {
    console.error('EMAILS_POR_RESPUESTA está vacío — pegar el resultado de backfillEmailsFaltantes() antes de correr esto.')
    process.exit(1)
  }

  const { data: respuestas, error: respuestasError } = await supabase
    .from('respuestas_formulario')
    .select('id, google_response_id, paciente_id, respuestas')
    .in('google_response_id', ids)
  if (respuestasError) {
    console.error('No se pudo leer respuestas_formulario:', respuestasError.message)
    process.exit(1)
  }

  const { data: pacientes, error: pacientesError } = await supabase.from('pacientes').select('id, nombre_completo, email')
  if (pacientesError) {
    console.error('No se pudo leer pacientes:', pacientesError.message)
    process.exit(1)
  }
  const pacientePorId = new Map(pacientes.map((p) => [p.id, p]))

  let respuestasActualizadas = 0
  let pacientesActualizados = 0
  let sinEmail = 0
  let noEncontradas = 0

  for (const googleResponseId of ids) {
    const email = EMAILS_POR_RESPUESTA[googleResponseId]?.trim() || null
    const respuesta = respuestas.find((r) => r.google_response_id === googleResponseId)
    if (!respuesta) {
      console.log(`⚠️  ${googleResponseId}: no se encontró en respuestas_formulario (¿ya se resolvió o cambió?)`)
      noEncontradas += 1
      continue
    }
    if (!email) {
      console.log(`⚠️  ${googleResponseId}: sin email en Apps Script tampoco (getRespondentEmail() vacío) — revisar a mano`)
      sinEmail += 1
      continue
    }
    if (respuesta.respuestas?.[CAMPO_EMAIL]) {
      console.log(`- ${googleResponseId}: ya tiene email en respuestas_formulario, no se toca`)
      continue
    }

    const paciente = respuesta.paciente_id ? pacientePorId.get(respuesta.paciente_id) : null
    const tocaPaciente = paciente && !paciente.email
    console.log(`${paciente?.nombre_completo ?? '(sin paciente asignado)'}: agregar email "${email}" a la respuesta${tocaPaciente ? ' y al paciente' : ''}`)

    if (COMMIT) {
      const nuevasRespuestas = { ...respuesta.respuestas, [CAMPO_EMAIL]: email }
      const { error: updateRespuestaError } = await supabase
        .from('respuestas_formulario')
        .update({ respuestas: nuevasRespuestas })
        .eq('id', respuesta.id)
      if (updateRespuestaError) {
        console.error(`  error al actualizar respuesta ${respuesta.id}: ${updateRespuestaError.message}`)
        continue
      }
      respuestasActualizadas += 1

      if (tocaPaciente) {
        const { error: updatePacienteError } = await supabase.from('pacientes').update({ email }).eq('id', paciente.id)
        if (updatePacienteError) {
          console.error(`  error al actualizar paciente ${paciente.nombre_completo}: ${updatePacienteError.message}`)
          continue
        }
        paciente.email = email // evita duplicar si dos respuestas apuntan al mismo paciente
        pacientesActualizados += 1
      }
    } else {
      respuestasActualizadas += 1
      if (tocaPaciente) pacientesActualizados += 1
    }
  }

  console.log(`\nRespuestas a completar: ${respuestasActualizadas} — pacientes a completar: ${pacientesActualizados} — sin email en Apps Script: ${sinEmail} — no encontradas: ${noEncontradas}`)

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se escribió nada. Correr de nuevo con --commit para aplicar.')
  }
}

main()
