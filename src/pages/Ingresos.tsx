import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useIngresos } from '../hooks/useIngresos'
import { useGastos } from '../hooks/useGastos'
import { NuevoTurnoForm } from '../components/NuevoTurnoForm/NuevoTurnoForm'
import { IngresosCarousel } from '../components/IngresosCarousel/IngresosCarousel'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { BarChartIcon } from '../components/icons'
import { formatCurrency, formatFecha } from '../lib/format'
import type { Turno } from '../types/turno'

// un turno Cancelado+señado aporta solo el monto de la seña — se marca en la
// fila para que un importe más chico de lo esperado se entienda
function esSena(t: Turno): boolean {
  return t.estado === 'Cancelado' && t.senado
}

// "Septiembre 2026" a partir del timestamp con zona de turnos.fecha (a
// diferencia de gastos.fecha, que es date-only) — new Date() lo pasa a hora
// local, que para Mai es Argentina
function formatMes(iso: string): string {
  const label = format(new Date(iso), 'MMMM yyyy', { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface GrupoMes {
  key: string
  label: string
  turnos: Turno[]
  total: number
}

// turnos ya viene ordenado desc por fecha (useIngresos) — agrupar en ese
// mismo recorrido preserva el orden de los meses (más reciente primero)
function agruparPorMes(turnos: Turno[]): GrupoMes[] {
  const grupos: GrupoMes[] = []
  const porKey = new Map<string, GrupoMes>()
  for (const t of turnos) {
    const key = format(new Date(t.fecha), 'yyyy-MM')
    let grupo = porKey.get(key)
    if (!grupo) {
      grupo = { key, label: formatMes(t.fecha), turnos: [], total: 0 }
      porKey.set(key, grupo)
      grupos.push(grupo)
    }
    grupo.turnos.push(t)
    grupo.total += t.precio
  }
  return grupos
}

export function Ingresos() {
  const { turnos, loading, refetch } = useIngresos()
  const { gastos, loading: gastosLoading } = useGastos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Turno | null>(null)

  function openEdit(t: Turno) {
    setEditing(t)
    setFormOpen(true)
  }

  const gruposPorMes = useMemo(() => agruparPorMes(turnos), [turnos])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">Ingresos</h1>
          {loading ? (
            <Skeleton className="mt-1.5 h-4 w-28" />
          ) : (
            <p className="text-sm text-ink-muted">{turnos.length} turnos facturados</p>
          )}
        </div>
        <Link
          to="/ingresos/historial"
          aria-label="Ver gráficos"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted"
        >
          <BarChartIcon className="h-5 w-5" />
        </Link>
      </div>

      <IngresosCarousel turnos={turnos} gastos={gastos} loading={loading || gastosLoading} />

      <div className="flex flex-col gap-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <IngresoRowSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {!loading &&
          gruposPorMes.map((grupo) => (
            <div key={grupo.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink-muted">{grupo.label}</h2>
                <span className="text-sm font-medium text-ink-muted">Total {formatCurrency(grupo.total)}</span>
              </div>
              <div className="flex flex-col gap-2">
                {grupo.turnos.map((t) => (
                  <IngresoRow key={t.id} turno={t} onClick={() => openEdit(t)} />
                ))}
              </div>
            </div>
          ))}

        {!loading && turnos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Todavía no hay turnos facturados.
          </p>
        )}
      </div>

      <NuevoTurnoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => refetch()}
        turno={editing}
      />
    </div>
  )
}

function IngresoRow({ turno: t, onClick }: { turno: Turno; onClick: () => void }) {
  const tratamientos = t.tratamientos.map((x) => x.nombre).join(', ')
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary-300"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{t.paciente?.nombreCompleto ?? 'Paciente'}</p>
          <span className="text-xs text-ink-muted">{formatFecha(t.fecha)}</span>
        </div>
        {esSena(t) && (
          <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
            Seña
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-ink-muted">{tratamientos || '—'}</p>
        <p className="shrink-0 font-semibold text-ink">{formatCurrency(t.precio)}</p>
      </div>
    </button>
  )
}

function IngresoRowSkeleton() {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
