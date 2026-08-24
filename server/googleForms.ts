import { supabaseAdmin } from './supabaseAdmin.js'
import { requireEnv } from './env.js'

interface FormWebhookPayload {
  googleResponseId?: unknown
  respuestas?: unknown
}

export class InvalidWebhookSecretError extends Error {}

function verifySecret(secretHeader: string | undefined): void {
  if (secretHeader !== requireEnv('GOOGLE_FORM_WEBHOOK_SECRET')) {
    throw new InvalidWebhookSecretError('Secret inválido en el webhook de Google Forms')
  }
}

// "Nombre y apellido" es la pregunta del form que mejor identifica de un
// vistazo quién la completó — se guarda como mensaje_original de la
// notificación para que la campanita muestre algo útil sin tener que abrir
// /formularios. Si el form cambia el texto de esa pregunta, cae a null.
const CAMPO_NOMBRE = 'Nombre y apellido'

// paciente_id siempre queda null acá — no hay forma confiable de matchear
// automático (el teléfono que el paciente escribe en el form no tiene por
// qué coincidir en formato con pacientes.telefono), así que la asignación
// queda 100% manual, como ya la hacía Mai en la app vieja. La notificación
// es lo que le avisa que hay una respuesta nueva para revisar.
export async function procesarRespuestaForm(payload: FormWebhookPayload, secretHeader: string | undefined) {
  verifySecret(secretHeader)

  const googleResponseId = typeof payload.googleResponseId === 'string' ? payload.googleResponseId : null
  const respuestas =
    typeof payload.respuestas === 'object' && payload.respuestas !== null
      ? (payload.respuestas as Record<string, string>)
      : {}

  const { error } = await supabaseAdmin.from('respuestas_formulario').insert({
    google_response_id: googleResponseId,
    respuestas,
  })
  if (error) {
    // un reintento de Apps Script con el mismo google_response_id pisa el
    // unique constraint — no es un error real, ya está guardada, y no
    // corresponde generar una segunda notificación para lo mismo
    if (error.code === '23505') return
    throw new Error(error.message)
  }

  await supabaseAdmin.from('notificaciones').insert({ tipo: 'formulario_nuevo', mensaje_original: respuestas[CAMPO_NOMBRE] ?? null })
}
