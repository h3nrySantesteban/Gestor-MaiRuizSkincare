import type { VercelRequest, VercelResponse } from '@vercel/node'
import { procesarRespuestaForm, InvalidWebhookSecretError } from '../server/googleForms.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const secretHeader = req.headers['x-webhook-secret']
  const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader

  try {
    await procesarRespuestaForm(req.body, secret)
  } catch (err) {
    if (err instanceof InvalidWebhookSecretError) {
      res.status(401).send('Unauthorized')
      return
    }
    console.error('Error procesando respuesta de Google Forms', err)
    res.status(500).send('Error interno')
    return
  }

  res.status(200).send('OK')
}
