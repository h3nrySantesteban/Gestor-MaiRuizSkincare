import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Cantidad de turnos por paciente (todos los estados, igual que el
 * contador "X turnos" del perfil del paciente) — separado de usePacientes
 * porque esa tabla no trae turnos, y de useTurnos porque acá solo importa
 * el conteo, no el listado completo. Usado por Pacientes.tsx para ordenar
 * por cantidad de turnos.
 */
export function useTurnoCountsPorPaciente() {
  const [counts, setCounts] = useState<Map<string, number>>(new Map())

  const refetch = useCallback(async () => {
    const { data } = await supabase.from('turnos').select('paciente_id')
    const map = new Map<string, number>()
    for (const t of data ?? []) {
      const id = t.paciente_id as string
      map.set(id, (map.get(id) ?? 0) + 1)
    }
    setCounts(map)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens en un microtask posterior
    refetch()
  }, [refetch])

  return counts
}
