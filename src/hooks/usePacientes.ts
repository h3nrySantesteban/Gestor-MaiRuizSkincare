import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapPacienteRow, type Paciente, type PacienteRow } from '../types/paciente'

export interface PacienteInput {
  nombreCompleto: string
  telefono: string | null
  instagram: string | null
  email: string | null
  notas: string | null
}

// turnos.paciente_id es "on delete restrict" y respuestas_formulario.paciente_id
// no tiene "on delete cascade" tampoco (ver supabase-setup.sql) — un paciente
// con turnos o formularios asociados no se puede borrar sin perder ese
// historial. Acá solo se traduce ese error de Postgres a un mensaje que Mai
// pueda entender, igual que traducirError en useTratamientos.ts.
function traducirError(error: { code?: string; message: string }): Error {
  if (error.code === '23503') {
    return new Error('Este paciente tiene turnos o formularios asociados — no se puede borrar mientras los tenga.')
  }
  return new Error(error.message)
}

export function usePacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('pacientes')
      .select('id, nombre_completo, telefono, instagram, email, notas, created_at')
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
          notas: input.notas,
        })
        .select('id, nombre_completo, telefono, instagram, email, notas, created_at')
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
          notas: input.notas,
        })
        .eq('id', id)
      if (updateError) throw updateError
      await refetch()
    },
    [refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('pacientes').delete().eq('id', id)
      if (deleteError) throw traducirError(deleteError)
      await refetch()
    },
    [refetch],
  )

  return { pacientes, loading, error, refetch, create, update, remove }
}
