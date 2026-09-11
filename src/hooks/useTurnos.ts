import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TURNO_SELECT } from '../lib/turnoSelect'
import { mapTurnoRow, type EstadoTurno, type Turno, type TurnoRow } from '../types/turno'

export interface TurnoFilters {
  fechaDesde?: string
  fechaHasta?: string
  pacienteId?: string
  estados?: EstadoTurno[]
  tratamientoIds?: string[]
  /** turnos sin NINGÚN tratamiento cargado — ver comentario en runQuery */
  sinTratamiento?: boolean
}

// Postgrest devuelve como mucho 1000 filas por consulta (límite del
// proyecto) — sin paginar, una vez que hay más de 1000 turnos en total la
// consulta recorta en silencio y la pantalla de Turnos deja de mostrar los
// más viejos. Los Agendados se traen siempre completos (es un conjunto
// acotado: turnos futuros, y finalizar_turnos_vencidos los saca de esta
// lista solo con que pase 1h de su fecha) — lo que crece sin límite con el
// tiempo es el histórico (Finalizado/Otro/Cancelado), así que ahí es donde
// se pagina de a HISTORICO_PAGE_SIZE con "cargar más".
const HISTORICO_PAGE_SIZE = 100

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // cuántas filas históricas pedir la próxima vez que se refetchee — crece
  // con loadMore(); un refetch disparado por realtime respeta este valor en
  // vez de resetear la página a la inicial (ver el useEffect de abajo, que
  // sí lo resetea cuando cambian los filtros)
  const historicoLimitRef = useRef(HISTORICO_PAGE_SIZE)

  const { fechaDesde, fechaHasta, pacienteId, estados, tratamientoIds, sinTratamiento } = filters
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
        setHasMore(false)
        setLoading(false)
        return
      }
      return runQuery(turnoIds)
    }

    return runQuery()

    async function runQuery(turnoIds?: string[]) {
      // el corte Agendado/histórico sigue aplicando aunque haya un filtro de
      // estado activo: pedir solo "Agendado" no debería traer históricos, y
      // pedir "Finalizado" no debería traer agendados.
      const quiereAgendados = !estados || estados.length === 0 || estados.includes('Agendado')
      const estadosHistoricos = estados && estados.length > 0 ? estados.filter((e) => e !== 'Agendado') : null
      const quiereHistoricos = !estados || estados.length === 0 || estadosHistoricos!.length > 0

      let agendadosQuery = supabase.from('turnos').select(TURNO_SELECT).eq('estado', 'Agendado').order('fecha', { ascending: true })
      if (fechaDesde) agendadosQuery = agendadosQuery.gte('fecha', fechaDesde)
      if (fechaHasta) agendadosQuery = agendadosQuery.lte('fecha', fechaHasta)
      if (pacienteId) agendadosQuery = agendadosQuery.eq('paciente_id', pacienteId)
      if (turnoIds) agendadosQuery = agendadosQuery.in('id', turnoIds)

      const limit = historicoLimitRef.current
      let historicoQuery = supabase
        .from('turnos')
        .select(TURNO_SELECT, { count: 'exact' })
        .neq('estado', 'Agendado')
        .order('fecha', { ascending: false })
        .range(0, limit - 1)
      if (fechaDesde) historicoQuery = historicoQuery.gte('fecha', fechaDesde)
      if (fechaHasta) historicoQuery = historicoQuery.lte('fecha', fechaHasta)
      if (pacienteId) historicoQuery = historicoQuery.eq('paciente_id', pacienteId)
      if (turnoIds) historicoQuery = historicoQuery.in('id', turnoIds)
      if (estadosHistoricos) historicoQuery = historicoQuery.in('estado', estadosHistoricos)

      const [agendadosRes, historicoRes] = await Promise.all([
        quiereAgendados ? agendadosQuery : Promise.resolve({ data: [] as TurnoRow[], error: null, count: 0 }),
        quiereHistoricos
          ? historicoQuery
          : Promise.resolve({ data: [] as TurnoRow[], error: null, count: 0 }),
      ])

      if (agendadosRes.error || historicoRes.error) {
        setError(agendadosRes.error?.message ?? historicoRes.error?.message ?? 'Error desconocido')
        setLoading(false)
        setLoadingMore(false)
        return
      }
      setError(null)
      let agendados = (agendadosRes.data as unknown as TurnoRow[]).map(mapTurnoRow)
      let historicos = (historicoRes.data as unknown as TurnoRow[]).map(mapTurnoRow).sort(compareTurnos)
      // "sin tratamiento" se filtra client-side, no con un .not('id','in',…):
      // la exclusión requeriría primero traer TODOS los turno_id que sí
      // tienen algún tratamiento (pueden ser miles), y meterlos en la URL de
      // la consulta principal — con este volumen de turnos esa lista rompe
      // el límite de longitud de una request GET. Al filtrar sobre la página
      // ya traída, "cargar más" puede necesitar más de un click para que
      // aparezcan nuevos resultados (hasMore sigue el conteo sin filtrar).
      if (sinTratamiento) {
        agendados = agendados.filter((t) => t.tratamientos.length === 0)
        historicos = historicos.filter((t) => t.tratamientos.length === 0)
      }
      setTurnos([...agendados, ...historicos])
      setHasMore((historicoRes.count ?? 0) > limit)
      setLoading(false)
      setLoadingMore(false)
    }
    // estados/tratamientoIds se resumen en sus *Key; excluirlos evita refetch cuando el caller pasa un array nuevo con el mismo contenido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, pacienteId, estadosKey, tratamientoIdsKey, sinTratamiento])

  const loadMore = useCallback(() => {
    historicoLimitRef.current += HISTORICO_PAGE_SIZE
    setLoadingMore(true)
    refetch()
  }, [refetch])

  useEffect(() => {
    // nuevos filtros arrancan de nuevo desde la primera página del histórico
    historicoLimitRef.current = HISTORICO_PAGE_SIZE
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens en un microtask posterior
    refetch()

    // cualquier alta/edición de turno (desde el FAB en otra página, o el bot
    // cancelando por WhatsApp) refresca esta lista mientras está montada —
    // usa el límite actual (no resetea la página si ya se cargó más)
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

  return { turnos, loading, loadingMore, hasMore, error, refetch, loadMore }
}
