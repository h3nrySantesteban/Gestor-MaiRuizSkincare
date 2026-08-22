import { requireEnv } from './env.js'
import { supabaseAdmin } from './supabaseAdmin.js'

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

function getCalendarId(): string {
  // el calendario "Turnos" lo crea Mai a mano en Google Calendar (nuestro
  // scope es calendar.events, no alcanza para crear calendarios) — el id
  // sale de Configuración > ese calendario > Integrar calendario
  return requireEnv('GOOGLE_CALENDAR_ID')
}

/** El endpoint/UI que llama a syncTurnoEvent la usa para ofrecer "Conectar Google Calendar" en vez de un error genérico. */
export class CalendarNoConectadoError extends Error {
  constructor() {
    super('Google Calendar no está conectado todavía')
    this.name = 'CalendarNoConectadoError'
  }
}

async function getStoredRefreshToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_conexion')
    .select('refresh_token')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer la conexión de Google Calendar: ${error.message}`)
  if (!data) throw new CalendarNoConectadoError()
  return data.refresh_token
}

/** Llamado por api/google-oauth-callback.ts al terminar el flujo de OAuth. */
export async function saveRefreshToken(refreshToken: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('google_calendar_conexion')
    .upsert({ id: 1, refresh_token: refreshToken, connected_at: new Date().toISOString() })
  if (error) throw new Error(`No se pudo guardar la conexión de Google Calendar: ${error.message}`)
}

async function getAccessToken(): Promise<string> {
  const refreshToken = await getStoredRefreshToken()
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
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
}

function buildEventBody(turno: TurnoParaCalendar) {
  const start = new Date(turno.fecha)
  const end = new Date(start.getTime() + DURATION_MS)
  return {
    summary: `Turno: ${turno.pacienteNombre} — Mailén Ruiz | Técnica Cosmetóloga`,
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

interface TurnoPendienteRow {
  id: string
  fecha: string
  pacientes: { nombre_completo: string; email: string | null } | null
}

/**
 * Sincroniza los turnos Agendados que quedaron sin google_event_id — el
 * caso típico es el turno que disparó el aviso de "Conectar Google
 * Calendar" (se guardó bien en Supabase, pero la sync falló porque todavía
 * no había conexión) y cualquier otro guardado mientras tanto. Se llama
 * justo después de guardar un refresh token nuevo (api/google-oauth-callback.ts)
 * — sin esto, esos turnos quedarían sin sincronizar para siempre, ya que
 * nada vuelve a reintentarlos después de conectar. Solo Agendados: un
 * Finalizado/Cancelado que nunca llegó a Calendar ya no aporta nada
 * agregándolo ahora.
 */
export async function syncTurnosPendientes(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('turnos')
    .select('id, fecha, pacientes ( nombre_completo, email )')
    .eq('estado', 'Agendado')
    .is('google_event_id', null)

  if (error) throw new Error(`No se pudieron leer los turnos pendientes de sincronizar: ${error.message}`)

  let sincronizados = 0
  for (const turno of (data ?? []) as unknown as TurnoPendienteRow[]) {
    try {
      const googleEventId = await syncTurnoEvent({
        fecha: turno.fecha,
        estado: 'Agendado',
        googleEventId: null,
        pacienteNombre: turno.pacientes?.nombre_completo ?? 'Paciente',
        pacienteEmail: turno.pacientes?.email ?? null,
      })
      if (googleEventId) {
        await supabaseAdmin.from('turnos').update({ google_event_id: googleEventId }).eq('id', turno.id)
        sincronizados++
      }
    } catch (err) {
      // un turno pendiente que falla no debe frenar el resto — sigue
      // apareciendo sin google_event_id, así que se reintenta en la
      // próxima conexión
      console.error(`No se pudo sincronizar el turno pendiente ${turno.id}`, err)
    }
  }
  return sincronizados
}
