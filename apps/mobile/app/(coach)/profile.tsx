import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

export default function CoachProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({ totalClasses: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    const [{ data: userData }, { count }] = await Promise.all([
      supabase.from('users').select('name, email').eq('id', authUser.id).single(),
      supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('coach_id', authUser.id).eq('is_active', true),
    ])

    setUser(userData)
    setStats({ totalClasses: count ?? 0 })
    setLoading(false)
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-400">Cargando...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4 py-6">
        <Text className="mb-6 text-2xl font-bold text-gray-900">Mi Perfil</Text>

        <View className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="text-lg font-bold text-gray-900">{user?.name}</Text>
          <Text className="mt-0.5 text-sm text-gray-400">{user?.email}</Text>
          <View className="mt-3 self-start rounded-full bg-purple-100 px-3 py-1">
            <Text className="text-xs font-semibold text-purple-700">Monitor</Text>
          </View>
        </View>

        <View className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="mb-1 text-sm text-gray-500">Clases activas asignadas</Text>
          <Text className="text-3xl font-bold text-green-600">{stats.totalClasses}</Text>
        </View>

        <TouchableOpacity className="mt-2 rounded-xl bg-red-50 py-4" onPress={handleLogout}>
          <Text className="text-center font-medium text-red-600">Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
