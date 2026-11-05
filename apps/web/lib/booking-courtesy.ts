// Reserva puntual de prueba o cortesía: apuntada por el club sin descontar
// bolsa ni cobrar. Se guarda como source 'admin', confirmada, con esta nota.
export const COURTESY_NOTE = 'cortesia'

// Origen que se enseña en las listas: la cortesía aparte de las demás 'admin'.
export function spotSourceOf(b: { source: string; notes?: string | null }): string {
  return b.notes === COURTESY_NOTE ? 'courtesy' : b.source
}
