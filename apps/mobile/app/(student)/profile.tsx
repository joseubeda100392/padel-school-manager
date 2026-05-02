import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { createClient } from '@/lib/supabase'

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [levelHistory, setLevelHistory] = useState<any[]>([])
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

    const [{ data: userData }, { data: history }] = await Promise.all([
      supabase.from('users').select('name, email, avatar_url, current_level_id, currentLevel:levels(name, color, description)').eq('id', authUser.id).single(),
      supabase.from('user_levels').select('created_at, level:levels(name, color)').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(10),
    ])

    setUser(userData)
    setLevelHistory(history ?? [])
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

  const level = user?.currentLevel
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
                  style={{ borderWidth: 3, borderColor: '#16a34a' }}
                />
                {uploading && (
                  <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                    <ActivityIndicator color="white" />
                  </View>
                )}
              </View>
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-green-100" style={{ borderWidth: 3, borderColor: '#16a34a' }}>
                {uploading ? (
                  <ActivityIndicator color="#16a34a" />
                ) : (
                  <Text className="text-2xl font-bold text-green-700">{initials}</Text>
                )}
              </View>
            )}
            <View className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full bg-green-600">
              <Text className="text-xs text-white">✎</Text>
            </View>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900">{user?.name}</Text>
          <Text className="mt-0.5 text-sm text-gray-400">{user?.email}</Text>
        </View>

        <View className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <Text className="mb-2 text-sm font-medium text-gray-500">Nivel actual</Text>
          {level ? (
            <View className="flex-row items-center gap-2">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: level.color }} />
              <Text className="text-lg font-semibold text-gray-900">{level.name}</Text>
            </View>
          ) : (
            <Text className="text-gray-400">Sin nivel asignado</Text>
          )}
          {level?.description && (
            <Text className="mt-1 text-sm text-gray-500">{level.description}</Text>
          )}
        </View>

        {levelHistory.length > 0 && (
          <View className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
            <Text className="mb-3 font-semibold text-gray-900">Mi Progresión</Text>
            {levelHistory.map((entry: any, i: number) => (
              <View key={i} className="mb-2 flex-row items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                <View className="flex-row items-center gap-2">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.level?.color }} />
                  <Text className="text-sm font-medium text-gray-800">{entry.level?.name}</Text>
                </View>
                <Text className="text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleDateString('es-ES')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity className="mt-2 rounded-xl bg-red-50 py-4" onPress={handleLogout}>
          <Text className="text-center font-medium text-red-600">Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
