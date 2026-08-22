import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEnv } from '../server/env.js'
import { saveRefreshToken } from '../server/googleCalendar.js'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Google redirige acá con un `code` de un solo uso después de que Mai
// acepta en la pantalla de consentimiento (arrancada desde el botón
// "Conectar Google Calendar" en la app, o /api/google-oauth-start
// directamente). Lo cambiamos por un refresh token y lo guardamos en
// Supabase (ver server/googleCalendar.ts) — de ahí en adelante la app usa
// esa fila sola, sin que Mai tenga que copiar/pegar nada ni redeployar.
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
        'Google no devolvió un refresh token (probablemente ya habías autorizado esta app antes sin revocarla). ' +
          'Revocá el acceso en https://myaccount.google.com/permissions y volvé a intentar conectar desde la app.',
      )
    return
  }

  try {
    await saveRefreshToken(data.refresh_token)
  } catch (err) {
    res.status(500).send(`No se pudo guardar la conexión: ${escapeHtml(err instanceof Error ? err.message : String(err))}`)
    return
  }

  res
    .status(200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .send(
      `<!doctype html><html><body style="font-family:sans-serif;max-width:640px;margin:40px auto">` +
        `<h2>Google Calendar conectado ✓</h2>` +
        `<p>Ya podés cerrar esta pestaña y volver a la app — los turnos se van a sincronizar solos de acá en más.</p>` +
        `<p><a href="/dashboard">Volver a la app</a></p>` +
        `</body></html>`,
    )
}
