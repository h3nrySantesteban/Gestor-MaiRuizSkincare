import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapIngresoExtraRow, type IngresoExtra, type IngresoExtraRow } from '../types/ingresoExtra'

export interface IngresoExtraInput {
  concepto: string
  valor: number
  fecha: string
  descripcion: string | null
}

const INGRESO_EXTRA_SELECT = 'id, concepto, valor, fecha, descripcion, created_at'

function toRow(input: IngresoExtraInput) {
  return {
    concepto: input.concepto,
    valor: input.valor,
    fecha: input.fecha,
    descripcion: input.descripcion,
  }
}

export function useIngresosExtra() {
  const [ingresosExtra, setIngresosExtra] = useState<IngresoExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('ingresos_extra')
      .select(INGRESO_EXTRA_SELECT)
      .order('fecha', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setIngresosExtra((data as IngresoExtraRow[]).map(mapIngresoExtraRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()
  }, [refetch])

  const create = useCallback(
    async (input: IngresoExtraInput): Promise<IngresoExtra> => {
      const { data, error: insertError } = await supabase
        .from('ingresos_extra')
        .insert(toRow(input))
        .select(INGRESO_EXTRA_SELECT)
        .single()
      if (insertError) throw new Error(insertError.message)
      await refetch()
      return mapIngresoExtraRow(data as IngresoExtraRow)
    },
    [refetch],
  )

  const update = useCallback(
    async (id: string, input: IngresoExtraInput) => {
      const { error: updateError } = await supabase.from('ingresos_extra').update(toRow(input)).eq('id', id)
      if (updateError) throw new Error(updateError.message)
      await refetch()
    },
    [refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('ingresos_extra').delete().eq('id', id)
      if (deleteError) throw new Error(deleteError.message)
      await refetch()
    },
    [refetch],
  )

  return { ingresosExtra, loading, error, refetch, create, update, remove }
}
