import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapTratamientoRow, type Tratamiento, type TratamientoRow } from '../types/tratamiento'

export interface TratamientoInput {
  nombre: string
  precio: number
  descripcion: string | null
  esSena: boolean
}

const TRATAMIENTO_SELECT = 'id, nombre, precio, descripcion, activo, es_sena, created_at'

// el índice único parcial (tratamientos_es_sena_unique) es lo que hace
// cumplir "como mucho un tratamiento es la seña" — acá solo se traduce ese
// error de Postgres a un mensaje que Mai pueda entender
function traducirError(error: { message: string }): Error {
  if (error.message.includes('tratamientos_es_sena_unique')) {
    return new Error('Ya hay otro tratamiento marcado como la seña — desmarcalo primero.')
  }
  return new Error(error.message)
}

export function useTratamientos() {
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('tratamientos')
      .select(TRATAMIENTO_SELECT)
      .order('nombre', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setTratamientos((data as TratamientoRow[]).map(mapTratamientoRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()
  }, [refetch])

  const create = useCallback(
    async (input: TratamientoInput): Promise<Tratamiento> => {
      const { data, error: insertError } = await supabase
        .from('tratamientos')
        .insert({ nombre: input.nombre, precio: input.precio, descripcion: input.descripcion, es_sena: input.esSena })
        .select(TRATAMIENTO_SELECT)
        .single()
      if (insertError) throw traducirError(insertError)
      await refetch()
      return mapTratamientoRow(data as TratamientoRow)
    },
    [refetch],
  )

  const update = useCallback(
    async (id: string, input: TratamientoInput) => {
      const { error: updateError } = await supabase
        .from('tratamientos')
        .update({ nombre: input.nombre, precio: input.precio, descripcion: input.descripcion, es_sena: input.esSena })
        .eq('id', id)
      if (updateError) throw traducirError(updateError)
      await refetch()
    },
    [refetch],
  )

  const setActivo = useCallback(
    async (id: string, activo: boolean) => {
      const { error: updateError } = await supabase.from('tratamientos').update({ activo }).eq('id', id)
      if (updateError) throw updateError
      await refetch()
    },
    [refetch],
  )

  return { tratamientos, loading, error, refetch, create, update, setActivo }
}
