import { useState } from 'react'
import { Modal } from '../Modal/Modal'
import { primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { ArrowRightIcon } from '../icons'
import { formatCurrency } from '../../lib/format'
import type { Tratamiento } from '../../types/tratamiento'

interface ActualizarPreciosModalProps {
  open: boolean
  onClose: () => void
  /** ya filtrados a activos y sin la seña — ver Tratamientos.tsx */
  tratamientos: Tratamiento[]
  porcentaje: number
  onConfirm: (updates: { id: string; precio: number }[]) => Promise<void>
}

function calcularPrecio(precioActual: number, porcentaje: number) {
  const conAumento = precioActual * (1 + porcentaje / 100)
  // "redondear sobre 1000": al múltiplo de 1000 más cercano
  const redondeado = Math.round(conAumento / 1000) * 1000
  return { conAumento, redondeado }
}

export function ActualizarPreciosModal({ open, onClose, tratamientos, porcentaje, onConfirm }: ActualizarPreciosModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const filas = tratamientos.map((t) => {
    const { conAumento, redondeado } = calcularPrecio(t.precio, porcentaje)
    return { id: t.id, nombre: t.nombre, actual: t.precio, conAumento, redondeado }
  })

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(filas.map((f) => ({ id: f.id, precio: f.redondeado })))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar los precios.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aplicar +${porcentaje}% a ${filas.length} tratamiento${filas.length === 1 ? '' : 's'}`}
      widthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-muted">
          El precio final queda redondeado al múltiplo de $1.000 más cercano. La seña y los tratamientos inactivos no
          se tocan.
        </p>

        <div className="flex flex-col gap-2">
          {filas.map((f) => (
            <div key={f.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
              <p className="min-w-0 truncate font-medium text-ink">{f.nombre}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-ink-muted">
                <span>{formatCurrency(f.actual)}</span>
                <ArrowRightIcon className="h-3 w-3 shrink-0" />
                <span>{formatCurrency(f.conAumento)}</span>
                <ArrowRightIcon className="h-3 w-3 shrink-0" />
                <span className="font-semibold text-ink">{formatCurrency(f.redondeado)}</span>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} className={primaryBtnClass}>
            {submitting ? 'Aplicando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
