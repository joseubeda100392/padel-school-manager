import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://web-production-f1316.up.railway.app'

export default function StudentScheduleScreen() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [myBookings, setMyBookings] = useState<Set<string>>(new Set())
  const [bagBalance, setBagBalance] = useState(0)
  const [userId, setUserId] = useState('')
  const [studentLevelId, setStudentLevelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<string | null>(null)
  const [price60, setPrice60] = useState(1200)
  const [price90, setPrice90] = useState(1500)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data: profile }, { data: bookings }, { data: bag }, { data: cfg }] = await Promise.all([
      supabase.from('users').select('current_level_id').eq('id', user.id).single(),
      supabase.from('bookings').select('schedule_id').eq('student_id', user.id).neq('status', 'cancelled'),
      supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
      supabase.from('app_config').select('key, value').in('key', ['pay_per_class_price_60', 'pay_per_class_price_90']),
    ])

    if (cfg) {
      cfg.forEach((row: any) => {
        if (row.key === 'pay_per_class_price_60') setPrice60(Number(row.value))
        if (row.key === 'pay_per_class_price_90') setPrice90(Number(row.value))
      })
    }

    const levelId = profile?.current_level_id ?? null
    setStudentLevelId(levelId)

    let schedulesQuery = supabase
      .from('schedules')
      .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name, color)')
      .eq('is_active', true)
      .order('start_time')

    if (levelId) {
      schedulesQuery = schedulesQuery.or(`level_id.is.null,level_id.eq.${levelId}`)
    } else {
      schedulesQuery = schedulesQuery.is('level_id', null)
    }

    const { data: scheds } = await schedulesQuery

    setSchedules(scheds ?? [])
    setMyBookings(new Set((bookings ?? []).map((b: any) => b.schedule_id)))
    setBagBalance(bag?.balance ?? 0)
    setLoading(false)
  }

  async function payClass(scheduleId: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    setBooking(scheduleId)
    try {
      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'single_class', scheduleId }),
      })
      const json = await res.json()
      if (!res.ok) { Alert.alert('Error', json.error); setBooking(null); return }
      const payUrl = `${API_BASE}/pay?url=${encodeURIComponent(json.redsysUrl)}&Ds_MerchantParameters=${encodeURIComponent(json.merchantParameters)}&Ds_Signature=${encodeURIComponent(json.signature)}`
      await Linking.openURL(payUrl)
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el pago')
    }
    setBooking(null)
  }

  async function bookWithBag(scheduleId: string) {
    if (bagBalance <= 0) {
      Alert.alert(
        'Sin clases en bolsa',
        'No te quedan clases disponibles.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Comprar bono', onPress: () => router.push('/(student)/buy-pack') },
        ]
      )
      return
    }
    setBooking(scheduleId)
    const supabase = createClient()

    const { error } = await supabase.from('bookings').insert({
      schedule_id: scheduleId,
      student_id: userId,
      status: 'confirmed',
      source: 'bag',
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      await supabase.from('class_bag').update({ balance: bagBalance - 1 }).eq('user_id', userId)
      setBagBalance((b) => b - 1)
      setMyBookings((prev) => new Set([...prev, scheduleId]))
      Alert.alert('¡Reservado!', 'Te has apuntado a la clase correctamente.')
    }
    setBooking(null)
  }

  async function cancelBooking(scheduleId: string) {
    const supabase = createClient()

    const { data: configRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'cancellation_hours')
      .single()
    const cancellationHours = configRow ? Number(configRow.value) : 24

    const sched = schedules.find((s) => s.id === scheduleId)
    let isLate = false
    if (sched && cancellationHours > 0) {
      const base = new Date(sched.start_time)
      const now = new Date()
      const next = new Date(now)
      next.setHours(base.getHours(), base.getMinutes(), 0, 0)
      const todayDow = now.getDay()
      const classDow = base.getDay()
      let daysAhead = (classDow - todayDow + 7) % 7
      if (daysAhead === 0 && next <= now) daysAhead = 7
      next.setDate(next.getDate() + daysAhead)
      const hoursUntil = (next.getTime() - now.getTime()) / 3600000
      isLate = hoursUntil < cancellationHours
    }

    const message = isLate
      ? `La clase empieza en menos de ${cancellationHours}h. Se cancelará pero NO se devolverá la clase a tu bolsa.`
      : '¿Seguro que quieres cancelar? Se devolverá la clase a tu bolsa.'

    Alert.alert('Cancelar reserva', message, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('schedule_id', scheduleId)
            .eq('student_id', userId)
          if (!isLate) {
            await supabase.from('class_bag').update({ balance: bagBalance + 1 }).eq('user_id', userId)
            setBagBalance((b) => b + 1)
          }
          setMyBookings((prev) => { const s = new Set(prev); s.delete(scheduleId); return s })

          // Notificar a alumnos del mismo nivel que hay plaza libre
          try {
            const { data: { session } } = await supabase.auth.getSession()
            fetch(`${API_BASE}/api/notifications/class-spot-available`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ scheduleId }),
            })
          } catch {}
        }
      }
    ])
  }

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  function getClassPrice(startTime: string, endTime: string) {
    const durationMin = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    return durationMin <= 65 ? price60 : price90
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Clases</Text>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-sm text-gray-500">
            Bolsa: <Text className="font-semibold text-green-600">{bagBalance} {bagBalance === 1 ? 'clase' : 'clases'}</Text>
          </Text>
          <TouchableOpacity onPress={() => router.push('/(student)/buy-pack')}>
            <Text className="text-sm font-medium text-green-600">+ Comprar bono</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {loading && <Text className="text-center text-gray-400">Cargando...</Text>}
        {!loading && schedules.length === 0 && (
          <Text className="mt-8 text-center text-gray-400">
            {studentLevelId ? 'No hay clases disponibles para tu nivel.' : 'No hay clases programadas.'}
          </Text>
        )}

        {schedules.map((s: any) => {
          const isBooked = myBookings.has(s.id)
          const start = new Date(s.start_time)
          const end = new Date(s.end_time)
          const price = getClassPrice(s.start_time, s.end_time)
          const isBusy = booking === s.id

          return (
            <View key={s.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
              <View className="flex-row items-center gap-2 flex-wrap mb-1.5">
                <View className="rounded-lg bg-green-50 px-2 py-1">
                  <Text className="text-xs font-semibold text-green-700">{days[start.getDay()]}</Text>
                </View>
                <Text className="font-semibold text-gray-900">
                  {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {s.level && (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: s.level.color }}>
                    <Text className="text-xs font-semibold text-white">{s.level.name}</Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-gray-500">{s.court?.name} · {s.coach?.name}</Text>
              <Text className="mt-0.5 text-xs text-gray-400">
                Máx. {s.max_students} alumnos · {s.recurrence === 'weekly' ? 'Semanal' : s.recurrence === 'biweekly' ? 'Quincenal' : 'Única'}
              </Text>

              <View className="mt-3">
                {isBooked ? (
                  <TouchableOpacity
                    onPress={() => cancelBooking(s.id)}
                    disabled={isBusy}
                    className="rounded-xl bg-red-50 py-2.5"
                  >
                    <Text className="text-center text-sm font-semibold text-red-600">
                      {isBusy ? '...' : 'Cancelar reserva'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => bookWithBag(s.id)}
                      disabled={isBusy}
                      className={`flex-1 rounded-xl py-2.5 ${bagBalance > 0 ? 'bg-green-600' : 'bg-gray-200'}`}
                    >
                      <Text className={`text-center text-sm font-semibold ${bagBalance > 0 ? 'text-white' : 'text-gray-500'}`}>
                        {isBusy ? '...' : `Bolsa (${bagBalance})`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => payClass(s.id)}
                      disabled={isBusy}
                      className="flex-1 rounded-xl border border-green-600 py-2.5"
                    >
                      <Text className="text-center text-sm font-semibold text-green-700">
                        {isBusy ? '...' : `Pagar ${(price / 100).toFixed(2)} €`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
