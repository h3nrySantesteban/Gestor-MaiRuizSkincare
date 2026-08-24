import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  mapRespuestaFormularioRow,
  type RespuestaFormulario,
  type RespuestaFormularioRow,
} from '../types/respuestaFormulario'

const RESPUESTA_SELECT = 'id, paciente_id, respuestas, created_at'

export function useRespuestasFormulario() {
  const [respuestas, setRespuestas] = useState<RespuestaFormulario[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('respuestas_formulario')
      .select(RESPUESTA_SELECT)
      .order('created_at', { ascending: false })
    if (!error && data) {
      setRespuestas((data as RespuestaFormularioRow[]).map(mapRespuestaFormularioRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens en un microtask posterior
    refetch()

    // refleja en vivo lo que va insertando api/google-form-webhook.ts
    const channel = supabase
      .channel('respuestas-formulario-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'respuestas_formulario' }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  const asignar = useCallback(
    async (id: string, pacienteId: string) => {
      const { error } = await supabase.from('respuestas_formulario').update({ paciente_id: pacienteId }).eq('id', id)
      if (error) throw error
      await refetch()
    },
    [refetch],
  )

  return { respuestas, loading, refetch, asignar }
}
