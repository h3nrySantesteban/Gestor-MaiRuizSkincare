import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapGastoRow, type Gasto, type GastoRow, type RecurrenciaUnidad } from '../types/gasto'

export interface GastoInput {
  nombre: string
  valor: number
  fecha: string
  descripcion: string | null
  esFijo: boolean
  recurrenciaNumero: number | null
  recurrenciaUnidad: RecurrenciaUnidad | null
}

const GASTO_SELECT = 'id, nombre, valor, fecha, descripcion, es_fijo, recurrencia_numero, recurrencia_unidad, created_at'

// la constraint gastos_recurrencia_solo_si_fijo es la que hace cumplir "los
// campos de recurrencia van juntos, solo si es_fijo" — acá se arma la fila
// ya respetando eso, así nunca llega un insert/update que la dispare
function toRow(input: GastoInput) {
  return {
    nombre: input.nombre,
    valor: input.valor,
    fecha: input.fecha,
    descripcion: input.descripcion,
    es_fijo: input.esFijo,
    recurrencia_numero: input.esFijo ? input.recurrenciaNumero : null,
    recurrencia_unidad: input.esFijo ? input.recurrenciaUnidad : null,
  }
}

export function useGastos() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('gastos')
      .select(GASTO_SELECT)
      .order('fecha', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setGastos((data as GastoRow[]).map(mapGastoRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()
  }, [refetch])

  const create = useCallback(
    async (input: GastoInput): Promise<Gasto> => {
      const { data, error: insertError } = await supabase
        .from('gastos')
        .insert(toRow(input))
        .select(GASTO_SELECT)
        .single()
      if (insertError) throw new Error(insertError.message)
      await refetch()
      return mapGastoRow(data as GastoRow)
    },
    [refetch],
  )

  const update = useCallback(
    async (id: string, input: GastoInput) => {
      const { error: updateError } = await supabase.from('gastos').update(toRow(input)).eq('id', id)
      if (updateError) throw new Error(updateError.message)
      await refetch()
    },
    [refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('gastos').delete().eq('id', id)
      if (deleteError) throw new Error(deleteError.message)
      await refetch()
    },
    [refetch],
  )

  return { gastos, loading, error, refetch, create, update, remove }
}
