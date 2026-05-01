import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

export default function CoachHomeScreen() {
  const [user, setUser] = useState<any>(null)
  const [todayClasses, setTodayClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [{ data: userData }, { data: classes }] = await Promise.all([
      supabase.from('users').select('name').eq('id', authUser.id).single(),
      supabase
        .from('schedules')
        .select('*, court:courts(name), bookings(count)')
        .eq('coach_id', authUser.id)
        .eq('is_active', true)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time'),
    ])

    setUser(userData)
    setTodayClasses(classes ?? [])
    setLoading(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4 py-6">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Hola, {user?.name?.split(' ')[0]} 👋
            </Text>
            <Text className="text-sm text-gray-500">Panel de monitor</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} className="rounded-lg bg-gray-100 px-3 py-1.5">
            <Text className="text-sm text-gray-600">Salir</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-5 rounded-2xl bg-green-600 p-5">
          <Text className="text-sm font-medium text-green-100">Clases hoy</Text>
          <Text className="mt-1 text-4xl font-bold text-white">{todayClasses.length}</Text>
        </View>

        <View className="rounded-2xl bg-white p-5 shadow-sm">
          <Text className="mb-4 font-semibold text-gray-900">Clases de hoy</Text>
          {loading && <Text className="text-gray-400">Cargando...</Text>}
          {!loading && todayClasses.length === 0 && (
            <Text className="text-gray-400">No tienes clases programadas para hoy.</Text>
          )}
          {todayClasses.map((s: any) => {
            const start = new Date(s.start_time)
            const end = new Date(s.end_time)
            const enrolled = s.bookings?.[0]?.count ?? 0
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => router.push('/(coach)/classes')}
                className="mb-3 rounded-xl border border-gray-100 p-4 last:mb-0"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-gray-900">
                    {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View className="rounded-full bg-green-100 px-2.5 py-1">
                    <Text className="text-xs font-semibold text-green-700">
                      {enrolled}/{s.max_students}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1 text-sm text-gray-500">{s.court?.name}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View className="mt-4 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 rounded-2xl bg-white p-4 shadow-sm"
            onPress={() => router.push('/(coach)/classes')}
          >
            <Text className="text-2xl">📅</Text>
            <Text className="mt-2 font-medium text-gray-900">Mis clases</Text>
            <Text className="text-xs text-gray-400">Ver todos los horarios</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 rounded-2xl bg-white p-4 shadow-sm"
            onPress={() => router.push('/(coach)/materials')}
          >
            <Text className="text-2xl">📚</Text>
            <Text className="mt-2 font-medium text-gray-900">Material</Text>
            <Text className="text-xs text-gray-400">Todos los PDFs</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
