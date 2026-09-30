import { useState } from 'react'
import { addMonths, format, getDaysInMonth, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { inputClass } from './FormField'
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon } from '../icons'

interface FechaHoraPickerProps {
  /** 'yyyy-MM-ddTHH:mm' (hora local), o '' si todavía no se eligió nada */
  value: string
  onChange: (value: string) => void
}

const HORAS = Array.from({ length: 24 }, (_, i) => i)
const MINUTOS = [0, 15, 30, 45]
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const HORA_POR_DEFECTO = 9

const pad = (n: number) => String(n).padStart(2, '0')

interface Partes {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
}

function parse(value: string): Partes | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] }
}

function build(p: Partes): string {
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Selector propio de fecha y hora, siempre en 24 hs. Reemplaza al
 * <input type="datetime-local"> nativo en el form de turnos: en el celular ese
 * control sigue la configuración del teléfono y puede mostrar una rueda con
 * AM/PM, fácil de dejar mal (un turno de las 15:00 que se guarda a las 03:00).
 * El minutero va cada 15 min, igual que el `step={900}` que tenía el nativo.
 *
 * Mismo contrato de valor que el input nativo ('yyyy-MM-ddTHH:mm'), así el
 * form que lo usa no cambia su manejo de la fecha. El panel se despliega en
 * el flujo (no flotante) para no pelearse con el overflow del Modal.
 */
export function FechaHoraPicker({ value, onChange }: FechaHoraPickerProps) {
  const seleccion = parse(value)
  const [open, setOpen] = useState(false)
  // mes que se está mirando (puede diferir del de la fecha elegida al navegar)
  const [mesVisible, setMesVisible] = useState(() => {
    const base = seleccion ? new Date(seleccion.year, seleccion.month - 1, 1) : new Date()
    return startOfMonth(base)
  })

  const year = mesVisible.getFullYear()
  const month = mesVisible.getMonth() + 1
  // getDay(): 0=domingo; la grilla arranca en lunes
  const offset = (mesVisible.getDay() + 6) % 7
  const diasEnMes = getDaysInMonth(mesVisible)
  const hoy = new Date()

  function elegirDia(day: number) {
    onChange(
      build({
        year,
        month,
        day,
        hour: seleccion?.hour ?? HORA_POR_DEFECTO,
        minute: seleccion?.minute ?? 0,
      }),
    )
  }

  function elegirHora(hour: number) {
    if (!seleccion) {
      // sin día elegido todavía: se toma hoy (o el primer día del mes que se
      // está mirando si es otro) para no perder el dato
      const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth() + 1
      onChange(build({ year, month, day: esMesActual ? hoy.getDate() : 1, hour, minute: 0 }))
      return
    }
    onChange(build({ ...seleccion, hour }))
  }

  function elegirMinuto(minute: number) {
    if (!seleccion) return
    onChange(build({ ...seleccion, minute }))
  }

  const resumen = seleccion
    ? `${format(new Date(seleccion.year, seleccion.month - 1, seleccion.day), "EEEE d 'de' MMMM yyyy", { locale: es })} · ${pad(seleccion.hour)}:${pad(seleccion.minute)} hs`
    : 'Elegí fecha y hora'

  const celdaBase = 'rounded-md py-1.5 text-sm transition-colors'
  const celdaActiva = 'bg-primary-500 font-medium text-white'
  const celdaInactiva = 'text-ink hover:bg-surface-muted'

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClass} flex items-center justify-between gap-2 text-left ${seleccion ? '' : 'text-ink-muted'}`}
      >
        <span className="min-w-0 truncate first-letter:uppercase">{resumen}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        // preventDefault: el picker vive dentro del <label> de Field, y un
        // click en un hueco del panel se reenviaría al botón de arriba,
        // cerrándolo solo
        <div
          className="mt-1 rounded-lg border border-border bg-surface p-3"
          onClick={(e) => e.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => setMesVisible((d) => addMonths(d, -1))}
              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium capitalize text-ink">{format(mesVisible, 'MMMM yyyy', { locale: es })}</span>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => setMesVisible((d) => addMonths(d, 1))}
              className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="py-1 text-xs font-medium text-ink-muted">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: diasEnMes }, (_, i) => {
              const day = i + 1
              const activo = seleccion?.year === year && seleccion.month === month && seleccion.day === day
              const esHoy = year === hoy.getFullYear() && month === hoy.getMonth() + 1 && day === hoy.getDate()
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => elegirDia(day)}
                  className={`${celdaBase} ${activo ? celdaActiva : celdaInactiva} ${esHoy && !activo ? 'ring-1 ring-primary-300' : ''}`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <p className="mb-1 mt-3 text-xs font-medium text-ink-muted">Hora (24 hs)</p>
          <div className="grid grid-cols-6 gap-1">
            {HORAS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => elegirHora(h)}
                className={`${celdaBase} ${seleccion?.hour === h ? celdaActiva : celdaInactiva}`}
              >
                {pad(h)}
              </button>
            ))}
          </div>

          <p className="mb-1 mt-3 text-xs font-medium text-ink-muted">Minutos</p>
          <div className="grid grid-cols-4 gap-1">
            {MINUTOS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={!seleccion}
                onClick={() => elegirMinuto(m)}
                className={`${celdaBase} disabled:opacity-50 ${seleccion?.minute === m ? celdaActiva : celdaInactiva}`}
              >
                {pad(m)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
          >
            Listo
          </button>
        </div>
      )}
    </div>
  )
}
