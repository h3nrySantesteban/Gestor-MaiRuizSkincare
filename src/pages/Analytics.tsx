import { useState } from 'react'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useTopTratamientos } from '../hooks/useTopTratamientos'
import { StatCard } from '../components/StatCard/StatCard'
import { formatCurrency } from '../lib/format'

function pctChange(actual: number, anterior: number): number {
  if (anterior === 0) return actual === 0 ? 0 : 100
  return ((actual - anterior) / anterior) * 100
}

export function Analytics() {
  const [{ desde, hasta }] = useState(() => ({
    desde: startOfMonth(subMonths(new Date(), 5)).toISOString(),
    hasta: endOfMonth(new Date()).toISOString(),
  }))
  const { serieSeisMeses, loading: loadingStats } = useDashboardStats()
  const { top, loading: loadingTop } = useTopTratamientos(desde, hasta)

  const mesActual = serieSeisMeses.at(-1)
  const mesAnterior = serieSeisMeses.at(-2)
  const maxIngresos = Math.max(1, ...top.map((t) => t.ingresos))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Analytics</h1>
        <p className="text-sm text-ink-muted">Este mes comparado con el anterior, y qué tratamientos rinden más</p>
      </div>

      {!loadingStats && mesActual && mesAnterior && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Turnos este mes"
            value={String(mesActual.cantidad)}
            secondary={`Mes anterior: ${mesAnterior.cantidad}`}
            delta={{ pct: pctChange(mesActual.cantidad, mesAnterior.cantidad), label: 'vs. mes anterior' }}
          />
          <StatCard
            label="Ingresos este mes"
            value={formatCurrency(mesActual.ingresos)}
            secondary={`Mes anterior: ${formatCurrency(mesAnterior.ingresos)}`}
            delta={{ pct: pctChange(mesActual.ingresos, mesAnterior.ingresos), label: 'vs. mes anterior' }}
          />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="mb-4 text-sm font-medium text-ink-muted">Tratamientos por ingresos — últimos 6 meses</p>
        <div className="flex flex-col gap-4">
          {top.map((t, i) => (
            <div key={t.tratamientoId} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-sm font-medium text-ink-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-ink">{t.nombre}</span>
                  <span className="shrink-0 font-semibold text-ink">{formatCurrency(t.ingresos)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${(t.ingresos / maxIngresos) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {t.cantidad} turno{t.cantidad === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          ))}

          {!loadingTop && top.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-muted">
              Todavía no hay turnos con tratamientos en este período.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
