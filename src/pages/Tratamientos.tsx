import { useState } from 'react'
import { useTratamientos } from '../hooks/useTratamientos'
import { NuevoTratamientoForm } from '../components/NuevoTratamientoForm/NuevoTratamientoForm'
import { primaryBtnClass, secondaryBtnClass } from '../components/forms/FormField'
import { formatCurrency } from '../lib/format'
import type { Tratamiento } from '../types/tratamiento'

export function Tratamientos() {
  const { tratamientos, loading, refetch, setActivo } = useTratamientos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tratamiento | null>(null)

  function openNuevo() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(t: Tratamiento) {
    setEditing(t)
    setFormOpen(true)
  }

  const ordenados = [...tratamientos].sort((a, b) => Number(b.activo) - Number(a.activo))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Tratamientos</h1>
          <p className="text-sm text-ink-muted">{tratamientos.filter((t) => t.activo).length} activos</p>
        </div>
        <button type="button" onClick={openNuevo} className={primaryBtnClass}>
          + Nuevo tratamiento
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {ordenados.map((t) => (
          <div
            key={t.id}
            className={`flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between ${
              t.activo ? '' : 'opacity-60'
            }`}
          >
            <button type="button" onClick={() => openEdit(t)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink">{t.nombre}</p>
                {!t.activo && (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
                    Inactivo
                  </span>
                )}
              </div>
              {t.descripcion && <p className="mt-0.5 truncate text-sm text-ink-muted">{t.descripcion}</p>}
            </button>
            <div className="flex shrink-0 items-center gap-3">
              <p className="font-semibold text-ink">{formatCurrency(t.precio)}</p>
              <button type="button" onClick={() => setActivo(t.id, !t.activo)} className={secondaryBtnClass}>
                {t.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}

        {!loading && tratamientos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Todavía no hay tratamientos cargados.
          </p>
        )}
      </div>

      <NuevoTratamientoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => refetch()}
        tratamiento={editing}
      />
    </div>
  )
}
