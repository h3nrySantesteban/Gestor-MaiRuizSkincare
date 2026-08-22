/**
 * Pub-sub mínimo para avisar "Google Calendar no está conectado" desde
 * donde sea que falle una sync (NuevoTurnoForm.tsx, que ya cerró su modal
 * para cuando el sync falla) hasta el banner persistente en AppLayout.tsx.
 * No hace falta más que esto — no es estado de la app, es un evento efímero.
 */
type Listener = () => void
const listeners = new Set<Listener>()

export function notifyGoogleCalendarNoConectado(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeGoogleCalendarNoConectado(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
