// Ventana de una inscripción fija: está en el grupo desde start_date (si lo
// hay) hasta end_date (si lo hay), ambos incluidos. Fechas 'YYYY-MM-DD'.
export interface EnrollmentWindow {
  start_date?: string | null
  end_date?: string | null
}

export function isActiveOn(e: EnrollmentWindow, date: string): boolean {
  return (!e.start_date || e.start_date <= date) && (!e.end_date || e.end_date >= date)
}

// Máximo de alumnos que tendrá el grupo desde `fromDate` en adelante. Solo
// cambia cuando entra alguien, así que basta con mirar `fromDate` y cada
// start_date posterior: un alta a futuro no puede llenar un hueco que otra
// alta más tardía ya tiene reservado.
export function peakOccupancyFrom(enrollments: EnrollmentWindow[], fromDate: string): number {
  const points = [fromDate, ...enrollments.map(e => e.start_date).filter((d): d is string => !!d && d > fromDate)]
  return Math.max(...points.map(p => enrollments.filter(e => isActiveOn(e, p)).length))
}

export function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d - 1))
  return t.toISOString().slice(0, 10)
}

export function firstOfNextMonth(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, m, 1))
  return t.toISOString().slice(0, 10)
}

export function madridToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
}

export interface RosterChange {
  kind: 'in' | 'out'
  date: string
}

// Quién está en el grupo durante un mes ('YYYY-MM') visto desde hoy: quita a
// quien ya se ha ido antes y a quien entra después, y marca a quien entra o
// sale ese mismo mes. Los días ya pasados del mes no cuentan.
export function rosterForMonth<T extends EnrollmentWindow>(enrollments: T[], month: string, today: string): { entry: T; change: RosterChange | null }[] {
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const from = today > first ? today : first
  return enrollments
    .filter(e => (!e.end_date || e.end_date >= from) && (!e.start_date || e.start_date <= last))
    .map(entry => {
      const joins = !!entry.start_date && entry.start_date > today && entry.start_date >= first
      const leaves = !!entry.end_date && entry.end_date <= last
      const change: RosterChange | null = joins
        ? { kind: 'in', date: entry.start_date! }
        : leaves ? { kind: 'out', date: entry.end_date! } : null
      return { entry, change }
    })
}

// Meses que se pueden planificar: el actual y los `count - 1` siguientes.
export function upcomingMonths(today: string, count: number): string[] {
  const [y, m] = today.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 7))
}
