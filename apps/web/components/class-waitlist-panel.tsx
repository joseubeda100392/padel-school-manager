import { Hourglass } from 'lucide-react'
import { getAdminClient } from '@/lib/supabase/admin'
import { formatLongDate } from '@/lib/format-date'
import { Card, CardHeader } from '@/components/ui/card'

// Quién está en reserva en las próximas fechas de una clase, en el orden en
// que entrarían. Solo lectura: el alumno se apunta y se quita desde su app.
export async function ClassWaitlistPanel({ scheduleId }: { scheduleId: string }) {
  const admin = getAdminClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const { data, error } = await admin
    .from('class_waitlist')
    .select('id, class_date, student:users!class_waitlist_student_id_fkey(name)')
    .eq('schedule_id', scheduleId)
    .eq('status', 'waiting')
    .gte('class_date', today)
    .order('class_date')
    .order('created_at')
  if (error || !data?.length) return null

  const byDate = new Map<string, string[]>()
  for (const row of data as any[]) {
    const list = byDate.get(row.class_date) ?? []
    list.push(row.student?.name ?? 'Alumno')
    byDate.set(row.class_date, list)
  }

  return (
    <Card>
      <CardHeader
        title="En reserva"
        description="Si se libera una plaza con más de 24 h de antelación, entra el primero y se le descuenta 1 clase de la bolsa"
      />
      <ul className="divide-y divide-line border-t border-line">
        {[...byDate.entries()].map(([date, names]) => (
          <li key={date} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
            <p className="flex min-w-[10rem] items-center gap-2 text-label text-ink">
              <Hourglass className="h-4 w-4 text-ink-3" aria-hidden />
              {formatLongDate(date)}
            </p>
            <ol className="text-body text-ink-2">
              {names.map((name, i) => <li key={i}>{i + 1}º · {name}</li>)}
            </ol>
          </li>
        ))}
      </ul>
    </Card>
  )
}
