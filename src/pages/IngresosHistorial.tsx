import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIngresos } from '../hooks/useIngresos'
import { useGastos } from '../hooks/useGastos'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ArrowLeftIcon } from '../components/icons'
import { InfoTooltip } from '../components/InfoTooltip/InfoTooltip'
import { formatCurrency, formatCurrencyCompact, parseFechaSolo } from '../lib/format'
import type { Turno } from '../types/turno'
import type { Gasto } from '../types/gasto'

type Metrica = 'bruto' | 'neto' | 'cantidad' | 'ticket'
type Granularidad = 'meses' | 'años'

// mismo estilo visual que inputClass pero sin w-full/min-w-0: estos
// desplegables tienen que quedar del ancho de su contenido (empujados al
// margen derecho por justify-between en el <label>), no ocupar todo el ancho
const selectClass =
  'rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500'

const METRICA_LABEL: Record<Metrica, string> = {
  bruto: 'Bruto',
  neto: 'Neto',
  cantidad: 'Cantidad de turnos',
  ticket: 'Ticket promedio',
}

interface Fila {
  key: string
  periodoCorto: string
  /** para la tabla en granularidad "meses": mes + año, evita ambigüedad entre "jul" de un año y otro (el gráfico sigue usando periodoCorto, sin año, para no recargar el eje) */
  periodoTabla: string
  periodoLargo: string
  bruto: number
  /** bruto − gastos cargados en ese mismo período — mismo criterio que IngresosCarousel */
  neto: number
  cantidad: number
  ticket: number
  totalTurnos: number
  totalSenas: number
  pctBruto: number | null
  pctNeto: number | null
  pctCantidad: number | null
  pctTicket: number | null
}

function esSena(t: Turno): boolean {
  return t.estado === 'Cancelado' && t.senado
}

function formatMesLargo(fecha: Date): string {
  const label = format(fecha, 'MMMM yyyy', { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function pct(curr: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

// una fila por mes/año con al menos un turno facturado o un gasto cargado
// (no rellena períodos vacíos con ceros) — el % es contra el período
// anterior CON datos en esta lista, no necesariamente el inmediato
// anterior del calendario
function calcularSerie(turnos: Turno[], gastos: Gasto[], granularidad: Granularidad): Fila[] {
  const porKey = new Map<string, { fechaMuestra: Date; bruto: number; cantidad: number; totalSenas: number; gastos: number }>()
  function entrada(key: string, fechaMuestra: Date) {
    let e = porKey.get(key)
    if (!e) {
      e = { fechaMuestra, bruto: 0, cantidad: 0, totalSenas: 0, gastos: 0 }
      porKey.set(key, e)
    }
    return e
  }
  for (const t of turnos) {
    const d = new Date(t.fecha)
    const key = granularidad === 'meses' ? format(d, 'yyyy-MM') : format(d, 'yyyy')
    const e = entrada(key, d)
    e.bruto += t.precio
    e.cantidad += 1
    if (esSena(t)) e.totalSenas += t.precio
  }
  for (const g of gastos) {
    // gastos.fecha es date-only (no timestamptz, a diferencia de
    // turnos.fecha) — parseFechaSolo evita el corrimiento de día por UTC
    const d = parseFechaSolo(g.fecha)
    const key = granularidad === 'meses' ? format(d, 'yyyy-MM') : format(d, 'yyyy')
    entrada(key, d).gastos += g.valor
  }
  const keys = [...porKey.keys()].sort() // "yyyy-MM"/"yyyy" ordenan cronológico como string
  return keys.map((key, i) => {
    const entry = porKey.get(key)!
    const prevEntry = i > 0 ? porKey.get(keys[i - 1]) : undefined
    const ticket = entry.cantidad > 0 ? entry.bruto / entry.cantidad : 0
    const prevTicket = prevEntry && prevEntry.cantidad > 0 ? prevEntry.bruto / prevEntry.cantidad : undefined
    const neto = entry.bruto - entry.gastos
    const prevNeto = prevEntry ? prevEntry.bruto - prevEntry.gastos : undefined
    return {
      key,
      periodoCorto: granularidad === 'meses' ? format(entry.fechaMuestra, 'MMM', { locale: es }) : key,
      periodoTabla: granularidad === 'meses' ? format(entry.fechaMuestra, 'MMM yyyy', { locale: es }) : key,
      periodoLargo: granularidad === 'meses' ? formatMesLargo(entry.fechaMuestra) : key,
      bruto: entry.bruto,
      neto,
      cantidad: entry.cantidad,
      ticket,
      totalTurnos: entry.bruto - entry.totalSenas,
      totalSenas: entry.totalSenas,
      pctBruto: pct(entry.bruto, prevEntry?.bruto),
      pctNeto: pct(neto, prevNeto),
      pctCantidad: pct(entry.cantidad, prevEntry?.cantidad),
      pctTicket: pct(ticket, prevTicket),
    }
  })
}

function formatPct(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`
}

// más ingreso = verde, menos = rojo (al revés que en gastos)
function pctColorClass(value: number | null): string {
  if (value === null || value === 0) return 'text-ink-muted'
  return value > 0 ? 'text-success' : 'text-danger'
}

type SortColumn = 'periodo' | 'bruto' | 'neto' | 'cantidad' | 'ticket'
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

export function IngresosHistorial() {
  const { turnos, loading } = useIngresos()
  const { gastos, loading: gastosLoading } = useGastos()
  const [granularidad, setGranularidad] = useState<Granularidad>('meses')
  const [vista, setVista] = useState<'tabla' | 'linea' | 'barras'>('tabla')
  const [metrica, setMetrica] = useState<Metrica>('bruto')
  const [sort, setSort] = useState<Sort>({ column: 'periodo', direction: 'desc' })

  const loadingSerie = loading || gastosLoading

  // los gráficos van siempre de más viejo a más nuevo (izquierda a derecha)
  // — el orden de la tabla es independiente, lo maneja sort
  const serie = useMemo(() => calcularSerie(turnos, gastos, granularidad), [turnos, gastos, granularidad])

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
      <Link to="/ingresos" className="flex w-fit items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" /> Ingresos
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-ink">Historial de ingresos</h1>
        <p className="text-sm text-ink-muted">
          Por {granularidad === 'meses' ? 'mes' : 'año'}, con la variación contra el{' '}
          {granularidad === 'meses' ? 'mes' : 'año'} anterior
        </p>
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

      {loadingSerie ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : serie.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          Todavía no hay turnos facturados.
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
              <SortButton label="Neto" column="neto" sort={sort} onSort={onSort} align="right" />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <SortButton label="Bruto" column="bruto" sort={sort} onSort={onSort} align="right" />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <SortButton label="Cant." column="cantidad" sort={sort} onSort={onSort} align="right" />
            </th>
            <th className="whitespace-nowrap px-2.5 py-3 text-right font-medium">
              <div className="flex items-center justify-end gap-1">
                <SortButton label="Ticket" column="ticket" sort={sort} onSort={onSort} />
                <InfoTooltip text="Ticket promedio: el total Bruto del período dividido por la cantidad de turnos facturados — el monto promedio por turno." />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.key} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-2.5 py-3 capitalize text-ink">{f.periodoTabla}</td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {formatCurrency(f.neto)}
                <div className={`text-[11px] font-medium ${pctColorClass(f.pctNeto)}`}>{formatPct(f.pctNeto)}</div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {formatCurrency(f.bruto)}
                <div className={`text-[11px] font-medium ${pctColorClass(f.pctBruto)}`}>{formatPct(f.pctBruto)}</div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {f.cantidad}
                <div className="text-[11px] font-medium text-ink-muted">{formatPct(f.pctCantidad)}</div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-3 text-right tabular-nums text-ink">
                {formatCurrency(f.ticket)}
                <div className={`text-[11px] font-medium ${pctColorClass(f.pctTicket)}`}>{formatPct(f.pctTicket)}</div>
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
        <LineChart data={data} accessibilityLayer={false} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
      <p className="text-sm font-semibold text-ink">{formatCurrency(row.bruto)} total</p>
      <p className="text-xs text-ink-muted">Turnos: {formatCurrency(row.totalTurnos)}</p>
      <p className="text-xs text-ink-muted">Señas: {formatCurrency(row.totalSenas)}</p>
    </div>
  )
}

// apiladas (stackId compartido), no una al lado de la otra — lo que importa
// es ver de qué se compone el total de cada período: turnos finalizados vs.
// señas de turnos cancelados
function GraficoBarras({ data }: { data: Fila[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-600)' }} />
          Turnos
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-300)' }} />
          Señas
        </span>
      </div>
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} accessibilityLayer={false} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            <Bar dataKey="totalTurnos" stackId="ingreso" name="Turnos" fill="var(--color-primary-600)" maxBarSize={32} />
            <Bar
              dataKey="totalSenas"
              stackId="ingreso"
              name="Señas"
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
