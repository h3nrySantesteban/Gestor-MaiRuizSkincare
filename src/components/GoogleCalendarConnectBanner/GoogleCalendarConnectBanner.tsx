import { useEffect, useState } from 'react'
import { subscribeGoogleCalendarNoConectado } from '../../lib/googleCalendarNotice'
import { CalendarIcon, XIcon } from '../icons'

/**
 * Se muestra sola la primera vez que se intenta guardar un turno y
 * server/googleCalendar.ts todavía no tiene un refresh token guardado (ver
 * CalendarNoConectadoError). El guardado del turno en sí ya se hizo bien —
 * esto solo ofrece resolver la sync que quedó pendiente.
 */
export function GoogleCalendarConnectBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeGoogleCalendarNoConectado(() => setVisible(true)), [])

  if (!visible) return null

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-warning-bg px-4 py-2.5 text-sm text-warning md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <CalendarIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">
          Este turno se guardó, pero todavía no conectaste Google Calendar — no se sincronizó.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <a href="/api/google-oauth-start" className="font-medium underline hover:no-underline">
          Conectar
        </a>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Cerrar aviso"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/5"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
