import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'
import { registerPushToken } from '@/lib/push-token'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://web-production-f1316.up.railway.app'
const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return new Date(paidUntil) >= endOfMonth
}

export default function StudentHomeScreen() {
  const [user, setUser] = useState<any>(null)
  const [bag, setBag] = useState<number>(0)
  const [nextClass, setNextClass] = useState<any>(null)
  const [pendingEnrollments, setPendingEnrollments] = useState<any[]>([])
  const [pendingMakeups, setPendingMakeups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const [{ data: userData }, { data: bagData }, { data: schedules }, { data: enrollments }, { data: makeups }] = await Promise.all([
      supabase.from('users').select('name, current_level_id, currentLevel:levels(name, color)').eq('id', authUser.id).single(),
      supabase.from('class_bag').select('balance').eq('user_id', authUser.id).single(),
      supabase.from('bookings')
        .select('*, schedule:schedules(start_time, end_time, is_active, recurrence, court:courts(name), coach:users!schedules_coach_id_fkey(name))')
        .eq('student_id', authUser.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true })
        .limit(20),
      supabase.from('group_enrollments')
        .select('id, monthly_price, paid_until, schedule:schedules(start_time)')
        .eq('student_id', authUser.id)
        .eq('status', 'active'),
      supabase.from('makeups')
        .select('id, original_date, makeup_date, notes, originalSchedule:schedules!makeups_original_schedule_id_fkey(start_time, court:courts(name))')
        .eq('student_id', authUser.id)
        .eq('status', 'pending')
        .order('makeup_date', { ascending: true }),
    ])

    const pending = (enrollments ?? []).filter((e: any) => !isPaidThisMonth(e.paid_until))

    // Próxima clase: clases activas con recurrencia o start_time futuro
    const now = new Date()
    const upcomingBooking = (schedules ?? []).find((b: any) => {
      if (!b.schedule?.is_active) return false
      if (b.schedule.recurrence !== 'none') return true
      return new Date(b.schedule.start_time) > now
    }) ?? null

    setUser(userData)
    setBag(bagData?.balance ?? 0)
    setNextClass(upcomingBooking)
    setPendingEnrollments(pending)
    setPendingMakeups(makeups ?? [])
    setLoading(false)
    registerPushToken(authUser.id)
  }

  async function handlePayFee(enrollmentId: string) {
    setPayingId(enrollmentId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'fixed_group_month', enrollmentId }),
      })
      const json = await res.json()
      if (!res.ok) { Alert.alert('Error', json.error); setPayingId(null); return }
      const payUrl = `${API_BASE}/pay?url=${encodeURIComponent(json.redsysUrl)}&Ds_MerchantParameters=${encodeURIComponent(json.merchantParameters)}&Ds_Signature=${encodeURIComponent(json.signature)}`
      await Linking.openURL(payUrl)
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el pago')
    }
    setPayingId(null)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-400">Cargando...</Text>
      </SafeAreaView>
    )
  }

  const levelColor = (user as any)?.currentLevel?.color ?? '#6b7280'
  const levelName = (user as any)?.currentLevel?.name

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4 py-6">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Hola, {user?.name?.split(' ')[0]} 👋
            </Text>
            {levelName && (
              <View className="mt-1 flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: levelColor }} />
                <Text className="text-sm text-gray-500">{levelName}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleLogout} className="rounded-lg bg-gray-100 px-3 py-1.5">
            <Text className="text-sm text-gray-600">Salir</Text>
          </TouchableOpacity>
        </View>

        {/* Cuotas pendientes de grupo fijo */}
        {pendingEnrollments.map((e: any) => {
          const now = new Date()
          const monthName = MONTH_NAMES[now.getMonth()]
          const year = now.getFullYear()
          const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
          const start = e.schedule?.start_time ? new Date(e.schedule.start_time) : null
          const groupLabel = start ? `${days[start.getDay()]} ${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Grupo fijo'
          const isPaying = payingId === e.id
          return (
            <View key={e.id} className="mb-4 rounded-2xl bg-red-500 p-5">
              <Text className="text-sm font-medium text-red-100">Cuota pendiente · {groupLabel}</Text>
              <Text className="mt-1 text-2xl font-bold text-white">
                {(e.monthly_price / 100).toFixed(2)}€ · {monthName} {year}
              </Text>
              <TouchableOpacity
                onPress={() => handlePayFee(e.id)}
                disabled={isPaying}
                className="mt-4 rounded-xl bg-white py-2.5"
              >
                <Text className="text-center text-sm font-bold text-red-600">
                  {isPaying ? 'Redirigiendo...' : `Pagar cuota ${monthName} · ${(e.monthly_price / 100).toFixed(2)}€`}
                </Text>
              </TouchableOpacity>
            </View>
          )
        })}

        {/* Recuperaciones pendientes */}
        {pendingMakeups.length > 0 && (
          <View className="mb-4 rounded-2xl bg-orange-500 p-5">
            <Text className="text-sm font-medium text-orange-100">
              {pendingMakeups.length === 1 ? 'Tienes 1 recuperación pendiente' : `Tienes ${pendingMakeups.length} recuperaciones pendientes`}
            </Text>
            {pendingMakeups.map((m: any) => {
              const makeupDate = m.makeup_date
                ? new Date(m.makeup_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
                : '—'
              const courtName = m.originalSchedule?.court?.name ?? ''
              return (
                <View key={m.id} className="mt-3 rounded-xl bg-white/20 px-4 py-3">
                  <Text className="font-semibold text-white">Recuperación: {makeupDate}</Text>
                  {courtName ? <Text className="mt-0.5 text-xs text-orange-100">{courtName}</Text> : null}
                  {m.notes ? <Text className="mt-0.5 text-xs text-orange-100">{m.notes}</Text> : null}
                </View>
              )
            })}
          </View>
        )}

        {/* Bolsa de clases */}
        <TouchableOpacity
          className="mb-5 rounded-2xl bg-green-600 p-6"
          onPress={() => router.push('/(student)/schedule')}
        >
          <Text className="mb-1 text-sm font-medium text-green-100">Recuperaciones disponibles</Text>
          <Text className="text-5xl font-bold text-white">{bag}</Text>
          <Text className="mt-1 text-green-100">recuperaciones · Toca para ver horarios</Text>
          <TouchableOpacity
            onPress={() => router.push('/(student)/buy-pack')}
            className="mt-4 self-start rounded-full bg-white/20 px-4 py-1.5"
          >
            <Text className="text-sm font-semibold text-white">+ Comprar bono</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Próxima clase */}
        <View className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="mb-3 font-semibold text-gray-900">Próxima clase</Text>
          {nextClass?.schedule ? (
            <View>
              <Text className="font-medium text-gray-900">
                {new Date(nextClass.schedule.start_time).toLocaleDateString('es-ES', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                {new Date(nextClass.schedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {new Date(nextClass.schedule.end_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text className="mt-0.5 text-sm text-gray-400">
                {nextClass.schedule.court?.name} · {nextClass.schedule.coach?.name}
              </Text>
            </View>
          ) : (
            <Text className="text-gray-400">No tienes clases próximas confirmadas.</Text>
          )}
        </View>

        {/* Accesos rápidos */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 rounded-2xl bg-white p-4 shadow-sm"
            onPress={() => router.push('/(student)/materials')}
          >
            <Text className="text-2xl">📚</Text>
            <Text className="mt-2 font-medium text-gray-900">Material</Text>
            <Text className="text-xs text-gray-400">PDFs de entrenamiento</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 rounded-2xl bg-white p-4 shadow-sm"
            onPress={() => router.push('/(student)/chat')}
          >
            <Text className="text-2xl">💬</Text>
            <Text className="mt-2 font-medium text-gray-900">Soporte</Text>
            <Text className="text-xs text-gray-400">Habla con admin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
