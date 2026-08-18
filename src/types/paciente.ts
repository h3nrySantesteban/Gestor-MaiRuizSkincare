export interface Paciente {
  id: string
  nombreCompleto: string
  telefono: string | null
  instagram: string | null
  email: string | null
  createdAt: string
}

export interface PacienteRow {
  id: string
  nombre_completo: string
  telefono: string | null
  instagram: string | null
  email: string | null
  created_at: string
}

export function mapPacienteRow(row: PacienteRow): Paciente {
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    telefono: row.telefono,
    instagram: row.instagram,
    email: row.email,
    createdAt: row.created_at,
  }
}
