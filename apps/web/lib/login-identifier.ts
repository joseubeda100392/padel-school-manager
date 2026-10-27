// Entrar con email o teléfono. Quien no tiene email tiene una cuenta con un
// email interno (<teléfono>@sin-email.epadelschool.app) que no recibe nada;
// entra escribiendo su teléfono. Quien tiene email puede usar cualquiera de
// los dos, salvo que su teléfono lo compartan varias cuentas (familias).

export const PLACEHOLDER_EMAIL_DOMAIN = 'sin-email.epadelschool.app'

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}

export function placeholderEmailFor(phone: string): string | null {
  const digits = normalizePhone(phone)
  return digits ? `${digits}@${PLACEHOLDER_EMAIL_DOMAIN}` : null
}

// Teléfono español a 9 cifras: quita espacios, guiones, puntos y el prefijo
// +34 / 0034 / 34. Devuelve null si no queda un número de 9 cifras.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('0034')) digits = digits.slice(4)
  else if (digits.length === 11 && digits.startsWith('34')) digits = digits.slice(2)
  return /^[6789]\d{8}$/.test(digits) ? digits : null
}

// Lo que se escribe en el login: con @ es un email; si no, se intenta como
// teléfono.
export function parseLoginIdentifier(input: string): { kind: 'email'; email: string } | { kind: 'phone'; phone: string } | null {
  const value = input.trim()
  if (value.includes('@')) return { kind: 'email', email: value.toLowerCase() }
  const phone = normalizePhone(value)
  return phone ? { kind: 'phone', phone } : null
}

// Patrón para buscar el teléfono en users.phone aunque esté guardado con
// espacios o prefijo: "649442601" → "%6%4%9%4%4%2%6%0%1". Los candidatos se
// confirman después con normalizePhone.
export function phoneSearchPattern(phone: string): string {
  return `%${phone.split('').join('%')}`
}
