export interface Tratamiento {
  id: string
  nombre: string
  precio: number
  descripcion: string | null
  activo: boolean
  createdAt: string
}

export interface TratamientoRow {
  id: string
  nombre: string
  precio: number
  descripcion: string | null
  activo: boolean
  created_at: string
}

export function mapTratamientoRow(row: TratamientoRow): Tratamiento {
  return {
    id: row.id,
    nombre: row.nombre,
    precio: row.precio,
    descripcion: row.descripcion,
    activo: row.activo,
    createdAt: row.created_at,
  }
}
