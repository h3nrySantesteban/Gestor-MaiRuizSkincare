import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Skeleton } from '../Skeleton/Skeleton'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'
import { formatCurrency, parseFechaSolo } from '../../lib/format'
import type { Turno } from '../../types/turno'
import type { Gasto } from '../../types/gasto'

interface IngresosCarouselProps {
  turnos: Turno[]
  gastos: Gasto[]
  loading: boolean
}

interface MesTotales {
  bruto: number
  gastos: number
}

function claveMes(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

// un solo recorrido de turnos + gastos arma el mapa mes -> totales; todo lo
// demás (bruto/neto de un mes puntual, promedios de 6 meses) sale de mirar
// este mapa, no de volver a filtrar los arrays completos cada vez
function construirTotalesPorMes(turnos: Turno[], gastos: Gasto[]): Map<string, MesTotales> {
  const map = new Map<string, MesTotales>()
  function entrada(key: string): MesTotales {
    let e = map.get(key)
    if (!e) {
      e = { bruto: 0, gastos: 0 }
      map.set(key, e)
    }
    return e
  }
  for (const t of turnos) {
    const d = new Date(t.fecha)
    entrada(claveMes(d.getFullYear(), d.getMonth() + 1)).bruto += t.precio
  }
  for (const g of gastos) {
    // gastos.fecha es date-only (no timestamptz, a diferencia de
    // turnos.fecha) — parseFechaSolo evita el corrimiento de día por UTC
    const d = parseFechaSolo(g.fecha)
    entrada(claveMes(d.getFullYear(), d.getMonth() + 1)).gastos += g.valor
  }
  return map
}

// month es 1-based; n meses hacia atrás (n=0 → el mismo mes, n=1 → el mes anterior)
function restarMeses(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - n, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function mesesAtras(anioActual: number, mesActual: number, year: number, month: number): number {
  return (anioActual - year) * 12 + (mesActual - month)
}

function totalesDelMes(map: Map<string, MesTotales>, year: number, month: number): MesTotales {
  return map.get(claveMes(year, month)) ?? { bruto: 0, gastos: 0 }
}

// promedio de los 6 meses CERRADOS anteriores al mes de la tarjeta (no
// incluye ese mes — mismo criterio que ya usaba la tarjeta "Promedio 6
// meses" vieja, generalizado acá a "el mes que se está mostrando" en vez de
// "hoy" siempre)
function promedios6Meses(map: Map<string, MesTotales>, year: number, month: number): { bruto: number; neto: number } {
  let bruto = 0
  let gastos = 0
  for (let i = 1; i <= 6; i++) {
    const { year: y, month: m } = restarMeses(year, month, i)
    const t = totalesDelMes(map, y, m)
    bruto += t.bruto
    gastos += t.gastos
  }
  return { bruto: bruto / 6, neto: (bruto - gastos) / 6 }
}

function formatLabel(year: number, month: number, back: number, anioActual: number): string {
  if (back === 0) return 'Actual'
  const nombre = format(new Date(year, month - 1, 1), 'MMMM', { locale: es })
  const capitalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  return year === anioActual ? capitalizado : `${capitalizado} ${year}`
}

/**
 * Carrusel de "Ingresos por mes": una tarjeta por mes, navegable con flechas
 * (arriba, a los costados del nombre del mes) o deslizando/scrolleando
 * horizontalmente — arranca mostrando el mes actual ("Actual"), a la
 * derecha del todo, con los meses anteriores hacia la izquierda.
 *
 * Bruto = suma de turno.precio de los turnos facturables del mes (mismo
 * criterio que useIngresos). Neto = bruto menos el total de gastos
 * cargados ese mismo mes — es la ÚNICA cuenta de toda la app que resta
 * gastos contra ingresos (ver CLAUDE.md: en Dashboard/Analytics/Gastos
 * nunca se netean), acá es a propósito porque Mai lo pidió como vista
 * puntual, no cambia ningún otro cálculo de ingresos existente.
 */
export function IngresosCarousel({ turnos, gastos, loading }: IngresosCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  const totalesPorMes = useMemo(() => construirTotalesPorMes(turnos, gastos), [turnos, gastos])

  // cuántos meses hacia atrás llega el carrusel: hasta el mes más viejo con
  // algún turno o gasto cargado (0 si no hay nada todavía, solo "Actual")
  const maxBack = useMemo(() => {
    let max = 0
    for (const key of totalesPorMes.keys()) {
      const [y, m] = key.split('-').map(Number)
      max = Math.max(max, mesesAtras(anioActual, mesActual, y, m))
    }
    return max
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anioActual/mesActual son estables durante la vida del componente
  }, [totalesPorMes])

  // de más viejo (índice 0) a más nuevo (último índice = mes actual) — así
  // el scroll arranca de entrada pegado a la derecha, mostrando "Actual"
  const meses = useMemo(() => Array.from({ length: maxBack + 1 }, (_, i) => maxBack - i), [maxBack])

  // al cargar (o cuando cambia la cantidad de meses disponibles) arranca
  // mostrando el mes actual, pegado al borde derecho del carrusel
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'auto' })
    setActiveIndex(meses.length - 1)
  }, [meses.length])

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(Math.min(Math.max(idx, 0), meses.length - 1))
  }

  function goTo(index: number) {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.min(Math.max(index, 0), meses.length - 1)
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setActiveIndex(clamped)
  }

  if (loading) return <Skeleton className="h-40 rounded-xl" />

  const activeBack = meses[activeIndex] ?? 0
  const { year: activeYear, month: activeMonth } = restarMeses(anioActual, mesActual, activeBack)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink">{formatLabel(activeYear, activeMonth, activeBack, anioActual)}</span>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === meses.length - 1}
          aria-label="Mes siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {meses.map((back) => {
          const { year, month } = restarMeses(anioActual, mesActual, back)
          const { bruto, gastos: gastosDelMes } = totalesDelMes(totalesPorMes, year, month)
          const neto = bruto - gastosDelMes
          const promedios = promedios6Meses(totalesPorMes, year, month)
          return (
            <div key={claveMes(year, month)} className="w-full shrink-0 snap-center">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <div>
                    <p className="text-xs font-medium text-ink-muted">Neto</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{formatCurrency(neto)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-ink-muted">Bruto</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{formatCurrency(bruto)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-muted">Prom. 6m neto</p>
                    <p className="mt-1 text-sm font-medium text-ink-muted">{formatCurrency(promedios.neto)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-ink-muted">Prom. 6m bruto</p>
                    <p className="mt-1 text-sm font-medium text-ink-muted">{formatCurrency(promedios.bruto)}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
