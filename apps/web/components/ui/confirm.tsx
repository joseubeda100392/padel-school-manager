'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Sheet } from './sheet'
import { Button } from './button'

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// Sustituye a window.confirm(): `if (!(await confirm({...}))) return`.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function settle(value: boolean) {
    resolver.current?.(value)
    resolver.current = null
    setOpen(false)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={open}
        onClose={() => settle(false)}
        title={options?.title ?? ''}
        description={options?.description}
        footer={
          <>
            <Button variant="secondary" size="lg" className="sm:h-11" onClick={() => settle(false)}>
              {options?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={options?.destructive ? 'danger' : 'primary'}
              size="lg"
              className="sm:h-11"
              onClick={() => settle(true)}
              autoFocus
            >
              {options?.confirmLabel}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm necesita <ConfirmProvider> en el layout')
  return confirm
}
