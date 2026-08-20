import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEnv } from '../server/env.js'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Paso 2 del setup manual: Google redirige acá con un `code` de un solo uso,
// lo cambiamos por access+refresh token y mostramos el refresh token en la
// página para que Mai lo copie a mano a GOOGLE_CALENDAR_REFRESH_TOKEN en
// Vercel — no lo guardamos nosotros, solo debe vivir en las env vars.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code
  const error = req.query.error
  if (error) {
    res.status(400).send(`Google devolvió un error: ${escapeHtml(String(error))}`)
    return
  }
  if (typeof code !== 'string') {
    res.status(400).send('Falta el parámetro code')
    return
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: requireEnv('GOOGLE_OAUTH_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    res.status(500).send(`No se pudo canjear el code por tokens: ${escapeHtml(await tokenRes.text())}`)
    return
  }

  const data = (await tokenRes.json()) as { refresh_token?: string; access_token?: string }
  if (!data.refresh_token) {
    res
      .status(200)
      .send(
        'Google no devolvió un refresh token (probablemente ya habías autorizado esta app antes). ' +
          'Revocá el acceso en https://myaccount.google.com/permissions y volvé a visitar /api/google-oauth-start.',
      )
    return
  }

  res
    .status(200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .send(
      `<!doctype html><html><body style="font-family:sans-serif;max-width:640px;margin:40px auto">` +
        `<h2>Listo</h2>` +
        `<p>Copiá este valor y cargalo en Vercel como la variable <code>GOOGLE_CALENDAR_REFRESH_TOKEN</code>:</p>` +
        `<pre style="background:#eee;padding:16px;border-radius:8px;white-space:pre-wrap;word-break:break-all">${escapeHtml(data.refresh_token)}</pre>` +
        `<p>Después de cargarla, hacé un redeploy en Vercel para que tome efecto.</p>` +
        `</body></html>`,
    )
}
