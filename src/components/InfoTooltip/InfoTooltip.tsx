import { useEffect, useRef, useState } from 'react'
import { InfoIcon } from '../icons'

const TOOLTIP_WIDTH = 224 // w-56

interface InfoTooltipProps {
  text: string
}

/**
 * Botón de "i" que abre una explicación corta al tocarlo (click afuera o
 * Escape cierra). El panel usa position:fixed calculado a mano desde el
 * botón (getBoundingClientRect, acotado al viewport) en vez de
 * position:absolute — así funciona igual esté o no dentro de un contenedor
 * con overflow-x-auto (ej. IngresosCarousel, una tabla con scroll
 * horizontal): absolute ahí queda recortado/superpuesto por el propio
 * overflow del ancestro.
 */
export function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const left = Math.min(Math.max(rect.left, 8), window.innerWidth - TOOLTIP_WIDTH - 8)
      setPos({ top: rect.bottom + 4, left })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
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
  }, [open])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Cómo se calcula"
        className="flex h-4 w-4 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: TOOLTIP_WIDTH }}
          className="z-50 rounded-lg border border-border bg-surface p-3 text-xs text-ink-muted shadow-lg"
        >
          {text}
        </div>
      )}
    </div>
  )
}
