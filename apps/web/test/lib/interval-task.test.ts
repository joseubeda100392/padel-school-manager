import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startIntervalTask } from '@/lib/interval-task'

describe('startIntervalTask', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('espera el primer retraso y después repite cada intervalo', async () => {
    const run = vi.fn(async () => {})
    const stop = startIntervalTask({ name: 't', everyMs: 10_000, firstDelayMs: 1_000, run, log: vi.fn() })
    await vi.advanceTimersByTimeAsync(999)
    expect(run).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(2)
    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('nunca lanza dos pasadas a la vez: si la anterior sigue, se salta', async () => {
    let finish: () => void = () => {}
    const run = vi.fn(() => new Promise<void>(r => { finish = r }))
    const stop = startIntervalTask({ name: 't', everyMs: 10_000, firstDelayMs: 0, run, log: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(run).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(2)
    stop()
  })

  it('un fallo se registra y no para las siguientes pasadas', async () => {
    const log = vi.fn()
    const run = vi.fn().mockRejectedValueOnce(new Error('Redsys caído')).mockResolvedValue(undefined)
    const stop = startIntervalTask({ name: 'revision', everyMs: 10_000, firstDelayMs: 0, run, log })
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toHaveBeenCalledWith('[revision] falló la pasada:', expect.any(Error))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(2)
    stop()
  })
})
