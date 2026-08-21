export interface Tratamiento {
  id: string
  nombre: string
  precio: number
  descripcion: string | null
  activo: boolean
  /** el tratamiento que representa el monto de seña — como mucho uno puede tener esto en true */
  esSena: boolean
  createdAt: string
}

export interface TratamientoRow {
  id: string
  nombre: string
  precio: number
  descripcion: string | null
  activo: boolean
  es_sena: boolean
  created_at: string
}

export function mapTratamientoRow(row: TratamientoRow): Tratamiento {
  return {
    id: row.id,
    nombre: row.nombre,
    precio: row.precio,
    descripcion: row.descripcion,
    activo: row.activo,
    esSena: row.es_sena,
    createdAt: row.created_at,
  }
}
