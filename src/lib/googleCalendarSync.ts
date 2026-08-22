/** Lanzado cuando /api/sync-calendar responde 409 "not_connected" — quien llama la usa para ofrecer conectar en vez de solo loguear el error. */
export class CalendarNoConectadoError extends Error {
  constructor() {
    super('Google Calendar no está conectado todavía')
    this.name = 'CalendarNoConectadoError'
  }
}

async function throwForResponse(res: Response): Promise<never> {
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (body?.error === 'not_connected') throw new CalendarNoConectadoError()
  }
  throw new Error(`sync-calendar respondió ${res.status}`)
}

/**
 * Llama a /api/sync-calendar. Nunca se usa para bloquear ni revertir un
 * guardado en Supabase — quien llama decide qué hacer si falla (ver
 * NuevoTurnoForm.tsx), esto solo dispara el request.
 */
export async function syncCalendarTurno(turnoId: string): Promise<void> {
  const res = await fetch('/api/sync-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnoId }),
  })
  if (!res.ok) await throwForResponse(res)
}

export async function syncCalendarDelete(googleEventId: string): Promise<void> {
  const res = await fetch('/api/sync-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', googleEventId }),
  })
  if (!res.ok) await throwForResponse(res)
}
