import { useEffect, useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Asistí', bg: '#dcfce7', text: '#15803d' },
  no_show: { label: 'No asistí', bg: '#fee2e2', text: '#dc2626' },
  cancelled: { label: 'Cancelada', bg: '#f3f4f6', text: '#6b7280' },
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function ClassHistoryScreen() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('bookings')
      .select('*, schedule:schedules(start_time, end_time, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name, color))')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60)

    setBookings(data ?? [])
    setLoading(false)
  }

  const attended = bookings.filter((b) => b.status === 'confirmed').length
  const missed = bookings.filter((b) => b.status === 'no_show').length

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-green-600">← Atrás</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Historial de clases</Text>
        </View>
        {!loading && bookings.length > 0 && (
          <View className="mt-3 flex-row gap-4">
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <Text className="text-sm text-gray-500">{attended} asistidas</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <Text className="text-sm text-gray-500">{missed} no asistí</Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {loading && (
          <ActivityIndicator color="#16a34a" size="large" style={{ marginTop: 40 }} />
        )}
        {!loading && bookings.length === 0 && (
          <Text className="mt-12 text-center text-gray-400">
            Aún no tienes clases registradas.
          </Text>
        )}

        {bookings.map((b: any) => {
          const start = b.schedule ? new Date(b.schedule.start_time) : null
          const end = b.schedule ? new Date(b.schedule.end_time) : null
          const status = STATUS_CONFIG[b.status] ?? { label: b.status, bg: '#f3f4f6', text: '#6b7280' }

          return (
            <View key={b.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="mb-1.5 flex-row flex-wrap items-center gap-2">
                    {start && (
                      <View className="rounded-lg bg-gray-100 px-2 py-1">
                        <Text className="text-xs font-semibold text-gray-600">
                          {DAYS[start.getDay()]}
                        </Text>
                      </View>
                    )}
                    {start && end && (
                      <Text className="font-semibold text-gray-900">
                        {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                    {b.schedule?.level && (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: b.schedule.level.color }}>
                        <Text className="text-xs font-semibold text-white">{b.schedule.level.name}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-gray-500">
                    {b.schedule?.court?.name ?? '—'} · {b.schedule?.coach?.name ?? '—'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-gray-400">
                    {new Date(b.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
                <View className="ml-3 rounded-full px-3 py-1" style={{ backgroundColor: status.bg }}>
                  <Text className="text-xs font-medium" style={{ color: status.text }}>
                    {status.label}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
