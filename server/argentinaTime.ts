// Argentina es UTC-3 todo el año (sin horario de verano desde 2009) — no
// hace falta una librería de timezones para esta cuenta.
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000

export function getArgentinaTomorrowRangeUtc(nowUtc = new Date()): { start: Date; end: Date } {
  const argNow = new Date(nowUtc.getTime() - ARGENTINA_OFFSET_MS)
  const y = argNow.getUTCFullYear()
  const m = argNow.getUTCMonth()
  const d = argNow.getUTCDate()
  const startUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0, 0) + ARGENTINA_OFFSET_MS
  return { start: new Date(startUtcMs), end: new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1) }
}

export function formatArgentinaDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatArgentinaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
  })
}
