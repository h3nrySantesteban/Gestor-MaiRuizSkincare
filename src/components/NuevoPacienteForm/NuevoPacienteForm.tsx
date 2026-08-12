import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { usePacientes, type PacienteInput } from '../../hooks/usePacientes'
import type { Paciente } from '../../types/paciente'

const schema = z.object({
  nombreCompleto: z.string().trim().min(1, 'Ingresá un nombre y apellido.'),
  telefono: z.string().trim(),
  instagram: z.string().trim(),
})

interface NuevoPacienteFormProps {
  open: boolean
  onClose: () => void
  onSaved: (paciente: Paciente) => void
  paciente?: Paciente | null
  /** pre-completa el nombre cuando se abre desde "crear nuevo" en el combobox del turno */
  initialNombre?: string
}

// Wrapper que solo monta NuevoPacienteFormInner mientras open=true: así cada
// apertura es un mount nuevo y el estado del form arranca limpio sin
// necesitar un efecto que lo resetee (evita setState síncrono en efecto).
export function NuevoPacienteForm(props: NuevoPacienteFormProps) {
  if (!props.open) return null
  return <NuevoPacienteFormInner {...props} />
}

function NuevoPacienteFormInner({ onClose, onSaved, paciente, initialNombre }: NuevoPacienteFormProps) {
  const { create, update } = usePacientes()
  const [nombreCompleto, setNombreCompleto] = useState(paciente?.nombreCompleto ?? initialNombre ?? '')
  const [telefono, setTelefono] = useState(paciente?.telefono ?? '')
  const [instagram, setInstagram] = useState(paciente?.instagram ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const telefonoRef = useRef<HTMLInputElement>(null)
  const instagramRef = useRef<HTMLInputElement>(null)

  function handleNombreKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      telefonoRef.current?.focus()
    }
  }

  function handleTelefonoKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      instagramRef.current?.focus()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = schema.safeParse({ nombreCompleto, telefono, instagram })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    setFormError(null)
    const input: PacienteInput = {
      nombreCompleto: result.data.nombreCompleto,
      telefono: result.data.telefono || null,
      instagram: result.data.instagram || null,
    }
    try {
      if (paciente) {
        await update(paciente.id, input)
        onSaved({ ...paciente, ...input })
      } else {
        onSaved(await create(input))
      }
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el paciente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={paciente ? 'Editar paciente' : 'Nuevo paciente'}
      widthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
        <Field label="Nombre y apellido" required error={errors.nombreCompleto}>
          <input
            autoFocus
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            onKeyDown={handleNombreKeyDown}
            className={inputClass}
          />
        </Field>
        <Field label="Número de teléfono" error={errors.telefono} hint="Con código de país, ej: 5493424123456">
          <input
            ref={telefonoRef}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onKeyDown={handleTelefonoKeyDown}
            className={inputClass}
          />
        </Field>
        <Field label="Instagram" error={errors.instagram} hint="Usuario, sin @">
          <input
            ref={instagramRef}
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
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
