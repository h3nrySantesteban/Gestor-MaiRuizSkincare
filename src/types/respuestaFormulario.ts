export interface RespuestaFormulario {
  id: string
  pacienteId: string | null
  respuestas: Record<string, string>
  createdAt: string
}

export interface RespuestaFormularioRow {
  id: string
  paciente_id: string | null
  respuestas: Record<string, string>
  created_at: string
}

export function mapRespuestaFormularioRow(row: RespuestaFormularioRow): RespuestaFormulario {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    respuestas: row.respuestas,
    createdAt: row.created_at,
  }
}
