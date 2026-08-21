import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { DateTimeInput } from '../forms/DateTimeInput'
import { ToggleSiNo } from '../forms/ToggleSiNo'
import { NuevoPacienteForm } from '../NuevoPacienteForm/NuevoPacienteForm'
import { NuevoTratamientoForm } from '../NuevoTratamientoForm/NuevoTratamientoForm'
import { ChevronDownIcon, TrashIcon } from '../icons'
import { usePacientes } from '../../hooks/usePacientes'
import { useTratamientos } from '../../hooks/useTratamientos'
import { useSaveTurno, type TurnoInput } from '../../hooks/useSaveTurno'
import { useDeleteTurno } from '../../hooks/useDeleteTurno'
import { syncCalendarDelete, syncCalendarTurno } from '../../lib/googleCalendarSync'
import { formatCurrency } from '../../lib/format'
import { ESTADOS_TURNO, MEDIOS_PAGO, type EstadoTurno, type MedioPago, type Turno } from '../../types/turno'
import type { Paciente } from '../../types/paciente'
import type { Tratamiento } from '../../types/tratamiento'

const schema = z.object({
  fecha: z.string().min(1, 'Elegí una fecha y hora.'),
  pacienteId: z.string().min(1, 'Elegí un paciente.'),
  precio: z.coerce.number({ error: 'Ingresá un precio válido.' }).nonnegative('El precio no puede ser negativo.'),
})

interface NuevoTurnoFormProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  turno?: Turno | null
}

// Mismo patrón que los otros forms: solo monta el Inner mientras open=true.
export function NuevoTurnoForm(props: NuevoTurnoFormProps) {
  if (!props.open) return null
  return <NuevoTurnoFormInner {...props} />
}

function toDatetimeLocal(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

interface SeleccionTratamiento {
  tratamientoId: string
  precioAplicado: number
}

function NuevoTurnoFormInner({ onClose, onSaved, turno }: NuevoTurnoFormProps) {
  const { pacientes, refetch: refetchPacientes } = usePacientes()
  const { tratamientos, refetch: refetchTratamientos } = useTratamientos()
  const save = useSaveTurno()
  const deleteTurno = useDeleteTurno()

  const [fecha, setFecha] = useState(turno ? toDatetimeLocal(turno.fecha) : '')
  const [pacienteId, setPacienteId] = useState<string | null>(turno?.pacienteId ?? null)
  const [seleccion, setSeleccion] = useState<SeleccionTratamiento[]>(
    turno?.tratamientos.map((t) => ({ tratamientoId: t.tratamientoId, precioAplicado: t.precioAplicado })) ?? [],
  )
  const [precio, setPrecio] = useState(turno ? String(turno.precio) : '0')
  // al editar un turno existente no recalculamos el precio solo con tocar los
  // tratamientos: Mai puede haberlo ajustado a mano y no queremos pisarlo.
  const [precioDirty, setPrecioDirty] = useState(Boolean(turno))
  const [giftCard, setGiftCard] = useState(turno?.giftCard ?? false)
  const [medioPago, setMedioPago] = useState<MedioPago | ''>(turno?.medioPago ?? '')
  const [senado, setSenado] = useState(turno?.senado ?? false)
  const [estado, setEstado] = useState<EstadoTurno>(turno?.estado ?? 'Agendado')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [nuevoPacienteOpen, setNuevoPacienteOpen] = useState(false)
  const [nuevoTratamientoOpen, setNuevoTratamientoOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const precioInputRef = useRef<HTMLInputElement>(null)
  const medioPagoRef = useRef<HTMLSelectElement>(null)
  const estadoRef = useRef<HTMLSelectElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const tratamientosById = new Map(tratamientos.map((t) => [t.id, t]))
  // la seña no es un tratamiento seleccionable acá — se aplica sola al
  // cancelar un turno señado (ver aplicarPrecioSena). un tratamiento
  // desactivado sigue apareciendo si este turno ya lo tenía cargado
  const tratamientosDisponibles = tratamientos.filter(
    (t) => !t.esSena && (t.activo || seleccion.some((s) => s.tratamientoId === t.id)),
  )

  function handlePrecioKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      medioPagoRef.current?.focus()
    }
  }

  // si el turno queda Cancelado y estaba señado, la seña se queda como
  // ingreso — el precio final pasa a ser el monto de la seña. Se dispara
  // solo en la transición (acá, no en un efecto) para no pisar un precio
  // que Mai ya haya ajustado a mano después de este cambio.
  function aplicarPrecioSenaSiCorresponde(nuevoEstado: EstadoTurno, nuevoSenado: boolean) {
    if (nuevoEstado !== 'Cancelado' || !nuevoSenado) return
    const sena = tratamientos.find((t) => t.esSena)
    if (!sena) return
    setPrecio(String(sena.precio))
    setPrecioDirty(true)
  }

  function handleEstadoChange(nuevoEstado: EstadoTurno) {
    setEstado(nuevoEstado)
    aplicarPrecioSenaSiCorresponde(nuevoEstado, senado)
  }

  function handleSenadoChange(nuevoSenado: boolean) {
    setSenado(nuevoSenado)
    aplicarPrecioSenaSiCorresponde(estado, nuevoSenado)
  }

  function handleTratamientoToggle(id: string) {
    setSeleccion((prev) => {
      const exists = prev.some((s) => s.tratamientoId === id)
      const next = exists
        ? prev.filter((s) => s.tratamientoId !== id)
        : [...prev, { tratamientoId: id, precioAplicado: tratamientosById.get(id)?.precio ?? 0 }]
      if (!precioDirty) {
        setPrecio(String(next.reduce((acc, s) => acc + s.precioAplicado, 0)))
      }
      return next
    })
  }

  async function handlePacienteCreated(p: Paciente) {
    await refetchPacientes()
    setPacienteId(p.id)
    setNuevoPacienteOpen(false)
  }

  async function handleTratamientoCreated(t: Tratamiento) {
    await refetchTratamientos()
    // usamos t.precio directo (el objeto recién creado) en vez de buscarlo en
    // tratamientosById, que puede haber quedado desactualizado de antes del refetch
    setSeleccion((prev) => {
      const next = [...prev, { tratamientoId: t.id, precioAplicado: t.precio }]
      if (!precioDirty) {
        setPrecio(String(next.reduce((acc, s) => acc + s.precioAplicado, 0)))
      }
      return next
    })
    setNuevoTratamientoOpen(false)
  }

  async function handleDelete() {
    if (!turno) return
    setDeleting(true)
    setFormError(null)
    try {
      if (turno.googleEventId) {
        // si falla, seguimos igual con el borrado — un evento huérfano en
        // Calendar es mucho menos grave que no poder borrar el turno
        await syncCalendarDelete(turno.googleEventId).catch((err) =>
          console.error('No se pudo borrar el evento de Google Calendar', err),
        )
      }
      await deleteTurno(turno.id)
      onSaved?.()
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo borrar el turno.')
      setConfirmDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = schema.safeParse({ fecha, pacienteId: pacienteId ?? '', precio })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    setFormError(null)
    const input: TurnoInput = {
      fecha: new Date(fecha).toISOString(),
      pacienteId: result.data.pacienteId,
      precio: result.data.precio,
      giftCard,
      medioPago: medioPago || null,
      senado,
      estado,
      tratamientos: seleccion,
    }
    try {
      const turnoId = await save(input, turno?.id)
      onSaved?.()
      onClose()
      // la sync a Calendar nunca bloquea ni revierte el guardado en
      // Supabase, que ya se hizo — un fallo acá solo queda en la consola
      syncCalendarTurno(turnoId).catch((err) => console.error('No se pudo sincronizar con Google Calendar', err))
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el turno.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title={turno ? 'Editar turno' : 'Nuevo turno'} widthClassName="max-w-xl">
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
          <Field label="Fecha y hora" required error={errors.fecha}>
            <DateTimeInput value={fecha} onChange={setFecha} step={900} />
          </Field>

          <Field label="Paciente" required error={errors.pacienteId}>
            {/* select nativo a propósito: el picker custom tenía bugs de foco
                en iOS que nunca terminamos de cazar del todo; el nativo lo
                maneja el propio sistema operativo, cero JS de por medio */}
            <select
              value={pacienteId ?? ''}
              onChange={(e) => setPacienteId(e.target.value || null)}
              className={inputClass}
            >
              <option value="">Seleccionar paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreCompleto}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNuevoPacienteOpen(true)}
              className="mt-1.5 text-xs font-medium text-primary-600 hover:underline"
            >
              + Nuevo paciente
            </button>
          </Field>

          <Field label="Tratamiento">
            <TratamientoDropdown
              tratamientos={tratamientosDisponibles}
              selectedIds={seleccion.map((s) => s.tratamientoId)}
              onToggle={handleTratamientoToggle}
            />
            <button
              type="button"
              onClick={() => setNuevoTratamientoOpen(true)}
              className="mt-1.5 text-xs font-medium text-primary-600 hover:underline"
            >
              + Nuevo tratamiento
            </button>
          </Field>

          <Field label="Precio" required error={errors.precio} hint="Se completa solo según el tratamiento; se puede editar">
            <input
              ref={precioInputRef}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={precio}
              onChange={(e) => {
                setPrecio(e.target.value)
                setPrecioDirty(true)
              }}
              onKeyDown={handlePrecioKeyDown}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Gift card">
              <ToggleSiNo value={giftCard} onChange={setGiftCard} />
            </Field>
            <Field label="Señado" required>
              <ToggleSiNo value={senado} onChange={handleSenadoChange} />
            </Field>
          </div>

          <Field label="Medio de pago">
            <select
              ref={medioPagoRef}
              value={medioPago}
              onChange={(e) => {
                setMedioPago(e.target.value as MedioPago | '')
                estadoRef.current?.focus()
              }}
              className={inputClass}
            >
              <option value="">—</option>
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado del turno" required>
            <select
              ref={estadoRef}
              value={estado}
              onChange={(e) => {
                handleEstadoChange(e.target.value as EstadoTurno)
                submitRef.current?.focus()
              }}
              className={inputClass}
            >
              {ESTADOS_TURNO.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="mt-2 flex items-center justify-between gap-2">
            {turno ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-bg"
              >
                <TrashIcon className="h-4 w-4" />
                Borrar turno
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={secondaryBtnClass}>
                Cancelar
              </button>
              <button ref={submitRef} type="submit" disabled={submitting} className={primaryBtnClass}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <NuevoPacienteForm open={nuevoPacienteOpen} onClose={() => setNuevoPacienteOpen(false)} onSaved={handlePacienteCreated} />
      <NuevoTratamientoForm
        open={nuevoTratamientoOpen}
        onClose={() => setNuevoTratamientoOpen(false)}
        onSaved={handleTratamientoCreated}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Borrar turno"
        message={`¿Estás segura de que querés borrar el turno de ${turno?.paciente?.nombreCompleto ?? 'este paciente'}? Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        danger
        submitting={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  )
}

interface TratamientoDropdownProps {
  tratamientos: Tratamiento[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

// Mismo patrón que TratamientoFilterDropdown en Turnos.tsx: trigger con el
// look del <select> nativo de Paciente, panel con checkboxes abajo — un turno
// puede tener varios tratamientos, así que no alcanza con un <select> simple.
function TratamientoDropdown({ tratamientos, selectedIds, onToggle }: TratamientoDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const summary =
    selectedIds.length === 0
      ? 'Seleccionar tratamientos...'
      : tratamientos
          .filter((t) => selectedIds.includes(t.id))
          .map((t) => t.nombre)
          .join(', ')

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex max-h-48 w-full flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-lg">
          {tratamientos.length === 0 && <p className="p-1 text-sm text-ink-muted">Todavía no hay tratamientos cargados.</p>}
          {tratamientos.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-ink hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(t.id)}
                onChange={() => onToggle(t.id)}
                className="h-4 w-4 shrink-0 rounded border-border text-primary-500 focus:ring-primary-500"
              />
              <span className="min-w-0 flex-1 truncate">{t.nombre}</span>
              <span className="shrink-0 text-xs text-ink-muted">{formatCurrency(t.precio)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
