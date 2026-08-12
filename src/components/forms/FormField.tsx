import type { ReactNode } from 'react'

export const inputClass =
  'w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'

export const primaryBtnClass =
  'rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60'

export const secondaryBtnClass =
  'rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted'

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

export function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}
