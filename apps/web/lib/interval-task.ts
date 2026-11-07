// Lanza una tarea cada cierto tiempo dentro del servidor. Si una pasada aún no
// ha terminado cuando toca la siguiente, esa se salta (nunca dos a la vez), y un
// fallo se registra sin parar el temporizador.
export function startIntervalTask(opts: {
  name: string
  everyMs: number
  firstDelayMs: number
  run: () => Promise<unknown>
  log: (...args: unknown[]) => void
}): () => void {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await opts.run()
    } catch (e) {
      opts.log(`[${opts.name}] falló la pasada:`, e)
    } finally {
      running = false
    }
  }
  const first = setTimeout(() => { void tick() }, opts.firstDelayMs)
  const every = setInterval(() => { void tick() }, opts.everyMs)
  // No mantener vivo el proceso solo por el temporizador.
  first.unref?.()
  every.unref?.()
  return () => { clearTimeout(first); clearInterval(every) }
}
