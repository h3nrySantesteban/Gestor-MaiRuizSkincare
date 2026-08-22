import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Ids de pacientes que tienen al menos un turno con una nota cargada —
 * separado de usePacientes porque esa tabla no trae turnos, y de useTurnos
 * porque acá solo importa "tiene alguna nota sí/no", no el listado completo.
 * Usado por Pacientes.tsx para el ícono de "tiene notas" en el listado.
 */
export function usePacienteIdsConNotasEnTurnos() {
  const [ids, setIds] = useState<Set<string>>(new Set())

  const refetch = useCallback(async () => {
    const { data } = await supabase.from('turnos').select('paciente_id').not('notas', 'is', null)
    setIds(new Set((data ?? []).map((t) => t.paciente_id as string)))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens en un microtask posterior
    refetch()
  }, [refetch])

  return ids
}
