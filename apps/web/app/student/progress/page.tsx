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

  const list = (checklists ?? []).map((c: any) => ({
    ...c,
    items: [...(c.items ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  }))

  const totalItems = list.reduce((acc, c) => acc + c.items.length, 0)
  const totalDone = list.reduce((acc, c) => acc + c.items.filter((i: any) => i.completed_at).length, 0)
  const globalPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

  return (
    <div className="max-w-lg">
      {/* Cabecera con progreso global */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-green-100">Mi progreso</p>
        {list.length === 0 ? (
          <p className="mt-1 text-2xl font-bold">Sin objetivos aún</p>
        ) : (
          <>
            <p className="mt-1 text-4xl font-bold">
              {totalItems > 0 ? <>{globalPct}<span className="text-2xl font-normal text-green-200">%</span></> : '—'}
            </p>
            <p className="mt-0.5 text-sm text-green-100">
              {totalItems > 0 ? `${totalDone} de ${totalItems} objetivos conseguidos` : `${list.length} checklist${list.length !== 1 ? 's' : ''} asignado${list.length !== 1 ? 's' : ''}`}
            </p>
            {totalItems > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-green-400/40">
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${globalPct}%` }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Sin checklists */}
      {list.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-gray-500">Tu monitor todavía no ha asignado objetivos</p>
          <p className="mt-1 text-sm text-gray-400">Aparecerán aquí cuando los añada.</p>
        </div>
      )}

      {/* Checklists */}
      <div className="space-y-4">
        {list.map((checklist: any) => {
          const done = checklist.items.filter((i: any) => i.completed_at).length
          const total = checklist.items.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const allDone = total > 0 && done === total

          return (
            <div key={checklist.id} className={`rounded-xl bg-white shadow-sm overflow-hidden ${allDone ? 'ring-1 ring-green-200' : ''}`}>
              {/* Header del checklist */}
              <div className={`flex items-center justify-between gap-3 px-5 py-4 ${allDone ? 'bg-green-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${allDone ? 'bg-green-500' : 'bg-gray-100'}`}>
                    {allDone ? (
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <h2 className={`font-semibold truncate ${allDone ? 'text-green-800' : 'text-gray-900'}`}>{checklist.title}</h2>
                </div>
                {total > 0 && (
                  <span className={`shrink-0 text-sm font-semibold ${allDone ? 'text-green-600' : 'text-gray-400'}`}>
                    {done}/{total}
                  </span>
                )}
              </div>

              {/* Barra de progreso */}
              {total > 0 && (
                <div className="h-1 w-full bg-gray-100">
                  <div
                    className={`h-1 transition-all ${allDone ? 'bg-green-500' : 'bg-green-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {/* Items */}
              <div className="px-5 py-3">
                <ul className="space-y-2.5">
                  {checklist.items.map((item: any) => (
                    <li key={item.id} className="flex items-start gap-3">
                      {item.completed_at ? (
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 1.5a8.25 8.25 0 100 16.5 8.25 8.25 0 000-16.5z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={`text-sm leading-relaxed ${item.completed_at ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
