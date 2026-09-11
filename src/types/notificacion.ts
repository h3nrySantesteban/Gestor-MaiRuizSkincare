export const TIPOS_NOTIFICACION = [
  'confirmado',
  'cancelado',
  'reprogramar',
  'no_reconocido',
  'formulario_nuevo',
  'turnos_sin_tratamiento',
] as const
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number]

export interface Notificacion {
  id: string
  turnoId: string | null
  tipo: TipoNotificacion
  mensajeOriginal: string | null
  leida: boolean
  createdAt: string
  turno: { fecha: string; pacienteNombre: string } | null
}

export interface NotificacionRow {
  id: string
  turno_id: string | null
  tipo: TipoNotificacion
  mensaje_original: string | null
  leida: boolean
  created_at: string
  turnos: { fecha: string; pacientes: { nombre_completo: string } | null } | null
}

export function mapNotificacionRow(row: NotificacionRow): Notificacion {
  return {
    id: row.id,
    turnoId: row.turno_id,
    tipo: row.tipo,
    mensajeOriginal: row.mensaje_original,
    leida: row.leida,
    createdAt: row.created_at,
    turno: row.turnos
      ? { fecha: row.turnos.fecha, pacienteNombre: row.turnos.pacientes?.nombre_completo ?? '' }
      : null,
  }
}
