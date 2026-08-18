import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEnv } from '../server/env'

// Paso 1 del setup manual de una sola vez (ver README): Mai visita este
// endpoint logueada con la cuenta de Google donde quiere que vivan los
// turnos, autoriza, y api/google-oauth-callback.ts le muestra el refresh
// token para cargar en las env vars de Vercel.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URI'),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    // fuerza que Google reemita el refresh token aunque ya se haya
    // autorizado antes (si no, en un segundo consentimiento Google lo omite)
    prompt: 'consent',
  })
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
