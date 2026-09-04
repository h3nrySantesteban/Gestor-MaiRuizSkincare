import type { EstadoTurno } from '../../types/turno'

// Texto coloreado, sin píldora de fondo — la versión anterior (bg-*)
// competía demasiado por atención en una lista con muchas tarjetas; el
// color en el texto alcanza para distinguir el estado de un vistazo.
const ESTADO_CLASS: Record<EstadoTurno, string> = {
  // primary-700 (no 600): es el tono que el tema ya aclara para modo oscuro
  // específicamente para texto plano sobre bg-surface — 600 se queda igual
  // en los dos modos y quedaba demasiado saturado/chillón sobre la
  // superficie oscura
  Agendado: 'text-primary-700',
  Finalizado: 'text-success',
  Cancelado: 'text-danger',
  Otro: 'text-ink-muted',
}

export function EstadoBadge({ estado }: { estado: EstadoTurno }) {
  return <span className={`text-xs font-medium ${ESTADO_CLASS[estado]}`}>{estado}</span>
}
