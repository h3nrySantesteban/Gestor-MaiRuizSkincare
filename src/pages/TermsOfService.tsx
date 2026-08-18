export function TermsOfService() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12 text-sm leading-relaxed text-ink">
      <h1 className="text-xl font-semibold">Condiciones del Servicio</h1>
      <p className="text-ink-muted">Última actualización: agosto de 2026</p>

      <p>
        Gestor de Turnos — Mai Ruiz Skincare ("la Aplicación") es un sistema interno de gestión de turnos, pacientes
        y tratamientos operado por Mai Ruiz Skincare (Argentina) exclusivamente para uso propio del consultorio. Al
        acceder o usar la Aplicación, la administradora acepta estas condiciones.
      </p>

      <h2 className="mt-2 text-base font-semibold">Uso del servicio</h2>
      <p>
        La Aplicación es de uso interno y no está disponible públicamente: no ofrece registro de usuarios ni acceso a
        terceros. Se usa únicamente para administrar la agenda del consultorio (turnos, pacientes y tratamientos) y
        para enviar recordatorios automáticos por WhatsApp y sincronizar turnos con Google Calendar.
      </p>

      <h2 className="mt-2 text-base font-semibold">Integraciones de terceros</h2>
      <p>
        La Aplicación se integra con la API de WhatsApp Cloud (Meta) para el envío y recepción de mensajes, y con la
        API de Google Calendar para reflejar los turnos en el calendario de Google de la administradora. El uso de
        cada una de estas integraciones está sujeto también a las condiciones y políticas del proveedor
        correspondiente (Meta y Google).
      </p>

      <h2 className="mt-2 text-base font-semibold">Responsabilidad</h2>
      <p>
        La Aplicación se ofrece "tal cual", sin garantías de disponibilidad ininterrumpida. Mai Ruiz Skincare no se
        responsabiliza por fallas de servicios de terceros (Supabase, Vercel, Meta, Google) que puedan afectar el
        funcionamiento de la Aplicación, ni por pérdidas derivadas de un uso indebido de la misma.
      </p>

      <h2 className="mt-2 text-base font-semibold">Cambios a estas condiciones</h2>
      <p>
        Estas condiciones pueden actualizarse en cualquier momento para reflejar cambios en la Aplicación. La versión
        vigente es siempre la publicada en esta misma página.
      </p>

      <h2 className="mt-2 text-base font-semibold">Contacto</h2>
      <p>
        Para consultas sobre estas condiciones, escribir a{' '}
        <a href="mailto:henrycanalla@gmail.com" className="text-primary-600 underline">
          henrycanalla@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
