import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../hooks/useTheme'
import { NotificationBell } from '../NotificationBell/NotificationBell'
import { NuevoTurnoForm } from '../NuevoTurnoForm/NuevoTurnoForm'
import { GoogleCalendarConnectBanner } from '../GoogleCalendarConnectBanner/GoogleCalendarConnectBanner'
import {
  BarChartIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClipboardListIcon,
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

// Submenu de "Resumen" (todo #2): por ahora solo Gastos tiene pantalla
// propia adonde llevar — el resto (Ingresos, Turnos tipo panel github, Top
// tratamientos, Top pacientes) todavía no existe como sección separada, así
// que quedan visibles pero sin destino hasta que se construyan por partes.
const RESUMEN_SUBMENU: { label: string; to?: string }[] = [
  { label: 'Gastos', to: '/gastos' },
  { label: 'Ingresos' },
  { label: 'Turnos' },
  { label: 'Top tratamientos' },
  { label: 'Top pacientes' },
]

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Resumen', icon: HomeIcon, end: true, submenu: RESUMEN_SUBMENU },
  { to: '/turnos', label: 'Turnos', icon: CalendarIcon, end: false, submenu: [] },
  { to: '/pacientes', label: 'Pacientes', icon: UsersIcon, end: false, submenu: [] },
  { to: '/tratamientos', label: 'Tratamientos', icon: PackageIcon, end: false, submenu: [] },
  { to: '/formularios', label: 'Formularios', icon: ClipboardListIcon, end: false, submenu: [] },
  { to: '/analytics', label: 'Analytics', icon: BarChartIcon, end: false, submenu: [] },
]

interface NavLinksProps {
  onNavigate?: () => void
  // levantado a AppLayout (no local) para que sobreviva a que el drawer
  // mobile se desmonte al cerrarse, y a navegar a otra pantalla y volver
  openSubmenu: string | null
  onToggleSubmenu: (to: string) => void
}

function NavLinks({ onNavigate, openSubmenu, onToggleSubmenu }: NavLinksProps) {
  const location = useLocation()

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end, submenu }) => {
        const expanded = openSubmenu === to
        const isCurrentPage = location.pathname === to
        // ya estando en la página, tocar la palabra no tiene nada nuevo
        // adonde navegar — en vez de ese no-op, despliega/oculta el submenu
        function handleLabelClick(e: MouseEvent) {
          if (submenu.length > 0 && isCurrentPage) {
            e.preventDefault()
            onToggleSubmenu(to)
          } else {
            onNavigate?.()
          }
        }
        return (
          <div key={to}>
            <div
              className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                expanded ? '' : 'hover:bg-surface-muted'
              }`}
            >
              <NavLink
                to={to}
                end={end}
                onClick={handleLabelClick}
                className={({ isActive }) =>
                  `flex flex-1 items-center gap-3 px-3 py-2.5 ${
                    isActive ? 'text-primary-700' : 'text-ink-muted hover:text-ink'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
              {submenu.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleSubmenu(to)}
                  aria-label={expanded ? `Ocultar opciones de ${label}` : `Mostrar opciones de ${label}`}
                  aria-expanded={expanded}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
                >
                  <ChevronDownIcon className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {expanded && (
              <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-4">
                {submenu.map((item) =>
                  item.to ? (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActive ? 'text-primary-700' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ) : (
                    // sin pantalla propia todavía — visible para mostrar el
                    // alcance final del menú, pero no navega a nada
                    <span key={item.label} className="cursor-default px-3 py-2 text-sm text-ink-muted/50">
                      {item.label}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        )
      })}
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
// mismo valor que la duración de las animaciones en index.css
// (drawer-panel-in/out, drawer-backdrop-in/out) — el drawer sigue montado
// este tiempo extra en fase "closing" para que la animación de salida
// llegue a verse en vez de desaparecer de golpe.
const DRAWER_CLOSE_ANIM_MS = 200

type DrawerPhase = 'closed' | 'open' | 'closing'

export function AppLayout() {
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [drawerPhase, setDrawerPhase] = useState<DrawerPhase>('closed')
  const [nuevoTurnoOpen, setNuevoTurnoOpen] = useState(false)
  // acá y no dentro de NavLinks: esa instancia del drawer mobile se
  // desmonta entera al cerrarse (ver "drawerPhase !== 'closed'" abajo), así
  // que un estado local ahí se perdería en vez de mantenerse abierto
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  // ref, no state: se actualiza en cada touchmove y no necesita re-render
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  function toggleSubmenu(to: string) {
    setOpenSubmenu((prev) => (prev === to ? null : to))
  }

  function openDrawer() {
    setDrawerPhase('open')
  }

  function closeDrawer() {
    setDrawerPhase((phase) => (phase === 'open' ? 'closing' : phase))
  }

  useEffect(() => {
    if (drawerPhase !== 'closing') return
    const id = setTimeout(() => setDrawerPhase('closed'), DRAWER_CLOSE_ANIM_MS)
    return () => clearTimeout(id)
  }, [drawerPhase])

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    if (drawerPhase === 'open') {
      // cerrando: no hace falta arrancar en ningún borde en particular
      swipeStart.current = { x: touch.clientX, y: touch.clientY }
    } else if (drawerPhase === 'closed') {
      swipeStart.current =
        touch.clientX >= window.innerWidth - EDGE_SWIPE_ZONE ? { x: touch.clientX, y: touch.clientY } : null
    } else {
      swipeStart.current = null
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
    if (drawerPhase === 'open' && deltaX > SWIPE_THRESHOLD) {
      closeDrawer()
      swipeStart.current = null
    } else if (drawerPhase === 'closed' && deltaX < -SWIPE_THRESHOLD) {
      openDrawer()
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
            <NotificationBell />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted"
            >
              {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
          </div>
          {/* hamburguesa sigue a la derecha, junto al menú/drawer que ahora
              también vive de ese lado (ver comentario en el div raíz) */}
          <button
            type="button"
            onClick={openDrawer}
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
        <NavLinks openSubmenu={openSubmenu} onToggleSubmenu={toggleSubmenu} />
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

      {drawerPhase !== 'closed' && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className={`absolute inset-0 bg-black/40 ${
              drawerPhase === 'closing'
                ? 'animate-[drawer-backdrop-out_0.2s_ease-in]'
                : 'animate-[drawer-backdrop-in_0.2s_ease-out]'
            }`}
            onClick={closeDrawer}
          />
          <aside
            className={`relative ml-auto flex h-full w-64 flex-col bg-surface py-5 shadow-xl ${
              drawerPhase === 'closing'
                ? 'animate-[drawer-panel-out_0.2s_ease-in]'
                : 'animate-[drawer-panel-in_0.2s_ease-out]'
            }`}
          >
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
                onClick={closeDrawer}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <NavLinks onNavigate={closeDrawer} openSubmenu={openSubmenu} onToggleSubmenu={toggleSubmenu} />
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
