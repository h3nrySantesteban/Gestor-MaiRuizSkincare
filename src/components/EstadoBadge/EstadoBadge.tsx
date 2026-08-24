import type { EstadoTurno } from '../../types/turno'

// Texto coloreado, sin píldora de fondo — la versión anterior (bg-*)
// competía demasiado por atención en una lista con muchas tarjetas; el
// color en el texto alcanza para distinguir el estado de un vistazo.
const ESTADO_CLASS: Record<EstadoTurno, string> = {
  Agendado: 'text-primary-600',
  Finalizado: 'text-success',
  Cancelado: 'text-danger',
  Otro: 'text-ink-muted',
}

export function EstadoBadge({ estado }: { estado: EstadoTurno }) {
  return <span className={`text-xs font-medium ${ESTADO_CLASS[estado]}`}>{estado}</span>
}
