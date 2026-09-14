import { useState } from 'react'
import { Modal } from '../Modal/Modal'
import { InfoIcon } from '../icons'

interface InfoTooltipProps {
  title: string
  text: string
}

/**
 * Botón de "i" que abre una explicación corta en un modal centrado —
 * mismo patrón que el modal "¿Cómo se calcula 'Agendados'?" de Dashboard.tsx.
 * Reemplaza al popover posicionado a mano que tenía antes (position:fixed
 * calculado desde el botón): ese approach evitaba el recorte dentro de
 * contenedores con overflow-x-auto (ej. IngresosCarousel, una tabla con
 * scroll horizontal), pero un modal centrado no tiene ese problema para
 * empezar, y de paso unifica el estilo de "info" en toda la app.
 */
export function InfoTooltip({ title, text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cómo se calcula"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} widthClassName="max-w-sm">
        <p className="text-sm text-ink-muted">{text}</p>
      </Modal>
    </>
  )
}
