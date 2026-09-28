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

// Pegar acá el JSON que imprimió backfillEmailsFaltantes() en Apps Script:
// { "<google_response_id>": "<email o null>", ... }
const EMAILS_POR_RESPUESTA = {
  '2_ABaOnufLDRO2FUYnt52j5S9jyfQ2CanC8soC11ztkgmrT8enKC4eORUWxpL-fhYv6qsAdmc': 'brendaaguilera161@gmail.com',
  '2_ABaOnufdnqJDkgUEs2Ze05sZNoIJ9OvgJefgGbgD0hfaBPZHuIfZcsiWygB6gNtbl2qIdnw': 'noguesmariana@gmail.com',
  '2_ABaOnud5GY3AUMdFiVw2fpy-6AOoDvtQbXge1aFfPOFY43Pa5KIh2uM8tsI21diUDSk-b4U': 'lorenacardozonatalia9@gmail.com',
  '2_ABaOnucKMwCn8jIRd2m7RmnCF22p7HvneMGFKuHe-rZPz7i_Enjxr2wBn6UoPgfyVVhGRcc': 'fernandaleguizamon.fl@gmail.com',
  '2_ABaOnufASa-Ui2KPmmPC9xrpXiBNenhUXzPkHeVU8UpZtKzHf-dPZuu3VzShezMWTMRtzlU': 'dia.algacibiurguadalupe@gmail.com',
  '2_ABaOnufCb46ci2YdJ5D7byDAJyrrk0sxjG3qpUUU6RY0mQYcFQCedlOzzYoMzF37Yg4oMMU': 'camila.m.puentes@gmail.com',
  '2_ABaOnueM27NJ1Ax22L3L4r_L8Q-U98gczSj5kSHn8TzS-IXgwQ-I9j5SQlcP6Idat3aCLmk': 'ca.suarez06@gmail.com',
  '2_ABaOnufFyEiMZinzvyTdv0fH2ye47ZPeu8SIHwT8Ap3z5tiUJ4XoQpwoY4Abkrn6Ndatl0o': 'valentinescoda1@gmail.com',
  '2_ABaOnufisdVLK9EMhprWjUgLOQI-wdr2au_o_Rp9PHwUx8LejshYpIDwNgejQh-fcMUoL5U': 'avrilmacosta74@gmail.com',
  '2_ABaOnudTYBZHDFx0IIxs2r3jRgyR0yEeQty_5ML-g1lWyZry-gNCm886qmQg6GnaotIvZCk': 'delfifernandez09@gmail.com',
  '2_ABaOnucJbcb8expxHMeE0-2LO3CpX-YIdgSrmXDhqmhu9SML9noDAu2_jweExTOVYi7NqIg': 'agustinafernandez131@gmail.com',
  '2_ABaOnucMgV4FavZDEh4jOG0QzIAfEd-TbA2xlNHa9yHBD3pCyWmju_IHa0Maa8E-uzvSkk8': 'agos.gomez2710@gmail.com',
  '2_ABaOnuexLcrDhHkIJJ50JMnyaJYQbbFrWQKf78dPxuE0NQkphAK1S2h1grifAukhat5NUHI': 'victoriasilberok@gmail.com',
  '2_ABaOnud_cBFmRoXlr3hC7aiZqsUpIYioJNyw00RUmS704GYcF3ni6dOGPkFby2NhAyWgmyA': 'valeriamartini.rc1979@gmail.com',
  '2_ABaOnufX4-EWxFTHJSJFhHVj9fP9On6PCKQzml3VwLvSJgD3r-ImKUhSElsWDDmxmQfpUHk': 'camila.ferrini2@gmail.com',
  '2_ABaOnueybBSZy2ccRu6Hd6mfN3668AJrCwi8d3rx1d8ftN4jsp9iHCoGSUo2ZeBu7jp75K0': 'lariilanero@gmail.com',
  '2_ABaOnueBMix4W-r2sk_sBC5e7sF512bhhLu4zsIH-7hOKpxAk-0mVmVRKiaAfMXKjuUJQbk': 'giulylanero@gmail.com',
  '2_ABaOnuf9jj7HvBBS2B9x8rT21rYckULppa36PlOHmSiUef-NsBQsvVmHp4HK4CvNxXe1Qak': 'romiju2017@gmail.com',
  '2_ABaOnudBHhCHJTRepAZFjjWn8ILjrAuguiDLag_p86Ha3fNNyre37PBubFKuvbd0-Lz9yNc': 'julietananni2020@gmail.com',
  '2_ABaOnuefmuMZtPvLZr7J3ILxTvqUbtEF-5bVhzqO3_ZuEjKgjUz9PFLDOwAlgqufr5VS1dU': 'lorenastephanii@gmail.com',
  '2_ABaOnuei-JfXxPS3TOezui8OzLSHtVuNvWCb54sT0sHbz3ZAsBXzzb4X0tyoR-6rMwuZ2n8': 'estefimartinez158@gmail.com',
  '2_ABaOnueBSiOp1j_rRcltAo88sjL2pZjhvkmzrpH37irUFoSqR9Z3ZWdT9l96Onoy9vNUBgQ': 'longorodriguez@gmail.com',
  '2_ABaOnuc6ZOou-FCKOzY-grG5RzOAgPl1eoQsOyraQNZFgTr1HDDQ1KTPnrcyI5CxqobDspM': 'aldivictoriazaher@gmail.com',
}

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
