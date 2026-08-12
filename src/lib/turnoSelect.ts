/** Shared `select()` fragment for `turnos` — keeps the shape in sync with TurnoRow (src/types/turno.ts). */
export const TURNO_SELECT = `
  id, fecha, paciente_id, precio, gift_card, medio_pago, senado, estado, confirmado_paciente, reminder_sent_at, created_at, updated_at,
  pacientes ( id, nombre_completo, telefono, instagram ),
  turno_tratamientos ( tratamiento_id, precio_aplicado, tratamientos ( nombre ) )
`
