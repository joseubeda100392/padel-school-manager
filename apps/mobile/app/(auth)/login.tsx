import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

type Step = 'club' | 'login'

interface Club {
  id: string
  name: string
  slug: string
}

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('club')
  const [clubSearch, setClubSearch] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function searchClubs(text: string) {
    setClubSearch(text)
    if (text.length < 2) {
      setClubs([])
      return
    }
    setSearchLoading(true)
    const { data } = await supabase
      .from('clubs')
      .select('id, name, slug')
      .eq('is_active', true)
      .ilike('name', `%${text}%`)
      .limit(8)
    setClubs(data ?? [])
    setSearchLoading(false)
  }

  function selectClub(club: Club) {
    setSelectedClub(club)
    setClubs([])
    setClubSearch(club.name)
    setStep('login')
  }

  async function handleLogin() {
    if (!selectedClub) return
    setLoading(true)

    const { error, data } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      Alert.alert('Error', error.message)
      setLoading(false)
      return
    }

    // Verificar que el usuario pertenece al club seleccionado
    const { data: userData } = await supabase
      .from('users')
      .select('role, club_id')
      .eq('id', data.user.id)
      .single()

    if (userData?.club_id && userData.club_id !== selectedClub.id) {
      await supabase.auth.signOut()
      Alert.alert('Error', 'No perteneces a este club. Selecciona el club correcto.')
      setLoading(false)
      setStep('club')
      return
    }

    const role = userData?.role ?? data.user.user_metadata?.role
    if (role === 'coach') {
      router.replace('/(coach)/home')
    } else {
      router.replace('/(student)/home')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="mb-10 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-green-600">
            <Text className="text-2xl font-bold text-white">P</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">Padel School</Text>
          <Text className="mt-1 text-gray-500">
            {step === 'club' ? 'Busca tu club' : selectedClub?.name}
          </Text>
        </View>

        {/* Paso 1: Seleccionar club */}
        {step === 'club' && (
          <View className="gap-4">
            <View>
              <TextInput
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
                placeholder="Nombre del club..."
                value={clubSearch}
                onChangeText={searchClubs}
                autoCapitalize="words"
              />
              {searchLoading && (
                <ActivityIndicator className="mt-2" color="#16a34a" />
              )}
              {clubs.length > 0 && (
                <View className="mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <FlatList
                    data={clubs}
                    keyExtractor={(c) => c.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => selectClub(item)}
                        className="border-b border-gray-50 px-4 py-3"
                      >
                        <Text className="font-medium text-gray-900">{item.name}</Text>
                        <Text className="text-xs text-gray-400">{item.slug}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
              {clubSearch.length >= 2 && clubs.length === 0 && !searchLoading && (
                <Text className="mt-2 text-center text-sm text-gray-400">
                  No se encontró ningún club
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Paso 2: Login */}
        {step === 'login' && (
          <View className="gap-4">
            <TouchableOpacity
              onPress={() => { setStep('club'); setEmail(''); setPassword('') }}
              className="mb-2"
            >
              <Text className="text-sm text-green-600">← Cambiar club</Text>
            </TouchableOpacity>

            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <TouchableOpacity
              className={`mt-2 rounded-xl py-4 ${loading ? 'bg-green-400' : 'bg-green-600'}`}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text className="text-center font-semibold text-white">
                {loading ? 'Accediendo...' : 'Entrar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
