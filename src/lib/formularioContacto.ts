import type { PacienteInput } from '../hooks/usePacientes'
import type { Paciente } from '../types/paciente'

const CAMPO_TELEFONO = 'Teléfono'
const CAMPO_EMAIL = 'Dirección de correo electrónico'

// El form pide el teléfono en formato local (ej. "3415100880", sin código de
// país) — el resto de la app espera el formato completo que usa la Cloud API
// de WhatsApp (549 + área + número, ver el hint en NuevoPacienteForm), que es
// lo que necesita el botón de WhatsApp del perfil para armar un link válido.
function normalizarTelefonoArgentino(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) return `549${digits.slice(2)}`
  return `549${digits}`
}

/** Teléfono y email que se pueden completar en el paciente a partir de una respuesta de formulario. */
function contactoDesdeFormulario(respuestas: Record<string, string>): { telefono: string | null; email: string | null } {
  const telefonoRaw = respuestas[CAMPO_TELEFONO]?.trim()
  const emailRaw = respuestas[CAMPO_EMAIL]?.trim()
  return {
    telefono: telefonoRaw ? normalizarTelefonoArgentino(telefonoRaw) : null,
    email: emailRaw || null,
  }
}

// Solo completa lo que el paciente todavía no tiene cargado — un formulario
// viejo no debe pisar un teléfono o email que Mai ya cargó/corrigió a mano.
export async function completarContactoDesdeFormulario(
  paciente: Paciente,
  respuestas: Record<string, string>,
  update: (id: string, input: PacienteInput) => Promise<void>,
): Promise<void> {
  const contacto = contactoDesdeFormulario(respuestas)
  const telefono = paciente.telefono ?? contacto.telefono
  const email = paciente.email ?? contacto.email
  if (telefono === paciente.telefono && email === paciente.email) return

  await update(paciente.id, {
    nombreCompleto: paciente.nombreCompleto,
    telefono,
    instagram: paciente.instagram,
    email,
    notas: paciente.notas,
  })
}
