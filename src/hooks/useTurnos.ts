import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TURNO_SELECT } from '../lib/turnoSelect'
import { mapTurnoRow, type EstadoTurno, type Turno, type TurnoRow } from '../types/turno'

export interface TurnoFilters {
  fechaDesde?: string
  fechaHasta?: string
  pacienteId?: string
  estados?: EstadoTurno[]
  tratamientoIds?: string[]
}

// 3 grupos, en este orden: Agendados (los más próximos primero, para ver
// qué viene ahora) — Finalizado/Otro/Cancelado sin seña (del más reciente
// al más lejano) — Cancelado señado al final (la seña quedó como ingreso,
// pero sigue siendo un turno cancelado, no uno "activo"). Turnos.tsx usa
// este mismo criterio para dibujar las barras entre grupos.
function grupo(t: Turno): 0 | 1 | 2 {
  if (t.estado === 'Agendado') return 0
  if (t.estado === 'Cancelado' && t.senado) return 2
  return 1
}

function compareTurnos(a: Turno, b: Turno): number {
  const grupoA = grupo(a)
  const grupoB = grupo(b)
  if (grupoA !== grupoB) return grupoA - grupoB

  const aTime = new Date(a.fecha).getTime()
  const bTime = new Date(b.fecha).getTime()
  return grupoA === 0 ? aTime - bTime : bTime - aTime
}

export function useTurnos(filters: TurnoFilters = {}) {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { fechaDesde, fechaHasta, pacienteId, estados, tratamientoIds } = filters
  // el contenido (no la identidad) del array es lo que debe disparar un refetch
  const estadosKey = estados?.join(',') ?? ''
  const tratamientoIdsKey = tratamientoIds?.join(',') ?? ''

  const refetch = useCallback(async () => {
    setLoading(true)

    // el filtro por tratamiento vive en la tabla puente turno_tratamientos
    // (relación muchos-a-muchos) — no se puede resolver con un .eq/.in directo
    // sobre turnos. Se resuelve en dos pasos: primero los turno_id que tienen
    // AL MENOS UNO de los tratamientos seleccionados, después se filtra la
    // consulta principal por esos ids. Hacerlo con `turno_tratamientos!inner`
    // + .in() en la consulta principal filtraría también el array embebido
    // (mostraría solo el tratamiento que matchea, no todos los del turno).
    if (tratamientoIds && tratamientoIds.length > 0) {
      const { data: matches, error: matchError } = await supabase
        .from('turno_tratamientos')
        .select('turno_id')
        .in('tratamiento_id', tratamientoIds)
      if (matchError) {
        setError(matchError.message)
        setLoading(false)
        return
      }
      const turnoIds = [...new Set((matches as { turno_id: string }[]).map((m) => m.turno_id))]
      if (turnoIds.length === 0) {
        setError(null)
        setTurnos([])
        setLoading(false)
        return
      }
      return runQuery(turnoIds)
    }

    return runQuery()

    async function runQuery(turnoIds?: string[]) {
      let query = supabase.from('turnos').select(TURNO_SELECT).order('fecha', { ascending: false })
      if (fechaDesde) query = query.gte('fecha', fechaDesde)
      if (fechaHasta) query = query.lte('fecha', fechaHasta)
      if (pacienteId) query = query.eq('paciente_id', pacienteId)
      if (estados && estados.length > 0) query = query.in('estado', estados)
      if (turnoIds) query = query.in('id', turnoIds)

      const { data, error: fetchError } = await query
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setError(null)
        setTurnos((data as unknown as TurnoRow[]).map(mapTurnoRow).sort(compareTurnos))
      }
      setLoading(false)
    }
    // estados/tratamientoIds se resumen en sus *Key; excluirlos evita refetch cuando el caller pasa un array nuevo con el mismo contenido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, pacienteId, estadosKey, tratamientoIdsKey])

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
