import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { XIcon } from '../icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  widthClassName?: string
}

export function Modal({ open, onClose, title, children, widthClassName = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    // items-start en mobile (no items-center): con el teclado abierto, vh no
    // se achica pero dvh sí — con center, el modal queda centrado según el
    // viewport "de layout" (ignora el teclado) y los campos de abajo terminan
    // fuera del área realmente visible, sin forma de alcanzarlos con scroll.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`my-8 flex max-h-[85dvh] w-full ${widthClassName} flex-col overflow-hidden rounded-2xl bg-surface shadow-xl sm:my-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
