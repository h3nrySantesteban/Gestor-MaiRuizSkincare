import { useDashboardStats } from '../hooks/useDashboardStats'
import { SplitStatCard } from '../components/StatCard/SplitStatCard'
import { MonthlyChart } from '../components/MonthlyChart/MonthlyChart'
import { formatCurrency, formatFechaHora } from '../lib/format'

export function Dashboard() {
  const { proximoTurno, semana, mes, agendadosSemana, agendadosMes, serieSeisMeses, loading } = useDashboardStats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
        {/* en mobile el header ya muestra "Dashboard" — esto sería redundante */}
        <p className="hidden text-sm text-ink-muted md:block">Resumen general del consultorio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

        <SplitStatCard
          left={{
            label: 'Esta semana',
            value: `${semana.cantidad} turno${semana.cantidad === 1 ? '' : 's'}`,
            secondary: formatCurrency(semana.ingresos),
          }}
          right={{
            label: 'Agendados',
            value: `${agendadosSemana.cantidad} turno${agendadosSemana.cantidad === 1 ? '' : 's'}`,
            secondary: `~${formatCurrency(agendadosSemana.ingresoAprox)}`,
          }}
        />
        <SplitStatCard
          left={{
            label: 'Este mes',
            value: `${mes.cantidad} turno${mes.cantidad === 1 ? '' : 's'}`,
            secondary: formatCurrency(mes.ingresos),
          }}
          right={{
            label: 'Agendados',
            value: `${agendadosMes.cantidad} turno${agendadosMes.cantidad === 1 ? '' : 's'}`,
            secondary: `~${formatCurrency(agendadosMes.ingresoAprox)}`,
          }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <MonthlyChart data={serieSeisMeses} />
      </div>
    </div>
  )
}
