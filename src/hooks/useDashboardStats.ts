import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabaseClient'
import { TURNO_SELECT } from '../lib/turnoSelect'
import { mapTurnoRow, type Turno, type TurnoRow } from '../types/turno'

export interface MesSerie {
  mes: string
  mesKey: string
  ingresos: number
  /** ingresos de ese mes contando solo días 1..N, con N = el día del mes de hoy — compara cada mes "a la misma altura" */
  ingresosAlaFecha: number
  cantidad: number
}

export interface RangoStats {
  cantidad: number
  ingresos: number
}

export interface AgendadosStats {
  cantidad: number
  /** promedio de precio de los tratamientos activos × cantidad — muchos turnos se cargan sin tratamiento, así que precio no siempre refleja lo que se va a cobrar */
  ingresoAprox: number
}

/**
 * Próximo turno, totales de la semana/mes en curso, lo que queda agendado
 * para lo que resta de la semana/mes, y una serie de 6 meses (mes actual +
 * 5 anteriores) para el gráfico del dashboard. Turnos cancelados no cuentan
 * para ninguno de estos totales. "cantidad" cuenta cualquier turno no
 * cancelado (actividad), pero "ingresos"/"ingresosAlaFecha" solo suman
 * turnos ya Finalizados — un turno Agendado todavía puede cancelarse o no
 * concretarse, así que no se factura hasta que se cumple (ver
 * finalizar_turnos_vencidos en supabase-setup.sql, que pasa un turno de
 * Agendado a Finalizado solo cuando ya pasó 1h de su fecha).
 */
export function useDashboardStats() {
  const [proximoTurno, setProximoTurno] = useState<Turno | null>(null)
  const [semana, setSemana] = useState<RangoStats>({ cantidad: 0, ingresos: 0 })
  const [mes, setMes] = useState<RangoStats>({ cantidad: 0, ingresos: 0 })
  const [agendadosSemana, setAgendadosSemana] = useState<AgendadosStats>({ cantidad: 0, ingresoAprox: 0 })
  const [agendadosMes, setAgendadosMes] = useState<AgendadosStats>({ cantidad: 0, ingresoAprox: 0 })
  const [serieSeisMeses, setSerieSeisMeses] = useState<MesSerie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const desde = startOfMonth(subMonths(now, 5))
    const finDeSemana = endOfWeek(now, { weekStartsOn: 1 })
    const finDeMes = endOfMonth(now)
    // en los últimos días del mes la semana puede terminar ya entrado el mes
    // siguiente — ensanchamos el límite superior para no cortar esos turnos
    const hasta = finDeSemana > finDeMes ? finDeSemana : finDeMes

    const [historicoRes, proximoRes, tratamientosRes] = await Promise.all([
      supabase
        .from('turnos')
        .select(TURNO_SELECT)
        .gte('fecha', desde.toISOString())
        .lte('fecha', hasta.toISOString())
        .neq('estado', 'Cancelado'),
      supabase
        .from('turnos')
        .select(TURNO_SELECT)
        .gte('fecha', now.toISOString())
        .eq('estado', 'Agendado')
        .order('fecha', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('tratamientos').select('precio').eq('activo', true),
    ])

    if (historicoRes.error || proximoRes.error || tratamientosRes.error) {
      setError(
        historicoRes.error?.message ?? proximoRes.error?.message ?? tratamientosRes.error?.message ?? 'Error desconocido',
      )
      setLoading(false)
      return
    }
    setError(null)

    const turnos = (historicoRes.data as unknown as TurnoRow[]).map(mapTurnoRow)
    const precios = (tratamientosRes.data ?? []).map((t) => t.precio as number)
    const precioPromedio = precios.length > 0 ? precios.reduce((acc, p) => acc + p, 0) / precios.length : 0

    // 6 buckets fijos (aunque algún mes tenga 0 turnos) para que el gráfico no salte de eje
    const buckets: MesSerie[] = Array.from({ length: 6 }, (_, i) => {
      const mesDate = subMonths(finDeMes, 5 - i)
      return {
        mes: format(mesDate, 'MMM', { locale: es }),
        mesKey: format(mesDate, 'yyyy-MM'),
        ingresos: 0,
        ingresosAlaFecha: 0,
        cantidad: 0,
      }
    })
    const bucketByKey = new Map(buckets.map((b) => [b.mesKey, b]))
    const diaDeHoy = now.getDate()

    const semanaInterval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    const mesInterval = { start: startOfMonth(now), end: endOfMonth(now) }
    // "lo que queda": desde ahora (no desde el inicio del período) hasta el final
    const restoSemanaInterval = { start: now, end: finDeSemana }
    const restoMesInterval = { start: now, end: finDeMes }
    let semanaAcc: RangoStats = { cantidad: 0, ingresos: 0 }
    let mesAcc: RangoStats = { cantidad: 0, ingresos: 0 }
    let agendadosSemanaCount = 0
    let agendadosMesCount = 0

    for (const turno of turnos) {
      const fecha = new Date(turno.fecha)
      const facturable = turno.estado === 'Finalizado'
      const bucket = bucketByKey.get(format(fecha, 'yyyy-MM'))
      if (bucket) {
        bucket.cantidad += 1
        if (facturable) {
          bucket.ingresos += turno.precio
          if (fecha.getDate() <= diaDeHoy) {
            bucket.ingresosAlaFecha += turno.precio
          }
        }
      }
      if (isWithinInterval(fecha, semanaInterval)) {
        semanaAcc = {
          cantidad: semanaAcc.cantidad + 1,
          ingresos: semanaAcc.ingresos + (facturable ? turno.precio : 0),
        }
      }
      if (isWithinInterval(fecha, mesInterval)) {
        mesAcc = { cantidad: mesAcc.cantidad + 1, ingresos: mesAcc.ingresos + (facturable ? turno.precio : 0) }
      }
      if (turno.estado === 'Agendado') {
        if (isWithinInterval(fecha, restoSemanaInterval)) agendadosSemanaCount += 1
        if (isWithinInterval(fecha, restoMesInterval)) agendadosMesCount += 1
      }
    }

    setSerieSeisMeses(buckets)
    setSemana(semanaAcc)
    setMes(mesAcc)
    setAgendadosSemana({ cantidad: agendadosSemanaCount, ingresoAprox: agendadosSemanaCount * precioPromedio })
    setAgendadosMes({ cantidad: agendadosMesCount, ingresoAprox: agendadosMesCount * precioPromedio })
    setProximoTurno(proximoRes.data ? mapTurnoRow(proximoRes.data as unknown as TurnoRow) : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()

    // el FAB puede crear un turno desde cualquier página; si el dashboard
    // sigue montado (u otra pestaña), se refresca solo
    const channel = supabase
      .channel('dashboard-turnos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  return {
    proximoTurno,
    semana,
    mes,
    agendadosSemana,
    agendadosMes,
    serieSeisMeses,
    loading,
    error,
    refetch,
  }
}
