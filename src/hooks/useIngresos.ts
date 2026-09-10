import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TURNO_SELECT } from '../lib/turnoSelect'
import { mapTurnoRow, type Turno, type TurnoRow } from '../types/turno'

// "Ingreso" = el precio de un turno facturable. Facturable, mismo criterio
// que useDashboardStats: un turno Finalizado, MÁS un turno Cancelado que
// estaba señado (la seña queda como ingreso aunque el turno no se haya
// concretado — ver NuevoTurnoForm.aplicarPrecioSenaSiCorresponde, que deja
// `precio` en el monto de la seña al cancelar). Un Agendado todavía puede
// caerse, así que no cuenta hasta que se cumple.
//
// Devuelve TODOS los turnos facturables (sin importar la fecha) para poder
// armar el historial completo por mes/año. PostgREST corta en 1000 filas
// por consulta, así que se trae en páginas de PAGE_SIZE hasta agotar —
// tanto la pantalla de Ingresos como su historial necesitan la serie
// completa, no una ventana de meses recientes.
const PAGE_SIZE = 1000

export function useIngresos() {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const acumulado: TurnoRow[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error: fetchError } = await supabase
        .from('turnos')
        .select(TURNO_SELECT)
        .or('estado.eq.Finalizado,and(estado.eq.Cancelado,senado.eq.true)')
        .order('fecha', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }
      const pagina = (data ?? []) as unknown as TurnoRow[]
      acumulado.push(...pagina)
      if (pagina.length < PAGE_SIZE) break
    }

    setError(null)
    setTurnos(acumulado.map(mapTurnoRow))
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()

    // el FAB crea/edita turnos desde cualquier página, y el cron
    // finalizar_turnos_vencidos pasa Agendados a Finalizado dentro de
    // Postgres — en ambos casos esta lista se refresca sola mientras
    // está montada
    const channel = supabase
      .channel('ingresos-turnos-realtime')
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
