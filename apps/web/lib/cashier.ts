// Cobrador: persona del club que solo cobra mensualidades y marca fianzas
// desde «Caja». No es admin: las rutas del panel no le dejan pasar.
export const CASHIER_ROLE = 'cashier'

// Quién puede cobrar una mensualidad o marcar una fianza en el club.
export const FEE_COLLECTOR_ROLES = ['admin', 'super_admin', CASHIER_ROLE] as const

export function canCollectFees(role: string | null | undefined): boolean {
  return !!role && (FEE_COLLECTOR_ROLES as readonly string[]).includes(role)
}
