export function DevError({ errors }: { errors: (string | null | undefined)[] }) {
  const active = errors.filter(Boolean)
  if (!active.length) return null
  return (
    <div className="mb-4 space-y-1 rounded-control border border-danger-ink/30 bg-danger-soft p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-danger-ink">DEV — Error de query</p>
      {active.map((e, i) => (
        <p key={i} className="break-all font-mono text-xs text-danger-ink">{e}</p>
      ))}
    </div>
  )
}
