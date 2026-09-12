import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// helpers de fecha compartidos por los carruseles "por mes" (ver
// MesCarousel.tsx) — IngresosCarousel/GastosCarousel arman su propio mapa
// mes -> totales, pero la aritmética de meses (restar N, contar "cuántos
// atrás", último día de un mes, formatear el label) es idéntica en los dos

export function claveMes(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

// month es 1-based; n meses hacia atrás (n=0 → el mismo mes, n=1 → el mes anterior)
export function restarMeses(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - n, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function mesesAtras(anioActual: number, mesActual: number, year: number, month: number): number {
  return (anioActual - year) * 12 + (mesActual - month)
}

export function diasEnMes(year: number, month: number): number {
  // día 0 del mes siguiente = último día de este mes
  return new Date(year, month, 0).getDate()
}

// "Septiembre" (mismo año que anioActual) o "Septiembre 2025" (otro año) —
// label de la tarjeta activa del carrusel
export function formatMesLabel(year: number, month: number, anioActual: number): string {
  const nombre = format(new Date(year, month - 1, 1), 'MMMM', { locale: es })
  const capitalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  return year === anioActual ? capitalizado : `${capitalizado} ${year}`
}
