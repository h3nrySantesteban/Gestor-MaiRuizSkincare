import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRespuestasFormulario } from '../hooks/useRespuestasFormulario'
import { usePacientes } from '../hooks/usePacientes'
import { PacienteCombobox } from '../components/PacienteCombobox/PacienteCombobox'
import { NuevoPacienteForm } from '../components/NuevoPacienteForm/NuevoPacienteForm'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { primaryBtnClass } from '../components/forms/FormField'
import { ArrowUpRightIcon, ChevronDownIcon } from '../components/icons'
import { formatFechaHora } from '../lib/format'
import { completarContactoDesdeFormulario, contactoDesdeFormulario } from '../lib/formularioContacto'
import { normalizeSearch } from '../lib/text'
import type { RespuestaFormulario } from '../types/respuestaFormulario'
import type { Paciente } from '../types/paciente'

// "Nombre y apellido" es la pregunta del form que mejor identifica de un
// vistazo quién la completó — se usa como título de la tarjeta mientras no
// esté asignada a un paciente. Si el form cambia de texto en esa pregunta
// esto simplemente cae al fallback, no rompe nada. Mismos campos que
// src/lib/formularioContacto.ts (no se importan de ahí porque esas
// constantes son privadas de ese archivo).
const CAMPO_NOMBRE = 'Nombre y apellido'
const CAMPO_TELEFONO = 'Teléfono'
const CAMPO_EMAIL = 'Dirección de correo electrónico'

// un solo campo de búsqueda en vez de tres — Mai suele acordarse de uno
// solo (a veces el teléfono, a veces el nombre), no tiene sentido pedirle
// que elija en cuál buscar. Nombre/email se comparan normalizados (sin
// tildes/mayúsculas); teléfono solo por dígitos, así "341 555..." matchea
// "3415551234" tipeado de una
function matchFormulario(r: RespuestaFormulario, query: string): boolean {
  const q = normalizeSearch(query)
  const qDigits = query.replace(/\D/g, '')
  const nombre = normalizeSearch(r.respuestas[CAMPO_NOMBRE] || '')
  const email = normalizeSearch(r.respuestas[CAMPO_EMAIL] || '')
  const telefonoDigits = (r.respuestas[CAMPO_TELEFONO] || '').replace(/\D/g, '')
  return nombre.includes(q) || email.includes(q) || (qDigits.length > 0 && telefonoDigits.includes(qDigits))
}

// mismo shape que la card colapsada: título+fecha a la izquierda, badge+flecha a la derecha
function RespuestaRowSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-1.5 h-3.5 w-24" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

export function Formularios() {
  const { respuestas, loading, asignar } = useRespuestasFormulario()
  const { pacientes, update } = usePacientes()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [asignandoId, setAsignandoId] = useState<string | null>(null)
  const [pacienteElegido, setPacienteElegido] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // id de la respuesta para la que se abrió "crear nuevo paciente" — asigna
  // automático al paciente recién creado en onSaved, ya que crearlo desde
  // acá justamente significa que es la persona de esta respuesta
  const [nuevoPacienteParaId, setNuevoPacienteParaId] = useState<string | null>(null)
  const [filtroOpen, setFiltroOpen] = useState(false)
  const [query, setQuery] = useState('')

  const sinAsignar = respuestas.filter((r) => !r.pacienteId).length
  const respuestasFiltradas = useMemo(() => {
    const q = query.trim()
    return q ? respuestas.filter((r) => matchFormulario(r, q)) : respuestas
  }, [respuestas, query])
  const respuestaNuevoPaciente = respuestas.find((r) => r.id === nuevoPacienteParaId) ?? null
  const contactoNuevoPaciente = respuestaNuevoPaciente ? contactoDesdeFormulario(respuestaNuevoPaciente.respuestas) : null

  async function handleAsignar(respuestaId: string) {
    if (!pacienteElegido) return
    setGuardando(true)
    try {
      await asignar(respuestaId, pacienteElegido)
      const paciente = pacientes.find((p) => p.id === pacienteElegido)
      const respuesta = respuestas.find((r) => r.id === respuestaId)
      if (paciente && respuesta) await completarContactoDesdeFormulario(paciente, respuesta.respuestas, update)
      setAsignandoId(null)
      setPacienteElegido(null)
    } finally {
      setGuardando(false)
    }
  }

  async function handleNuevoPacienteCreado(p: Paciente) {
    if (nuevoPacienteParaId) await asignar(nuevoPacienteParaId, p.id)
    setNuevoPacienteParaId(null)
    setAsignandoId(null)
    setPacienteElegido(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Formularios</h1>
        {loading ? (
          <Skeleton className="mt-1.5 h-4 w-32" />
        ) : query.trim() ? (
          <p className="text-sm text-ink-muted">
            Mostrando {respuestasFiltradas.length} de {respuestas.length} respuesta{respuestas.length === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            {respuestas.length} respuesta{respuestas.length === 1 ? '' : 's'}
            {sinAsignar > 0 && ` — ${sinAsignar} sin asignar`}
          </p>
        )}
      </div>

      <div className="flex flex-col rounded-2xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setFiltroOpen((v) => !v)}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            Filtro
            {query.trim() && (
              <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                1
              </span>
            )}
          </span>
          <ChevronDownIcon className={`h-4 w-4 text-ink-muted transition-transform ${filtroOpen ? 'rotate-180' : ''}`} />
        </button>

        {filtroOpen && (
          <div className="flex flex-col gap-2 border-t border-border p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">Nombre, email o teléfono</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-lg border border-border px-3 py-2 text-base text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </label>
            {query.trim() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-xs font-medium text-ink-muted hover:text-ink hover:underline"
                >
                  Limpiar filtro
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {loading && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <RespuestaRowSkeleton key={i} />)}

        {!loading && respuestasFiltradas.map((r) => {
          const paciente = r.pacienteId ? pacientes.find((p) => p.id === r.pacienteId) : null
          const expanded = expandedId === r.id
          const titulo = r.respuestas[CAMPO_NOMBRE] || 'Respuesta sin nombre'

          return (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : r.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpandedId(expanded ? null : r.id)
                  }
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{titulo}</p>
                    <p className="text-xs text-ink-muted">{formatFechaHora(r.createdAt)}</p>
                  </div>
                  {paciente && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/pacientes/${paciente.id}`, { state: { from: '/formularios' } })
                      }}
                      aria-label={`Ver perfil de ${paciente.nombreCompleto}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
                    >
                      <ArrowUpRightIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {paciente ? (
                    <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                      {paciente.nombreCompleto}
                    </span>
                  ) : (
                    <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                      Sin asignar
                    </span>
                  )}
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {expanded && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  {!paciente && (
                    <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3 sm:flex-row sm:items-center">
                      {asignandoId === r.id ? (
                        <>
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <PacienteCombobox pacientes={pacientes} value={pacienteElegido} onChange={setPacienteElegido} />
                            <button
                              type="button"
                              onClick={() => setNuevoPacienteParaId(r.id)}
                              className="w-fit text-xs font-medium text-primary-600 hover:underline"
                            >
                              + Nuevo paciente
                            </button>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={!pacienteElegido || guardando}
                              onClick={() => handleAsignar(r.id)}
                              className={primaryBtnClass}
                            >
                              {guardando ? 'Guardando...' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAsignandoId(null)
                                setPacienteElegido(null)
                              }}
                              className="px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
                            >
                              Cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAsignandoId(r.id)}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          Asignar a un paciente
                        </button>
                      )}
                    </div>
                  )}

                  <dl className="flex flex-col gap-2">
                    {Object.entries(r.respuestas).map(([pregunta, respuesta]) => (
                      <div key={pregunta}>
                        <dt className="text-xs font-medium text-ink-muted">{pregunta}</dt>
                        <dd className="whitespace-pre-wrap text-sm text-ink">{respuesta || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )
        })}

        {!loading && respuestas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Todavía no llegó ninguna respuesta del formulario.
          </p>
        )}

        {!loading && respuestas.length > 0 && respuestasFiltradas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Ninguna respuesta coincide con el filtro.
          </p>
        )}
      </div>

      <NuevoPacienteForm
        open={nuevoPacienteParaId !== null}
        onClose={() => setNuevoPacienteParaId(null)}
        onSaved={handleNuevoPacienteCreado}
        initialNombre={respuestaNuevoPaciente?.respuestas[CAMPO_NOMBRE] || undefined}
        initialTelefono={contactoNuevoPaciente?.telefono ?? undefined}
        initialEmail={contactoNuevoPaciente?.email ?? undefined}
      />
    </div>
  )
}
