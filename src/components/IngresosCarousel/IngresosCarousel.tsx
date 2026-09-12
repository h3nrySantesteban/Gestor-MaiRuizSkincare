import { useMemo } from 'react'
import { MesCarousel, type DatosMes } from '../MesCarousel/MesCarousel'
import { claveMes, diasEnMes, mesesAtras, restarMeses } from '../../lib/mesCarousel'
import { parseFechaSolo } from '../../lib/format'
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

function totalesDelMes(map: Map<string, MesTotales>, year: number, month: number): MesTotales {
  return map.get(claveMes(year, month)) ?? { bruto: 0, gastos: 0 }
}

// promedio de los 6 meses CERRADOS anteriores a HOY — un solo número fijo,
// no uno por tarjeta (ver comentario en MesCarousel: recalcularlo para
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
 * Bruto = suma de turno.precio de los turnos facturables del mes (mismo
 * criterio que useIngresos). Neto = bruto menos el total de gastos
 * cargados ese mismo mes — es la ÚNICA cuenta de toda la app que resta
 * gastos contra ingresos (ver CLAUDE.md: en Dashboard/Analytics/Gastos
 * nunca se netean), acá es a propósito porque Mai lo pidió como vista
 * puntual, no cambia ningún otro cálculo de ingresos existente.
 *
 * La estructura visual (peek, navegación, tarjeta de promedio) vive en
 * MesCarousel — esto solo calcula qué números le corresponden a cada mes.
 */
export function IngresosCarousel({ turnos, gastos, loading }: IngresosCarouselProps) {
  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  const totalesPorMes = construirTotalesPorMes(turnos, gastos)

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
  // el carrusel arranca de entrada pegado a la derecha, mostrando el mes en curso
  const meses = useMemo(() => Array.from({ length: maxBack + 1 }, (_, i) => maxBack - i), [maxBack])

  const promedio = promedios6MesesCerrados(totalesPorMes, anioActual, mesActual)

  function datosMes(back: number): DatosMes {
    const { year, month } = restarMeses(anioActual, mesActual, back)
    const { bruto, gastos: gastosDelMes } = totalesDelMes(totalesPorMes, year, month)
    return { valor1: bruto - gastosDelMes, valor2: bruto }
  }

  function datosMesAnterior(back: number): DatosMes {
    const { year, month } = restarMeses(anioActual, mesActual, back)
    const r = totalMesAnteriorAEstaAltura(turnos, gastos, year, month, hoy)
    return { valor1: r.neto, valor2: r.bruto }
  }

  return (
    <MesCarousel
      loading={loading}
      meses={meses}
      anioActual={anioActual}
      mesActual={mesActual}
      label1="Ingreso Neto"
      label2="Ingreso Bruto"
      datosMes={datosMes}
      datosMesAnterior={datosMesAnterior}
      datosPromedio={{ valor1: promedio.neto, valor2: promedio.bruto }}
      anteriorTooltip="Ingresos del mes anterior, contando solo hasta el día de hoy del calendario — mismo tramo que ya lleva el mes en curso, para comparar en igualdad de condiciones."
    />
  )
}
