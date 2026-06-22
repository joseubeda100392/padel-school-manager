'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const statusBadge: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  closed:    'bg-red-100 text-red-600',
}

const statusLabel: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviada',
  converted: 'Convertida',
  closed:    'Cerrada',
}

export default function CampaignsList({ campaigns: initial }: { campaigns: any[] }) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState(initial)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function deleteCampaign(id: string) {
    if (!confirm('¿Borrar esta campaña?')) return
    setDeleting(id)
    const res = await fetch(`/api/admin/pista-viva/campaigns?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      router.refresh()
    }
    setDeleting(null)
  }

  if (!campaigns.length) {
    return (
      <tr>
        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
          No hay campañas aún. Pulsa &quot;Buscar pistas libres&quot; para empezar.
        </td>
      </tr>
    )
  }

  return (
    <>
      {campaigns.map((c) => (
        <tr key={c.id} className="hover:bg-gray-50">
          <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.court_name}</td>
          <td className="px-6 py-4 text-sm text-gray-600">
            {new Date(c.slot_datetime).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' '}
            {new Date(c.slot_datetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">{c.levels?.name ?? '—'}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{c.players_joined}/{c.players_needed}</td>
          <td className="px-6 py-4 text-sm text-gray-600">{c.click_count}</td>
          <td className="px-6 py-4">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[c.status] ?? c.status}
            </span>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <a href={`/dashboard/pista-viva/${c.id}`} className="text-sm text-brand-600 hover:underline">
                Ver →
              </a>
              <button
                onClick={() => deleteCampaign(c.id)}
                disabled={deleting === c.id}
                className="text-sm text-red-400 hover:text-red-600 disabled:opacity-40"
              >
                {deleting === c.id ? '...' : 'Borrar'}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}
