interface SkeletonProps {
  className?: string
}

/**
 * Bloque de carga (pulse). No define tamaño/forma propios — eso lo pone
 * quien lo usa vía className (alto, ancho, rounded-full para un círculo,
 * etc.), matcheando el tamaño real del contenido que va a reemplazar para
 * que no haya un salto de layout cuando llega la data de verdad.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-surface-muted ${className}`} />
}
