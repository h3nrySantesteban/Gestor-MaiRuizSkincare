import { useMemo } from 'react'
import { MesCarousel, type DatosMes } from '../MesCarousel/MesCarousel'
import { claveMes, mesesAtras, restarMeses } from '../../lib/mesCarousel'
import { parseFechaSolo } from '../../lib/format'
import type { Gasto } from '../../types/gasto'

interface GastosCarouselProps {
  gastos: Gasto[]
  loading: boolean
}

interface MesTotales {
  total: number
  habituales: number
}

// un solo recorrido de gastos arma el mapa mes -> totales; todo lo demás
// (total/habituales de un mes puntual, promedios de 6 meses) sale de mirar
// este mapa, no de volver a filtrar el array completo cada vez
function construirTotalesPorMes(gastos: Gasto[]): Map<string, MesTotales> {
  const map = new Map<string, MesTotales>()
  function entrada(key: string): MesTotales {
    let e = map.get(key)
    if (!e) {
      e = { total: 0, habituales: 0 }
      map.set(key, e)
    }
    return e
  }
  for (const g of gastos) {
    // gastos.fecha es date-only (no timestamptz, a diferencia de
    // turnos.fecha) — parseFechaSolo evita el corrimiento de día por UTC
    const d = parseFechaSolo(g.fecha)
    const e = entrada(claveMes(d.getFullYear(), d.getMonth() + 1))
    e.total += g.valor
    if (g.esFijo) e.habituales += g.valor
  }
  return map
}

function totalesDelMes(map: Map<string, MesTotales>, year: number, month: number): MesTotales {
  return map.get(claveMes(year, month)) ?? { total: 0, habituales: 0 }
}

// promedio de los 6 meses CERRADOS anteriores a HOY — un solo número fijo,
// no uno por tarjeta (ver comentario en MesCarousel: recalcularlo para
// cada mes del carrusel no tenía sentido, así que vive afuera del slider)
function promedios6MesesCerrados(map: Map<string, MesTotales>, anioActual: number, mesActual: number): MesTotales {
  let total = 0
  let habituales = 0
  for (let i = 1; i <= 6; i++) {
    const { year, month } = restarMeses(anioActual, mesActual, i)
    const t = totalesDelMes(map, year, month)
    total += t.total
    habituales += t.habituales
  }
  return { total: total / 6, habituales: habituales / 6 }
}

/**
 * Total gastado = suma de gastos.valor del mes (mismo criterio que
 * totalDelMes en Gastos.tsx). Gastos habituales = la porción de ese total
 * que corresponde a gastos marcados es_fijo — no resta nada, es un
 * desglose del mismo total, no una cuenta neta.
 *
 * A diferencia de IngresosCarousel, no pasa datosMesAnterior: comparar
 * "cuánto llevamos gastado este mes vs. el mismo tramo del mes pasado" no
 * aporta nada útil acá (los gastos no se acumulan progresivamente como un
 * ingreso que se va facturando en el mes, dependen de cuándo Mai los
 * carga) — MesCarousel ya soporta que ese dato venga o no.
 *
 * La estructura visual (peek, navegación, tarjeta de promedio) vive en
 * MesCarousel — esto solo calcula qué números le corresponden a cada mes.
 */
export function GastosCarousel({ gastos, loading }: GastosCarouselProps) {
  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  const totalesPorMes = construirTotalesPorMes(gastos)

  // cuántos meses hacia atrás llega el carrusel: hasta el mes más viejo con
  // algún gasto cargado (0 si no hay nada todavía, solo el mes en curso)
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
    const t = totalesDelMes(totalesPorMes, year, month)
    return { valor1: t.total, valor2: t.habituales }
  }

  return (
    <MesCarousel
      loading={loading}
      meses={meses}
      anioActual={anioActual}
      mesActual={mesActual}
      label1="Total gastado"
      label2="Gastos habituales"
      datosMes={datosMes}
      datosPromedio={{ valor1: promedio.total, valor2: promedio.habituales }}
    />
  )
}
