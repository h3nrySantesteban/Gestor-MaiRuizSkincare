import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// mismos valores que --color-surface-muted en src/index.css (claro/oscuro) —
// colorean la barra de estado de iOS/Android para que combine con el fondo
const THEME_COLOR: Record<Theme, string> = { light: '#f7f3f1', dark: '#131117' }

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' ? stored : null
}

function setThemeColorMeta(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

/**
 * Sin preferencia guardada: no tocamos el atributo, así el CSS sigue el
 * @media (prefers-color-scheme) del sistema solo (y reacciona en vivo si el
 * sistema cambia, sin recargar la página).
 */
function applyTheme(theme: Theme | null) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme)
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  setThemeColorMeta(theme ?? getSystemTheme())
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? getSystemTheme())

  // sin preferencia explícita, si el sistema cambia de tema mientras la app
  // está abierta el CSS ya sigue esa preferencia solo — pero el meta
  // theme-color no, así que lo actualizamos a mano en este caso
  useEffect(() => {
    if (getStoredTheme()) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setThemeColorMeta(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      applyTheme(next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
