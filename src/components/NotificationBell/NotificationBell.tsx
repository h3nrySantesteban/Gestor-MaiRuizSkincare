import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { formatFechaHora } from '../../lib/format'
import { BellIcon } from '../icons'
import type { Notificacion, TipoNotificacion } from '../../types/notificacion'

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  confirmado: 'Confirmó',
  cancelado: 'Canceló',
  reprogramar: 'Quiere reprogramar',
  no_reconocido: 'Respuesta sin reconocer',
  formulario_nuevo: 'Formulario nuevo',
  turnos_sin_tratamiento: 'Sin tratamiento',
}

const TIPO_CLASS: Record<TipoNotificacion, string> = {
  confirmado: 'bg-success-bg text-success',
  cancelado: 'bg-danger-bg text-danger',
  reprogramar: 'bg-warning-bg text-warning',
  no_reconocido: 'bg-surface-muted text-ink-muted',
  formulario_nuevo: 'bg-surface-muted text-ink-muted',
  turnos_sin_tratamiento: 'bg-warning-bg text-warning',
}

export function NotificationBell() {
  const { notificaciones, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  function handleClick(n: Notificacion) {
    markAsRead(n.id)
    if (n.tipo === 'formulario_nuevo') {
      setOpen(false)
      navigate('/formularios')
    } else if (n.tipo === 'turnos_sin_tratamiento') {
      setOpen(false)
      // Turnos.tsx lee este state al montar y precarga el filtro "Sin
      // tratamiento" ya abierto, en vez de que Mai tenga que armarlo a mano
      navigate('/turnos', { state: { sinTratamiento: true } })
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">Sin notificaciones todavía.</p>
            )}
            {notificaciones.map((n) => {
              // la línea principal identifica de qué/quién se trata — turno
              // si hay uno matcheado, el nombre puesto en el form para
              // formulario_nuevo, o la cantidad para turnos_sin_tratamiento
              // (las tres son notificaciones sin turno_id, ver
              // notificar_turnos_sin_tratamiento en supabase-setup.sql, que
              // reutiliza mensaje_original para guardar la cantidad como
              // texto en vez de agregar una columna nueva). La etiqueta de
              // tipo va al lado, en el mismo renglón, no arriba.
              const cantidadSinTratamiento = Number(n.mensajeOriginal)
              const principal = n.turno
                ? `${n.turno.pacienteNombre} — turno ${formatFechaHora(n.turno.fecha)}`
                : n.tipo === 'formulario_nuevo'
                  ? (n.mensajeOriginal ?? 'Formulario nuevo')
                  : n.tipo === 'turnos_sin_tratamiento'
                    ? `${Number.isFinite(cantidadSinTratamiento) ? cantidadSinTratamiento : ''} turno${cantidadSinTratamiento === 1 ? '' : 's'} finalizado${cantidadSinTratamiento === 1 ? '' : 's'} sin tratamiento`
                    : null
              const mensajeAparte = n.mensajeOriginal && n.tipo !== 'formulario_nuevo' && n.tipo !== 'turnos_sin_tratamiento'
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface-muted ${
                    n.leida ? '' : 'bg-primary-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {principal ? (
                      <p className="min-w-0 truncate text-sm text-ink">{principal}</p>
                    ) : (
                      <span />
                    )}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIPO_CLASS[n.tipo]}`}>
                        {TIPO_LABEL[n.tipo]}
                      </span>
                      {!n.leida && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
                    </div>
                  </div>
                  {mensajeAparte && <p className="mt-0.5 truncate text-xs text-ink-muted">"{n.mensajeOriginal}"</p>}
                  <p className="mt-1 text-[11px] text-ink-muted">{formatFechaHora(n.createdAt)}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
