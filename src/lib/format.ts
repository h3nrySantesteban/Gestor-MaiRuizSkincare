import { format } from 'date-fns'
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

export function formatFechaHora(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: es })
}

export function formatHora(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: es })
}
