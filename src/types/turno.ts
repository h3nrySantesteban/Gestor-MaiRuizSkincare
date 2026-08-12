import type { Paciente } from './paciente'

export const ESTADOS_TURNO = ['Agendado', 'Finalizado', 'Cancelado', 'Otro'] as const
export type EstadoTurno = (typeof ESTADOS_TURNO)[number]

export const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Credito', 'Debito'] as const
export type MedioPago = (typeof MEDIOS_PAGO)[number]

export interface TurnoTratamiento {
  tratamientoId: string
  nombre: string
  precioAplicado: number
}

export interface Turno {
  id: string
  fecha: string
  pacienteId: string
  paciente: Pick<Paciente, 'id' | 'nombreCompleto' | 'telefono' | 'instagram'> | null
  precio: number
  giftCard: boolean
  medioPago: MedioPago | null
  senado: boolean
  estado: EstadoTurno
  confirmadoPaciente: boolean
  reminderSentAt: string | null
  tratamientos: TurnoTratamiento[]
  createdAt: string
  updatedAt: string
}

/** Shape returned by a Supabase select with nested paciente + turno_tratamientos joins. */
export interface TurnoRow {
  id: string
  fecha: string
  paciente_id: string
  precio: number
  gift_card: boolean
  medio_pago: MedioPago | null
  senado: boolean
  estado: EstadoTurno
  confirmado_paciente: boolean
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
  pacientes: {
    id: string
    nombre_completo: string
    telefono: string | null
    instagram: string | null
  } | null
  turno_tratamientos: {
    tratamiento_id: string
    precio_aplicado: number
    tratamientos: { nombre: string } | null
  }[]
}

export function mapTurnoRow(row: TurnoRow): Turno {
  return {
    id: row.id,
    fecha: row.fecha,
    pacienteId: row.paciente_id,
    paciente: row.pacientes
      ? {
          id: row.pacientes.id,
          nombreCompleto: row.pacientes.nombre_completo,
          telefono: row.pacientes.telefono,
          instagram: row.pacientes.instagram,
        }
      : null,
    precio: row.precio,
    giftCard: row.gift_card,
    medioPago: row.medio_pago,
    senado: row.senado,
    estado: row.estado,
    confirmadoPaciente: row.confirmado_paciente,
    reminderSentAt: row.reminder_sent_at,
    tratamientos: row.turno_tratamientos.map((t) => ({
      tratamientoId: t.tratamiento_id,
      nombre: t.tratamientos?.nombre ?? '',
      precioAplicado: t.precio_aplicado,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
