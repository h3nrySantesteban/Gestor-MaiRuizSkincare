import { useState } from 'react'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MesSerie } from '../../hooks/useDashboardStats'
import { formatCurrency, formatCurrencyCompact } from '../../lib/format'

interface MonthlyChartProps {
  data: MesSerie[]
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { payload: MesSerie }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.mes}</p>
      <p className="text-sm font-semibold text-ink">{formatCurrency(row.ingresos)}</p>
      <p className="text-xs text-ink-muted">
        {row.cantidad} turno{row.cantidad === 1 ? '' : 's'}
      </p>
    </div>
  )
}

/**
 * Un solo eje/serie (ingresos) a propósito: la cantidad de turnos por mes se
 * ve en el tooltip y en la vista de tabla, nunca como segundo eje Y en el
 * mismo gráfico (un dual-axis inventa una correlación que no está en los datos).
 */
export function MonthlyChart({ data }: MonthlyChartProps) {
  const [view, setView] = useState<'chart' | 'tabla'>('chart')

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">Ingresos — últimos 6 meses</p>
        <button
          type="button"
          onClick={() => setView((v) => (v === 'chart' ? 'tabla' : 'chart'))}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          {view === 'chart' ? 'Ver tabla' : 'Ver gráfico'}
        </button>
      </div>

      {view === 'chart' ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<ChartTooltip />} />
              <Bar dataKey="ingresos" fill="var(--color-primary-600)" radius={[4, 4, 0, 0]} maxBarSize={24}>
                <LabelList
                  dataKey="ingresos"
                  position="top"
                  formatter={(v: ReactNode) => formatCurrencyCompact(Number(v))}
                  style={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="py-2 font-medium">Mes</th>
                <th className="py-2 font-medium">Turnos</th>
                <th className="py-2 text-right font-medium">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.mesKey} className="border-b border-border last:border-0">
                  <td className="py-2 capitalize text-ink">{row.mes}</td>
                  <td className="py-2 tabular-nums text-ink">{row.cantidad}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{formatCurrency(row.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
