export type ReplyIntent = 'confirmado' | 'cancelado' | 'reprogramar' | 'no_reconocido'

// heurística por palabra clave, no NLU — cualquier respuesta no reconocida
// igual genera una notificación para que Mai la revise a mano
const PATTERNS: { intent: ReplyIntent; regex: RegExp }[] = [
  { intent: 'cancelado', regex: /\b(cancelar|cancelo|cancela|no puedo|no voy|^no)\b/i },
  { intent: 'confirmado', regex: /\b(confirmar|confirmo|confirma|dale|listo|^si|^sí|^ok)\b/i },
  { intent: 'reprogramar', regex: /\b(reprogramar|reprograma|cambiar|cambio|mover|otro dia|otro día|posponer)\b/i },
]

export function parseReply(text: string): ReplyIntent {
  const normalized = text.trim().toLowerCase()
  for (const { intent, regex } of PATTERNS) {
    if (regex.test(normalized)) return intent
  }
  return 'no_reconocido'
}
