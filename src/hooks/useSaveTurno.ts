import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { EstadoTurno, MedioPago } from '../types/turno'

export interface TurnoInput {
  fecha: string
  pacienteId: string
  precio: number
  giftCard: boolean
  medioPago: MedioPago | null
  senado: boolean
  estado: EstadoTurno
  tratamientos: { tratamientoId: string; precioAplicado: number }[]
}

/**
 * Solo el write (vía upsert_turno, ver supabase-setup.sql). Separado de
 * useTurnos a propósito: quien solo necesita guardar (NuevoTurnoForm) no
 * tiene por qué traer una lista completa de turnos ni abrir una segunda
 * suscripción realtime — eso es cosa de quien renderiza un listado.
 */
export function useSaveTurno() {
  return useCallback(async (input: TurnoInput, id?: string) => {
    const { error } = await supabase.rpc('upsert_turno', {
      p_id: id ?? null,
      p_fecha: input.fecha,
      p_paciente_id: input.pacienteId,
      p_precio: input.precio,
      p_gift_card: input.giftCard,
      p_medio_pago: input.medioPago,
      p_senado: input.senado,
      p_estado: input.estado,
      p_tratamiento_ids: input.tratamientos.map((t) => t.tratamientoId),
      p_tratamiento_precios: input.tratamientos.map((t) => t.precioAplicado),
    })
    if (error) throw error
  }, [])
}
