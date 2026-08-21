import { useState } from 'react'
import { endOfDay } from 'date-fns'
import { useTurnos } from '../hooks/useTurnos'
import { usePacientes } from '../hooks/usePacientes'
import { NuevoTurnoForm } from '../components/NuevoTurnoForm/NuevoTurnoForm'
import { EstadoBadge } from '../components/EstadoBadge/EstadoBadge'
import { inputClass, primaryBtnClass } from '../components/forms/FormField'
import { ChevronDownIcon, InstagramIcon, WhatsAppIcon } from '../components/icons'
import { formatCurrency, formatFechaHora } from '../lib/format'
import { instagramLink, waLink } from '../lib/links'
import { ESTADOS_TURNO, type EstadoTurno, type Turno } from '../types/turno'

export function Turnos() {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [estados, setEstados] = useState<EstadoTurno[]>([])
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null)

  const { pacientes } = usePacientes()
  const { turnos, loading } = useTurnos({
    fechaDesde: fechaDesde ? new Date(fechaDesde).toISOString() : undefined,
    fechaHasta: fechaHasta ? endOfDay(new Date(fechaHasta)).toISOString() : undefined,
    pacienteId: pacienteId ?? undefined,
    estados: estados.length > 0 ? estados : undefined,
  })

  const activeFilterCount =
    (fechaDesde ? 1 : 0) + (fechaHasta ? 1 : 0) + (pacienteId ? 1 : 0) + estados.length
  const hasFilters = activeFilterCount > 0

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

      <div className="flex flex-col rounded-2xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setFiltrosOpen((v) => !v)}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            Filtros
            {hasFilters && (
              <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 text-ink-muted transition-transform ${filtrosOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {filtrosOpen && (
          <div className="flex flex-col gap-4 border-t border-border p-4">
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
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Paciente</span>
                <select
                  value={pacienteId ?? ''}
                  onChange={(e) => setPacienteId(e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">Todos</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombreCompleto}
                    </option>
                  ))}
                </select>
              </label>
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
            </div>

            {hasFilters && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="text-xs font-medium text-ink-muted hover:text-ink hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
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
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-medium text-ink">{turno.paciente?.nombreCompleto ?? 'Paciente'}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {/* una vez finalizado ya no aporta info accionable — el pago ya está saldado */}
                  {turno.senado && turno.estado !== 'Finalizado' && (
                    <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                      Señado
                    </span>
                  )}
                  <EstadoBadge estado={turno.estado} />
                  {turno.confirmadoPaciente && <span className="text-xs font-medium text-success">✓ confirmó</span>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="shrink-0 text-sm text-ink-muted">{formatFechaHora(turno.fecha)}</p>
                {turno.tratamientos.length > 0 && (
                  <p className="min-w-0 truncate text-sm text-ink-muted">
                    {turno.tratamientos.map((t) => t.nombre).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
              <p className="font-semibold text-ink">{formatCurrency(turno.precio)}</p>
              <div className="flex items-center gap-3">
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
                {turno.paciente?.instagram && (
                  <a
                    href={instagramLink(turno.paciente.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                  >
                    <InstagramIcon className="h-3.5 w-3.5" /> Instagram
                  </a>
                )}
              </div>
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
