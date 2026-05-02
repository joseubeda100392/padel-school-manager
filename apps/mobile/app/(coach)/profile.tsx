import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '@/lib/supabase'

export default function CoachProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [stats, setStats] = useState({ totalClasses: 0 })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return

    setUserId(authUser.id)

    const [{ data: userData }, { count }] = await Promise.all([
      supabase.from('users').select('name, email, avatar_url').eq('id', authUser.id).single(),
      supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('coach_id', authUser.id).eq('is_active', true),
    ])

    setUser(userData)
    setStats({ totalClasses: count ?? 0 })
    setLoading(false)
  }

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para cambiar la foto.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const supabase = createClient()
      const uri = result.assets[0].uri
      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${userId}/avatar.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar.jpg`)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId)
      setUser((prev: any) => ({ ...prev, avatar_url: publicUrl }))
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo subir la foto')
    } finally {
      setUploading(false)
    }
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

  const initials = (user?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4 py-6">
        <Text className="mb-6 text-2xl font-bold text-gray-900">Mi Perfil</Text>

        <View className="mb-4 items-center rounded-2xl bg-white p-6 shadow-sm">
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploading} className="mb-4">
            {user?.avatar_url ? (
              <View className="relative">
                <Image
                  source={{ uri: user.avatar_url }}
                  className="h-24 w-24 rounded-full"
                  style={{ borderWidth: 3, borderColor: '#7c3aed' }}
                />
                {uploading && (
                  <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                    <ActivityIndicator color="white" />
                  </View>
                )}
              </View>
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-purple-100" style={{ borderWidth: 3, borderColor: '#7c3aed' }}>
                {uploading ? (
                  <ActivityIndicator color="#7c3aed" />
                ) : (
                  <Text className="text-2xl font-bold text-purple-700">{initials}</Text>
                )}
              </View>
            )}
            <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full bg-purple-600">
              <Text className="text-xs text-white">✎</Text>
            </View>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">{user?.name}</Text>
          <Text className="mt-0.5 text-sm text-gray-400">{user?.email}</Text>
          <View className="mt-3 rounded-full bg-purple-100 px-3 py-1">
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
