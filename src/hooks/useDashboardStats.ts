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

/**
 * Próximo turno, totales de la semana/mes en curso y una serie de 6 meses
 * (mes actual + 5 anteriores) para el gráfico del dashboard. Turnos
 * cancelados no cuentan para ninguno de estos totales.
 */
export function useDashboardStats() {
  const [proximoTurno, setProximoTurno] = useState<Turno | null>(null)
  const [semana, setSemana] = useState<RangoStats>({ cantidad: 0, ingresos: 0 })
  const [mes, setMes] = useState<RangoStats>({ cantidad: 0, ingresos: 0 })
  const [serieSeisMeses, setSerieSeisMeses] = useState<MesSerie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const desde = startOfMonth(subMonths(now, 5))
    const hasta = endOfMonth(now)

    const [historicoRes, proximoRes] = await Promise.all([
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
    ])

    if (historicoRes.error || proximoRes.error) {
      setError(historicoRes.error?.message ?? proximoRes.error?.message ?? 'Error desconocido')
      setLoading(false)
      return
    }
    setError(null)

    const turnos = (historicoRes.data as unknown as TurnoRow[]).map(mapTurnoRow)

    // 6 buckets fijos (aunque algún mes tenga 0 turnos) para que el gráfico no salte de eje
    const buckets: MesSerie[] = Array.from({ length: 6 }, (_, i) => {
      const mesDate = subMonths(hasta, 5 - i)
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
    let semanaAcc: RangoStats = { cantidad: 0, ingresos: 0 }
    let mesAcc: RangoStats = { cantidad: 0, ingresos: 0 }

    for (const turno of turnos) {
      const fecha = new Date(turno.fecha)
      const bucket = bucketByKey.get(format(fecha, 'yyyy-MM'))
      if (bucket) {
        bucket.ingresos += turno.precio
        bucket.cantidad += 1
        if (fecha.getDate() <= diaDeHoy) {
          bucket.ingresosAlaFecha += turno.precio
        }
      }
      if (isWithinInterval(fecha, semanaInterval)) {
        semanaAcc = { cantidad: semanaAcc.cantidad + 1, ingresos: semanaAcc.ingresos + turno.precio }
      }
      if (isWithinInterval(fecha, mesInterval)) {
        mesAcc = { cantidad: mesAcc.cantidad + 1, ingresos: mesAcc.ingresos + turno.precio }
      }
    }

    setSerieSeisMeses(buckets)
    setSemana(semanaAcc)
    setMes(mesAcc)
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

  return { proximoTurno, semana, mes, serieSeisMeses, loading, error, refetch }
}
