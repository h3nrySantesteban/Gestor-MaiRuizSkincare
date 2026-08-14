import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface TopTratamiento {
  tratamientoId: string
  nombre: string
  ingresos: number
  cantidad: number
}

interface TurnoTratamientoRow {
  tratamiento_id: string
  precio_aplicado: number
  tratamientos: { nombre: string } | null
}

/** Ranking de tratamientos por ingresos en un rango de fechas — solo turnos Finalizados cuentan como ingreso. */
export function useTopTratamientos(desde: string, hasta: string) {
  const [top, setTop] = useState<TopTratamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    // turnos!inner: necesario para poder filtrar por columnas de la tabla embebida (PostgREST)
    const { data, error: fetchError } = await supabase
      .from('turno_tratamientos')
      .select('tratamiento_id, precio_aplicado, tratamientos ( nombre ), turnos!inner ( fecha, estado )')
      .gte('turnos.fecha', desde)
      .lte('turnos.fecha', hasta)
      .eq('turnos.estado', 'Finalizado')

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }
    setError(null)

    const byTratamiento = new Map<string, TopTratamiento>()
    for (const row of (data ?? []) as unknown as TurnoTratamientoRow[]) {
      const existing = byTratamiento.get(row.tratamiento_id) ?? {
        tratamientoId: row.tratamiento_id,
        nombre: row.tratamientos?.nombre ?? '',
        ingresos: 0,
        cantidad: 0,
      }
      existing.ingresos += row.precio_aplicado
      existing.cantidad += 1
      byTratamiento.set(row.tratamiento_id, existing)
    }

    setTop(Array.from(byTratamiento.values()).sort((a, b) => b.ingresos - a.ingresos))
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()
  }, [refetch])

  return { top, loading, error }
}
