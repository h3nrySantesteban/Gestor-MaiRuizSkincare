import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapTratamientoRow, type Tratamiento, type TratamientoRow } from '../types/tratamiento'

export interface TratamientoInput {
  nombre: string
  precio: number
  descripcion: string | null
}

export function useTratamientos() {
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('tratamientos')
      .select('id, nombre, precio, descripcion, activo, created_at')
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
        .insert({ nombre: input.nombre, precio: input.precio, descripcion: input.descripcion })
        .select('id, nombre, precio, descripcion, activo, created_at')
        .single()
      if (insertError) throw insertError
      await refetch()
      return mapTratamientoRow(data as TratamientoRow)
    },
    [refetch],
  )

  const update = useCallback(
    async (id: string, input: TratamientoInput) => {
      const { error: updateError } = await supabase
        .from('tratamientos')
        .update({ nombre: input.nombre, precio: input.precio, descripcion: input.descripcion })
        .eq('id', id)
      if (updateError) throw updateError
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
