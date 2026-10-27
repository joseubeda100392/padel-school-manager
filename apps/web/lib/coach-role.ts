// Quién cuenta como monitor: los de rol 'coach' y los admins marcados como
// "también es monitor" (users.also_coach). Las listas de monitores, las horas
// y las clases que se les pueden asignar usan esto en vez de role = 'coach'.

// Filtro de PostgREST para .or(...)
export const COACH_USERS_FILTER = 'role.eq.coach,and(role.eq.admin,also_coach.eq.true)'

export function isCoachUser(user: { role?: string | null; also_coach?: boolean | null } | null | undefined): boolean {
  if (!user) return false
  return user.role === 'coach' || (user.role === 'admin' && user.also_coach === true)
}
