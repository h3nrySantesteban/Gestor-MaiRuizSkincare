import crypto from 'node:crypto'
import { requireEnv } from './env'

const GRAPH_VERSION = 'v21.0'

async function callGraphApi(body: Record<string, unknown>): Promise<unknown> {
  const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID')
  const token = requireEnv('WHATSAPP_TOKEN')
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`)
  }
  return res.json()
}

export interface RecordatorioParams {
  pacienteNombre: string
  fecha: string
  hora: string
  tratamiento: string
}

/**
 * Mensajes que la empresa inicia fuera de la ventana de 24h de conversación
 * tienen que ser una plantilla pre-aprobada por Meta — no es opcional.
 * WHATSAPP_TEMPLATE_NAME/LANG apuntan a esa plantilla (ver .env.example).
 */
export async function sendReminderTemplate(to: string, params: RecordatorioParams): Promise<unknown> {
  return callGraphApi({
    to,
    type: 'template',
    template: {
      name: requireEnv('WHATSAPP_TEMPLATE_NAME'),
      language: { code: requireEnv('WHATSAPP_TEMPLATE_LANG') },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.pacienteNombre },
            { type: 'text', text: params.fecha },
            { type: 'text', text: params.hora },
            { type: 'text', text: params.tratamiento },
          ],
        },
      ],
    },
  })
}

/** Texto libre: solo válido dentro de la ventana de 24h que abre un mensaje entrante del paciente. */
export async function sendText(to: string, body: string): Promise<unknown> {
  return callGraphApi({ to, type: 'text', text: { body } })
}

export function verifySignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', requireEnv('WHATSAPP_APP_SECRET')).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signatureHeader)
  if (expectedBuffer.length !== actualBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}
