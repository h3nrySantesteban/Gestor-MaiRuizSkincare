import { Modal } from '../Modal/Modal'
import { primaryBtnClass, secondaryBtnClass } from '../forms/FormField'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** rojo en vez del color primario, para acciones destructivas (ej. borrar) */
  danger?: boolean
  submitting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const dangerBtnClass =
  'rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  submitting,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <Modal open onClose={onCancel} title={title} widthClassName="max-w-sm">
      <p className="text-sm text-ink-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryBtnClass}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className={danger ? dangerBtnClass : primaryBtnClass}
        >
          {submitting ? 'Un momento...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
