interface DbError {
  message?: string
  code?: string
}

export function sanitizeDbError(err: DbError | null | undefined): string {
  if (!err) return 'Error interno del servidor'
  if (err.code === '23505') return 'Ya existe un registro con esos datos'
  if (err.code === '23503') return 'Referencia no válida'
  if (err.code === '23502') return 'Faltan datos requeridos'
  return 'Error interno del servidor'
}
