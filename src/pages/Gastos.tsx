import { useState } from 'react'
import { useGastos } from '../hooks/useGastos'
import { NuevoGastoForm } from '../components/NuevoGastoForm/NuevoGastoForm'
import { primaryBtnClass } from '../components/forms/FormField'
import { formatCurrency, formatFecha } from '../lib/format'
import type { Gasto, RecurrenciaUnidad } from '../types/gasto'

const UNIDAD_LABELS: Record<RecurrenciaUnidad, { singular: string; plural: string }> = {
  dia: { singular: 'día', plural: 'días' },
  semana: { singular: 'semana', plural: 'semanas' },
  mes: { singular: 'mes', plural: 'meses' },
}

function formatRecurrencia(numero: number, unidad: RecurrenciaUnidad): string {
  const { singular, plural } = UNIDAD_LABELS[unidad]
  return `cada ${numero} ${numero === 1 ? singular : plural}`
}

export function Gastos() {
  const { gastos, loading, refetch } = useGastos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Gasto | null>(null)

  function openNuevo() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(g: Gasto) {
    setEditing(g)
    setFormOpen(true)
  }

  // fecha ya viene ordenada desc por la consulta (useGastos), acá no hace falta reordenar

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Gastos</h1>
          <p className="text-sm text-ink-muted">{gastos.length} gastos cargados</p>
        </div>
        <button type="button" onClick={openNuevo} className={primaryBtnClass}>
          + Nuevo gasto
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {gastos.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => openEdit(g)}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">{g.nombre}</p>
                <span className="text-xs text-ink-muted">{formatFecha(g.fecha)}</span>
                {g.esFijo && g.recurrenciaNumero && g.recurrenciaUnidad && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                    Fijo · {formatRecurrencia(g.recurrenciaNumero, g.recurrenciaUnidad)}
                  </span>
                )}
              </div>
              {g.descripcion && <p className="mt-0.5 truncate text-sm text-ink-muted">{g.descripcion}</p>}
            </div>
            <p className="shrink-0 font-semibold text-ink sm:text-right">{formatCurrency(g.valor)}</p>
          </button>
        ))}

        {!loading && gastos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Todavía no hay gastos cargados.
          </p>
        )}
      </div>

      <NuevoGastoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => refetch()}
        onDeleted={() => refetch()}
        gasto={editing}
      />
    </div>
  )
}
