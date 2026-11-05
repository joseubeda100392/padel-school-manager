// Importes escritos a mano en euros: se acepta coma o punto («46,5», «46.50»).
// null si no es un importe válido (vacío, letras o negativo).
export function eurosToCents(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

// Céntimos → texto para un campo editable, con coma y sin «,00».
export function centsToEurosText(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')
}
