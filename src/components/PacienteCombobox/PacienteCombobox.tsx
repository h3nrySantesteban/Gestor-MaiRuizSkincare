import { useEffect, useRef, useState } from 'react'
import { inputClass } from '../forms/FormField'
import { ChevronDownIcon } from '../icons'
import { normalizeSearch } from '../../lib/text'
import type { Paciente } from '../../types/paciente'

interface PacienteComboboxProps {
  pacientes: Paciente[]
  value: string | null
  onChange: (id: string | null) => void
}

// Extraído de NuevoTurnoForm.tsx para reusar en Formularios/PacienteDetalle
// (asignar una respuesta de formulario a un paciente). Reemplaza al
// <select> nativo que había en NuevoTurnoForm: con muchos pacientes cargados
// hace falta poder escribir para filtrar. El nativo se había elegido en su
// momento por bugs de foco en iOS con un combobox más viejo — este es
// deliberadamente simple (un input que filtra una lista, click para elegir,
// sin autofocus ni navegación por teclado) para minimizar esa superficie de
// bugs, pero probar bien en un iPhone real antes de confiar del todo en esto.
export function PacienteCombobox({ pacientes, value, onChange }: PacienteComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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

  const seleccionado = pacientes.find((p) => p.id === value) ?? null
  const filtrados = pacientes.filter((p) => normalizeSearch(p.nombreCompleto).includes(normalizeSearch(query.trim())))

  function handleSelect(id: string) {
    // blur explícito: en iOS, sacar del DOM un input enfocado (acá, al
    // pasar open a false) no siempre alcanza para bajar el teclado solo —
    // hay que sacarle el foco a mano antes de que el input desaparezca
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    onChange(id)
    setOpen(false)
  }

  function handleTriggerClick() {
    if (open) {
      setOpen(false)
      return
    }
    setQuery('')
    setOpen(true)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleTriggerClick}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="min-w-0 truncate">{seleccionado?.nombreCompleto ?? 'Seleccionar paciente...'}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-full flex-col rounded-lg border border-border bg-surface shadow-lg">
          <input
            // focus apenas se monta (o sea, apenas se abre el panel): permite
            // escribir directo desde el click en el trigger, sin tocar el
            // buscador aparte. el ref-callback dispara en cada montaje, que
            // es exactamente cuando open pasa a true (este bloque entero
            // deja de renderizarse mientras open es false)
            ref={(el) => el?.focus()}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="border-b border-border px-3 py-2 text-base text-ink outline-none"
          />
          <div className="max-h-48 overflow-y-auto p-1">
            {filtrados.length === 0 && <p className="p-2 text-sm text-ink-muted">Sin resultados.</p>}
            {filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                // onMouseDown+preventDefault, no onClick: en iOS, con el
                // buscador enfocado, el ciclo touchstart→mousedown→click de
                // un <button> distinto no le saca el foco al input a tiempo
                // (mismo bug ya documentado en CLAUDE.md para el picker
                // anterior) — preventDefault en mousedown evita ese forcejeo
                // y dispara la selección ahí mismo, antes de que el click
                // llegue a pelearse con el foco del input.
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(p.id)
                }}
                className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-surface-muted ${
                  p.id === value ? 'bg-primary-50 text-primary-700' : 'text-ink'
                }`}
              >
                {p.nombreCompleto}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
