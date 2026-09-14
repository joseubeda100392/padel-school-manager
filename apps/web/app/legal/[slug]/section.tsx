export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </div>
  )
}

export function LegalMissingData({ fields }: { fields: string[] }) {
  return (
    <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-xs text-yellow-800">
      Falta configurar: {fields.join(', ')}. El club puede rellenarlo en Configuración → Pagos → Datos legales.
    </div>
  )
}
