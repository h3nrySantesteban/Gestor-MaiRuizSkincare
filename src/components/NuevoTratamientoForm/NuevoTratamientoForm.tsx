import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { useTratamientos, type TratamientoInput } from '../../hooks/useTratamientos'
import type { Tratamiento } from '../../types/tratamiento'

const schema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá un nombre.'),
  precio: z.coerce.number({ error: 'Ingresá un precio válido.' }).positive('El precio debe ser mayor a 0.'),
  descripcion: z.string().trim(),
})

interface NuevoTratamientoFormProps {
  open: boolean
  onClose: () => void
  onSaved: (tratamiento: Tratamiento) => void
  tratamiento?: Tratamiento | null
  initialNombre?: string
}

// Mismo patrón que NuevoPacienteForm: solo monta el Inner mientras open=true
// para que el estado arranque limpio en cada apertura sin efecto de reset.
export function NuevoTratamientoForm(props: NuevoTratamientoFormProps) {
  if (!props.open) return null
  return <NuevoTratamientoFormInner {...props} />
}

function NuevoTratamientoFormInner({ onClose, onSaved, tratamiento, initialNombre }: NuevoTratamientoFormProps) {
  const { create, update } = useTratamientos()
  const [nombre, setNombre] = useState(tratamiento?.nombre ?? initialNombre ?? '')
  const [precio, setPrecio] = useState(tratamiento ? String(tratamiento.precio) : '')
  const [descripcion, setDescripcion] = useState(tratamiento?.descripcion ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const precioRef = useRef<HTMLInputElement>(null)
  const descripcionRef = useRef<HTMLTextAreaElement>(null)

  function handleNombreKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      precioRef.current?.focus()
    }
  }

  function handlePrecioKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      descripcionRef.current?.focus()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = schema.safeParse({ nombre, precio, descripcion })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    setFormError(null)
    const input: TratamientoInput = {
      nombre: result.data.nombre,
      precio: result.data.precio,
      descripcion: result.data.descripcion || null,
    }
    try {
      if (tratamiento) {
        await update(tratamiento.id, input)
        onSaved({ ...tratamiento, ...input })
      } else {
        onSaved(await create(input))
      }
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el tratamiento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={tratamiento ? 'Editar tratamiento' : 'Nuevo tratamiento'}
      widthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
        <Field label="Nombre" required error={errors.nombre}>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={handleNombreKeyDown}
            className={inputClass}
          />
        </Field>
        <Field label="Precio" required error={errors.precio}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">$</span>
            <input
              ref={precioRef}
              type="number"
              min="0"
              step="1000"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              onKeyDown={handlePrecioKeyDown}
              className={`${inputClass} !pl-7`}
            />
          </div>
        </Field>
        <Field label="Descripción" error={errors.descripcion}>
          <textarea
            ref={descripcionRef}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>

        {formError && <p className="text-sm text-danger">{formError}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className={primaryBtnClass}>
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
