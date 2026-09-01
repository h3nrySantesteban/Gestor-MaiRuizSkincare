import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { ToggleSiNo } from '../forms/ToggleSiNo'
import { TrashIcon } from '../icons'
import { useGastos, type GastoInput } from '../../hooks/useGastos'
import type { Gasto, RecurrenciaUnidad } from '../../types/gasto'

const schema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá un nombre.'),
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

interface NuevoGastoFormProps {
  open: boolean
  onClose: () => void
  onSaved: (gasto: Gasto) => void
  /** solo aplica al editar un gasto existente — al crear no hay nada que borrar */
  onDeleted?: () => void
  gasto?: Gasto | null
}

// Mismo patrón que NuevoTratamientoForm/NuevoPacienteForm: solo monta el
// Inner mientras open=true para que el estado arranque limpio en cada
// apertura sin necesitar un efecto que lo resetee.
export function NuevoGastoForm(props: NuevoGastoFormProps) {
  if (!props.open) return null
  return <NuevoGastoFormInner {...props} />
}

function NuevoGastoFormInner({ onClose, onSaved, onDeleted, gasto }: NuevoGastoFormProps) {
  const { create, update, remove } = useGastos()
  const [nombre, setNombre] = useState(gasto?.nombre ?? '')
  const [valor, setValor] = useState(gasto ? String(gasto.valor) : '')
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoyLocal())
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '')
  const [esFijo, setEsFijo] = useState(gasto?.esFijo ?? false)
  const [recurrenciaNumero, setRecurrenciaNumero] = useState(
    gasto?.recurrenciaNumero != null ? String(gasto.recurrenciaNumero) : '1',
  )
  const [recurrenciaUnidad, setRecurrenciaUnidad] = useState<RecurrenciaUnidad>(gasto?.recurrenciaUnidad ?? 'mes')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const valorRef = useRef<HTMLInputElement>(null)
  const fechaRef = useRef<HTMLInputElement>(null)
  const descripcionRef = useRef<HTMLTextAreaElement>(null)

  function handleNombreKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
    const result = schema.safeParse({ nombre, valor, fecha, descripcion })
    const fieldErrors: Record<string, string> = {}
    if (!result.success) {
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
    }
    const recurrenciaNumeroNum = Number(recurrenciaNumero)
    if (esFijo && (!Number.isFinite(recurrenciaNumeroNum) || recurrenciaNumeroNum < 1)) {
      fieldErrors.recurrenciaNumero = 'Ingresá un número válido.'
    }
    if (Object.keys(fieldErrors).length > 0 || !result.success) {
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    setFormError(null)
    const input: GastoInput = {
      nombre: result.data.nombre,
      valor: result.data.valor,
      fecha: result.data.fecha,
      descripcion: result.data.descripcion || null,
      esFijo,
      recurrenciaNumero: esFijo ? recurrenciaNumeroNum : null,
      recurrenciaUnidad: esFijo ? recurrenciaUnidad : null,
    }
    try {
      if (gasto) {
        await update(gasto.id, input)
        onSaved({ ...gasto, ...input })
      } else {
        onSaved(await create(input))
      }
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el gasto.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!gasto) return
    setDeleting(true)
    setFormError(null)
    try {
      await remove(gasto.id)
      onDeleted?.()
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo borrar el gasto.')
      setConfirmDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title={gasto ? 'Editar gasto' : 'Nuevo gasto'} widthClassName="max-w-md">
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
          <Field label="Nombre del gasto" required error={errors.nombre}>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={handleNombreKeyDown}
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
            <input
              ref={fechaRef}
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              onKeyDown={handleFechaKeyDown}
              className={inputClass}
            />
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

          <Field label="Gasto fijo" hint="Se repite periódicamente (alquiler, un insumo recurrente, etc.)">
            <ToggleSiNo value={esFijo} onChange={setEsFijo} />
          </Field>

          {esFijo && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cada" required error={errors.recurrenciaNumero}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={recurrenciaNumero}
                  onChange={(e) => setRecurrenciaNumero(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Unidad" required>
                <select
                  value={recurrenciaUnidad}
                  onChange={(e) => setRecurrenciaUnidad(e.target.value as RecurrenciaUnidad)}
                  className={inputClass}
                >
                  <option value="dia">Día(s)</option>
                  <option value="semana">Semana(s)</option>
                  <option value="mes">Mes(es)</option>
                </select>
              </Field>
            </div>
          )}

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="mt-2 flex items-center justify-between gap-2">
            {gasto ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-bg"
              >
                <TrashIcon className="h-4 w-4" />
                Borrar gasto
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
        title="Borrar gasto"
        message={`¿Estás segura de que querés borrar "${gasto?.nombre ?? 'este gasto'}"? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        danger
        submitting={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}
