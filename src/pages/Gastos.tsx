import { useMemo, useState } from 'react'
import { useGastos } from '../hooks/useGastos'
import { NuevoGastoForm } from '../components/NuevoGastoForm/NuevoGastoForm'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { primaryBtnClass } from '../components/forms/FormField'
import { formatCurrency, formatFechaSolo, formatMesAno, parseFechaSolo } from '../lib/format'
import type { Gasto, RecurrenciaUnidad } from '../types/gasto'

const UNIDAD_LABELS: Record<RecurrenciaUnidad, { singular: string; plural: string }> = {
  dia: { singular: 'día', plural: 'días' },
  semana: { singular: 'semana', plural: 'semanas' },
  mes: { singular: 'mes', plural: 'meses' },
}

function formatRecurrencia(numero: number, unidad: RecurrenciaUnidad): string {
  const { singular, plural } = UNIDAD_LABELS[unidad]
  return `cada ${numero} ${numero === 1 ? singular : plural}`
}

// Un gasto fijo solo tiene UNA fila con UNA fecha (la de cuando se cargó
// por primera vez) — la recurrencia no genera filas nuevas (ver
// useGastos.ts). Para saber si "aplica este mes" hay que proyectarla hacia
// adelante desde esa fecha en pasos de recurrenciaNumero/recurrenciaUnidad
// y ver si el mes buscado cae en alguno de esos pasos — comparar la fecha
// tal cual contra el mes actual (lo que hacía la versión anterior) solo
// daba el resultado correcto el mismísimo mes en que se cargó el gasto, y
// nunca más después.
function ocurreEnMes(gasto: Gasto, targetYear: number, targetMonth: number): boolean {
  if (!gasto.esFijo || !gasto.recurrenciaNumero || !gasto.recurrenciaUnidad) return false
  const inicio = parseFechaSolo(gasto.fecha)
  const primerDiaMes = new Date(targetYear, targetMonth - 1, 1)
  const primerDiaMesSiguiente = new Date(targetYear, targetMonth, 1)
  if (inicio >= primerDiaMesSiguiente) return false // todavía no arrancó

  if (gasto.recurrenciaUnidad === 'mes') {
    // los meses no tienen la misma cantidad de días — para esta unidad se
    // resuelve por aritmética de meses en vez de días, así "cada 1 mes"
    // arrancando el 31 no se salta meses más cortos
    const mesesDesdeInicio = (targetYear - inicio.getFullYear()) * 12 + (targetMonth - 1 - inicio.getMonth())
    return mesesDesdeInicio >= 0 && mesesDesdeInicio % gasto.recurrenciaNumero === 0
  }

  const msPorDia = 24 * 60 * 60 * 1000
  const pasoDias = gasto.recurrenciaUnidad === 'semana' ? gasto.recurrenciaNumero * 7 : gasto.recurrenciaNumero
  const diasHastaElMes = Math.round((primerDiaMes.getTime() - inicio.getTime()) / msPorDia)
  const kMin = diasHastaElMes <= 0 ? 0 : Math.ceil(diasHastaElMes / pasoDias)
  const proximaOcurrenciaMs = inicio.getTime() + kMin * pasoDias * msPorDia
  return proximaOcurrenciaMs < primerDiaMesSiguiente.getTime()
}

interface GrupoMes {
  key: string
  label: string
  gastos: Gasto[]
}

// gastos ya viene ordenado desc por fecha (useGastos) — agrupar en ese
// mismo recorrido preserva el orden de los meses (más reciente primero)
// sin necesitar un sort aparte.
function agruparPorMes(gastos: Gasto[]): GrupoMes[] {
  const grupos: GrupoMes[] = []
  const porKey = new Map<string, GrupoMes>()
  for (const g of gastos) {
    const key = g.fecha.slice(0, 7)
    let grupo = porKey.get(key)
    if (!grupo) {
      grupo = { key, label: formatMesAno(g.fecha), gastos: [] }
      porKey.set(key, grupo)
      grupos.push(grupo)
    }
    grupo.gastos.push(g)
  }
  return grupos
}

export function Gastos() {
  const { gastos, loading, refetch } = useGastos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Gasto | null>(null)

  function openNuevo() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(g: Gasto) {
    setEditing(g)
    setFormOpen(true)
  }

  const gastosFijosDelMes = useMemo(() => {
    const hoy = new Date()
    return gastos.filter((g) => ocurreEnMes(g, hoy.getFullYear(), hoy.getMonth() + 1))
  }, [gastos])

  const gruposPorMes = useMemo(() => agruparPorMes(gastos), [gastos])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Gastos</h1>
          {loading ? (
            <Skeleton className="mt-1.5 h-4 w-28" />
          ) : (
            <p className="text-sm text-ink-muted">{gastos.length} gastos cargados</p>
          )}
        </div>
        <button type="button" onClick={openNuevo} className={primaryBtnClass}>
          + Nuevo gasto
        </button>
      </div>

      {/* si todavía no hay ningún gasto cargado, esta sección quedaría
          duplicando el estado vacío de abajo — se oculta hasta que haya algo */}
      {gastos.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-muted">Gastos fijos de este mes</h2>
          <div className="flex flex-col gap-2">
            {gastosFijosDelMes.map((g) => (
              <GastoRow key={g.id} gasto={g} onClick={() => openEdit(g)} />
            ))}
            {gastosFijosDelMes.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
                No hay gastos fijos cargados este mes.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <GastoRowSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {!loading && gruposPorMes.map((grupo) => (
          <div key={grupo.key} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink-muted">{grupo.label}</h2>
            <div className="flex flex-col gap-2">
              {grupo.gastos.map((g) => (
                <GastoRow key={g.id} gasto={g} onClick={() => openEdit(g)} />
              ))}
            </div>
          </div>
        ))}

        {!loading && gastos.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Todavía no hay gastos cargados.
          </p>
        )}
      </div>

      <NuevoGastoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => refetch()}
        onDeleted={() => refetch()}
        gasto={editing}
      />
    </div>
  )
}

function GastoRow({ gasto: g, onClick }: { gasto: Gasto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-left sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{g.nombre}</p>
          <span className="text-xs text-ink-muted">{formatFechaSolo(g.fecha)}</span>
        </div>
        {g.descripcion && <p className="mt-0.5 truncate text-sm text-ink-muted">{g.descripcion}</p>}
      </div>
      {/* Fijo + valor van juntos, mismo renglón, alineados a la derecha */}
      <div className="flex shrink-0 items-center justify-end gap-2">
        {g.esFijo && g.recurrenciaNumero && g.recurrenciaUnidad && (
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            Fijo · {formatRecurrencia(g.recurrenciaNumero, g.recurrenciaUnidad)}
          </span>
        )}
        <p className="font-semibold text-ink">{formatCurrency(g.valor)}</p>
      </div>
    </button>
  )
}

function GastoRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
