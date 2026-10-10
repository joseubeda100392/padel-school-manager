'use client'

import { createContext, forwardRef, useContext, useId } from 'react'
import { cn } from '@/lib/utils'

type FieldCtx = { id: string; describedBy?: string; invalid: boolean }
const FieldContext = createContext<FieldCtx | null>(null)

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className="text-label text-ink">
          {label}
        </label>
        {children}
        {hint && !error && <p id={hintId} className="text-meta text-ink-3">{hint}</p>}
        {error && (
          <p id={errorId} role="alert" className="text-meta font-medium text-danger-ink">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

const controlClass = cn(
  'w-full rounded-control border border-line-strong/70 bg-surface px-3.5 text-base text-ink sm:text-body',
  'placeholder:text-ink-3/80 transition-[border-color,box-shadow] duration-150',
  'hover:border-line-strong focus:border-accent-ink focus:outline-none focus:ring-2 focus:ring-accent/30',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3',
  'aria-[invalid=true]:border-danger-ink aria-[invalid=true]:focus:ring-danger-ink/20',
)

function useFieldProps(props: { id?: string; 'aria-describedby'?: string }) {
  const ctx = useContext(FieldContext)
  return {
    id: props.id ?? ctx?.id,
    'aria-describedby': props['aria-describedby'] ?? ctx?.describedBy,
    'aria-invalid': ctx?.invalid || undefined,
  }
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlClass, 'h-11', className)} {...props} {...useFieldProps(props)} />
})

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(controlClass, 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566A7F' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
      {...useFieldProps(props)}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlClass, 'min-h-24 py-2.5', className)} {...props} {...useFieldProps(props)} />
  },
)
