import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MesSerie } from '../../hooks/useDashboardStats'
import { formatCurrency, formatCurrencyCompact } from '../../lib/format'

interface MonthlyChartProps {
  data: MesSerie[]
}

type SortColumn = 'mes' | 'cantidad' | 'ingresos' | 'ingresosAlaFecha'
type SortDirection = 'asc' | 'desc'

function SortButton({
  label,
  column,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  column: SortColumn
  sort: { column: SortColumn; direction: SortDirection } | null
  onSort: (column: SortColumn) => void
  align?: 'left' | 'right'
}) {
  const active = sort?.column === column
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`flex items-center gap-1 font-medium hover:text-ink ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      <span className="w-3 text-[10px]">{active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  )
}

interface ChartTooltipProps {
  active?: boolean
  payload?: { payload: MesSerie }[]
  diaDeHoy: number
}

function ChartTooltip({ active, payload, diaDeHoy }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.mes}</p>
      <p className="text-sm font-semibold text-ink">{formatCurrency(row.ingresos)} total</p>
      <p className="text-xs text-ink-muted">Al día {diaDeHoy}: {formatCurrency(row.ingresosAlaFecha)}</p>
      <p className="mt-1 text-xs text-ink-muted">
        {row.cantidad} turno{row.cantidad === 1 ? '' : 's'}
      </p>
    </div>
  )
}

/**
 * Un solo eje/unidad a propósito (siempre pesos): las dos barras comparan la
 * misma magnitud de dos formas — total del mes vs. lo acumulado a la misma
 * altura del mes (mismo día que hoy) — así el mes en curso, todavía
 * incompleto, se puede comparar contra meses cerrados sin que la comparación
 * sea injusta. La cantidad de turnos por mes se ve en el tooltip y en la
 * tabla, no como tercer eje.
 */
export function MonthlyChart({ data }: MonthlyChartProps) {
  const [view, setView] = useState<'chart' | 'tabla'>('chart')
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection } | null>(null)
  const diaDeHoy = new Date().getDate()

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev?.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' },
    )
  }

  const sortedData = sort
    ? [...data].sort((a, b) => {
        // mesKey es "yyyy-MM": ordena cronológicamente como string, a
        // diferencia de "mes" (ene, feb...) que ordenaría alfabético
        const cmp = sort.column === 'mes' ? a.mesKey.localeCompare(b.mesKey) : a[sort.column] - b[sort.column]
        return sort.direction === 'asc' ? cmp : -cmp
      })
    : data

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">Ingresos — últimos 6 meses</p>
        <button
          type="button"
          onClick={() => setView((v) => (v === 'chart' ? 'tabla' : 'chart'))}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          {view === 'chart' ? 'Ver tabla' : 'Ver gráfico'}
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 sm:mb-4">
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-700)' }} />
          Total del mes
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-500)' }} />
          Acumulado al día {diaDeHoy}
        </span>
      </div>

      {view === 'chart' ? (
        // más bajo solo en pantallas angostas de teléfono (<640px, el sm de
        // Tailwind sin tocar) — parte de achicar el dashboard para que entre
        // en el viewport de un iPhone sin scroll vertical (todo #2). "md" en
        // este proyecto es 1200px (ver index.css), demasiado ancho: un iPad
        // (768-1200px) quedaba con el gráfico chico de igual manera, con
        // lugar de sobra sin usar debajo — por eso sm: y no md: acá.
        <div className="h-44 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} accessibilityLayer={false} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              {/* cursor=false: sin esto, Recharts pinta un rectángulo de fondo
                  detrás de toda la columna al tocar/hacer hover — se veía
                  como si estuviera "seleccionando" esa franja del gráfico */}
              <Tooltip cursor={false} content={<ChartTooltip diaDeHoy={diaDeHoy} />} />
              <Bar dataKey="ingresos" name="Total del mes" fill="var(--color-primary-700)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar
                dataKey="ingresosAlaFecha"
                name={`Acumulado al día ${diaDeHoy}`}
                fill="var(--color-primary-500)"
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="py-2 font-medium">
                  <SortButton label="Mes" column="mes" sort={sort} onSort={handleSort} />
                </th>
                <th className="py-2 font-medium">
                  <SortButton label="Turnos" column="cantidad" sort={sort} onSort={handleSort} />
                </th>
                <th className="py-2 text-right font-medium">
                  <SortButton label="Total del mes" column="ingresos" sort={sort} onSort={handleSort} align="right" />
                </th>
                <th className="py-2 text-right font-medium">
                  <SortButton
                    label={`Al día ${diaDeHoy}`}
                    column="ingresosAlaFecha"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row) => (
                <tr key={row.mesKey} className="border-b border-border last:border-0">
                  <td className="py-2 capitalize text-ink">{row.mes}</td>
                  <td className="py-2 tabular-nums text-ink">{row.cantidad}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{formatCurrency(row.ingresos)}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{formatCurrency(row.ingresosAlaFecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
