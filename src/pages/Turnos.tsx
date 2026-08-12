import { useState } from 'react'
import { endOfDay } from 'date-fns'
import { useTurnos } from '../hooks/useTurnos'
import { usePacientes } from '../hooks/usePacientes'
import { NuevoTurnoForm } from '../components/NuevoTurnoForm/NuevoTurnoForm'
import { ComboboxCreatable } from '../components/ComboboxCreatable/ComboboxCreatable'
import { EstadoBadge } from '../components/EstadoBadge/EstadoBadge'
import { inputClass, primaryBtnClass } from '../components/forms/FormField'
import { WhatsAppIcon } from '../components/icons'
import { formatCurrency, formatFechaHora } from '../lib/format'
import { waLink } from '../lib/links'
import { ESTADOS_TURNO, type EstadoTurno, type Turno } from '../types/turno'

export function Turnos() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [estados, setEstados] = useState<EstadoTurno[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null)

  const { pacientes } = usePacientes()
  const { turnos, loading } = useTurnos({
    fechaDesde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
    fechaHasta: fechaHasta ? endOfDay(new Date(fechaHasta)).toISOString() : undefined,
    pacienteId: pacienteId ?? undefined,
    estados: estados.length > 0 ? estados : undefined,
  })

  const hasFilters = fechaDesde || fechaHasta || pacienteId || estados.length > 0

  function openNuevo() {
    setEditingTurno(null)
    setFormOpen(true)
  }

  function openEdit(turno: Turno) {
    setEditingTurno(turno)
    setFormOpen(true)
  }

  function limpiarFiltros() {
    setFechaDesde('')
    setFechaHasta('')
    setPacienteId(null)
    setEstados([])
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Turnos</h1>
          <p className="text-sm text-ink-muted">{turnos.length} resultado{turnos.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" onClick={openNuevo} className={primaryBtnClass}>
          + Nuevo turno
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Desde</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">Hasta</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className={inputClass}
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-muted">Paciente</span>
            <ComboboxCreatable
              items={pacientes}
              selectedIds={pacienteId ? [pacienteId] : []}
              multiple={false}
              getId={(p) => p.id}
              getLabel={(p) => p.nombreCompleto}
              placeholder="Todos"
              onChange={(ids) => setPacienteId(ids[0] ?? null)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ESTADOS_TURNO.map((e) => {
            const active = estados.includes(e)
            return (
              <button
                key={e}
                type="button"
                onClick={() => setEstados((prev) => (active ? prev.filter((x) => x !== e) : [...prev, e]))}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-border text-ink-muted hover:bg-surface-muted'
                }`}
              >
                {e}
              </button>
            )
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs font-medium text-ink-muted hover:text-ink hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {turnos.map((turno) => (
          <div
            key={turno.id}
            role="button"
            tabIndex={0}
            onClick={() => openEdit(turno)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openEdit(turno)
              }
            }}
            className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-ink">{turno.paciente?.nombreCompleto ?? 'Paciente'}</p>
                <EstadoBadge estado={turno.estado} />
                {turno.confirmadoPaciente && <span className="text-xs font-medium text-success">✓ confirmó</span>}
              </div>
              <p className="text-sm text-ink-muted">{formatFechaHora(turno.fecha)}</p>
              {turno.tratamientos.length > 0 && (
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {turno.tratamientos.map((t) => t.nombre).join(', ')}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
              <p className="font-semibold text-ink">{formatCurrency(turno.precio)}</p>
              {turno.paciente?.telefono && (
                <a
                  href={waLink(turno.paciente.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs font-medium text-success hover:underline"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        ))}

        {!loading && turnos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            No hay turnos que coincidan con los filtros.
          </p>
        )}
      </div>

      <NuevoTurnoForm open={formOpen} onClose={() => setFormOpen(false)} turno={editingTurno} />
    </div>
  )
}
