import { requireEnv } from './env'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
// mismo supuesto de duración que usa finalizar_turnos_vencidos en supabase-setup.sql
const DURATION_MS = 60 * 60 * 1000

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: requireEnv('GOOGLE_CALENDAR_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`No se pudo renovar el access token de Google: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function callCalendarApi(path: string, init: RequestInit): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  // 404: el evento ya no existe del lado de Google (ej. lo borraron a mano) —
  // no es un error, el que llama decide qué hacer (típicamente: crear uno nuevo)
  if (res.status === 404 || res.status === 204) return null
  if (!res.ok) {
    throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export interface TurnoParaCalendar {
  fecha: string
  estado: string
  googleEventId: string | null
  pacienteNombre: string
  pacienteEmail: string | null
  tratamientos: string[]
}

function buildEventBody(turno: TurnoParaCalendar) {
  const start = new Date(turno.fecha)
  const end = new Date(start.getTime() + DURATION_MS)
  const tratamientosTexto = turno.tratamientos.length > 0 ? turno.tratamientos.join(', ') : 'turno'
  return {
    summary: `Turno: ${turno.pacienteNombre} — ${tratamientosTexto}`,
    start: { dateTime: start.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    attendees: turno.pacienteEmail ? [{ email: turno.pacienteEmail }] : [],
  }
}

/**
 * Crea, actualiza o borra el evento de Google Calendar de un turno según su
 * estado actual. Devuelve el google_event_id que corresponde guardar (null
 * si el evento se borró o nunca existió — turno cancelado).
 */
export async function syncTurnoEvent(turno: TurnoParaCalendar): Promise<string | null> {
  if (turno.estado === 'Cancelado') {
    if (turno.googleEventId) await deleteTurnoEvent(turno.googleEventId)
    return null
  }

  const body = JSON.stringify(buildEventBody(turno))

  if (turno.googleEventId) {
    const updated = await callCalendarApi(`/calendars/primary/events/${turno.googleEventId}?sendUpdates=all`, {
      method: 'PUT',
      body,
    })
    if (updated) return turno.googleEventId
    // si updated es null, el evento ya no existía en Google (borrado a mano)
    // — seguimos y creamos uno nuevo en vez de fallar
  }

  const created = (await callCalendarApi('/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    body,
  })) as { id: string } | null
  return created?.id ?? null
}

export async function deleteTurnoEvent(googleEventId: string): Promise<void> {
  await callCalendarApi(`/calendars/primary/events/${googleEventId}?sendUpdates=all`, { method: 'DELETE' })
}
