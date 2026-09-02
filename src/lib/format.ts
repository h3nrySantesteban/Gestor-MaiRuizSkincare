import { differenceInCalendarDays, endOfWeek, format } from 'date-fns'
import { es } from 'date-fns/locale'

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

const compactCurrencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Para labels/ejes de gráfico, donde el monto exacto ya está en el tooltip: $4,2K en vez de $4.200. */
export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFormatter.format(value)
}

export function formatFecha(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy', { locale: es })
}

// new Date('YYYY-MM-DD') interpreta ese string como medianoche UTC (así lo
// define el spec para fechas "date-only", a diferencia de un datetime sin
// zona) — en Argentina (UTC-3) eso muestra el día anterior. Parsear los
// componentes a mano y construir con el constructor de 3 argumentos (que sí
// es local, sin ambigüedad) evita el corrimiento. Solo hace falta para
// columnas `date` de Postgres sin hora, como gastos.fecha — turnos.fecha es
// timestamptz y ya trae zona, formatFecha/formatFechaHora de arriba le
// pegan bien directo.
export function parseFechaSolo(fecha: string): Date {
  const [year, month, day] = fecha.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatFechaSolo(fecha: string): string {
  return format(parseFechaSolo(fecha), 'dd/MM/yyyy', { locale: es })
}

/** "Septiembre 2026" — encabezado de grupo para listados agrupados por mes a partir de una fecha date-only. */
export function formatMesAno(fecha: string): string {
  const label = format(parseFechaSolo(fecha), 'MMMM yyyy', { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatFechaHora(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: es })
}

export function formatHora(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: es })
}

/**
 * Encabezado de grupo para el listado de turnos: "Hoy"/"Mañana" los
 * próximos dos días, "el martes" mientras siga cayendo dentro de esta
 * semana (hasta el domingo — weekStartsOn:1 así "esta semana" termina un
 * domingo, no un sábado), y una fecha corta ("9/9") para cualquier otro
 * caso (más adelante que el domingo, o en el pasado).
 */
export function formatGrupoDia(iso: string): string {
  const fecha = new Date(iso)
  const hoy = new Date()
  const diff = differenceInCalendarDays(fecha, hoy)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff > 1 && fecha <= endOfWeek(hoy, { weekStartsOn: 1 })) {
    return `el ${format(fecha, 'EEEE', { locale: es })}`
  }
  return format(fecha, 'd/M', { locale: es })
}
