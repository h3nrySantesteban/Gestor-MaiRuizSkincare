import { Link } from 'react-router-dom'

// Página pública de inicio — a propósito no requiere sesión. Google exige
// que la "página principal" de una app que pide scopes sensibles (Calendar)
// sea accesible sin login y explique el propósito de la app.
export function Landing() {
  return (
    <div className="flex min-h-svh flex-col bg-surface-muted">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">
            🌼
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">Gestor de Turnos — Mai Ruiz Skincare</h1>
            <p className="text-sm text-ink-muted">Panel interno de gestión de turnos</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink">
          Gestor de Turnos — Mai Ruiz Skincare es un sistema de uso interno para administrar la agenda de un
          consultorio de skincare: pacientes, tratamientos y turnos. Permite registrar turnos, enviar recordatorios
          automáticos por WhatsApp y sincronizar cada turno con Google Calendar.
        </p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Es una herramienta de uso exclusivo de la administradora del consultorio — no tiene registro público ni
          usuarios externos.
        </p>

        <div>
          <Link
            to="/login"
            className="inline-flex items-center rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      <footer className="flex justify-center gap-4 border-t border-border px-6 py-4 text-xs text-ink-muted">
        <Link to="/privacidad" className="hover:text-ink hover:underline">
          Política de Privacidad
        </Link>
        <Link to="/terminos" className="hover:text-ink hover:underline">
          Condiciones del Servicio
        </Link>
      </footer>
    </div>
  )
}
