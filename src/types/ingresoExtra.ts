export interface IngresoExtra {
  id: string
  concepto: string
  valor: number
  /** 'YYYY-MM-DD' — es date en la base, no timestamptz: no importa la hora */
  fecha: string
  descripcion: string | null
  createdAt: string
}

export interface IngresoExtraRow {
  id: string
  concepto: string
  valor: number
  fecha: string
  descripcion: string | null
  created_at: string
}

export function mapIngresoExtraRow(row: IngresoExtraRow): IngresoExtra {
  return {
    id: row.id,
    concepto: row.concepto,
    valor: row.valor,
    fecha: row.fecha,
    descripcion: row.descripcion,
    createdAt: row.created_at,
  }
}
