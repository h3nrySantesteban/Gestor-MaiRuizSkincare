import type { PacienteInput } from '../hooks/usePacientes'
import type { Paciente } from '../types/paciente'

const CAMPO_TELEFONO = 'Teléfono'
const CAMPO_EMAIL = 'Dirección de correo electrónico'

// El form pide el teléfono en formato local, pero lo que la gente tipea es
// inconsistente: sin nada ("3415100880"), con el 0 de área a la vieja usanza
// ("03415100880"), o con el 9 de celular que se usa al discar en Argentina
// ("93416611332"). El resto de la app espera el formato completo que usa la
// Cloud API de WhatsApp (549 + área + número, 13 dígitos — ver el hint en
// NuevoPacienteForm), que es lo que necesita el botón de WhatsApp del perfil
// para armar un link válido. Si después de sacar esos prefijos no quedan
// justo 10 dígitos, el número está incompleto o mal tipeado en el form —
// mejor no adivinar y dejarlo sin completar que guardar algo que no sirve.
function normalizarTelefonoArgentino(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('549')) return digits.length === 13 ? digits : null
  if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 11 && digits.startsWith('9')) digits = digits.slice(1)
  return digits.length === 10 ? `549${digits}` : null
}

/**
 * Teléfono y email que se pueden completar en el paciente a partir de una
 * respuesta de formulario. También se usa para precompletar el form de
 * "crear nuevo paciente" cuando se arranca desde una respuesta sin asignar.
 */
export function contactoDesdeFormulario(respuestas: Record<string, string>): { telefono: string | null; email: string | null } {
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
