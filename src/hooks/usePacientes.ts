import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapPacienteRow, type Paciente, type PacienteRow } from '../types/paciente'

export interface PacienteInput {
  nombreCompleto: string
  telefono: string | null
  instagram: string | null
  email: string | null
}

export function usePacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('pacientes')
      .select('id, nombre_completo, telefono, instagram, email, created_at')
      .order('nombre_completo', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setPacientes((data as PacienteRow[]).map(mapPacienteRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()
  }, [refetch])

  const create = useCallback(
    async (input: PacienteInput): Promise<Paciente> => {
      const { data, error: insertError } = await supabase
        .from('pacientes')
        .insert({
          nombre_completo: input.nombreCompleto,
          telefono: input.telefono,
          instagram: input.instagram,
          email: input.email,
        })
        .select('id, nombre_completo, telefono, instagram, email, created_at')
        .single()
      if (insertError) throw insertError
      await refetch()
      return mapPacienteRow(data as PacienteRow)
    },
    [refetch],
  )

  const update = useCallback(
    async (id: string, input: PacienteInput) => {
      const { error: updateError } = await supabase
        .from('pacientes')
        .update({
          nombre_completo: input.nombreCompleto,
          telefono: input.telefono,
          instagram: input.instagram,
          email: input.email,
        })
        .eq('id', id)
      if (updateError) throw updateError
      await refetch()
    },
    [refetch],
  )

  return { pacientes, loading, error, refetch, create, update }
}
