import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useIngresos } from '../hooks/useIngresos'
import { NuevoTurnoForm } from '../components/NuevoTurnoForm/NuevoTurnoForm'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ArrowRightIcon } from '../components/icons'
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

function totalDelMes(turnos: Turno[], year: number, month: number): number {
  return turnos.reduce((sum, t) => {
    const f = new Date(t.fecha)
    return f.getFullYear() === year && f.getMonth() + 1 === month ? sum + t.precio : sum
  }, 0)
}

function cantDelMes(turnos: Turno[], year: number, month: number): number {
  return turnos.reduce((n, t) => {
    const f = new Date(t.fecha)
    return f.getFullYear() === year && f.getMonth() + 1 === month ? n + 1 : n
  }, 0)
}

// month es 1-based; n meses hacia atrás (n=1 → el mes anterior)
function restarMeses(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - n, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function Ingresos() {
  const { turnos, loading, refetch } = useIngresos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Turno | null>(null)

  function openEdit(t: Turno) {
    setEditing(t)
    setFormOpen(true)
  }

  const gruposPorMes = useMemo(() => agruparPorMes(turnos), [turnos])

  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  const totalEsteMes = useMemo(() => totalDelMes(turnos, anioActual, mesActual), [turnos, anioActual, mesActual])
  const totalMesPasado = useMemo(() => {
    const { year, month } = restarMeses(anioActual, mesActual, 1)
    return totalDelMes(turnos, year, month)
  }, [turnos, anioActual, mesActual])
  const diferencia = totalEsteMes - totalMesPasado
  const diferenciaPct = totalMesPasado > 0 ? (diferencia / totalMesPasado) * 100 : null

  // promedio de los últimos 6 meses CERRADOS (sin el actual, que todavía
  // está incompleto y tiraría el promedio para abajo)
  const promedio6Meses = useMemo(() => {
    let suma = 0
    for (let i = 1; i <= 6; i++) {
      const { year, month } = restarMeses(anioActual, mesActual, i)
      suma += totalDelMes(turnos, year, month)
    }
    return suma / 6
  }, [turnos, anioActual, mesActual])

  // ticket promedio de esos mismos 6 meses: total facturado / cantidad de
  // turnos facturados (no es promedio6Meses/6, que sería promedio mensual)
  const ticketPromedio = useMemo(() => {
    let suma = 0
    let cant = 0
    for (let i = 1; i <= 6; i++) {
      const { year, month } = restarMeses(anioActual, mesActual, i)
      suma += totalDelMes(turnos, year, month)
      cant += cantDelMes(turnos, year, month)
    }
    return cant > 0 ? suma / cant : 0
  }, [turnos, anioActual, mesActual])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Ingresos</h1>
        {loading ? (
          <Skeleton className="mt-1.5 h-4 w-28" />
        ) : (
          <p className="text-sm text-ink-muted">{turnos.length} turnos facturados</p>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/ingresos/historial"
            className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300"
          >
            <div className="flex items-center justify-between gap-1">
              <p className="whitespace-nowrap text-xs font-medium text-ink-muted">Total este mes</p>
              <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            </div>
            <p className="mt-1 text-xl font-semibold text-ink">{formatCurrency(totalEsteMes)}</p>
            <p
              className={`mt-1 whitespace-nowrap text-xs font-medium ${
                diferenciaPct === null
                  ? 'text-ink-muted'
                  : diferencia > 0
                    ? 'text-success'
                    : diferencia < 0
                      ? 'text-danger'
                      : 'text-ink-muted'
              }`}
            >
              {diferenciaPct === null
                ? 'Sin datos del mes ant.'
                : `${diferencia >= 0 ? '+' : ''}${diferenciaPct.toFixed(0)}% que el ult. mes`}
            </p>
          </Link>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="whitespace-nowrap text-xs font-medium text-ink-muted">Promedio (6 meses)</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatCurrency(promedio6Meses)}</p>
            <p className="mt-1 whitespace-nowrap text-xs font-medium text-ink-muted">
              Ticket prom.: {formatCurrency(ticketPromedio)}
            </p>
          </div>
        </div>
      )}

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
