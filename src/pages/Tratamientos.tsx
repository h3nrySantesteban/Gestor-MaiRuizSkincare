import { Fragment, useState } from 'react'
import { useTratamientos } from '../hooks/useTratamientos'
import { NuevoTratamientoForm } from '../components/NuevoTratamientoForm/NuevoTratamientoForm'
import { ActualizarPreciosModal } from '../components/ActualizarPreciosModal/ActualizarPreciosModal'
import { inputClass, primaryBtnClass, secondaryBtnClass } from '../components/forms/FormField'
import { formatCurrency } from '../lib/format'
import type { Tratamiento } from '../types/tratamiento'

export function Tratamientos() {
  const { tratamientos, loading, refetch, setActivo, updatePrecios } = useTratamientos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tratamiento | null>(null)
  const [porcentaje, setPorcentaje] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  function openNuevo() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(t: Tratamiento) {
    setEditing(t)
    setFormOpen(true)
  }

  // la seña no es un precio de lista (es un monto de depósito que se
  // configura a mano) y un tratamiento inactivo ya no se ofrece — ninguno
  // de los dos debería moverse con un aumento general de precios
  const tratamientosParaAumento = tratamientos.filter((t) => t.activo && !t.esSena)
  const porcentajeNum = Number(porcentaje)
  const porcentajeValido = porcentaje.trim() !== '' && Number.isFinite(porcentajeNum) && porcentajeNum > 0

  // la seña primero (a lo sumo hay una), después el resto por activo/inactivo
  const ordenados = [...tratamientos].sort((a, b) => {
    if (a.esSena !== b.esSena) return a.esSena ? -1 : 1
    return Number(b.activo) - Number(a.activo)
  })
  const primerNoSenaIndex = ordenados.findIndex((t) => !t.esSena)

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

      {tratamientosParaAumento.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Aumentar todos los precios</span>
            <div className="relative w-28">
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="10"
                className={`${inputClass} !pr-7`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted">%</span>
            </div>
          </label>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={!porcentajeValido}
            className={primaryBtnClass}
          >
            Aplicar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {ordenados.map((t, index) => (
          <Fragment key={t.id}>
            {index === primerNoSenaIndex && index > 0 && <div className="my-1 border-t border-border" />}
            <div
              className={`flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between ${
                t.activo ? '' : 'opacity-60'
              }`}
            >
              <button type="button" onClick={() => openEdit(t)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink">{t.nombre}</p>
                  {t.esSena && (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      Seña
                    </span>
                  )}
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
          </Fragment>
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
      <ActualizarPreciosModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        tratamientos={tratamientosParaAumento}
        porcentaje={porcentajeValido ? porcentajeNum : 0}
        onConfirm={async (updates) => {
          await updatePrecios(updates)
          setPorcentaje('')
        }}
      />
    </div>
  )
}
