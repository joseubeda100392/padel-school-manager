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

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data: profile }, { data: bookings }, { data: bag }] = await Promise.all([
      supabase.from('users').select('current_level_id').eq('id', user.id).single(),
      supabase.from('bookings').select('schedule_id').eq('student_id', user.id).neq('status', 'cancelled'),
      supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
    ])

    const levelId = profile?.current_level_id ?? null
    setStudentLevelId(levelId)

    // Traer clases abiertas a todos + las del nivel del alumno
    let schedulesQuery = supabase
      .from('schedules')
      .select('*, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name, color)')
      .eq('is_active', true)
      .order('start_time')

    if (levelId) {
      // Clases sin nivel (abiertas) O clases del nivel del alumno
      schedulesQuery = schedulesQuery.or(`level_id.is.null,level_id.eq.${levelId}`)
    } else {
      // Sin nivel asignado: solo ve clases abiertas
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

  async function bookClass(scheduleId: string) {
    if (bagBalance <= 0) {
      Alert.alert(
        'Sin clases en bolsa',
        '¿Qué quieres hacer?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Comprar bono', onPress: () => router.push('/(student)/buy-pack') },
          { text: 'Pagar esta clase', onPress: () => payClass(scheduleId) },
        ]
      )
      return
    }
    setBooking(scheduleId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const clubId = user?.user_metadata?.club_id ?? null

    const { error } = await supabase.from('bookings').insert({
      schedule_id: scheduleId,
      student_id: userId,
      status: 'confirmed',
      source: 'bag',
      club_id: clubId,
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
    Alert.alert('Cancelar reserva', '¿Seguro que quieres cancelar?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          const supabase = createClient()
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('schedule_id', scheduleId)
            .eq('student_id', userId)
          await supabase.from('class_bag').update({ balance: bagBalance + 1 }).eq('user_id', userId)
          setBagBalance((b) => b + 1)
          setMyBookings((prev) => { const s = new Set(prev); s.delete(scheduleId); return s })
        }
      }
    ])
  }

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Clases</Text>
        <Text className="text-sm text-gray-500">
          Bolsa: <Text className="font-semibold text-green-600">{bagBalance} clases</Text>
        </Text>
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
          return (
            <View key={s.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <View className="rounded-lg bg-green-50 px-2 py-1">
                      <Text className="text-xs font-semibold text-green-700">
                        {days[start.getDay()]}
                      </Text>
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
                  <Text className="mt-1.5 text-sm text-gray-500">
                    {s.court?.name} · {s.coach?.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    Máx. {s.max_students} alumnos · {s.recurrence === 'weekly' ? 'Semanal' : s.recurrence === 'biweekly' ? 'Quincenal' : 'Única'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => isBooked ? cancelBooking(s.id) : bookClass(s.id)}
                  disabled={booking === s.id}
                  className={`ml-3 rounded-xl px-4 py-2 ${isBooked ? 'bg-red-50' : 'bg-green-600'}`}
                >
                  <Text className={`text-sm font-semibold ${isBooked ? 'text-red-600' : 'text-white'}`}>
                    {booking === s.id ? '...' : isBooked ? 'Cancelar' : 'Reservar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
