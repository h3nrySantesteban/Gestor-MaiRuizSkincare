import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePacientes } from '../hooks/usePacientes'
import { usePacienteIdsConNotasEnTurnos } from '../hooks/usePacienteIdsConNotasEnTurnos'
import { NuevoPacienteForm } from '../components/NuevoPacienteForm/NuevoPacienteForm'
import { InstagramIcon, NoteIcon, SearchIcon, WhatsAppIcon } from '../components/icons'
import { primaryBtnClass } from '../components/forms/FormField'
import { instagramLink, waLink } from '../lib/links'
import { normalizeSearch } from '../lib/text'

export function Pacientes() {
  const { pacientes, loading, refetch } = usePacientes()
  const pacienteIdsConNotasEnTurnos = usePacienteIdsConNotasEnTurnos()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim())
    if (!q) return pacientes
    return pacientes.filter((p) => normalizeSearch(p.nombreCompleto).includes(q))
  }, [pacientes, query])

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
        <button type="button" onClick={openNuevo} className={primaryBtnClass}>
          + Nuevo paciente
        </button>
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
