import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePacientes } from '../hooks/usePacientes'
import { useTurnos } from '../hooks/useTurnos'
import { NuevoPacienteForm } from '../components/NuevoPacienteForm/NuevoPacienteForm'
import { NuevoTurnoForm } from '../components/NuevoTurnoForm/NuevoTurnoForm'
import { EstadoBadge } from '../components/EstadoBadge/EstadoBadge'
import { secondaryBtnClass } from '../components/forms/FormField'
import { ArrowLeftIcon, InstagramIcon, WhatsAppIcon } from '../components/icons'
import { formatCurrency, formatFechaHora } from '../lib/format'
import { instagramLink, waLink } from '../lib/links'
import type { Turno } from '../types/turno'

export function PacienteDetalle() {
  const { id } = useParams<{ id: string }>()
  // instancia propia, igual que NuevoTurnoForm con usePacientes/useTratamientos:
  // el estado no se comparte entre instancias del hook, así que refetch()
  // después de editar es necesario para que este paciente se actualice acá
  const { pacientes, loading: loadingPacientes, refetch } = usePacientes()
  const { turnos, loading: loadingTurnos } = useTurnos({ pacienteId: id })
  const [editOpen, setEditOpen] = useState(false)
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null)
  const [turnoFormOpen, setTurnoFormOpen] = useState(false)

  const paciente = pacientes.find((p) => p.id === id) ?? null

  function openEditTurno(turno: Turno) {
    setEditingTurno(turno)
    setTurnoFormOpen(true)
  }

  if (!loadingPacientes && !paciente) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/pacientes" className="flex w-fit items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" /> Pacientes
        </Link>
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          No se encontró el paciente.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/pacientes" className="flex w-fit items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" /> Pacientes
      </Link>

      <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-ink">{paciente?.nombreCompleto ?? 'Cargando...'}</h1>
          <div className="mt-2 flex flex-col gap-1.5">
            {paciente?.telefono && (
              <a
                href={waLink(paciente.telefono)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-success"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0" /> {paciente.telefono}
              </a>
            )}
            {paciente?.instagram && (
              <a
                href={instagramLink(paciente.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-primary-600"
              >
                <InstagramIcon className="h-4 w-4 shrink-0" /> @{paciente.instagram}
              </a>
            )}
            {paciente?.email && <p className="text-sm text-ink-muted">{paciente.email}</p>}
          </div>
        </div>
        <button type="button" onClick={() => setEditOpen(true)} className={secondaryBtnClass}>
          Editar
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink-muted">
          {turnos.length} turno{turnos.length === 1 ? '' : 's'}
        </p>

        {turnos.map((turno) => (
          <div
            key={turno.id}
            role="button"
            tabIndex={0}
            onClick={() => openEditTurno(turno)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openEditTurno(turno)
              }
            }}
            className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="shrink-0 text-sm text-ink-muted">{formatFechaHora(turno.fecha)}</p>
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
              <p className="min-w-0 truncate text-sm text-ink-muted">
                {turno.tratamientos.length > 0 ? turno.tratamientos.map((t) => t.nombre).join(', ') : '—'}
              </p>
              <p className="shrink-0 font-semibold text-ink">{formatCurrency(turno.precio)}</p>
            </div>
          </div>
        ))}

        {!loadingTurnos && turnos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Este paciente todavía no tiene turnos.
          </p>
        )}
      </div>

      <NuevoPacienteForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => refetch()} paciente={paciente} />
      <NuevoTurnoForm open={turnoFormOpen} onClose={() => setTurnoFormOpen(false)} turno={editingTurno} />
    </div>
  )
}
