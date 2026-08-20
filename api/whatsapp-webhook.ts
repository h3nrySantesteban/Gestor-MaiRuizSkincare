import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../server/supabaseAdmin.js'
import { sendText, verifySignature } from '../server/whatsappClient.js'
import { parseReply, type ReplyIntent } from '../server/replyParser.js'
import { normalizePhone } from '../server/phone.js'
import { requireEnv } from '../server/env.js'
import { deleteTurnoEvent } from '../server/googleCalendar.js'

// necesitamos el body crudo (sin parsear) para poder validar la firma
// X-Hub-Signature-256 byte a byte
export const config = { api: { bodyParser: false } }

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const AUTO_REPLY: Record<Exclude<ReplyIntent, 'no_reconocido'>, string> = {
  confirmado: '¡Gracias! Confirmamos tu turno. Te esperamos ✨',
  cancelado: 'Listo, cancelamos tu turno. Cualquier cosa escribinos para reagendar.',
  reprogramar: 'Recibido, en breve nos comunicamos para coordinar una nueva fecha.',
}

interface IncomingMessage {
  from: string
  type: string
  text?: { body: string }
}

async function handleMessage(message: IncomingMessage): Promise<void> {
  if (message.type !== 'text') return

  const fromPhone = message.from
  const text = message.text?.body ?? ''
  const intent = parseReply(text)
  const normalizedFrom = normalizePhone(fromPhone)

  const { data: pacientes } = await supabaseAdmin.from('pacientes').select('id, telefono').not('telefono', 'is', null)
  const paciente = ((pacientes ?? []) as { id: string; telefono: string | null }[]).find(
    (p) => p.telefono && normalizePhone(p.telefono) === normalizedFrom,
  )

  let turnoId: string | null = null
  if (paciente) {
    const { data: turno } = await supabaseAdmin
      .from('turnos')
      .select('id')
      .eq('paciente_id', paciente.id)
      .eq('estado', 'Agendado')
      .not('reminder_sent_at', 'is', null)
      .order('reminder_sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    turnoId = turno?.id ?? null
  }

  if (turnoId && intent === 'cancelado') {
    await supabaseAdmin.from('turnos').update({ estado: 'Cancelado' }).eq('id', turnoId)
    // si no, el calendario de Mai queda con turnos cancelados por WhatsApp
    // que nunca se sacan — un fallo acá no debe frenar el resto del flujo
    const { data: turnoCancelado } = await supabaseAdmin
      .from('turnos')
      .select('google_event_id')
      .eq('id', turnoId)
      .single()
    const googleEventId = (turnoCancelado as { google_event_id: string | null } | null)?.google_event_id
    if (googleEventId) {
      try {
        await deleteTurnoEvent(googleEventId)
        await supabaseAdmin.from('turnos').update({ google_event_id: null }).eq('id', turnoId)
      } catch (err) {
        console.error('No se pudo borrar el evento de Google Calendar', err)
      }
    }
  } else if (turnoId && intent === 'confirmado') {
    await supabaseAdmin.from('turnos').update({ confirmado_paciente: true }).eq('id', turnoId)
  }

  await supabaseAdmin.from('notificaciones').insert({
    turno_id: turnoId,
    tipo: intent,
    mensaje_original: paciente ? text : `(WhatsApp +${fromPhone}) ${text}`,
  })

  // solo respondemos automático cuando pudimos correlacionar un turno concreto;
  // sin esa certeza, que lo maneje Mai desde la notificación
  if (turnoId && intent !== 'no_reconocido') {
    await sendText(fromPhone, AUTO_REPLY[intent])
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === requireEnv('WHATSAPP_VERIFY_TOKEN')) {
      res.status(200).send(String(challenge ?? ''))
      return
    }
    res.status(403).send('Forbidden')
    return
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const rawBody = await readRawBody(req)
  const signatureHeader = req.headers['x-hub-signature-256']
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
  if (!verifySignature(rawBody, signature)) {
    res.status(401).send('Invalid signature')
    return
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    res.status(400).send('Invalid JSON')
    return
  }

  const messages = extractMessages(payload)
  for (const message of messages) {
    try {
      await handleMessage(message)
    } catch (err) {
      // un mensaje con error no debe tirar abajo el resto ni hacer que Meta
      // reintente el webhook entero indefinidamente
      console.error('Error procesando mensaje de WhatsApp', err)
    }
  }

  // Meta espera 200 para no reintentar la entrega
  res.status(200).send('OK')
}

function extractMessages(payload: unknown): IncomingMessage[] {
  if (typeof payload !== 'object' || payload === null) return []
  const entry = (payload as { entry?: unknown }).entry
  if (!Array.isArray(entry)) return []
  const messages: IncomingMessage[] = []
  for (const e of entry) {
    const changes = (e as { changes?: unknown })?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const value = (change as { value?: unknown })?.value
      const valueMessages = (value as { messages?: unknown })?.messages
      if (Array.isArray(valueMessages)) messages.push(...(valueMessages as IncomingMessage[]))
    }
  }
  return messages
}
