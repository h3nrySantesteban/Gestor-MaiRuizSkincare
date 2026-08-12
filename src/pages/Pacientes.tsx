import { useMemo, useState } from 'react'
import { usePacientes } from '../hooks/usePacientes'
import { NuevoPacienteForm } from '../components/NuevoPacienteForm/NuevoPacienteForm'
import { InstagramIcon, SearchIcon, WhatsAppIcon } from '../components/icons'
import { primaryBtnClass } from '../components/forms/FormField'
import { instagramLink, waLink } from '../lib/links'
import type { Paciente } from '../types/paciente'

export function Pacientes() {
  const { pacientes, loading, refetch } = usePacientes()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Paciente | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pacientes
    return pacientes.filter((p) => p.nombreCompleto.toLowerCase().includes(q))
  }, [pacientes, query])

  function openNuevo() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(p: Paciente) {
    setEditing(p)
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
          className="w-full text-sm text-ink outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => openEdit(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openEdit(p)
              }
            }}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300"
          >
            <p className="min-w-0 truncate font-medium text-ink">{p.nombreCompleto}</p>
            <div className="flex shrink-0 items-center gap-2">
              {p.telefono && (
                <a
                  href={waLink(p.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`WhatsApp de ${p.nombreCompleto}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-success-bg text-success hover:opacity-80"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )}
              {p.instagram && (
                <a
                  href={instagramLink(p.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Instagram de ${p.nombreCompleto}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600 hover:opacity-80"
                >
                  <InstagramIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {query ? 'No se encontraron pacientes.' : 'Todavía no hay pacientes cargados.'}
          </p>
        )}
      </div>

      <NuevoPacienteForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => refetch()} paciente={editing} />
    </div>
  )
}
