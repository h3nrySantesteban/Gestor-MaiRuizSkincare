import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '../Skeleton/Skeleton'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
import { formatCurrency } from '../../lib/format'
import { restarMeses, formatMesLabel } from '../../lib/mesCarousel'

export interface DatosMes {
  valor1: number
  valor2: number
}

interface MesCarouselProps {
  loading: boolean
  /** "back" de cada tarjeta (0 = mes actual), de más viejo a más nuevo */
  meses: number[]
  anioActual: number
  mesActual: number
  /** mismas dos etiquetas en todas las tarjetas — solo cambian los valores */
  label1: string
  label2: string
  datosMes: (back: number) => DatosMes
  /** si no se pasa, la tarjeta no muestra el bloque de comparación de abajo (ver Gastos: no tiene sentido comparar un gasto puntual contra el mismo tramo del mes pasado) */
  datosMesAnterior?: (back: number) => DatosMes
  /** label de ese bloque — puede variar por tarjeta (ver IngresosCarousel: "Mes anterior a esta altura" en el mes actual, "Mismo mes, año pasado" en los cerrados). Si no se pasa, usa "Mes anterior a esta altura" fijo. */
  anteriorLabel?: (back: number) => string
  datosPromedio: DatosMes
  anteriorTooltip?: (back: number) => string | undefined
  /** true si "subió" es una mala noticia (Gastos) — por defecto false, "subió" es buena noticia (Ingresos). Se usa para el color del % debajo de cada valor. */
  masEsMalo?: boolean
}

function pctVsMesPasado(actual: number, pasado: number): number | null {
  if (pasado === 0) return null
  return ((actual - pasado) / pasado) * 100
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}% que el mes pasado`
}

function pctColorClass(value: number | null, masEsMalo: boolean): string {
  if (value === null || value === 0) return 'text-ink-muted'
  const subio = value > 0
  const esMalo = masEsMalo ? subio : !subio
  return esMalo ? 'text-danger' : 'text-success'
}

/**
 * Carrusel de "algo por mes": una tarjeta por mes con dos valores lado a
 * lado (label1/label2 — Ingreso Neto/Bruto en Ingresos, Total gastado/
 * Gastos habituales en Gastos), navegable deslizando/scrolleando
 * horizontalmente o tocando el margen asomado de una tarjeta vecina.
 * Arranca mostrando el mes actual, a la derecha del todo, con los meses
 * anteriores hacia la izquierda. Toda la lógica de "qué significan esos
 * dos valores" (bruto/neto, total/habituales, etc.) vive en el componente
 * que llama a este — acá solo hay estructura visual + navegación.
 *
 * Cada tarjeta puede mostrar además un segundo bloque de comparación (si el
 * caller pasa datosMesAnterior — opcional, ver Gastos: no tiene sentido
 * comparar un gasto puntual contra el mismo tramo del mes pasado). Qué
 * compara exactamente puede variar por tarjeta — ver IngresosCarousel:
 * "mes anterior a esta altura" (recortado a hoy) solo tiene sentido en el
 * mes en curso, así que ahí compara contra el mismo mes del año pasado en
 * vez de eso; anteriorLabel/anteriorTooltip acompañan ese cambio de
 * significado por tarjeta. El promedio de 6 meses NO vive por tarjeta — es un solo
 * valor relativo a hoy, mostrado una vez debajo del slider (recalcularlo
 * para cada mes del carrusel no aportaba nada distinto mes a mes, solo
 * ruido).
 *
 * -mx-4 md:-mx-6 (más abajo) cancela el padding de <main> en
 * AppLayout.tsx (p-4 md:p-6) para que el peek de las tarjetas vecinas
 * llegue al borde real de la pantalla en vez de quedar recortado por ese
 * margen. Los dos "espaciadores" (w-[6%] antes/después de las tarjetas)
 * reservan el mismo ancho que le falta a una tarjeta w-[88%] para llegar
 * al 100%, así la primera y la última tarjeta también pueden centrarse —
 * van como hijos del flex, no como padding del contenedor: un padding ahí
 * encogería el ancho disponible para sus hijos (88% de un 88%, ~77% en
 * vez de 88%).
 */
export function MesCarousel({
  loading,
  meses,
  anioActual,
  mesActual,
  label1,
  label2,
  datosMes,
  datosMesAnterior,
  anteriorLabel,
  datosPromedio,
  anteriorTooltip,
  masEsMalo = false,
}: MesCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  // "back" de la tarjeta centrada — arranca en 0 porque el carrusel también
  // arranca mostrando el mes actual (ver el useEffect de scrollTo abajo), y
  // de ahí en más lo mantiene al día el IntersectionObserver de abajo
  const [activeBack, setActiveBack] = useState(0)

  // al cargar (o cuando cambia la cantidad de meses disponibles) arranca
  // mostrando el mes actual, pegado al borde derecho del carrusel
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'auto' })
  }, [meses.length])

  // qué tarjeta está centrada, para la etiqueta de mes de arriba —
  // rootMargin "-50%" a los costados angosta el área de intersección a una
  // línea vertical en el centro del carrusel, así el callback dispara con
  // la tarjeta que cruza esa línea (la que está centrada), sin tener que
  // recalcular a mano posiciones de scroll mezclando %/px (spacers, gap,
  // tarjetas al 88%)
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (!visible) return
        const back = Number((visible.target as HTMLElement).dataset.back)
        setActiveBack(back)
      },
      { root, rootMargin: '0px -50% 0px -50%', threshold: 0 },
    )
    for (const el of cardRefs.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [meses])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    )
  }

  const { year: activeYear, month: activeMonth } = restarMeses(anioActual, mesActual, activeBack)

  return (
    <div>
      <p className="mb-1.5 text-center text-sm font-semibold text-ink">
        {formatMesLabel(activeYear, activeMonth, anioActual)}
      </p>

      <div className="-mx-4 md:-mx-6">
        <div ref={scrollRef} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth">
          <div aria-hidden className="w-[6%] shrink-0" />
          {meses.map((back) => {
            const actual = datosMes(back)
            const anterior = datosMesAnterior?.(back)
            // "mes pasado" acá es el mes calendario completo anterior a
            // esta tarjeta (back+1), no confundir con datosMesAnterior de
            // arriba (que compara "a esta altura", un tramo parcial) — son
            // dos comparaciones distintas y pueden convivir en la misma tarjeta
            const pasado = datosMes(back + 1)
            const pct1 = pctVsMesPasado(actual.valor1, pasado.valor1)
            const pct2 = pctVsMesPasado(actual.valor2, pasado.valor2)
            return (
              // 88% del ancho (no 100%): deja asomar un margen de la
              // tarjeta vecina a cada lado como pista visual de que se
              // puede deslizar. onClick: tocar ese margen (la tarjeta de
              // al lado, todavía asomando) la trae al centro sin
              // necesidad de deslizar — scrollIntoView respeta el
              // snap-center de abajo.
              <div
                key={back}
                ref={(el) => {
                  if (el) cardRefs.current.set(back, el)
                  else cardRefs.current.delete(back)
                }}
                data-back={back}
                onClick={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })}
                className="w-[88%] shrink-0 snap-center"
              >
                <div className="rounded-xl border border-border bg-surface p-3">
                  <div className="grid grid-cols-2 gap-x-4">
                    <div>
                      <p className="text-xs font-medium text-ink-muted">{label1}</p>
                      <p className="text-lg font-semibold text-ink">{formatCurrency(actual.valor1)}</p>
                      <p className={`text-[11px] font-medium ${pctColorClass(pct1, masEsMalo)}`}>{formatPct(pct1)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-ink-muted">{label2}</p>
                      <p className="text-lg font-semibold text-ink">{formatCurrency(actual.valor2)}</p>
                      <p className={`text-[11px] font-medium ${pctColorClass(pct2, masEsMalo)}`}>{formatPct(pct2)}</p>
                    </div>
                  </div>
                  {anterior && (
                    <>
                      <div className="mt-2.5 flex items-center justify-center gap-1 border-t border-border pt-2">
                        <p className="text-[11px] font-medium text-ink-muted">
                          {anteriorLabel ? anteriorLabel(back) : 'Mes anterior a esta altura'}
                        </p>
                        {anteriorTooltip?.(back) && <InfoTooltip text={anteriorTooltip(back)!} />}
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-4">
                        <div>
                          <p className="text-[11px] text-ink-muted">{label1}</p>
                          <p className="text-sm font-medium text-ink-muted">{formatCurrency(anterior.valor1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-ink-muted">{label2}</p>
                          <p className="text-sm font-medium text-ink-muted">{formatCurrency(anterior.valor2)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          <div aria-hidden className="w-[6%] shrink-0" />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <p className="text-left text-xs font-medium text-ink-muted">Promedio (6 meses)</p>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <p className="text-[11px] text-ink-muted">{label1}</p>
              <p className="text-sm font-medium text-ink-muted">{formatCurrency(datosPromedio.valor1)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-ink-muted">{label2}</p>
              <p className="text-sm font-medium text-ink-muted">{formatCurrency(datosPromedio.valor2)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
