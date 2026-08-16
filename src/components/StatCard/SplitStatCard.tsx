interface StatHalf {
  label: string
  value: string
  secondary?: string
}

interface SplitStatCardProps {
  left: StatHalf
  right: StatHalf
}

/** Misma tarjeta que StatCard, partida en dos mitades separadas por un borde. */
export function SplitStatCard({ left, right }: SplitStatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-4">
          <p className="text-sm font-medium text-ink-muted">{left.label}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{left.value}</p>
          {left.secondary && <p className="mt-0.5 text-sm text-ink-muted">{left.secondary}</p>}
        </div>
        <div className="pl-4">
          <p className="text-sm font-medium text-ink-muted">{right.label}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{right.value}</p>
          {right.secondary && <p className="mt-0.5 text-sm text-ink-muted">{right.secondary}</p>}
        </div>
      </div>
    </div>
  )
}
