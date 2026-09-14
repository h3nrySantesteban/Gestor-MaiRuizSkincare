import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { DateTimeInput } from '../forms/DateTimeInput'
import { TrashIcon } from '../icons'
import { useIngresosExtra, type IngresoExtraInput } from '../../hooks/useIngresosExtra'
import type { IngresoExtra } from '../../types/ingresoExtra'

const schema = z.object({
  concepto: z.string().trim().min(1, 'Ingresá un concepto.'),
  valor: z.coerce.number({ error: 'Ingresá un valor válido.' }).positive('El valor debe ser mayor a 0.'),
  fecha: z.string().trim().min(1, 'Ingresá una fecha.'),
  descripcion: z.string().trim(),
})

function hoyLocal(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

interface NuevoIngresoExtraFormProps {
  open: boolean
  onClose: () => void
  onSaved: (ingresoExtra: IngresoExtra) => void
  /** solo aplica al editar uno existente — al crear no hay nada que borrar */
  onDeleted?: () => void
  ingresoExtra?: IngresoExtra | null
}

// Mismo patrón que NuevoGastoForm/NuevoTratamientoForm/NuevoPacienteForm:
// solo monta el Inner mientras open=true para que el estado arranque limpio
// en cada apertura sin necesitar un efecto que lo resetee.
export function NuevoIngresoExtraForm(props: NuevoIngresoExtraFormProps) {
  if (!props.open) return null
  return <NuevoIngresoExtraFormInner {...props} />
}

function NuevoIngresoExtraFormInner({ onClose, onSaved, onDeleted, ingresoExtra }: NuevoIngresoExtraFormProps) {
  const { create, update, remove } = useIngresosExtra()
  const [concepto, setConcepto] = useState(ingresoExtra?.concepto ?? '')
  const [valor, setValor] = useState(ingresoExtra ? String(ingresoExtra.valor) : '')
  const [fecha, setFecha] = useState(ingresoExtra?.fecha ?? hoyLocal())
  const [descripcion, setDescripcion] = useState(ingresoExtra?.descripcion ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const valorRef = useRef<HTMLInputElement>(null)
  const fechaRef = useRef<HTMLInputElement>(null)
  const descripcionRef = useRef<HTMLTextAreaElement>(null)

  function handleConceptoKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      valorRef.current?.focus()
    }
  }

  function handleValorKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      fechaRef.current?.focus()
    }
  }

  function handleFechaKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      descripcionRef.current?.focus()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = schema.safeParse({ concepto, valor, fecha, descripcion })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    setFormError(null)
    const input: IngresoExtraInput = {
      concepto: result.data.concepto,
      valor: result.data.valor,
      fecha: result.data.fecha,
      descripcion: result.data.descripcion || null,
    }
    try {
      if (ingresoExtra) {
        await update(ingresoExtra.id, input)
        onSaved({ ...ingresoExtra, ...input })
      } else {
        onSaved(await create(input))
      }
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el ingreso.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!ingresoExtra) return
    setDeleting(true)
    setFormError(null)
    try {
      await remove(ingresoExtra.id)
      onDeleted?.()
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo borrar el ingreso.')
      setConfirmDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={ingresoExtra ? 'Editar ingreso extra' : 'Nuevo ingreso extra'}
        widthClassName="max-w-md"
      >
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
          <Field label="Nombre del Ingreso" required error={errors.concepto} hint="Ej: Subalquiler del consultorio">
            <input
              autoFocus
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              onKeyDown={handleConceptoKeyDown}
              className={inputClass}
            />
          </Field>
          <Field label="Valor" required error={errors.valor}>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">$</span>
              <input
                ref={valorRef}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={handleValorKeyDown}
                className={`${inputClass} !pl-7`}
              />
            </div>
          </Field>
          <Field label="Fecha" required error={errors.fecha}>
            <DateTimeInput ref={fechaRef} type="date" value={fecha} onChange={setFecha} onKeyDown={handleFechaKeyDown} />
          </Field>
          <Field label="Descripción" error={errors.descripcion}>
            <textarea
              ref={descripcionRef}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="mt-2 flex items-center justify-between gap-2">
            {ingresoExtra ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-bg"
              >
                <TrashIcon className="h-4 w-4" />
                Borrar ingreso
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={secondaryBtnClass}>
                Cancelar
              </button>
              <button type="submit" disabled={submitting} className={primaryBtnClass}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Borrar ingreso extra"
        message={`¿Estás segura de que querés borrar "${ingresoExtra?.concepto ?? 'este ingreso'}"? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        danger
        submitting={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}
