export type RecurrenciaUnidad = 'dia' | 'semana' | 'mes'

export interface Gasto {
  id: string
  nombre: string
  valor: number
  /** 'YYYY-MM-DD' — es date en la base, no timestamptz: no importa la hora */
  fecha: string
  descripcion: string | null
  esFijo: boolean
  /** solo tiene valor si esFijo es true */
  recurrenciaNumero: number | null
  /** solo tiene valor si esFijo es true */
  recurrenciaUnidad: RecurrenciaUnidad | null
  /** solo tiene sentido si esFijo es true — ver setHabitualActivo en useGastos.ts */
  habitualActivo: boolean
  createdAt: string
}

export interface GastoRow {
  id: string
  nombre: string
  valor: number
  fecha: string
  descripcion: string | null
  es_fijo: boolean
  recurrencia_numero: number | null
  recurrencia_unidad: RecurrenciaUnidad | null
  habitual_activo: boolean
  created_at: string
}

export function mapGastoRow(row: GastoRow): Gasto {
  return {
    id: row.id,
    nombre: row.nombre,
    valor: row.valor,
    fecha: row.fecha,
    descripcion: row.descripcion,
    esFijo: row.es_fijo,
    recurrenciaNumero: row.recurrencia_numero,
    recurrenciaUnidad: row.recurrencia_unidad,
    habitualActivo: row.habitual_activo,
    createdAt: row.created_at,
  }
}
