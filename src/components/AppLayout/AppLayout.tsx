import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { NotificationBell } from '../NotificationBell/NotificationBell'
import { NuevoTurnoForm } from '../NuevoTurnoForm/NuevoTurnoForm'
import {
  BarChartIcon,
  CalendarIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  PlusIcon,
  UsersIcon,
  XIcon,
} from '../icons'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, end: true },
  { to: '/turnos', label: 'Turnos', icon: CalendarIcon, end: false },
  { to: '/pacientes', label: 'Pacientes', icon: UsersIcon, end: false },
  { to: '/tratamientos', label: 'Tratamientos', icon: PackageIcon, end: false },
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

export function AppLayout() {
  const { signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [nuevoTurnoOpen, setNuevoTurnoOpen] = useState(false)

  return (
    // h-svh + overflow-hidden a propósito: sin esto los flex children (que
    // por default no bajan de su min-height de contenido) hacen que la
    // página entera crezca y sea el body el que scrollea, no <main> — en iOS
    // eso dispara el rebote elástico nativo y se siente "trabado" al hacer scroll.
    <div className="flex h-svh overflow-hidden bg-surface-muted">
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface py-5 md:flex">
        <div className="mb-6 px-5">
          <p className="text-sm font-semibold text-ink">Mai Ruiz Skincare</p>
          <p className="text-xs text-ink-muted">Gestor de turnos</p>
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
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-surface py-5 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-5">
              <div>
                <p className="text-sm font-semibold text-ink">Mai Ruiz Skincare</p>
                <p className="text-xs text-ink-muted">Gestor de turnos</p>
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
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <p className="text-sm font-medium text-ink md:hidden">Mai Ruiz Skincare</p>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6">
          <Outlet />
        </main>
      </div>

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
