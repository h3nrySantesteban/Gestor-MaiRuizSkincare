import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TURNO_SELECT } from '../lib/turnoSelect'
import { mapTurnoRow, type EstadoTurno, type Turno, type TurnoRow } from '../types/turno'

export interface TurnoFilters {
  fechaDesde?: string
  fechaHasta?: string
  pacienteId?: string
  estados?: EstadoTurno[]
}

export function useTurnos(filters: TurnoFilters = {}) {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { fechaDesde, fechaHasta, pacienteId, estados } = filters
  // el contenido (no la identidad) del array es lo que debe disparar un refetch
  const estadosKey = estados?.join(',') ?? ''

  const refetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('turnos').select(TURNO_SELECT).order('fecha', { ascending: false })
    if (fechaDesde) query = query.gte('fecha', fechaDesde)
    if (fechaHasta) query = query.lte('fecha', fechaHasta)
    if (pacienteId) query = query.eq('paciente_id', pacienteId)
    if (estados && estados.length > 0) query = query.in('estado', estados)

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setTurnos((data as unknown as TurnoRow[]).map(mapTurnoRow))
    }
    setLoading(false)
    // estados se resume en estadosKey; excluirlo evita refetch cuando el caller pasa un array nuevo con el mismo contenido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, pacienteId, estadosKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()

    // cualquier alta/edición de turno (desde el FAB en otra página, o el bot
    // cancelando por WhatsApp) refresca esta lista mientras está montada
    const channel = supabase
      .channel('turnos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  return { turnos, loading, error, refetch }
}
