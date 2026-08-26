import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePacientes } from '../hooks/usePacientes'
import { usePacienteIdsConNotasEnTurnos } from '../hooks/usePacienteIdsConNotasEnTurnos'
import { useTurnoCountsPorPaciente } from '../hooks/useTurnoCountsPorPaciente'
import { NuevoPacienteForm } from '../components/NuevoPacienteForm/NuevoPacienteForm'
import { InstagramIcon, ListIcon, NoteIcon, SearchIcon, WhatsAppIcon } from '../components/icons'
import { primaryBtnClass } from '../components/forms/FormField'
import { instagramLink, waLink } from '../lib/links'
import { normalizeSearch } from '../lib/text'

const ORDENES = ['Alfabético', 'Cantidad de turnos'] as const
type Orden = (typeof ORDENES)[number]

export function Pacientes() {
  const { pacientes, loading, refetch } = usePacientes()
  const pacienteIdsConNotasEnTurnos = usePacienteIdsConNotasEnTurnos()
  const turnoCounts = useTurnoCountsPorPaciente()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [orden, setOrden] = useState<Orden>('Alfabético')

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim())
    const base = q ? pacientes.filter((p) => normalizeSearch(p.nombreCompleto).includes(q)) : pacientes
    if (orden === 'Alfabético') return base
    // usePacientes ya trae orden alfabético de la base — acá solo se
    // reordena por cantidad, de más a menos turnos
    return [...base].sort((a, b) => (turnoCounts.get(b.id) ?? 0) - (turnoCounts.get(a.id) ?? 0))
  }, [pacientes, query, orden, turnoCounts])

  function openNuevo() {
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Pacientes</h1>
          <p className="text-sm text-ink-muted">
            {pacientes.length} paciente{pacientes.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OrdenDropdown value={orden} onChange={setOrden} />
          <button type="button" onClick={openNuevo} className={primaryBtnClass}>
            + Nuevo paciente
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-sm">
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full text-base text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((p) => {
          const tieneNotas = Boolean(p.notas) || pacienteIdsConNotasEnTurnos.has(p.id)
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/pacientes/${p.id}`, { state: { from: '/pacientes' } })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/pacientes/${p.id}`, { state: { from: '/pacientes' } })
                }
              }}
              className="relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300"
            >
              {tieneNotas && (
                // pegado a la esquina de la tarjeta (no del contenido) a
                // propósito: así nunca compite por espacio con los badges de
                // WhatsApp/Instagram, que están centrados dentro de la fila
                <span
                  role="img"
                  aria-label="Tiene notas"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-muted text-ink-muted"
                >
                  <NoteIcon className="h-3 w-3 shrink-0" />
                </span>
              )}
              <p className="min-w-0 truncate font-medium text-ink">{p.nombreCompleto}</p>
              <div className="flex shrink-0 items-center gap-2">
                {p.telefono && (
                  <a
                    href={waLink(p.telefono)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`WhatsApp de ${p.nombreCompleto}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-success-bg text-success hover:opacity-80"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5" />
                  </a>
                )}
                {p.instagram && (
                  <a
                    href={instagramLink(p.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Instagram de ${p.nombreCompleto}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600 hover:opacity-80"
                  >
                    <InstagramIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}

        {!loading && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {query ? 'No se encontraron pacientes.' : 'Todavía no hay pacientes cargados.'}
          </p>
        )}
      </div>

      <NuevoPacienteForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => refetch()} />
    </div>
  )
}

interface OrdenDropdownProps {
  value: Orden
  onChange: (orden: Orden) => void
}

// mismo patrón que TratamientoFilterDropdown en Turnos.tsx: trigger + panel
// que cierra al clickear afuera o con Escape
function OrdenDropdown({ value, onChange }: OrdenDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Ordenar pacientes (actual: ${value})`}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <ListIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg">
          {ORDENES.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
              className={`rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted ${
                o === value ? 'bg-primary-50 text-primary-700' : 'text-ink'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
