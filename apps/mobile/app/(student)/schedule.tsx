import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://web-production-f1316.up.railway.app'
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function StudentScheduleScreen() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [enrolledCounts, setEnrolledCounts] = useState<Record<string, number>>({})
  const [myBookings, setMyBookings] = useState<Set<string>>(new Set())
  const [bagBalance, setBagBalance] = useState(0)
  const [userId, setUserId] = useState('')
  const [studentLevelId, setStudentLevelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [price60, setPrice60] = useState(1200)
  const [price90, setPrice90] = useState(1500)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data: profile }, { data: myBookingRows }, { data: bag }, { data: cfg }] = await Promise.all([
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
    const schedIds = (scheds ?? []).map((s: any) => s.id)

    // Fetch current enrollment counts for all classes
    const [{ data: bookingRows }, { data: groupRows }] = await Promise.all([
      schedIds.length
        ? supabase.from('bookings').select('schedule_id').in('schedule_id', schedIds).neq('status', 'cancelled')
        : Promise.resolve({ data: [] }),
      schedIds.length
        ? supabase.from('group_enrollments').select('schedule_id').in('schedule_id', schedIds).eq('status', 'active')
        : Promise.resolve({ data: [] }),
    ])

    const counts: Record<string, number> = {}
    for (const b of bookingRows ?? []) counts[b.schedule_id] = (counts[b.schedule_id] ?? 0) + 1
    for (const g of groupRows ?? []) counts[g.schedule_id] = (counts[g.schedule_id] ?? 0) + 1

    setSchedules(scheds ?? [])
    setEnrolledCounts(counts)
    setMyBookings(new Set((myBookingRows ?? []).map((b: any) => b.schedule_id)))
    setBagBalance(bag?.balance ?? 0)
    setLoading(false)
  }

  async function bookWithBag(scheduleId: string) {
    setBusy(scheduleId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ scheduleId }),
      })
      const json = await res.json()
      if (!res.ok) {
        Alert.alert('Error', json.error)
      } else {
        setBagBalance(json.newBalance)
        setMyBookings((prev) => new Set([...prev, scheduleId]))
        setEnrolledCounts((prev) => ({ ...prev, [scheduleId]: (prev[scheduleId] ?? 0) + 1 }))
        Alert.alert('¡Apuntado!', 'Te has apuntado a la clase. Se ha descontado 1 clase de tu bolsa.')
      }
    } catch {
      Alert.alert('Error', 'No se pudo realizar la reserva')
    }
    setBusy(null)
  }

  async function payClass(scheduleId: string) {
    setBusy(scheduleId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'single_class', scheduleId }),
      })
      const json = await res.json()
      if (!res.ok) { Alert.alert('Error', json.error); setBusy(null); return }
      const payUrl = `${API_BASE}/pay?url=${encodeURIComponent(json.redsysUrl)}&Ds_MerchantParameters=${encodeURIComponent(json.merchantParameters)}&Ds_Signature=${encodeURIComponent(json.signature)}`
      await Linking.openURL(payUrl)
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el pago')
    }
    setBusy(null)
  }

  async function cancelBooking(scheduleId: string) {
    const supabase = createClient()
    const { data: configRow } = await supabase.from('app_config').select('value').eq('key', 'cancellation_hours').single()
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
      isLate = (next.getTime() - now.getTime()) / 3600000 < cancellationHours
    }

    const message = isLate
      ? `La clase empieza en menos de ${cancellationHours}h. Se cancelará pero NO se devolverá la clase a tu bolsa.`
      : '¿Seguro que quieres cancelar? Se devolverá la clase a tu bolsa.'

    Alert.alert('Cancelar reserva', message, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`${API_BASE}/api/bookings`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ scheduleId, refundBag: !isLate }),
            })
            const json = await res.json()
            if (res.ok) {
              if (json.newBalance !== undefined) setBagBalance(json.newBalance)
              setMyBookings((prev) => { const s = new Set(prev); s.delete(scheduleId); return s })
              setEnrolledCounts((prev) => ({ ...prev, [scheduleId]: Math.max(0, (prev[scheduleId] ?? 1) - 1) }))
              try {
                fetch(`${API_BASE}/api/notifications/class-spot-available`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                  body: JSON.stringify({ scheduleId }),
                })
              } catch {}
            }
          } catch {
            Alert.alert('Error', 'No se pudo cancelar la reserva')
          }
        }
      }
    ])
  }

  const renderItem = useCallback(({ item: s }: { item: any }) => {
    const isBooked = myBookings.has(s.id)
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    const durationMin = (end.getTime() - start.getTime()) / 60000
    const price = durationMin <= 65 ? price60 : price90
    const isBusy = busy === s.id
    const enrolled = enrolledCounts[s.id] ?? 0
    const spots = (s.max_students ?? 0) - enrolled
    const isFull = spots <= 0

    return (
      <View className={`mb-3 rounded-2xl bg-white p-4 shadow-sm ${isFull && !isBooked ? 'opacity-60' : ''}`}>
        <View className="flex-row items-center gap-2 flex-wrap mb-1.5">
          <View className="rounded-lg bg-green-50 px-2 py-1">
            <Text className="text-xs font-semibold text-green-700">{DAYS[start.getDay()]}</Text>
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
          {isFull && !isBooked ? (
            <View className="rounded-full bg-red-100 px-2 py-0.5">
              <Text className="text-xs font-semibold text-red-600">Llena</Text>
            </View>
          ) : (
            <View className="rounded-full bg-gray-100 px-2 py-0.5">
              <Text className="text-xs font-semibold text-gray-500">
                {spots} {spots === 1 ? 'plaza' : 'plazas'}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-sm text-gray-500">{s.court?.name} · {s.coach?.name}</Text>
        <Text className="mt-0.5 text-xs text-gray-400">
          {enrolled}/{s.max_students} alumnos · {s.recurrence === 'weekly' ? 'Semanal' : s.recurrence === 'biweekly' ? 'Quincenal' : 'Única'}
        </Text>

        <View className="mt-3">
          {isBooked ? (
            <TouchableOpacity onPress={() => cancelBooking(s.id)} disabled={isBusy} className="rounded-xl bg-red-50 py-2.5">
              <Text className="text-center text-sm font-semibold text-red-600">
                {isBusy ? '...' : 'Cancelar reserva'}
              </Text>
            </TouchableOpacity>
          ) : isFull ? (
            <View className="rounded-xl bg-gray-100 py-2.5">
              <Text className="text-center text-sm text-gray-400">Sin plazas disponibles</Text>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  if (bagBalance <= 0) {
                    Alert.alert('Sin clases en bolsa', 'No te quedan clases disponibles.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Comprar bono', onPress: () => router.push('/(student)/buy-pack') },
                    ])
                    return
                  }
                  bookWithBag(s.id)
                }}
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
  }, [myBookings, busy, bagBalance, price60, price90, enrolledCounts])

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Clases disponibles</Text>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-sm text-gray-500">
            Bolsa: <Text className="font-semibold text-green-600">{bagBalance} {bagBalance === 1 ? 'clase' : 'clases'}</Text>
          </Text>
          <TouchableOpacity onPress={() => router.push('/(student)/buy-pack')}>
            <Text className="text-sm font-medium text-green-600">+ Comprar bono</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={schedules}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
        ListEmptyComponent={
          loading ? (
            <Text className="text-center text-gray-400">Cargando...</Text>
          ) : (
            <Text className="mt-8 text-center text-gray-400">
              {studentLevelId ? 'No hay clases disponibles para tu nivel.' : 'No hay clases programadas.'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  )
}
