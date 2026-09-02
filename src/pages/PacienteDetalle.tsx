import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { usePacientes } from '../hooks/usePacientes'
import { useTurnos } from '../hooks/useTurnos'
import { useRespuestasFormulario } from '../hooks/useRespuestasFormulario'
import { NuevoPacienteForm } from '../components/NuevoPacienteForm/NuevoPacienteForm'
import { NuevoTurnoForm } from '../components/NuevoTurnoForm/NuevoTurnoForm'
import { EstadoBadge } from '../components/EstadoBadge/EstadoBadge'
import { Modal } from '../components/Modal/Modal'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { secondaryBtnClass } from '../components/forms/FormField'
import { ArrowLeftIcon, ChevronDownIcon, InstagramIcon, MailIcon, SearchIcon, WhatsAppIcon } from '../components/icons'
import { formatCurrency, formatFechaHora } from '../lib/format'
import { instagramLink, waLink } from '../lib/links'
import { completarContactoDesdeFormulario } from '../lib/formularioContacto'
import { normalizeSearch } from '../lib/text'
import type { Turno } from '../types/turno'

const BACK_LABELS: Record<string, string> = { '/dashboard': 'Resumen', '/turnos': 'Turnos', '/formularios': 'Formularios' }

function PacienteHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-5 w-40" />
        <div className="mt-2.5 flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <Skeleton className="h-9 w-16 shrink-0 rounded-lg" />
    </div>
  )
}

// sirve para las filas de formularios (título+fecha, sin badge) y de
// turnos (dos líneas) de esta misma pantalla — ambas son "una línea corta
// + otra más corta" dentro de una card
function RowSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  )
}

export function PacienteDetalle() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  // Dashboard, Turnos, Pacientes y Formularios son los puntos de entrada hoy
  // — cada uno pasa de dónde vino al navegar acá (state, no localStorage: es
  // por-navegación, no algo que deba persistir). Sin ese state (ej. se
  // entra pegando la URL directo), /pacientes es el default más razonable.
  const backTo = (location.state as { from?: string } | null)?.from ?? '/pacientes'
  const backLabel = BACK_LABELS[backTo] ?? 'Pacientes'
  // instancia propia, igual que NuevoTurnoForm con usePacientes/useTratamientos:
  // el estado no se comparte entre instancias del hook, así que refetch()
  // después de editar es necesario para que este paciente se actualice acá
  const { pacientes, loading: loadingPacientes, refetch, update } = usePacientes()
  const { turnos, loading: loadingTurnos } = useTurnos({ pacienteId: id })
  const { respuestas: formularios, loading: loadingFormularios, asignar: asignarFormulario } = useRespuestasFormulario()
  const [editOpen, setEditOpen] = useState(false)
  const [editingTurno, setEditingTurno] = useState<Turno | null>(null)
  const [turnoFormOpen, setTurnoFormOpen] = useState(false)
  const [asignarFormOpen, setAsignarFormOpen] = useState(false)
  const [expandedFormularioId, setExpandedFormularioId] = useState<string | null>(null)
  const [busquedaFormulario, setBusquedaFormulario] = useState('')

  const paciente = pacientes.find((p) => p.id === id) ?? null
  const formulariosPaciente = formularios.filter((f) => f.pacienteId === id)
  const formulariosSinAsignar = formularios.filter((f) => !f.pacienteId)
  const busquedaFormularioNormalizada = normalizeSearch(busquedaFormulario.trim())
  const formulariosSinAsignarFiltrados = busquedaFormularioNormalizada
    ? formulariosSinAsignar.filter((f) =>
        normalizeSearch(f.respuestas['Nombre y apellido'] || '').includes(busquedaFormularioNormalizada),
      )
    : formulariosSinAsignar

  function openEditTurno(turno: Turno) {
    setEditingTurno(turno)
    setTurnoFormOpen(true)
  }

  function closeAsignarForm() {
    setAsignarFormOpen(false)
    setBusquedaFormulario('')
  }

  async function handleAsignarFormulario(respuestaId: string) {
    if (!id || !paciente) return
    await asignarFormulario(respuestaId, id)
    const respuesta = formularios.find((f) => f.id === respuestaId)
    if (respuesta) await completarContactoDesdeFormulario(paciente, respuesta.respuestas, update)
    closeAsignarForm()
  }

  if (!loadingPacientes && !paciente) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={backTo} className="flex w-fit items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" /> {backLabel}
        </Link>
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          No se encontró el paciente.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to={backTo} className="flex w-fit items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" /> {backLabel}
      </Link>

      {loadingPacientes ? (
        <PacienteHeaderSkeleton />
      ) : (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-ink">{paciente?.nombreCompleto}</h1>
            <div className="mt-2 flex flex-col gap-1.5">
              {/* teléfono y mail siempre muestran su ícono, aunque falte el
                  dato — atenuado (sin link) en vez de desaparecer del todo,
                  así queda claro de un vistazo qué contacto falta cargar */}
              {paciente?.telefono ? (
                <a
                  href={waLink(paciente.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 text-sm text-ink-muted hover:text-success"
                >
                  <WhatsAppIcon className="h-4 w-4 shrink-0" /> {paciente.telefono}
                </a>
              ) : (
                <span className="flex w-fit items-center gap-1.5 text-sm text-ink-muted/50">
                  <WhatsAppIcon className="h-4 w-4 shrink-0" /> Sin teléfono
                </span>
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
              {paciente?.email ? (
                <span className="flex w-fit items-center gap-1.5 text-sm text-ink-muted">
                  <MailIcon className="h-4 w-4 shrink-0" /> {paciente.email}
                </span>
              ) : (
                <span className="flex w-fit items-center gap-1.5 text-sm text-ink-muted/50">
                  <MailIcon className="h-4 w-4 shrink-0" /> Sin email
                </span>
              )}
            </div>
            {paciente?.notas && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-muted">
                {paciente.notas}
              </p>
            )}
          </div>
          <button type="button" onClick={() => setEditOpen(true)} className={secondaryBtnClass}>
            Editar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {loadingFormularios ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <p className="text-sm font-medium text-ink-muted">
              {formulariosPaciente.length} formulario{formulariosPaciente.length === 1 ? '' : 's'}
            </p>
          )}
          <button
            type="button"
            onClick={() => setAsignarFormOpen(true)}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Asignar formulario existente
          </button>
        </div>

        {loadingFormularios && <RowSkeleton />}

        {!loadingFormularios && formulariosPaciente.map((f) => {
          const expanded = expandedFormularioId === f.id
          return (
            <div key={f.id} className="rounded-xl border border-border bg-surface p-4">
              <button
                type="button"
                onClick={() => setExpandedFormularioId(expanded ? null : f.id)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <p className="text-sm text-ink-muted">{formatFechaHora(f.createdAt)}</p>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
              {expanded && (
                <dl className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  {Object.entries(f.respuestas).map(([pregunta, respuesta]) => (
                    <div key={pregunta}>
                      <dt className="text-xs font-medium text-ink-muted">{pregunta}</dt>
                      <dd className="whitespace-pre-wrap text-sm text-ink">{respuesta || '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )
        })}

        {!loadingFormularios && formulariosPaciente.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Este paciente todavía no tiene formularios asignados.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {loadingTurnos ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <p className="text-sm font-medium text-ink-muted">
            {turnos.length} turno{turnos.length === 1 ? '' : 's'}
          </p>
        )}

        {loadingTurnos && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}

        {!loadingTurnos && turnos.map((turno) => (
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
            {turno.notas && (
              <p className="whitespace-pre-wrap rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-muted">
                {turno.notas}
              </p>
            )}
          </div>
        ))}

        {!loadingTurnos && turnos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Este paciente todavía no tiene turnos.
          </p>
        )}
      </div>

      <NuevoPacienteForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => refetch()}
        onDeleted={() => navigate(backTo)}
        paciente={paciente}
      />
      <NuevoTurnoForm open={turnoFormOpen} onClose={() => setTurnoFormOpen(false)} turno={editingTurno} />

      <Modal open={asignarFormOpen} onClose={closeAsignarForm} title="Asignar formulario existente">
        <div className="flex flex-col gap-3">
          {formulariosSinAsignar.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
              <input
                autoFocus
                value={busquedaFormulario}
                onChange={(e) => setBusquedaFormulario(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full text-base text-ink outline-none"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {formulariosSinAsignarFiltrados.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleAsignarFormulario(f.id)}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-left text-sm hover:border-primary-300"
              >
                <span className="min-w-0 truncate">{f.respuestas['Nombre y apellido'] || 'Respuesta sin nombre'}</span>
                <span className="shrink-0 text-xs text-ink-muted">{formatFechaHora(f.createdAt)}</span>
              </button>
            ))}
            {formulariosSinAsignar.length === 0 && (
              <p className="text-sm text-ink-muted">No hay formularios sin asignar.</p>
            )}
            {formulariosSinAsignar.length > 0 && formulariosSinAsignarFiltrados.length === 0 && (
              <p className="text-sm text-ink-muted">No se encontraron formularios.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
