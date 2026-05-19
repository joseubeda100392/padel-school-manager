import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function StudentProgressPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: checklists } = await admin
    .from('student_checklists')
    .select('id, title, created_at, items:checklist_items(id, text, sort_order, completed_at)')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const list = checklists ?? []

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Mi progreso</h1>

      {list.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-400">Todavía no tienes objetivos asignados.</p>
          <p className="mt-1 text-sm text-gray-300">Tu monitor los irá añadiendo aquí.</p>
        </div>
      )}

      <div className="space-y-4">
        {list.map((checklist: any) => {
          const items = [...(checklist.items ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)
          const done = items.filter((i: any) => i.completed_at).length
          const total = items.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0

          return (
            <div key={checklist.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{checklist.title}</h2>
                {total > 0 && (
                  <span className="shrink-0 text-sm font-medium text-gray-500">{done}/{total}</span>
                )}
              </div>

              {total > 0 && (
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-green-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {items.length === 0 && (
                <p className="text-sm text-gray-400">Sin objetivos todavía.</p>
              )}

              <ul className="space-y-2">
                {items.map((item: any) => (
                  <li key={item.id} className="flex items-center gap-3">
                    {item.completed_at ? (
                      <svg className="h-5 w-5 shrink-0 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 shrink-0 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 1.5a8.25 8.25 0 100 16.5 8.25 8.25 0 000-16.5z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`text-sm ${item.completed_at ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
