export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function waLink(phone: string): string {
  return `https://wa.me/${normalizePhone(phone)}`
}

export function instagramLink(username: string): string {
  const clean = username.trim().replace(/^@/, '')
  return `https://instagram.com/${clean}`
}
