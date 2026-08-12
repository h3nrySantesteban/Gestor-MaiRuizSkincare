import { useDashboardStats } from '../hooks/useDashboardStats'
import { StatCard } from '../components/StatCard/StatCard'
import { MonthlyChart } from '../components/MonthlyChart/MonthlyChart'
import { formatCurrency, formatFechaHora } from '../lib/format'

export function Dashboard() {
  const { proximoTurno, semana, mes, serieSeisMeses, loading } = useDashboardStats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted">Resumen general del consultorio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-ink-muted">Próximo turno</p>
          {loading ? null : proximoTurno ? (
            <div className="mt-1">
              <p className="text-lg font-semibold text-ink">{proximoTurno.paciente?.nombreCompleto ?? 'Paciente'}</p>
              <p className="text-sm text-ink-muted">{formatFechaHora(proximoTurno.fecha)}</p>
              {proximoTurno.tratamientos.length > 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  {proximoTurno.tratamientos.map((t) => t.nombre).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">No hay turnos agendados.</p>
          )}
        </div>

        <StatCard
          label="Esta semana"
          value={`${semana.cantidad} turno${semana.cantidad === 1 ? '' : 's'}`}
          secondary={formatCurrency(semana.ingresos)}
        />
        <StatCard
          label="Este mes"
          value={`${mes.cantidad} turno${mes.cantidad === 1 ? '' : 's'}`}
          secondary={formatCurrency(mes.ingresos)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <MonthlyChart data={serieSeisMeses} />
      </div>
    </div>
  )
}
