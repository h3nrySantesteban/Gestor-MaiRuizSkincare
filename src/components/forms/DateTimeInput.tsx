interface DateTimeInputProps {
  value: string
  onChange: (value: string) => void
  /** default 'datetime-local' */
  type?: 'datetime-local' | 'date'
  /** segundos entre valores del minutero nativo (ej: 900 = cada 15 min) */
  step?: number
}

/**
 * <input type="datetime-local"> o type="date" a secas ignoran w-full en iOS
 * Safari: el control nativo se renderiza con su propio ancho intrínseco (más
 * ancho que el resto de los campos) sin importar el CSS que le pongas, así
 * que min-w-0/max-width no alcanzan para domarlo.
 *
 * Acá el ancho lo define un wrapper normal en flujo (position: relative +
 * overflow: hidden), y el input se posiciona absolute inset-0 encima —
 * position: absolute sí obliga al control a resolver su tamaño contra el
 * contenedor en vez de su contenido. El div "sizer" invisible solo existe
 * para darle al wrapper el alto correcto (mismo padding/font que inputClass)
 * ya que el input absolute no participa del flujo normal.
 */
export function DateTimeInput({ value, onChange, type = 'datetime-local', step }: DateTimeInputProps) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      <div aria-hidden className="invisible border border-transparent px-3 py-2 text-base">
        &nbsp;
      </div>
      <input
        type={type}
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        // appearance-none: sin esto iOS dibuja su propio "chrome" nativo
        // sobre el control (fondo/borde propios) que pisa el border/bg de
        // acá y se termina viendo más fino/incompleto que los demás inputs
        className="absolute inset-0 h-full w-full min-w-0 appearance-none rounded-lg border border-border bg-surface px-3 py-2 text-base text-ink outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
    </div>
  )
}
