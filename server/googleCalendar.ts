import { requireEnv } from './env.js'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
// mismo supuesto de duración que usa finalizar_turnos_vencidos en supabase-setup.sql
const DURATION_MS = 60 * 60 * 1000

// dirección del consultorio — no es un dato sensible, se hardcodea acá en
// vez de agregar otra env var
const DIRECCION_CONSULTORIO = 'Sarmiento 756, S2000 Rosario, Santa Fe, Argentina'

// colorId de Google Calendar para "Grape" — el morado más parecido al
// primary-500 de la app (ver src/index.css). Lista completa de colorId en
// https://developers.google.com/calendar/api/v3/reference/colors/get
const COLOR_ID_PURPURA = '3'

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

function getCalendarId(): string {
  // el calendario "Turnos" lo crea Mai a mano en Google Calendar (nuestro
  // scope es calendar.events, no alcanza para crear calendarios) — el id
  // sale de Configuración > ese calendario > Integrar calendario
  return requireEnv('GOOGLE_CALENDAR_ID')
}

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
  precio: number
  medioPago: string | null
  giftCard: boolean
  senado: boolean
}

function buildDescription(turno: TurnoParaCalendar): string {
  const tratamientosTexto = turno.tratamientos.length > 0 ? turno.tratamientos.join(', ') : 'sin especificar'
  const lineas = [
    `Tratamiento: ${tratamientosTexto}`,
    `Precio: ${currencyFormatter.format(turno.precio)}`,
    `Medio de pago: ${turno.medioPago ?? '—'}`,
    `Gift card: ${turno.giftCard ? 'Sí' : 'No'}`,
    `Señado: ${turno.senado ? 'Sí' : 'No'}`,
  ]
  return lineas.join('\n')
}

function buildEventBody(turno: TurnoParaCalendar) {
  const start = new Date(turno.fecha)
  const end = new Date(start.getTime() + DURATION_MS)
  return {
    summary: `Turno: ${turno.pacienteNombre} — Mailén Ruiz | Técnica Cosmetóloga`,
    description: buildDescription(turno),
    location: DIRECCION_CONSULTORIO,
    colorId: COLOR_ID_PURPURA,
    start: { dateTime: start.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    attendees: turno.pacienteEmail ? [{ email: turno.pacienteEmail }] : [],
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 60 }],
    },
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
  const calendarId = encodeURIComponent(getCalendarId())

  if (turno.googleEventId) {
    const updated = await callCalendarApi(`/calendars/${calendarId}/events/${turno.googleEventId}?sendUpdates=all`, {
      method: 'PUT',
      body,
    })
    if (updated) return turno.googleEventId
    // si updated es null, el evento ya no existía en Google (borrado a mano)
    // — seguimos y creamos uno nuevo en vez de fallar
  }

  const created = (await callCalendarApi(`/calendars/${calendarId}/events?sendUpdates=all`, {
    method: 'POST',
    body,
  })) as { id: string } | null
  return created?.id ?? null
}

export async function deleteTurnoEvent(googleEventId: string): Promise<void> {
  const calendarId = encodeURIComponent(getCalendarId())
  await callCalendarApi(`/calendars/${calendarId}/events/${googleEventId}?sendUpdates=all`, { method: 'DELETE' })
}
