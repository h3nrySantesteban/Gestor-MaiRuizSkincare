interface StatCardProps {
  label: string
  value: string
  secondary?: string
  /** signed % change vs. a named prior period — up=success, down=danger (más turnos/ingresos es mejor) */
  delta?: { pct: number; label: string } | null
}

export function StatCard({ label, value, secondary, delta }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {secondary && <p className="mt-0.5 text-sm text-ink-muted">{secondary}</p>}
      {delta && (
        <p className={`mt-2 text-xs font-medium ${delta.pct >= 0 ? 'text-success' : 'text-danger'}`}>
          {delta.pct >= 0 ? '▲' : '▼'} {Math.abs(delta.pct).toFixed(0)}% {delta.label}
        </p>
      )}
    </div>
  )
}
