import { useDashboardStats } from '../hooks/useDashboardStats'
import { SplitStatCard } from '../components/StatCard/SplitStatCard'
import { MonthlyChart } from '../components/MonthlyChart/MonthlyChart'
import { formatCurrency, formatFechaHora } from '../lib/format'

export function Dashboard() {
  const { proximosTurnos, semana, mes, agendadosSemana, agendadosMes, serieSeisMeses, loading } = useDashboardStats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
        <p className="hidden text-sm text-ink-muted md:block">Resumen general del consultorio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium text-ink-muted">Próximos Turnos</p>
          {loading ? null : proximosTurnos.length > 0 ? (
            // auto-fill: cada columna pide un mínimo de 150px, así entran
            // tantas como quepan sin achicarse (2 en un teléfono angosto, 3+
            // a medida que crece el ancho) en vez de un breakpoint fijo.
            // divide-x en vez de tarjetas individuales: mismo estilo que
            // SplitStatCard. Turnos de más envuelven a una fila 2 igual que
            // cualquier grid — en vez de adivinar su altura en px con
            // max-h (frágil: alcanzaba a filtrarse un pixelado de esa fila),
            // grid-rows-[auto] fija la fila 1 al contenido real y
            // auto-rows-[0px] fuerza cualquier fila implícita (la 2, 3...) a
            // 0px, así el overflow-hidden no tiene nada que recortar mal.
            <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] grid-rows-[auto] auto-rows-[0px] divide-x divide-border overflow-hidden">
              {proximosTurnos.map((turno) => (
                <div key={turno.id} className="min-w-0 px-4 first:pl-0 last:pr-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {turno.paciente?.nombreCompleto ?? 'Paciente'}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">{formatFechaHora(turno.fecha)}</p>
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
