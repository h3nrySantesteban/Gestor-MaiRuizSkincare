import { InfoIcon } from '../icons'

interface StatHalf {
  label: string
  value: string
  secondary?: string
  /** icono de info junto al label — para valores que son una proyección/estimación y conviene aclarar cómo se calculan */
  onInfoClick?: () => void
}

interface SplitStatCardProps {
  left: StatHalf
  right: StatHalf
}

function StatHalfContent({ label, value, secondary, onInfoClick }: StatHalf) {
  return (
    <>
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {onInfoClick && (
          <button
            type="button"
            onClick={onInfoClick}
            aria-label={`Cómo se calcula: ${label}`}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-muted hover:text-ink"
          >
            <InfoIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {secondary && <p className="mt-0.5 text-sm text-ink-muted">{secondary}</p>}
    </>
  )
}

/** Misma tarjeta que StatCard, partida en dos mitades separadas por un borde. */
export function SplitStatCard({ left, right }: SplitStatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="pr-4">
          <StatHalfContent {...left} />
        </div>
        <div className="pl-4">
          <StatHalfContent {...right} />
        </div>
      </div>
    </div>
  )
}
