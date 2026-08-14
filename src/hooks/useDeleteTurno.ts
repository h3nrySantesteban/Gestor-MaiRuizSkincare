import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

/** turno_tratamientos y notificaciones tienen on delete cascade, así que se limpian solas. */
export function useDeleteTurno() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from('turnos').delete().eq('id', id)
    if (error) throw error
  }, [])
}
