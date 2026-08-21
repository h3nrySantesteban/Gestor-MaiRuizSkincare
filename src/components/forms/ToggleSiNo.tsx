export function ToggleSiNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          value ? 'bg-primary-500 text-white' : 'bg-surface text-ink-muted hover:bg-surface-muted'
        }`}
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 text-sm font-medium transition-colors ${
          !value ? 'bg-primary-500 text-white' : 'bg-surface text-ink-muted hover:bg-surface-muted'
        }`}
      >
        No
      </button>
    </div>
  )
}
