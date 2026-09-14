import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  notificationType: string = 'admin_message',
) {
  if (!userIds.length) return

  // Lazy init: evita crash en build (las env vars solo existen en runtime)
  webpush.setVapidDetails(
    'mailto:admin@padel.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // club_id de cada destinatario — sin esto la notificación quedaba
  // huérfana (nunca se limpiaba si algún día se borraba el club entero).
  const { data: recipients } = await admin.from('users').select('id, club_id').in('id', userIds)
  const clubIdByUser = new Map((recipients ?? []).map(r => [r.id, r.club_id]))

  // Persistir notificación en DB para cada usuario
  await admin.from('notifications').insert(
    userIds.map(userId => ({
      user_id: userId,
      club_id: clubIdByUser.get(userId) ?? null,
      type: notificationType,
      title: payload.title,
      body: payload.body,
      data: payload.url ? { url: payload.url } : null,
      is_read: false,
    }))
  )

  // Enviar push a los que tengan suscripción activa
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subs?.length) return

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  )

  // Limpiar suscripciones expiradas (410 Gone)
  const gone: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason as any)?.statusCode === 410) {
      gone.push(subs[i].endpoint)
    }
  })
  if (gone.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', gone)
  }
}
