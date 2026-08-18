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
  if (!res.ok) throw new Error(`sync-calendar respondió ${res.status}`)
}

export async function syncCalendarDelete(googleEventId: string): Promise<void> {
  const res = await fetch('/api/sync-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', googleEventId }),
  })
  if (!res.ok) throw new Error(`sync-calendar respondió ${res.status}`)
}
