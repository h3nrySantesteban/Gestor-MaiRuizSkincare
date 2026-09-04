import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

interface MarqueeTextProps {
  text: string
  className?: string
}

/**
 * Texto de una sola línea que, si no entra en su contenedor, se desliza
 * hacia la izquierda para dejar ver el final y vuelve — en vez de cortarse
 * con "..." (truncate) y perder esa parte para siempre. Si entra sin
 * problema, se queda quieto (nada de animación de más).
 *
 * La distancia a recorrer (cuánto se pasa el texto del ancho visible) se
 * mide en cada resize/cambio de texto y se manda como variable CSS al
 * keyframe — no hay forma de saber ese número solo con CSS.
 */
export function MarqueeText({ text, className = '' }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [distancia, setDistancia] = useState(0)

  useEffect(() => {
    function medir() {
      if (!containerRef.current || !textRef.current) return
      const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth
      setDistancia(overflow > 0 ? overflow : 0)
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [text])

  return (
    <div ref={containerRef} className={`min-w-0 overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className={`inline-block ${distancia > 0 ? 'animate-[marquee-pingpong_6s_ease-in-out_infinite]' : ''}`}
        style={distancia > 0 ? ({ '--marquee-distance': `-${distancia}px` } as CSSProperties) : undefined}
      >
        {text}
      </span>
    </div>
  )
}
