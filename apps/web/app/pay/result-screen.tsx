import Link from 'next/link'
import { CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function ResultScreen({
  tone,
  title,
  description,
  action,
}: {
  tone: 'success' | 'pending' | 'danger'
  title: string
  description: string
  action?: { href: string; label: string }
}) {
  const Icon = { success: CircleCheck, pending: Clock, danger: TriangleAlert }[tone]
  const iconClass = {
    success: 'bg-accent-soft text-accent-ink',
    pending: 'bg-warn-soft text-warn-ink',
    danger: 'bg-danger-soft text-danger-ink',
  }[tone]

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 text-center">
      <div className="flex w-full max-w-sm flex-col items-center">
        <span aria-hidden className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${iconClass}`}>
          <Icon className="h-8 w-8" />
        </span>
        <h1 className="font-display text-title text-ink">{title}</h1>
        <p className="mt-2 text-body text-ink-2">{description}</p>
        {action && (
          <Link href={action.href} className={buttonVariants({ size: 'lg', className: 'mt-8 w-full sm:w-auto' })}>
            {action.label}
          </Link>
        )}
      </div>
    </main>
  )
}
