import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from '../icons'

interface ComboboxCreatableProps<T> {
  items: T[]
  selectedIds: string[]
  multiple: boolean
  getId: (item: T) => string
  getLabel: (item: T) => string
  getSublabel?: (item: T) => string | null
  placeholder?: string
  onChange: (ids: string[]) => void
  /** Omitir cuando se usa como filtro de búsqueda, donde "crear nuevo" no aplica. */
  onCreateNew?: (query: string) => void
  createLabel?: (query: string) => string
  /** Para poder enfocar este picker desde afuera (ej: avanzar acá al completar el campo anterior). */
  inputRef?: RefObject<HTMLInputElement | null>
}

/**
 * Picker buscable con "crear nuevo" inline. multiple=false: elegir cierra el
 * dropdown y muestra el valor elegido (paciente). multiple=true: los
 * elegidos quedan como chips removibles y el dropdown sigue abierto
 * (tratamientos).
 */
export function ComboboxCreatable<T>({
  items,
  selectedIds,
  multiple,
  getId,
  getLabel,
  getSublabel,
  placeholder = 'Buscar...',
  onChange,
  onCreateNew,
  createLabel,
  inputRef,
}: ComboboxCreatableProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = inputRef ?? internalInputRef

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selectedItems = items.filter((item) => selectedIds.includes(getId(item)))
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = items.filter((item) => getLabel(item).toLowerCase().includes(normalizedQuery))
  const exactMatch = items.some((item) => getLabel(item).toLowerCase() === normalizedQuery)

  function toggle(id: string) {
    if (multiple) {
      onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id])
      // el dropdown se queda abierto para seguir eligiendo, pero clickear el
      // botón de la opción le robó el foco al input — se lo devolvemos para
      // poder seguir escribiendo el siguiente sin tocar de nuevo la pantalla
      searchInputRef.current?.focus()
    } else {
      onChange([id])
      setOpen(false)
      setQuery('')
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((i) => i !== id))
  }

  const showButton = !multiple && selectedItems[0] && !open

  return (
    <div className="relative" ref={ref}>
      {showButton ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm text-ink hover:border-primary-500"
        >
          {getLabel(selectedItems[0])}
          <span className="text-xs font-medium text-primary-600">cambiar</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
          <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full text-base text-ink outline-none"
          />
        </div>
      )}

      {/* solo con el dropdown cerrado: mientras está abierto, el check junto a
          cada opción ya muestra qué está elegido — mostrar los chips además
          tapaba el resto del formulario (el dropdown, absolute, no empuja lo
          que viene después) */}
      {multiple && !open && selectedItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span
              key={getId(item)}
              className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
            >
              {getLabel(item)}
              <button type="button" onClick={() => remove(getId(item))} aria-label={`Quitar ${getLabel(item)}`}>
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {filtered.length === 0 && !normalizedQuery && (
            <p className="px-3 py-2 text-sm text-ink-muted">Empezá a escribir para buscar.</p>
          )}
          {filtered.map((item) => {
            const id = getId(item)
            const isSelected = selectedIds.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                  isSelected ? 'text-primary-700' : 'text-ink'
                }`}
              >
                <span>
                  {getLabel(item)}
                  {getSublabel?.(item) && <span className="ml-1.5 text-xs text-ink-muted">{getSublabel(item)}</span>}
                </span>
                {isSelected && <CheckIcon className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
          {onCreateNew && normalizedQuery && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(query.trim())
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium text-primary-600 hover:bg-primary-50"
            >
              <PlusIcon className="h-4 w-4 shrink-0" />
              {createLabel ? createLabel(query.trim()) : `Crear "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
