import { useEffect, useMemo, useRef } from 'react'
import { Skeleton } from '../Skeleton/Skeleton'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
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

// promedio de los 6 meses CERRADOS anteriores a HOY — un solo número fijo,
// no uno por tarjeta (ver comentario en el componente: recalcularlo para
// cada mes del carrusel no tenía sentido, así que vive afuera del slider)
function promedios6MesesCerrados(map: Map<string, MesTotales>, anioActual: number, mesActual: number): { bruto: number; neto: number } {
  let bruto = 0
  let gastos = 0
  for (let i = 1; i <= 6; i++) {
    const { year, month } = restarMeses(anioActual, mesActual, i)
    const t = totalesDelMes(map, year, month)
    bruto += t.bruto
    gastos += t.gastos
  }
  return { bruto: bruto / 6, neto: (bruto - gastos) / 6 }
}

function diasEnMes(year: number, month: number): number {
  // día 0 del mes siguiente = último día de este mes
  return new Date(year, month, 0).getDate()
}

// "a esta altura" del mes anterior a la tarjeta: SIEMPRE hasta el día de
// hoy del calendario real (no hasta el día que le tocaría a la tarjeta si
// fuera el mes en curso) — mismo criterio que ingresosAlaFecha en
// useDashboardStats, aplicado igual en todas las tarjetas para que la
// comparación sea consistente en todo el carrusel. Para un mes ya cerrado
// esto compara "lo que llevamos hoy" contra el mismo tramo del mes
// anterior a esa tarjeta, no contra el mes anterior completo.
function totalMesAnteriorAEstaAltura(
  turnos: Turno[],
  gastos: Gasto[],
  year: number,
  month: number,
  hoy: Date,
): { bruto: number; neto: number } {
  const { year: prevYear, month: prevMonth } = restarMeses(year, month, 1)
  const hastaDia = Math.min(hoy.getDate(), diasEnMes(prevYear, prevMonth))

  let bruto = 0
  for (const t of turnos) {
    const d = new Date(t.fecha)
    if (d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth && d.getDate() <= hastaDia) bruto += t.precio
  }
  let gastosTotal = 0
  for (const g of gastos) {
    const d = parseFechaSolo(g.fecha)
    if (d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth && d.getDate() <= hastaDia) gastosTotal += g.valor
  }
  return { bruto, neto: bruto - gastosTotal }
}

/**
 * Carrusel de "Ingresos por mes": una tarjeta por mes, navegable deslizando/
 * scrolleando horizontalmente — arranca mostrando el mes actual, a la
 * derecha del todo, con los meses anteriores hacia la izquierda.
 *
 * Bruto = suma de turno.precio de los turnos facturables del mes (mismo
 * criterio que useIngresos). Neto = bruto menos el total de gastos
 * cargados ese mismo mes — es la ÚNICA cuenta de toda la app que resta
 * gastos contra ingresos (ver CLAUDE.md: en Dashboard/Analytics/Gastos
 * nunca se netean), acá es a propósito porque Mai lo pidió como vista
 * puntual, no cambia ningún otro cálculo de ingresos existente.
 *
 * Cada tarjeta también compara contra el mes anterior "a esta altura" (ver
 * totalMesAnteriorAEstaAltura). El promedio de 6 meses NO vive por tarjeta
 * — es un solo número relativo a hoy, mostrado una vez debajo del slider
 * (recalcularlo para cada mes del carrusel no aportaba nada distinto mes a
 * mes, solo ruido).
 */
export function IngresosCarousel({ turnos, gastos, loading }: IngresosCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  const totalesPorMes = useMemo(() => construirTotalesPorMes(turnos, gastos), [turnos, gastos])

  // cuántos meses hacia atrás llega el carrusel: hasta el mes más viejo con
  // algún turno o gasto cargado (0 si no hay nada todavía, solo el mes en curso)
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
  // el scroll arranca de entrada pegado a la derecha, mostrando el mes en curso
  const meses = useMemo(() => Array.from({ length: maxBack + 1 }, (_, i) => maxBack - i), [maxBack])

  // al cargar (o cuando cambia la cantidad de meses disponibles) arranca
  // mostrando el mes actual, pegado al borde derecho del carrusel
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'auto' })
  }, [meses.length])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    )
  }

  const promedio6Meses = promedios6MesesCerrados(totalesPorMes, anioActual, mesActual)

  return (
    <div>
      <div ref={scrollRef} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth">
        {meses.map((back) => {
          const { year, month } = restarMeses(anioActual, mesActual, back)
          const { bruto, gastos: gastosDelMes } = totalesDelMes(totalesPorMes, year, month)
          const neto = bruto - gastosDelMes
          const mesAnterior = totalMesAnteriorAEstaAltura(turnos, gastos, year, month, hoy)
          return (
            // 88% del ancho (no 100%): deja asomar un margen de la tarjeta
            // vecina a cada lado como pista visual de que se puede deslizar
            <div key={claveMes(year, month)} className="w-[88%] shrink-0 snap-center">
              <div className="rounded-xl border border-border bg-surface p-3">
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <p className="text-xs font-medium text-ink-muted">Ingreso Neto</p>
                    <p className="text-lg font-semibold text-ink">{formatCurrency(neto)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-ink-muted">Ingreso Bruto</p>
                    <p className="text-lg font-semibold text-ink">{formatCurrency(bruto)}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-1 border-t border-border pt-2">
                  <p className="text-[11px] font-medium text-ink-muted">Mes anterior a esta altura</p>
                  <InfoTooltip text="Ingresos del mes anterior, contando solo hasta el día de hoy del calendario — mismo tramo que ya lleva el mes en curso, para comparar en igualdad de condiciones." />
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-4">
                  <div>
                    <p className="text-[11px] text-ink-muted">Ingreso Neto</p>
                    <p className="text-sm font-medium text-ink-muted">{formatCurrency(mesAnterior.neto)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-ink-muted">Ingreso Bruto</p>
                    <p className="text-sm font-medium text-ink-muted">{formatCurrency(mesAnterior.bruto)}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <p className="text-left text-xs font-medium text-ink-muted">Promedio (6 meses)</p>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <p className="text-[11px] text-ink-muted">Ingreso Neto</p>
              <p className="text-sm font-medium text-ink-muted">{formatCurrency(promedio6Meses.neto)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-ink-muted">Ingreso Bruto</p>
              <p className="text-sm font-medium text-ink-muted">{formatCurrency(promedio6Meses.bruto)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

