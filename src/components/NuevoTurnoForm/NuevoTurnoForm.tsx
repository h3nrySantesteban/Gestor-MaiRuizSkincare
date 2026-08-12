import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { z } from 'zod'
import { Modal } from '../Modal/Modal'
import { Field, inputClass, primaryBtnClass, secondaryBtnClass } from '../forms/FormField'
import { DateTimeInput } from '../forms/DateTimeInput'
import { ComboboxCreatable } from '../ComboboxCreatable/ComboboxCreatable'
import { NuevoPacienteForm } from '../NuevoPacienteForm/NuevoPacienteForm'
import { NuevoTratamientoForm } from '../NuevoTratamientoForm/NuevoTratamientoForm'
import { usePacientes } from '../../hooks/usePacientes'
import { useTratamientos } from '../../hooks/useTratamientos'
import { useSaveTurno, type TurnoInput } from '../../hooks/useSaveTurno'
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

  const [nuevoPacienteQuery, setNuevoPacienteQuery] = useState<string | null>(null)
  const [nuevoTratamientoQuery, setNuevoTratamientoQuery] = useState<string | null>(null)

  // completar un campo avanza el foco al siguiente para cargar turnos más
  // rápido — cada ref es el próximo destino en el orden del formulario
  const pacienteInputRef = useRef<HTMLInputElement>(null)
  const tratamientoInputRef = useRef<HTMLInputElement>(null)
  const precioInputRef = useRef<HTMLInputElement>(null)
  const medioPagoRef = useRef<HTMLSelectElement>(null)
  const estadoRef = useRef<HTMLSelectElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const tratamientosById = new Map(tratamientos.map((t) => [t.id, t]))
  // un tratamiento desactivado sigue apareciendo si este turno ya lo tenía cargado
  const tratamientosDisponibles = tratamientos.filter(
    (t) => t.activo || seleccion.some((s) => s.tratamientoId === t.id),
  )

  function handlePacienteChange(ids: string[]) {
    setPacienteId(ids[0] ?? null)
    // ojo: NO enfocamos el picker de tratamiento acá — su input abre el
    // desplegable en onFocus, y hacerlo automático tapaba el resto del
    // formulario apenas se elegía paciente (ver historial de commits)
  }

  function handlePrecioKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      medioPagoRef.current?.focus()
    }
  }

  function handleTratamientosChange(newIds: string[]) {
    setSeleccion((prev) => {
      const next = newIds.map((id) => prev.find((s) => s.tratamientoId === id) ?? {
        tratamientoId: id,
        precioAplicado: tratamientosById.get(id)?.precio ?? 0,
      })
      if (!precioDirty) {
        setPrecio(String(next.reduce((acc, s) => acc + s.precioAplicado, 0)))
      }
      return next
    })
  }

  async function handlePacienteCreated(p: Paciente) {
    await refetchPacientes()
    setPacienteId(p.id)
    setNuevoPacienteQuery(null)
  }

  async function handleTratamientoCreated(t: Tratamiento) {
    await refetchTratamientos()
    // no reusamos handleTratamientosChange acá: su lookup de precio pasa por
    // tratamientosById, que quedó capturado (stale) en el closure de este
    // handler desde antes del refetch — usamos t.precio directo, que es el
    // objeto recién creado y siempre correcto.
    setSeleccion((prev) => {
      const next = [...prev, { tratamientoId: t.id, precioAplicado: t.precio }]
      if (!precioDirty) {
        setPrecio(String(next.reduce((acc, s) => acc + s.precioAplicado, 0)))
      }
      return next
    })
    setNuevoTratamientoQuery(null)
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
      await save(input, turno?.id)
      onSaved?.()
      onClose()
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
            <DateTimeInput value={fecha} onChange={setFecha} />
          </Field>

          <Field label="Paciente" required error={errors.pacienteId}>
            <ComboboxCreatable
              inputRef={pacienteInputRef}
              items={pacientes}
              selectedIds={pacienteId ? [pacienteId] : []}
              multiple={false}
              getId={(p) => p.id}
              getLabel={(p) => p.nombreCompleto}
              placeholder="Buscar paciente..."
              onChange={handlePacienteChange}
              onCreateNew={setNuevoPacienteQuery}
              createLabel={(q) => `+ Crear paciente "${q}"`}
            />
          </Field>

          <Field label="Tratamiento">
            <ComboboxCreatable
              inputRef={tratamientoInputRef}
              items={tratamientosDisponibles}
              selectedIds={seleccion.map((s) => s.tratamientoId)}
              multiple
              getId={(t) => t.id}
              getLabel={(t) => t.nombre}
              getSublabel={(t) => formatCurrency(t.precio)}
              placeholder="Buscar tratamiento..."
              onChange={handleTratamientosChange}
              onCreateNew={setNuevoTratamientoQuery}
              createLabel={(q) => `+ Crear tratamiento "${q}"`}
            />
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
              <ToggleSiNo value={senado} onChange={setSenado} />
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
                setEstado(e.target.value as EstadoTurno)
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

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryBtnClass}>
              Cancelar
            </button>
            <button ref={submitRef} type="submit" disabled={submitting} className={primaryBtnClass}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <NuevoPacienteForm
        open={nuevoPacienteQuery !== null}
        onClose={() => setNuevoPacienteQuery(null)}
        onSaved={handlePacienteCreated}
        initialNombre={nuevoPacienteQuery ?? undefined}
      />
      <NuevoTratamientoForm
        open={nuevoTratamientoQuery !== null}
        onClose={() => setNuevoTratamientoQuery(null)}
        onSaved={handleTratamientoCreated}
        initialNombre={nuevoTratamientoQuery ?? undefined}
      />
    </>
  )
}

function ToggleSiNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          value ? 'bg-primary-500 text-white' : 'bg-surface text-ink-muted hover:bg-surface-muted'
        }`}
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          !value ? 'bg-primary-500 text-white' : 'bg-surface text-ink-muted hover:bg-surface-muted'
        }`}
      >
        No
      </button>
    </div>
  )
}
