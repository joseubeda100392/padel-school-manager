export function DevError({ errors }: { errors: (string | null | undefined)[] }) {
  const active = errors.filter(Boolean)
  if (!active.length) return null
  return (
    <div className="mb-4 space-y-1 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-600">DEV — Error de query</p>
      {active.map((e, i) => (
        <p key={i} className="break-all font-mono text-xs text-red-700">{e}</p>
      ))}
    </div>
  )
}
