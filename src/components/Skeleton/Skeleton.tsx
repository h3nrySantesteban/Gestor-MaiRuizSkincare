interface SkeletonProps {
  className?: string
}

/**
 * Bloque de carga (pulse). No define tamaño/forma propios — eso lo pone
 * quien lo usa vía className (alto, ancho, rounded-full para un círculo,
 * etc.), matcheando el tamaño real del contenido que va a reemplazar para
 * que no haya un salto de layout cuando llega la data de verdad.
 *
 * bg-border, no bg-surface-muted: varios headers de página (Pacientes,
 * Turnos, Tratamientos...) ponen el subtítulo directo sobre el fondo de
 * página (bg-surface-muted) sin una card de por medio — con ese mismo color
 * el bloque quedaba invisible. border tiene contraste tanto contra
 * surface-muted (fondo de página) como contra surface (dentro de una card).
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-border ${className}`} />
}
