import { useDashboardStats } from '../hooks/useDashboardStats'
import { SplitStatCard } from '../components/StatCard/SplitStatCard'
import { MonthlyChart } from '../components/MonthlyChart/MonthlyChart'
import { formatCurrency, formatFechaHora } from '../lib/format'

export function Dashboard() {
  const { proximosTurnos, semana, mes, agendadosSemana, agendadosMes, serieSeisMeses, loading } = useDashboardStats()

  return (
    <div className="flex flex-col gap-6">
      {/* en mobile el header ya muestra "Dashboard" — este bloque entero sería redundante */}
      <div className="hidden md:block">
        <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted">Resumen general del consultorio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-ink-muted">Próximos Turnos</p>
          {loading ? null : proximosTurnos.length > 0 ? (
            // auto-fill: cada tarjeta pide un mínimo de 150px, así entran
            // tantas como quepan sin achicarse (2 en un teléfono angosto, 3+
            // a medida que crece el ancho) en vez de un breakpoint fijo.
            // max-h + overflow-hidden recorta turnos de más a una sola fila
            // completa, nunca una tarjeta a la mitad.
            <div className="mt-2 grid max-h-[84px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-hidden">
              {proximosTurnos.map((turno) => (
                <div key={turno.id} className="min-w-0 rounded-xl border border-border bg-surface-muted p-3">
                  <p className="truncate text-sm font-semibold text-ink">
                    {turno.paciente?.nombreCompleto ?? 'Paciente'}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{formatFechaHora(turno.fecha)}</p>
                  {turno.tratamientos.length > 0 && (
                    <p className="truncate text-xs text-ink-muted">
                      {turno.tratamientos.map((t) => t.nombre).join(', ')}
                    </p>
                  )}
                </div>
              ))}
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
