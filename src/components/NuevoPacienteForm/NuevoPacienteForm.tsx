import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { TrashIcon } from '../icons'
import { usePacientes, type PacienteInput } from '../../hooks/usePacientes'
import type { Paciente } from '../../types/paciente'

const schema = z.object({
  nombreCompleto: z.string().trim().min(1, 'Ingresá un nombre y apellido.'),
  telefono: z.string().trim(),
  instagram: z.string().trim(),
  email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'Email inválido.'),
  notas: z.string().trim(),
})

interface NuevoPacienteFormProps {
  open: boolean
  onClose: () => void
  onSaved: (paciente: Paciente) => void
  /** solo aplica al editar un paciente existente — al crear no hay nada que borrar */
  onDeleted?: () => void
  paciente?: Paciente | null
  /** pre-completa al abrir desde "crear nuevo" en el combobox del turno, o desde un formulario sin paciente asignado */
  initialNombre?: string
  initialTelefono?: string
  initialEmail?: string
}

// Wrapper que solo monta NuevoPacienteFormInner mientras open=true: así cada
// apertura es un mount nuevo y el estado del form arranca limpio sin
// necesitar un efecto que lo resetee (evita setState síncrono en efecto).
export function NuevoPacienteForm(props: NuevoPacienteFormProps) {
  if (!props.open) return null
  return <NuevoPacienteFormInner {...props} />
}

function NuevoPacienteFormInner({
  onClose,
  onSaved,
  onDeleted,
  paciente,
  initialNombre,
  initialTelefono,
  initialEmail,
}: NuevoPacienteFormProps) {
  const { create, update, remove } = usePacientes()
  const [nombreCompleto, setNombreCompleto] = useState(paciente?.nombreCompleto ?? initialNombre ?? '')
  const [telefono, setTelefono] = useState(paciente?.telefono ?? initialTelefono ?? '')
  const [instagram, setInstagram] = useState(paciente?.instagram ?? '')
  const [email, setEmail] = useState(paciente?.email ?? initialEmail ?? '')
  const [notas, setNotas] = useState(paciente?.notas ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const telefonoRef = useRef<HTMLInputElement>(null)
  const instagramRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

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

  function handleInstagramKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      emailRef.current?.focus()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = schema.safeParse({ nombreCompleto, telefono, instagram, email, notas })
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
      email: result.data.email || null,
      notas: result.data.notas || null,
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

  async function handleDelete() {
    if (!paciente) return
    setDeleting(true)
    setFormError(null)
    try {
      await remove(paciente.id)
      onDeleted?.()
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo borrar el paciente.')
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
              onKeyDown={handleInstagramKeyDown}
              className={inputClass}
            />
          </Field>
          <Field label="Email" error={errors.email} hint="Opcional — para invitarlo al turno en Google Calendar">
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Notas" error={errors.notas} hint="Algo que aplica siempre a este paciente, ej. alergias">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={inputClass} />
          </Field>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="mt-2 flex items-center justify-between gap-2">
            {paciente ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-bg"
              >
                <TrashIcon className="h-4 w-4" />
                Borrar paciente
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
        title="Borrar paciente"
        message={`¿Estás segura de que querés borrar a ${paciente?.nombreCompleto ?? 'este paciente'}? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        danger
        submitting={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}
