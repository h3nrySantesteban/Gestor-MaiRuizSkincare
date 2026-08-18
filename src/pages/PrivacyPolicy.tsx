export function PrivacyPolicy() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12 text-sm leading-relaxed text-ink">
      <h1 className="text-xl font-semibold">Política de Privacidad</h1>
      <p className="text-ink-muted">Última actualización: agosto de 2026</p>

      <p>
        Gestor de Turnos — Mai Ruiz Skincare ("la Aplicación") es un sistema interno de gestión de turnos operado por
        Mai Ruiz Skincare (Argentina) para administrar pacientes, tratamientos y turnos de su consultorio. Esta
        política describe qué información se recopila, cómo se usa, y en particular cómo se accede y usa la
        información de Google de quien administra la cuenta.
      </p>

      <h2 className="mt-2 text-base font-semibold">Quién opera la Aplicación</h2>
      <p>
        La Aplicación es de uso exclusivo interno: la utiliza únicamente la administradora del consultorio (single
        admin), con una cuenta creada manualmente. No tiene registro público ni usuarios externos.
      </p>

      <h2 className="mt-2 text-base font-semibold">Datos que recopila la Aplicación</h2>
      <p>Para prestar el servicio, la Aplicación almacena en una base de datos propia (Supabase):</p>
      <ul className="list-disc pl-5">
        <li>Datos de pacientes: nombre, teléfono, usuario de Instagram y, opcionalmente, email.</li>
        <li>Datos de turnos: fecha, tratamiento, precio, medio de pago y estado.</li>
        <li>Mensajes de WhatsApp entrantes relacionados a la confirmación o cancelación de turnos.</li>
      </ul>

      <h2 className="mt-2 text-base font-semibold">Uso de datos de Google (Google Calendar)</h2>
      <p>
        La Aplicación se integra con la API de Google Calendar para reflejar automáticamente los turnos agendados en
        el calendario de Google de la administradora. Concretamente, con el permiso otorgado (scope{' '}
        <code>https://www.googleapis.com/auth/calendar.events</code>) la Aplicación:
      </p>
      <ul className="list-disc pl-5">
        <li>Crea un evento en el calendario de Google cuando se agenda un nuevo turno.</li>
        <li>Actualiza ese mismo evento si el turno se edita (por ejemplo, se cambia la fecha).</li>
        <li>Elimina el evento si el turno se cancela o se borra.</li>
        <li>
          Si el paciente tiene un email cargado, lo agrega como invitado del evento para que también le llegue la
          invitación a su propio calendario.
        </li>
      </ul>
      <p>
        La Aplicación no lee, exporta ni comparte con terceros ningún otro evento o dato del calendario de Google más
        allá de los eventos que ella misma crea para reflejar los turnos. No se usa esta información con fines
        publicitarios ni se vende a terceros bajo ninguna circunstancia.
      </p>
      <p>
        El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se
        adhieren a la{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 underline"
        >
          Política de Datos de Usuario de los Servicios de API de Google
        </a>
        , incluidos los requisitos de Uso Limitado.
      </p>

      <h2 className="mt-2 text-base font-semibold">Cómo se almacenan y protegen los datos</h2>
      <p>
        Los datos se almacenan en Supabase (Postgres) con acceso restringido exclusivamente a la cuenta autenticada
        de la administradora (Row Level Security). El token de acceso a Google Calendar se guarda como variable de
        entorno privada del servidor y nunca se expone al navegador ni a terceros.
      </p>

      <h2 className="mt-2 text-base font-semibold">Cómo revocar el acceso</h2>
      <p>
        La administradora puede revocar el permiso otorgado a la Aplicación en cualquier momento desde{' '}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 underline"
        >
          myaccount.google.com/permissions
        </a>
        . Al revocarlo, la Aplicación deja de poder crear, editar o borrar eventos en el calendario; los turnos
        siguen existiendo con normalidad dentro de la Aplicación.
      </p>

      <h2 className="mt-2 text-base font-semibold">Contacto</h2>
      <p>
        Para consultas sobre esta política o sobre el tratamiento de datos, escribir a{' '}
        <a href="mailto:henrycanalla@gmail.com" className="text-primary-600 underline">
          henrycanalla@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
