import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'
import { registerPushToken } from '@/lib/push-token'

export default function StudentHomeScreen() {
  const [user, setUser] = useState<any>(null)
  const [bag, setBag] = useState<number>(0)
  const [nextClass, setNextClass] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const [{ data: userData }, { data: bagData }, { data: schedules }] = await Promise.all([
      supabase.from('users').select('name, current_level_id, currentLevel:levels(name, color)').eq('id', authUser.id).single(),
      supabase.from('class_bag').select('balance').eq('user_id', authUser.id).single(),
      supabase.from('bookings')
        .select('*, schedule:schedules(start_time, end_time, court:courts(name), coach:users!schedules_coach_id_fkey(name))')
        .eq('student_id', authUser.id)
        .eq('status', 'confirmed')
        .gte('schedules.start_time', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(1),
    ])

    setUser(userData)
    setBag(bagData?.balance ?? 0)
    setNextClass(schedules?.[0] ?? null)
    setLoading(false)
    registerPushToken(authUser.id)
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

        {/* Bolsa de clases */}
        <TouchableOpacity
          className="mb-5 rounded-2xl bg-green-600 p-6"
          onPress={() => router.push('/(student)/schedule')}
        >
          <Text className="mb-1 text-sm font-medium text-green-100">Tu bolsa de clases</Text>
          <Text className="text-5xl font-bold text-white">{bag}</Text>
          <Text className="mt-1 text-green-100">clases disponibles · Toca para ver horarios</Text>
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
