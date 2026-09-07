import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGastos } from '../hooks/useGastos'
import { NuevoGastoForm } from '../components/NuevoGastoForm/NuevoGastoForm'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { MarqueeText } from '../components/MarqueeText/MarqueeText'
import { primaryBtnClass } from '../components/forms/FormField'
import { BarChartIcon, InfoIcon } from '../components/icons'
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

// Un gasto habitual no tiene una fila por mes — cada pago real que Mai
// carga es una fila propia con su propia fecha (ver useGastos.ts), y todas
// las de una misma serie comparten el mismo nombre (no hay un id que las
// conecte, es la única forma de agruparlas sin cambiar la base). Para saber
// si "corresponde este mes" hay que proyectar la cadencia hacia adelante
// desde la fecha de la fila-ancla en pasos de
// recurrenciaNumero/recurrenciaUnidad y ver si el mes buscado cae en alguno
// de esos pasos.
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
  total: number
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
      grupo = { key, label: formatMesAno(g.fecha), gastos: [], total: 0 }
      porKey.set(key, grupo)
      grupos.push(grupo)
    }
    grupo.gastos.push(g)
    grupo.total += g.valor
  }
  return grupos
}

function totalDelMes(gastos: Gasto[], year: number, month: number, opts?: { excluirHabituales?: boolean }): number {
  return gastos.reduce((sum, g) => {
    if (opts?.excluirHabituales && g.esFijo) return sum
    const f = parseFechaSolo(g.fecha)
    return f.getFullYear() === year && f.getMonth() + 1 === month ? sum + g.valor : sum
  }, 0)
}

// month es 1-based; n meses hacia atrás (n=1 → el mes anterior)
function restarMeses(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month - 1 - n, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function Gastos() {
  const { gastos, loading, refetch, setHabitualActivo } = useGastos()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Gasto | null>(null)
  // gasto-ancla de la serie que se está "completando" (ver openCompletar) —
  // solo importa para precargar nombre/recurrencia en el form de creación,
  // nunca se edita esa fila directamente
  const [plantillaHabitual, setPlantillaHabitual] = useState<Gasto | null>(null)

  function openNuevo() {
    setEditing(null)
    setPlantillaHabitual(null)
    setFormOpen(true)
  }

  function openEdit(g: Gasto) {
    setEditing(g)
    setPlantillaHabitual(null)
    setFormOpen(true)
  }

  // completar un habitual pendiente = crear un gasto NUEVO para este mes
  // (nombre/recurrencia precargados desde la fila-ancla), nunca editar la
  // fila vieja — esa sigue intacta como historial del mes en que se cargó
  function openCompletarHabitual(ancla: Gasto) {
    setEditing(null)
    setPlantillaHabitual(ancla)
    setFormOpen(true)
  }

  // serie = mismo nombre exacto (no hay un id que conecte los pagos
  // mensuales entre sí — ver comentario de ocurreEnMes). Se toma como
  // "ancla" la fila más vieja marcada habitual de cada nombre, así la
  // cadencia no se corre aunque después se carguen más pagos con ese nombre.
  const anclasHabituales = useMemo(() => {
    const porNombre = new Map<string, Gasto>()
    for (const g of gastos) {
      if (!g.esFijo) continue
      const actual = porNombre.get(g.nombre)
      if (!actual || parseFechaSolo(g.fecha) < parseFechaSolo(actual.fecha)) {
        porNombre.set(g.nombre, g)
      }
    }
    return [...porNombre.values()]
  }, [gastos])

  // habitualActivo viene repetido en todas las filas de la serie (ver
  // setHabitualActivo en useGastos.ts), así que da lo mismo leerlo de la
  // fila-ancla — separa las series que Mai sigue pagando de las que
  // desactivó (dejaron de pedir "completar" cada mes, pero sus filas viejas
  // siguen contando en las estadísticas igual que antes).
  const anclasHabitualesActivas = useMemo(() => anclasHabituales.filter((g) => g.habitualActivo), [anclasHabituales])
  const anclasHabitualesInactivas = useMemo(
    () => anclasHabituales.filter((g) => !g.habitualActivo),
    [anclasHabituales],
  )

  // nombres que ya tienen algún gasto cargado este mes (fijo o no — lo que
  // importa es que Mai ya registró el pago, no que lo haya vuelto a marcar
  // habitual)
  const nombresPagadosEsteMes = useMemo(() => {
    const hoy = new Date()
    const set = new Set<string>()
    for (const g of gastos) {
      const fecha = parseFechaSolo(g.fecha)
      if (fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth()) set.add(g.nombre)
    }
    return set
  }, [gastos])

  const habitualesPendientes = useMemo(() => {
    const hoy = new Date()
    return anclasHabitualesActivas.filter(
      (g) => ocurreEnMes(g, hoy.getFullYear(), hoy.getMonth() + 1) && !nombresPagadosEsteMes.has(g.nombre),
    )
  }, [anclasHabitualesActivas, nombresPagadosEsteMes])

  async function handleDesactivar(nombre: string) {
    await setHabitualActivo(nombre, false)
  }

  async function handleReactivar(nombre: string) {
    await setHabitualActivo(nombre, true)
  }

  const gruposPorMes = useMemo(() => agruparPorMes(gastos), [gastos])

  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const mesActual = hoy.getMonth() + 1

  const totalEsteMes = useMemo(() => totalDelMes(gastos, anioActual, mesActual), [gastos, anioActual, mesActual])
  const totalMesPasado = useMemo(() => {
    const { year, month } = restarMeses(anioActual, mesActual, 1)
    return totalDelMes(gastos, year, month)
  }, [gastos, anioActual, mesActual])
  const diferencia = totalEsteMes - totalMesPasado
  const diferenciaPct = totalMesPasado > 0 ? (diferencia / totalMesPasado) * 100 : null

  // promedio de los últimos 6 meses CERRADOS (sin contar el actual, que
  // todavía está incompleto y arrastraría el promedio para abajo)
  const promedio6Meses = useMemo(() => {
    let suma = 0
    for (let i = 1; i <= 6; i++) {
      const { year, month } = restarMeses(anioActual, mesActual, i)
      suma += totalDelMes(gastos, year, month)
    }
    return suma / 6
  }, [gastos, anioActual, mesActual])

  // mismo promedio pero sin los gastos habituales — para ver cuánto de ese
  // promedio es gasto "suelto"/variable, sin lo recurrente (alquiler, etc.)
  const promedio6MesesSinHabituales = useMemo(() => {
    let suma = 0
    for (let i = 1; i <= 6; i++) {
      const { year, month } = restarMeses(anioActual, mesActual, i)
      suma += totalDelMes(gastos, year, month, { excluirHabituales: true })
    }
    return suma / 6
  }, [gastos, anioActual, mesActual])

  // gastos habituales cargados el mes pasado cuya cadencia (ver ocurreEnMes)
  // también corresponde a este mes — una proyección, no lo que ya se pagó.
  // Excluye series desactivadas: ya no se espera que se vuelvan a pagar.
  const gastoAproximado = useMemo(() => {
    const { year: prevYear, month: prevMonth } = restarMeses(anioActual, mesActual, 1)
    return gastos
      .filter((g) => g.esFijo && g.habitualActivo)
      .filter((g) => {
        const f = parseFechaSolo(g.fecha)
        return f.getFullYear() === prevYear && f.getMonth() + 1 === prevMonth
      })
      .filter((g) => ocurreEnMes(g, anioActual, mesActual))
      .reduce((sum, g) => sum + g.valor, 0)
  }, [gastos, anioActual, mesActual])

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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/gastos/historial"
            aria-label="Ver gráficos"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted"
          >
            <BarChartIcon className="h-5 w-5" />
          </Link>
          <button type="button" onClick={openNuevo} className={primaryBtnClass}>
            + Nuevo gasto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="whitespace-nowrap text-xs font-medium text-ink-muted">Total este mes</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatCurrency(totalEsteMes)}</p>
            <p
              className={`mt-1 whitespace-nowrap text-xs font-medium ${
                diferenciaPct === null ? 'text-ink-muted' : diferencia > 0 ? 'text-danger' : diferencia < 0 ? 'text-success' : 'text-ink-muted'
              }`}
            >
              {diferenciaPct === null
                ? 'Sin datos del mes ant.'
                : `${diferencia >= 0 ? '+' : ''}${diferenciaPct.toFixed(0)}% que el ult. mes`}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="whitespace-nowrap text-xs font-medium text-ink-muted">Promedio (6 meses)</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatCurrency(promedio6Meses)}</p>
            <p className="mt-1 whitespace-nowrap text-xs font-medium text-ink-muted">
              Sin hab.: {formatCurrency(promedio6MesesSinHabituales)}
            </p>
          </div>
        </div>
      )}

      {/* solo se muestra si hay alguna serie habitual registrada — sin
          eso, quedaría duplicando el estado vacío de abajo */}
      {anclasHabituales.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="whitespace-nowrap text-sm font-semibold text-ink-muted">Gastos hab. de este mes</h2>
            <div className="flex shrink-0 items-center gap-1">
              <span className="whitespace-nowrap text-sm font-medium text-ink-muted">
                ~{formatCurrency(gastoAproximado)}
              </span>
              <InfoTooltip text="Suma de los gastos habituales cargados el mes pasado cuya cadencia (cada X días/semanas/meses) también corresponde a este mes. Es una proyección, no lo que ya se pagó." />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {habitualesPendientes.map((g) => (
              <GastoHabitualPendienteRow
                key={g.nombre}
                gasto={g}
                onCompletar={() => openCompletarHabitual(g)}
                onDesactivar={() => handleDesactivar(g.nombre)}
              />
            ))}
            {habitualesPendientes.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
                No hay gastos habituales pendientes este mes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* series que Mai desactivó — sus filas viejas ya cargadas siguen
          contando en las estadísticas de arriba, esto es solo para
          reactivarlas si vuelve a pagarlas */}
      {anclasHabitualesInactivas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-muted">Gastos habituales desactivados</h2>
          <div className="flex flex-col gap-2">
            {anclasHabitualesInactivas.map((g) => (
              <div
                key={g.nombre}
                className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface p-4 opacity-70"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{g.nombre}</p>
                  {g.recurrenciaNumero && g.recurrenciaUnidad && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Habitual · {formatRecurrencia(g.recurrenciaNumero, g.recurrenciaUnidad)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleReactivar(g.nombre)}
                  className="shrink-0 text-xs font-medium text-primary-600 hover:underline"
                >
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <GastoRowSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {!loading && gruposPorMes.map((grupo) => (
          <div key={grupo.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-muted">{grupo.label}</h2>
              <span className="text-sm font-medium text-ink-muted">Total {formatCurrency(grupo.total)}</span>
            </div>
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
        initialNombre={plantillaHabitual?.nombre}
        initialEsFijo={plantillaHabitual ? true : undefined}
        initialRecurrenciaNumero={plantillaHabitual?.recurrenciaNumero}
        initialRecurrenciaUnidad={plantillaHabitual?.recurrenciaUnidad}
      />
    </div>
  )
}

function GastoRow({ gasto: g, onClick }: { gasto: Gasto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 text-left"
    >
      {/* fila 1: nombre+fecha a la izquierda, badge de habitual a la derecha */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="font-medium text-ink">{g.nombre}</p>
          <span className="text-xs text-ink-muted">{formatFechaSolo(g.fecha)}</span>
        </div>
        {g.esFijo && g.recurrenciaNumero && g.recurrenciaUnidad && (
          <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            Habitual · {formatRecurrencia(g.recurrenciaNumero, g.recurrenciaUnidad)}
          </span>
        )}
      </div>
      {/* fila 2: descripción a la izquierda, precio a la derecha */}
      <div className="flex items-center justify-between gap-2">
        {g.descripcion ? (
          <MarqueeText text={g.descripcion} className="text-sm text-ink-muted" />
        ) : (
          <span />
        )}
        <p className="shrink-0 font-semibold text-ink">{formatCurrency(g.valor)}</p>
      </div>
    </button>
  )
}

// item pendiente en "Gastos habituales de este mes" — a propósito sin
// precio (el de la fila-ancla es viejo, de otro mes) y con borde punteado
// para diferenciarse de una card de gasto ya cargado; tocarla abre el form
// de creación precargado con nombre/recurrencia, lista para que Mai solo
// tenga que poner el valor de este mes
function GastoHabitualPendienteRow({
  gasto: g,
  onCompletar,
  onDesactivar,
}: {
  gasto: Gasto
  onCompletar: () => void
  onDesactivar: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface p-4">
      {/* botón propio (no anidado en el de Desactivar) para que todo salvo
          "Desactivar" abra el form de completar */}
      <button
        type="button"
        onClick={onCompletar}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:opacity-80"
      >
        <div className="min-w-0">
          <p className="font-medium text-ink">{g.nombre}</p>
          {g.recurrenciaNumero && g.recurrenciaUnidad && (
            <p className="mt-0.5 text-xs text-ink-muted">Habitual · {formatRecurrencia(g.recurrenciaNumero, g.recurrenciaUnidad)}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-primary-600">Completar</span>
      </button>
      <button
        type="button"
        onClick={onDesactivar}
        aria-label={`Desactivar gasto habitual "${g.nombre}"`}
        className="shrink-0 text-xs font-medium text-ink-muted hover:text-danger"
      >
        Desactivar
      </button>
    </div>
  )
}

// mismo patrón de "click para abrir, click afuera o Escape para cerrar" que
// TratamientoFilterDropdown (Turnos.tsx) / NotificationBell
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cómo se calcula"
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-border bg-surface p-3 text-xs text-ink-muted shadow-lg">
          {text}
        </div>
      )}
    </div>
  )
}

function GastoRowSkeleton() {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
