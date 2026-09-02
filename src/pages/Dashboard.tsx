import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { SplitStatCard } from '../components/StatCard/SplitStatCard'
import { MonthlyChart } from '../components/MonthlyChart/MonthlyChart'
import { Modal } from '../components/Modal/Modal'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ArrowUpRightIcon, NoteIcon } from '../components/icons'
import { formatCurrency, formatFechaHora } from '../lib/format'

// mismo shape que SplitStatCard (StatCard/SplitStatCard.tsx): dos mitades
// con label + valor grande + secundario, separadas por un borde
function SplitStatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="grid grid-cols-2 divide-x divide-border">
        {[0, 1].map((i) => (
          <div key={i} className={`flex flex-col gap-2 ${i === 0 ? 'pr-4' : 'pl-4'}`}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
          {/* mismo grid que el real, truco de recorte incluido:
              grid-rows-[auto] + auto-rows-[0px] + overflow-hidden fuerza
              cualquier fila implícita a 0px, así en un teléfono angosto
              (donde solo entra 1 columna) se ve un solo ítem, no los 3
              apilados — igual que el contenido real */}
          <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] grid-rows-[auto] auto-rows-[0px] gap-x-4 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </div>
        <SplitStatCardSkeleton />
        <SplitStatCardSkeleton />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between sm:mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-44 w-full sm:h-72" />
      </div>
    </div>
  )
}

export function Dashboard() {
  const { proximosTurnos, semana, mes, agendadosSemana, agendadosMes, serieSeisMeses, loading } = useDashboardStats()
  const navigate = useNavigate()
  const [infoAgendadosOpen, setInfoAgendadosOpen] = useState(false)

  if (loading) return <DashboardSkeleton />

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
          {proximosTurnos.length > 0 ? (
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
            onInfoClick: () => setInfoAgendadosOpen(true),
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
            onInfoClick: () => setInfoAgendadosOpen(true),
          }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <MonthlyChart data={serieSeisMeses} />
      </div>

      <Modal
        open={infoAgendadosOpen}
        onClose={() => setInfoAgendadosOpen(false)}
        title='¿Cómo se calcula "Agendados"?'
        widthClassName="max-w-sm"
      >
        <div className="flex flex-col gap-3 text-sm text-ink-muted">
          <p>
            <span className="font-medium text-ink">Cantidad:</span> turnos con estado Agendado que todavía quedan
            entre hoy y el final de la semana o el mes en curso.
          </p>
          <p>
            <span className="font-medium text-ink">Ingreso aproximado:</span> como un turno Agendado todavía puede
            cancelarse o cambiar antes de concretarse, no se usa su precio cargado — se estima con el precio
            promedio de los últimos 10 turnos ya Finalizados (el precio real cobrado, sea de uno o varios
            tratamientos combinados), multiplicado por la cantidad de Agendados. Por eso aparece con el signo{' '}
            <span className="font-medium text-ink">~</span>: es una proyección, no un monto exacto.
          </p>
        </div>
      </Modal>
    </div>
  )
}
