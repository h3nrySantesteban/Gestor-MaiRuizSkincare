import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { SplitStatCard } from '../components/StatCard/SplitStatCard'
import { MonthlyChart } from '../components/MonthlyChart/MonthlyChart'
import { ArrowUpRightIcon, NoteIcon } from '../components/icons'
import { formatCurrency, formatFechaHora } from '../lib/format'

export function Dashboard() {
  const { proximosTurnos, semana, mes, agendadosSemana, agendadosMes, serieSeisMeses, loading } = useDashboardStats()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-muted">Próximos Turnos</p>
            <button
              type="button"
              onClick={() => navigate('/turnos')}
              aria-label="Ver todos los turnos"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <ArrowUpRightIcon className="h-4 w-4" />
            </button>
          </div>
          {loading ? null : proximosTurnos.length > 0 ? (
            // auto-fill: cada columna pide un mínimo de 150px, así entran
            // tantas como quepan sin achicarse (2 en un teléfono angosto, 3+
            // a medida que crece el ancho) en vez de un breakpoint fijo.
            // gap en vez de separadores por borde (divide-x): con más
            // turnos de los que entran en una fila, el que envuelve a la
            // fila 2 sigue siendo "no el primer hijo" en el DOM aunque caiga
            // en la primera columna visual — divide-x le pone un borde
            // igual, sin importar en qué columna cayó (le puso un separador
            // a la izquierda de un turno que no tenía nada a su izquierda).
            // grid-rows-[auto] fija la fila 1 al contenido real y
            // auto-rows-[0px] fuerza cualquier fila implícita (la 2, 3...) a
            // 0px, así el overflow-hidden no tiene nada que recortar mal.
            <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] grid-rows-[auto] auto-rows-[0px] gap-x-4 overflow-hidden">
              {proximosTurnos.map((turno) => {
                const tieneNotas = Boolean(turno.notas) || Boolean(turno.paciente?.notas)
                return (
                  <div
                    key={turno.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/pacientes/${turno.pacienteId}`, { state: { from: '/dashboard' } })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/pacientes/${turno.pacienteId}`, { state: { from: '/dashboard' } })
                      }
                    }}
                    className="relative min-w-0 cursor-pointer"
                  >
                    {tieneNotas && (
                      <span
                        role="img"
                        aria-label="Tiene notas"
                        className="absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-muted text-ink-muted"
                      >
                        <NoteIcon className="h-3 w-3 shrink-0" />
                      </span>
                    )}
                    <p className="truncate pr-6 text-sm font-semibold text-ink">
                      {turno.paciente?.nombreCompleto ?? 'Paciente'}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-muted">{formatFechaHora(turno.fecha)}</p>
                  </div>
                )
              })}
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
