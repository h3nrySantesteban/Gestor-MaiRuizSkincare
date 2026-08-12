import type { EstadoTurno } from '../../types/turno'

const ESTADO_CLASS: Record<EstadoTurno, string> = {
  Agendado: 'bg-primary-50 text-primary-700',
  Finalizado: 'bg-success-bg text-success',
  Cancelado: 'bg-danger-bg text-danger',
  Otro: 'bg-surface-muted text-ink-muted',
}

export function EstadoBadge({ estado }: { estado: EstadoTurno }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_CLASS[estado]}`}>
      {estado}
    </span>
  )
}
