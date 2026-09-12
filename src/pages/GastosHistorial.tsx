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
type RangoTiempo = '6m' | '1a' | '2a' | 'todo'

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

// "cantidad" es un conteo, no un monto — no puede compartir eje con las
// demás (moneda) sin inventar una correlación falsa (ver CLAUDE.md: los
// gráficos de esta app son de un solo eje a propósito). toggleMetrica de
// abajo usa esto para que elegir una métrica de un grupo reemplace la
// selección en vez de sumarse a una del otro grupo.
const METRICA_GRUPO: Record<Metrica, 'moneda' | 'cantidad'> = {
  total: 'moneda',
  totalHabituales: 'moneda',
  totalSinHabituales: 'moneda',
  cantidad: 'cantidad',
}

// paleta categórica fija por métrica (no por posición/orden de selección) —
// así sacar o poner una métrica no repinta el color de las que ya estaban
// (ver --color-chart-1/2/3 en index.css, validada con el script del skill
// de dataviz contra las superficies clara/oscura de esta app)
const METRICA_COLOR: Record<Metrica, string> = {
  total: 'var(--color-chart-1)',
  totalHabituales: 'var(--color-chart-2)',
  totalSinHabituales: 'var(--color-chart-3)',
  cantidad: 'var(--color-chart-1)',
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

// chip de selección — se usa tanto para "Desde cuándo" (una sola activa a
// la vez) como para "Métrica" (varias activas a la vez, ver toggleMetrica)
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

export function GastosHistorial() {
  const { gastos, loading } = useGastos()
  const [granularidad, setGranularidad] = useState<Granularidad>('meses')
  const [vista, setVista] = useState<'tabla' | 'linea' | 'barras'>('tabla')
  const [metricas, setMetricas] = useState<Metrica[]>(['total'])
  const [rango, setRango] = useState<RangoTiempo>('1a')
  const [sort, setSort] = useState<Sort>({ column: 'periodo', direction: 'desc' })

  // no se puede deseleccionar la última métrica (el gráfico necesita al
  // menos una) y cambiar de grupo (moneda <-> cantidad) reemplaza la
  // selección entera en vez de sumarse — no comparten eje (ver METRICA_GRUPO)
  function toggleMetrica(m: Metrica) {
    setMetricas((prev) => {
      if (prev.includes(m)) {
        if (prev.length === 1) return prev
        return prev.filter((x) => x !== m)
      }
      if (METRICA_GRUPO[m] !== METRICA_GRUPO[prev[0]]) return [m]
      return [...prev, m]
    })
  }

  // los gráficos van siempre de más viejo a más nuevo (izquierda a derecha)
  // — el orden de la tabla es independiente, lo maneja sort
  const serie = useMemo(() => calcularSerie(gastos, granularidad), [gastos, granularidad])

  // el rango solo recorta los gráficos (línea y barras, ver selector "Desde
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
        {esGrafico && (
          <div className="flex flex-col gap-1.5 text-sm text-ink-muted">
            Métrica (podés elegir varias, del mismo tipo)
            <div className="flex flex-wrap gap-2">
              {(Object.keys(METRICA_LABEL) as Metrica[]).map((key) => (
                <ChipButton key={key} active={metricas.includes(key)} onClick={() => toggleMetrica(key)}>
                  {METRICA_LABEL[key]}
                </ChipButton>
              ))}
            </div>
          </div>
        )}
      </div>

      {esGrafico && !loading && serie.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RANGO_LABEL) as RangoTiempo[]).map((key) => (
            <ChipButton key={key} active={rango === key} onClick={() => setRango(key)}>
              {RANGO_LABEL[key]}
            </ChipButton>
          ))}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : serie.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          Todavía no hay gastos cargados.
        </p>
      ) : vista === 'tabla' ? (
        <TablaHistorial filas={filasTabla} sort={sort} onSort={handleSort} granularidad={granularidad} />
      ) : vista === 'linea' ? (
        <GraficoLinea data={serieFiltrada} metricas={metricas} />
      ) : (
        <GraficoBarras data={serieFiltrada} metricas={metricas} />
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

// leyenda compartida por línea y barras — mismo layout, solo cambia la
// forma del swatch (redondo en línea, cuadrado en barras) vía el className
// que le pasa cada gráfico
function LeyendaMetricas({ metricas, swatchClassName }: { metricas: Metrica[]; swatchClassName: string }) {
  if (metricas.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {metricas.map((m) => (
        <span key={m} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className={swatchClassName} style={{ backgroundColor: METRICA_COLOR[m] }} />
          {METRICA_LABEL[m]}
        </span>
      ))}
    </div>
  )
}

function valorFormateado(metrica: Metrica, valor: number): string {
  return metrica === 'cantidad' ? String(valor) : formatCurrency(valor)
}

function GraficoTooltip({ active, payload, metricas }: { active?: boolean; payload?: { payload: Fila }[]; metricas: Metrica[] }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs font-medium capitalize text-ink">{row.periodoLargo}</p>
      {metricas.map((m) => (
        <p key={m} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: METRICA_COLOR[m] }} />
          {valorFormateado(m, row[m])}
        </p>
      ))}
    </div>
  )
}

// eje único a propósito (ver CLAUDE.md) — si la selección mezclara "moneda"
// y "cantidad" el eje quedaría inventando una escala falsa entre las dos,
// por eso toggleMetrica no deja combinar ambos grupos
function ejeSoloCantidad(metricas: Metrica[]): boolean {
  return metricas.every((m) => METRICA_GRUPO[m] === 'cantidad')
}

function GraficoLinea({ data, metricas }: { data: Fila[]; metricas: Metrica[] }) {
  const soloCantidad = ejeSoloCantidad(metricas)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <LeyendaMetricas metricas={metricas} swatchClassName="h-2.5 w-2.5 rounded-full" />
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
              tickFormatter={(v: number) => (soloCantidad ? String(v) : formatCurrencyCompact(v))}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip cursor={{ stroke: 'var(--color-border)' }} content={<GraficoTooltip metricas={metricas} />} />
            {metricas.map((m) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                name={METRICA_LABEL[m]}
                stroke={METRICA_COLOR[m]}
                strokeWidth={2}
                dot={{ r: 3, fill: METRICA_COLOR[m] }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// barras agrupadas (sin stackId), no apiladas: al permitir cualquier
// combinación de métricas ya no hay una composición parte-todo garantizada
// (ej. elegir "Total" + "Habituales" a la vez se superpondría si se
// apilaran) — agrupado es lo único que sigue siendo correcto para una
// selección arbitraria
function GraficoBarras({ data, metricas }: { data: Fila[]; metricas: Metrica[] }) {
  const soloCantidad = ejeSoloCantidad(metricas)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <LeyendaMetricas metricas={metricas} swatchClassName="h-2.5 w-2.5 rounded-sm" />
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
              tickFormatter={(v: number) => (soloCantidad ? String(v) : formatCurrencyCompact(v))}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} content={<GraficoTooltip metricas={metricas} />} />
            {metricas.map((m) => (
              <Bar key={m} dataKey={m} name={METRICA_LABEL[m]} fill={METRICA_COLOR[m]} radius={[4, 4, 0, 0]} maxBarSize={32} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
