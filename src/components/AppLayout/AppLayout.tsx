import { useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../hooks/useTheme'
import { NotificationBell } from '../NotificationBell/NotificationBell'
import { NuevoTurnoForm } from '../NuevoTurnoForm/NuevoTurnoForm'
import { GoogleCalendarConnectBanner } from '../GoogleCalendarConnectBanner/GoogleCalendarConnectBanner'
import {
  BarChartIcon,
  CalendarIcon,
  ClipboardListIcon,
  DollarSignIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  PackageIcon,
  PlusIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from '../icons'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, end: true },
  { to: '/turnos', label: 'Turnos', icon: CalendarIcon, end: false },
  { to: '/pacientes', label: 'Pacientes', icon: UsersIcon, end: false },
  { to: '/tratamientos', label: 'Tratamientos', icon: PackageIcon, end: false },
  { to: '/formularios', label: 'Formularios', icon: ClipboardListIcon, end: false },
  { to: '/gastos', label: 'Gastos', icon: DollarSignIcon, end: false },
  { to: '/analytics', label: 'Analytics', icon: BarChartIcon, end: false },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

// Zona angosta pegada al borde derecho donde tiene que arrancar el toque
// para contar como "abrir con swipe" — si se contara desde cualquier punto
// de la pantalla, cualquier scroll/drag horizontal accidental abriría el
// drawer. Para cerrar no hace falta esa restricción: con el drawer abierto,
// cualquier arrastre hacia la derecha (el gesto opuesto) lo cierra, arranque
// donde arranque. SWIPE_THRESHOLD es cuánto tiene que arrastrar el dedo
// antes de abrir/cerrar, para no disparar con un toque casi estático.
const EDGE_SWIPE_ZONE = 24
const SWIPE_THRESHOLD = 60

export function AppLayout() {
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [nuevoTurnoOpen, setNuevoTurnoOpen] = useState(false)
  // ref, no state: se actualiza en cada touchmove y no necesita re-render
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    if (drawerOpen) {
      // cerrando: no hace falta arrancar en ningún borde en particular
      swipeStart.current = { x: touch.clientX, y: touch.clientY }
    } else {
      swipeStart.current =
        touch.clientX >= window.innerWidth - EDGE_SWIPE_ZONE ? { x: touch.clientX, y: touch.clientY } : null
    }
  }

  function handleTouchMove(e: TouchEvent) {
    const start = swipeStart.current
    if (!start) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    // más horizontal que vertical, así un scroll vertical no dispara el
    // abrir/cerrar por error
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return
    if (drawerOpen && deltaX > SWIPE_THRESHOLD) {
      setDrawerOpen(false)
      swipeStart.current = null
    } else if (!drawerOpen && deltaX < -SWIPE_THRESHOLD) {
      setDrawerOpen(true)
      swipeStart.current = null
    }
  }

  function handleTouchEnd() {
    swipeStart.current = null
  }

  return (
    // h-svh + overflow-hidden a propósito: sin esto los flex children (que
    // por default no bajan de su min-height de contenido) hacen que la
    // página entera crezca y sea el body el que scrollea, no <main> — en iOS
    // eso dispara el rebote elástico nativo y se siente "trabado" al hacer scroll.
    // Sidebar/drawer del lado derecho a propósito: Mai es diestra, y con el
    // menú a la derecha tanto el botón que lo abre (header) como el propio
    // panel quedan más cerca del pulgar al sostener el teléfono con esa mano.
    <div
      className="flex h-svh overflow-hidden bg-surface-muted"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-6">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted"
            >
              {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            <NotificationBell />
          </div>
          {/* hamburguesa sigue a la derecha, junto al menú/drawer que ahora
              también vive de ese lado (ver comentario en el div raíz) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </header>

        <GoogleCalendarConnectBanner />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-5">
          <span className="text-2xl" aria-hidden="true">
            🌼
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Mai Ruiz Skincare</p>
            <p className="text-xs text-ink-muted">Gestor de turnos</p>
          </div>
        </div>
        <NavLinks />
        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <LogOutIcon className="h-5 w-5 shrink-0" />
            Cerrar sesión
          </button>
        </div>
        <p className="px-5 pt-4 text-left text-[11px] text-ink-muted">Hecho con amor para mi amor &lt;3</p>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-[drawer-backdrop-in_0.2s_ease-out]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative ml-auto flex h-full w-64 flex-col bg-surface py-5 shadow-xl animate-[drawer-panel-in_0.2s_ease-out]">
            <div className="mb-6 flex items-center justify-between px-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">
                  🌼
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Mai Ruiz Skincare</p>
                  <p className="text-xs text-ink-muted">Gestor de turnos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            <div className="px-3 pt-4">
              <button
                type="button"
                onClick={() => signOut()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <LogOutIcon className="h-5 w-5 shrink-0" />
                Cerrar sesión
              </button>
            </div>
            <p className="px-5 pt-4 text-left text-[11px] text-ink-muted">Hecho con amor para mi amor &lt;3</p>
          </aside>
        </div>
      )}

      <button
        type="button"
        onClick={() => setNuevoTurnoOpen(true)}
        aria-label="Nuevo turno"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-600 active:scale-95"
      >
        <PlusIcon className="h-6 w-6" />
      </button>

      <NuevoTurnoForm open={nuevoTurnoOpen} onClose={() => setNuevoTurnoOpen(false)} />
    </div>
  )
}
