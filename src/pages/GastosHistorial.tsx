import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGastos } from '../hooks/useGastos'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ArrowLeftIcon } from '../components/icons'
import { formatCurrency, formatCurrencyCompact, formatMesAno, formatMesCorto } from '../lib/format'
import type { Gasto } from '../types/gasto'

type Metrica = 'total' | 'cantidad' | 'totalHabituales' | 'totalSinHabituales'
type Granularidad = 'meses' | 'años'

// mismo estilo visual que inputClass pero sin w-full/min-w-0: estos
// desplegables tienen que quedar del ancho de su contenido (empujados al
// margen derecho por justify-between en el <label>), no ocupar todo el
// espacio disponible
const selectClass =
  'rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'

const METRICA_LABEL: Record<Metrica, string> = {
  total: 'Total gastado',
  cantidad: 'Cantidad de gastos',
  totalHabituales: 'Gastos habituales',
  totalSinHabituales: 'Gastos sin habituales',
}

interface Fila {
  key: string
  periodoCorto: string
  periodoLargo: string
  total: number
  cantidad: number
  totalHabituales: number
  totalSinHabituales: number
  pctTotal: number | null
  pctCantidad: number | null
  pctHabituales: number | null
  pctSinHabituales: number | null
}

function pct(curr: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

// una fila por mes/año con al menos un gasto cargado (igual que
// agruparPorMes en Gastos.tsx, no rellena períodos sin datos con ceros) —
// el % es contra el período anterior CON datos en esta lista, no
// necesariamente el inmediato anterior en el calendario si hubo uno sin
// ningún gasto cargado en el medio
function calcularSerie(gastos: Gasto[], granularidad: Granularidad): Fila[] {
  const porKey = new Map<string, { fechaMuestra: string; total: number; cantidad: number; totalHabituales: number }>()
  for (const g of gastos) {
    const key = granularidad === 'meses' ? g.fecha.slice(0, 7) : g.fecha.slice(0, 4)
    let entry = porKey.get(key)
    if (!entry) {
      entry = { fechaMuestra: g.fecha, total: 0, cantidad: 0, totalHabituales: 0 }
      porKey.set(key, entry)
    }
    entry.total += g.valor
    entry.cantidad += 1
    if (g.esFijo) entry.totalHabituales += g.valor
  }
  const keys = [...porKey.keys()].sort() // "yyyy-MM"/"yyyy" ordenan cronológico como string
  return keys.map((key, i) => {
    const entry = porKey.get(key)!
    const prevEntry = i > 0 ? porKey.get(keys[i - 1]) : undefined
    const totalSinHabituales = entry.total - entry.totalHabituales
    const prevSinHabituales = prevEntry ? prevEntry.total - prevEntry.totalHabituales : undefined
    return {
      key,
      // en la vista "Meses" el mes va sin año (el desplegable de arriba ya
      // aclara en qué granularidad se está mirando) — en "Años" el período
      // corto y largo son lo mismo, el año solo
      periodoCorto: granularidad === 'meses' ? formatMesCorto(entry.fechaMuestra) : key,
      periodoLargo: granularidad === 'meses' ? formatMesAno(entry.fechaMuestra) : key,
      total: entry.total,
      cantidad: entry.cantidad,
      totalHabituales: entry.totalHabituales,
      totalSinHabituales,
      pctTotal: pct(entry.total, prevEntry?.total),
      pctCantidad: pct(entry.cantidad, prevEntry?.cantidad),
      pctHabituales: pct(entry.totalHabituales, prevEntry?.totalHabituales),
      pctSinHabituales: pct(totalSinHabituales, prevSinHabituales),
    }
  })
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`
}

// más gasto = rojo, menos gasto = verde — mismo criterio que la tarjeta
// "Total este mes" en Gastos.tsx
function pctColorClass(value: number | null): string {
  if (value === null || value === 0) return 'text-ink-muted'
  return value > 0 ? 'text-danger' : 'text-success'
}

type SortColumn = 'periodo' | 'total' | 'cantidad' | 'totalHabituales' | 'totalSinHabituales'
type SortDirection = 'asc' | 'desc'
interface Sort {
  column: SortColumn
  direction: SortDirection
}

function SortButton({
  label,
  column,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  column: SortColumn
  sort: Sort
  onSort: (column: SortColumn) => void
  align?: 'left' | 'right'
}) {
  const active = sort.column === column
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

export function GastosHistorial() {
  const { gastos, loading } = useGastos()
  const [granularidad, setGranularidad] = useState<Granularidad>('meses')
  const [vista, setVista] = useState<'tabla' | 'linea' | 'barras'>('tabla')
  const [metrica, setMetrica] = useState<Metrica>('total')
  const [sort, setSort] = useState<Sort>({ column: 'periodo', direction: 'desc' })

  // los gráficos van siempre de más viejo a más nuevo (izquierda a derecha)
  // — el orden de la tabla es independiente, lo maneja sort
  const serie = useMemo(() => calcularSerie(gastos, granularidad), [gastos, granularidad])

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' },
    )
  }

  const filasTabla = useMemo(() => {
    const copia = [...serie]
    copia.sort((a, b) => {
      const cmp = sort.column === 'periodo' ? a.key.localeCompare(b.key) : a[sort.column] - b[sort.column]
      return sort.direction === 'asc' ? cmp : -cmp
    })
    return copia
  }, [serie, sort])

  return (
    <div className="flex flex-col gap-6">
      <Link to="/gastos" className="flex w-fit items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" /> Gastos
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-ink">Historial de gastos</h1>
        <p className="text-sm text-ink-muted">Por {granularidad === 'meses' ? 'mes' : 'año'}, con la variación contra el {granularidad === 'meses' ? 'mes' : 'año'} anterior</p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
          Agrupar por
          <select
            value={granularidad}
            onChange={(e) => setGranularidad(e.target.value as Granularidad)}
            className={selectClass}
          >
            <option value="meses">Meses</option>
            <option value="años">Años</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
          Ver como
          <select value={vista} onChange={(e) => setVista(e.target.value as typeof vista)} className={selectClass}>
            <option value="tabla">Tabla</option>
            <option value="linea">Línea</option>
            <option value="barras">Barras</option>
          </select>
        </label>
        {vista === 'linea' && (
          <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
            Métrica
            <select value={metrica} onChange={(e) => setMetrica(e.target.value as Metrica)} className={selectClass}>
              {(Object.keys(METRICA_LABEL) as Metrica[]).map((key) => (
                <option key={key} value={key}>
                  {METRICA_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : serie.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          Todavía no hay gastos cargados.
        </p>
      ) : vista === 'tabla' ? (
        <TablaHistorial filas={filasTabla} sort={sort} onSort={handleSort} granularidad={granularidad} />
      ) : vista === 'linea' ? (
        <GraficoLinea data={serie} metrica={metrica} />
      ) : (
        <GraficoBarras data={serie} />
      )}
    </div>
  )
}

function TablaHistorial({
  filas,
  sort,
  onSort,
  granularidad,
}: {
  filas: Fila[]
  sort: Sort
  onSort: (column: SortColumn) => void
  granularidad: Granularidad
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th className="whitespace-nowrap px-2.5 py-3 font-medium">
              <SortButton label={granularidad === 'meses' ? 'Mes' : 'Año'} column="periodo" sort={sort} onSort={onSort} />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <SortButton label="Total" column="total" sort={sort} onSort={onSort} align="right" />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <SortButton label="Cant." column="cantidad" sort={sort} onSort={onSort} align="right" />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <SortButton label="Hab." column="totalHabituales" sort={sort} onSort={onSort} align="right" />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <SortButton label="Sin hab." column="totalSinHabituales" sort={sort} onSort={onSort} align="right" />
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.key} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-2.5 py-3 capitalize text-ink">{f.periodoCorto}</td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {formatCurrency(f.total)}
                <div className={`text-[11px] font-medium ${pctColorClass(f.pctTotal)}`}>{formatPct(f.pctTotal)}</div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {f.cantidad}
                <div className="text-[11px] font-medium text-ink-muted">{formatPct(f.pctCantidad)}</div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {formatCurrency(f.totalHabituales)}
                <div className={`text-[11px] font-medium ${pctColorClass(f.pctHabituales)}`}>{formatPct(f.pctHabituales)}</div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {formatCurrency(f.totalSinHabituales)}
                <div className={`text-[11px] font-medium ${pctColorClass(f.pctSinHabituales)}`}>{formatPct(f.pctSinHabituales)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LineaTooltip({ active, payload, metrica }: { active?: boolean; payload?: { payload: Fila }[]; metrica: Metrica }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  const valor = row[metrica]
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.periodoLargo}</p>
      <p className="text-sm font-semibold text-ink">{metrica === 'cantidad' ? valor : formatCurrency(valor)}</p>
    </div>
  )
}

function GraficoLinea({ data, metrica }: { data: Fila[]; metrica: Metrica }) {
  return (
    <div className="h-64 w-full rounded-xl border border-border bg-surface p-4 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="periodoCorto"
            tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
            tickFormatter={(v: number) => (metrica === 'cantidad' ? String(v) : formatCurrencyCompact(v))}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip cursor={{ stroke: 'var(--color-border)' }} content={<LineaTooltip metrica={metrica} />} />
          <Line
            type="monotone"
            dataKey={metrica}
            name={METRICA_LABEL[metrica]}
            stroke="var(--color-primary-600)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-primary-600)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarrasTooltip({ active, payload }: { active?: boolean; payload?: { payload: Fila }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.periodoLargo}</p>
      <p className="text-sm font-semibold text-ink">{formatCurrency(row.total)} total</p>
      <p className="text-xs text-ink-muted">Habituales: {formatCurrency(row.totalHabituales)}</p>
      <p className="text-xs text-ink-muted">Sin habituales: {formatCurrency(row.totalSinHabituales)}</p>
    </div>
  )
}

// apiladas (stackId compartido), no una al lado de la otra — lo que importa
// acá es ver la composición del total de cada período, no comparar barras
function GraficoBarras({ data }: { data: Fila[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-600)' }} />
          Habituales
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-300)' }} />
          Sin habituales
        </span>
      </div>
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="periodoCorto"
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
            <Tooltip cursor={false} content={<BarrasTooltip />} />
            <Bar dataKey="totalHabituales" stackId="gasto" name="Habituales" fill="var(--color-primary-600)" maxBarSize={32} />
            <Bar
              dataKey="totalSinHabituales"
              stackId="gasto"
              name="Sin habituales"
              fill="var(--color-primary-300)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
