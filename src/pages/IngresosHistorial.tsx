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

// "bruto"/"neto" ya no se eligen por separado: se fusionaron en la opción
// "ingresos" del selector (ver MetricaSeleccionable), que muestra las dos
// líneas juntas con leyenda — Metrica sigue existiendo porque Fila todavía
// tiene un campo por cada una y el tooltip/leyenda necesitan sus labels.
type Metrica = 'bruto' | 'neto' | 'cantidad' | 'ticket'
type MetricaSeleccionable = 'ingresos' | 'cantidad' | 'ticket'
type Granularidad = 'meses' | 'años'
type RangoTiempo = '6m' | '1a' | '2a' | 'todo'

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

const SELECTOR_LABEL: Record<MetricaSeleccionable, string> = {
  ingresos: 'Ingresos',
  cantidad: 'Cantidad de turnos',
  ticket: 'Ticket promedio',
}

// cortos a propósito: son chips angostos arriba del gráfico, un label largo
// ("Últimos 6 meses") los hacía demasiado anchos
const RANGO_LABEL: Record<RangoTiempo, string> = {
  '6m': '6M',
  '1a': '1A',
  '2a': '2A',
  todo: 'Max',
}

// las keys de la serie ("yyyy-MM"/"yyyy") ordenan cronológico como string
// (ver calcularSerie) — comparar contra un corte con el mismo formato evita
// tener que parsear fechas de vuelta acá
function claveDeCorte(rango: RangoTiempo, granularidad: Granularidad): string | null {
  if (rango === 'todo') return null
  const meses = rango === '6m' ? 6 : rango === '1a' ? 12 : 24
  const hoy = new Date()
  // -1: el mes actual (parcial) ya cuenta como uno de los "meses" del rango
  const corte = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1)
  if (granularidad === 'años') return String(corte.getFullYear())
  return `${corte.getFullYear()}-${String(corte.getMonth() + 1).padStart(2, '0')}`
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
  pctBruto: number | null
  pctNeto: number | null
  pctCantidad: number | null
  pctTicket: number | null
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
  const porKey = new Map<string, { fechaMuestra: Date; bruto: number; cantidad: number; gastos: number }>()
  function entrada(key: string, fechaMuestra: Date) {
    let e = porKey.get(key)
    if (!e) {
      e = { fechaMuestra, bruto: 0, cantidad: 0, gastos: 0 }
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

// chip de selección para "Desde cuándo" (una sola activa a la vez)
function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-border text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  )
}

export function IngresosHistorial() {
  const { turnos, loading } = useIngresos()
  const { gastos, loading: gastosLoading } = useGastos()
  const [granularidad, setGranularidad] = useState<Granularidad>('meses')
  const [vista, setVista] = useState<'tabla' | 'linea' | 'barras'>('tabla')
  const [metrica, setMetrica] = useState<MetricaSeleccionable>('ingresos')
  const [rango, setRango] = useState<RangoTiempo>('6m')
  const [sort, setSort] = useState<Sort>({ column: 'periodo', direction: 'desc' })

  const loadingSerie = loading || gastosLoading

  // los gráficos van siempre de más viejo a más nuevo (izquierda a derecha)
  // — el orden de la tabla es independiente, lo maneja sort
  const serie = useMemo(() => calcularSerie(turnos, gastos, granularidad), [turnos, gastos, granularidad])

  // el rango recorta los gráficos (línea y barras, ver selector "Desde
  // cuándo" más abajo) — la tabla sigue mostrando todo el historial
  const serieFiltrada = useMemo(() => {
    const corte = claveDeCorte(rango, granularidad)
    return corte === null ? serie : serie.filter((f) => f.key >= corte)
  }, [serie, rango, granularidad])

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

  const esGrafico = vista === 'linea' || vista === 'barras'

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-2">
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
        {esGrafico && (
          <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
            Métrica
            <select value={metrica} onChange={(e) => setMetrica(e.target.value as MetricaSeleccionable)} className={selectClass}>
              {(Object.keys(SELECTOR_LABEL) as MetricaSeleccionable[]).map((key) => (
                <option key={key} value={key}>
                  {SELECTOR_LABEL[key]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {esGrafico && !loadingSerie && serie.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RANGO_LABEL) as RangoTiempo[]).map((key) => (
            <ChipButton key={key} active={rango === key} onClick={() => setRango(key)}>
              {RANGO_LABEL[key]}
            </ChipButton>
          ))}
        </div>
      )}

      {loadingSerie ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : serie.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          Todavía no hay turnos facturados.
        </p>
      ) : vista === 'tabla' ? (
        <TablaHistorial filas={filasTabla} sort={sort} onSort={handleSort} granularidad={granularidad} />
      ) : vista === 'linea' ? (
        <GraficoLinea data={serieFiltrada} metrica={metrica} />
      ) : (
        <GraficoBarras data={serieFiltrada} metrica={metrica} />
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

// "Ingresos" es la única opción que enciende 2 series a la vez (Bruto +
// Neto) — necesita su propia leyenda para que se entienda qué color es
// cada una; el resto de las métricas son una sola línea, la leyenda no
// aporta nada ahí (el eje/tooltip ya identifican el valor sin ambigüedad)
function LeyendaBrutoNeto() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-600)' }} />
        Bruto
      </span>
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-300)' }} />
        Neto
      </span>
    </div>
  )
}

function LineaTooltip({ active, payload, metrica }: { active?: boolean; payload?: { payload: Fila }[]; metrica: MetricaSeleccionable }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.periodoLargo}</p>
      {metrica === 'ingresos' ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-primary-600)' }} />
            {METRICA_LABEL.bruto}: {formatCurrency(row.bruto)}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-primary-300)' }} />
            {METRICA_LABEL.neto}: {formatCurrency(row.neto)}
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-ink">{metrica === 'cantidad' ? row.cantidad : formatCurrency(row.ticket)}</p>
      )}
    </div>
  )
}

function GraficoLinea({ data, metrica }: { data: Fila[]; metrica: MetricaSeleccionable }) {
  const esIngresos = metrica === 'ingresos'
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3">
      {esIngresos && <LeyendaBrutoNeto />}
      <div className="h-64 w-full sm:h-80">
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
            {esIngresos ? (
              <>
                <Line
                  type="monotone"
                  dataKey="bruto"
                  name={METRICA_LABEL.bruto}
                  stroke="var(--color-primary-600)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-primary-600)' }}
                />
                <Line
                  type="monotone"
                  dataKey="neto"
                  name={METRICA_LABEL.neto}
                  stroke="var(--color-primary-300)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-primary-300)' }}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey={metrica}
                name={SELECTOR_LABEL[metrica]}
                stroke="var(--color-primary-600)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-primary-600)' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BarrasTooltip({ active, payload, metrica }: { active?: boolean; payload?: { payload: Fila }[]; metrica: MetricaSeleccionable }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.periodoLargo}</p>
      {metrica === 'ingresos' ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-primary-600)' }} />
            {METRICA_LABEL.bruto}: {formatCurrency(row.bruto)}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-primary-300)' }} />
            {METRICA_LABEL.neto}: {formatCurrency(row.neto)}
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-ink">{metrica === 'cantidad' ? row.cantidad : formatCurrency(row.ticket)}</p>
      )}
    </div>
  )
}

// mismas métricas que el gráfico de línea (ver GraficoLinea) — "Ingresos"
// dibuja Bruto y Neto lado a lado (no apilados: neto = bruto − gastos, no
// son partes de un todo, apilarlos sumaría un número sin sentido), el
// resto de las métricas es una sola barra
function GraficoBarras({ data, metrica }: { data: Fila[]; metrica: MetricaSeleccionable }) {
  const esIngresos = metrica === 'ingresos'
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3">
      {esIngresos && <LeyendaBrutoNeto />}
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
              tickFormatter={(v: number) => (metrica === 'cantidad' ? String(v) : formatCurrencyCompact(v))}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<BarrasTooltip metrica={metrica} />} />
            {esIngresos ? (
              <>
                <Bar dataKey="bruto" name={METRICA_LABEL.bruto} fill="var(--color-primary-600)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="neto" name={METRICA_LABEL.neto} fill="var(--color-primary-300)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </>
            ) : (
              <Bar dataKey={metrica} name={SELECTOR_LABEL[metrica]} fill="var(--color-primary-600)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
