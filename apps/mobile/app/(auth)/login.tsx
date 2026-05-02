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
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

type Step = 'club' | 'login' | 'register' | 'forgot'

interface Club {
  id: string
  name: string
  slug: string
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://padel-school-manager-production.up.railway.app'

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('club')
  const [clubSearch, setClubSearch] = useState('')
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Registro
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [registering, setRegistering] = useState(false)

  // Recuperar contraseña
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

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

  function goBackToClub() {
    setStep('club')
    setEmail('')
    setPassword('')
    setRegName('')
    setRegEmail('')
    setRegPassword('')
    setRegPassword2('')
    setForgotEmail('')
    setForgotSent(false)
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) {
      Alert.alert('Error', 'Introduce tu email')
      return
    }
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
      redirectTo: 'padelschool://reset-password',
    })
    setForgotLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setForgotSent(true)
    }
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

  async function handleRegister() {
    if (!selectedClub) return

    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      Alert.alert('Error', 'Rellena todos los campos')
      return
    }
    if (regPassword !== regPassword2) {
      Alert.alert('Error', 'Las contraseñas no coinciden')
      return
    }
    if (regPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres')
      return
    }

    setRegistering(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          clubId: selectedClub.id,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        Alert.alert('Error al registrarse', json.error ?? 'Inténtalo de nuevo')
        setRegistering(false)
        return
      }

      // Login automático tras registro
      const { error, data } = await supabase.auth.signInWithPassword({
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
      })

      if (error) {
        Alert.alert('Cuenta creada', 'Ya puedes iniciar sesión con tu email y contraseña.')
        setStep('login')
        setEmail(regEmail.trim().toLowerCase())
        setRegistering(false)
        return
      }

      const role = data.user.user_metadata?.role
      if (role === 'coach') {
        router.replace('/(coach)/home')
      } else {
        router.replace('/(student)/home')
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar. Comprueba tu conexión.')
    }
    setRegistering(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
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
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Nombre del club..."
              value={clubSearch}
              onChangeText={searchClubs}
              autoCapitalize="words"
            />
            {searchLoading && <ActivityIndicator className="mt-2" color="#16a34a" />}
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
        )}

        {/* Paso 2: Login */}
        {step === 'login' && (
          <View className="gap-4">
            <TouchableOpacity onPress={goBackToClub} className="mb-2">
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
                {loading ? 'Accediendo...' : 'Iniciar sesión'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('register')} className="mt-2">
              <Text className="text-center text-sm text-gray-500">
                ¿No tienes cuenta?{' '}
                <Text className="font-semibold text-green-600">Regístrate</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setForgotEmail(email); setStep('forgot') }} className="mt-1">
              <Text className="text-center text-sm text-gray-400">¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Paso: Recuperar contraseña */}
        {step === 'forgot' && (
          <View className="gap-4">
            <TouchableOpacity onPress={() => setStep('login')} className="mb-2">
              <Text className="text-sm text-green-600">← Volver al login</Text>
            </TouchableOpacity>

            <Text className="text-center text-lg font-bold text-gray-900">Recuperar contraseña</Text>

            {forgotSent ? (
              <View className="items-center gap-3 rounded-xl bg-green-50 p-6">
                <Text className="text-4xl">📧</Text>
                <Text className="text-center font-semibold text-green-800">
                  ¡Email enviado!
                </Text>
                <Text className="text-center text-sm text-green-700">
                  Revisa tu bandeja de entrada y sigue el enlace para crear una nueva contraseña.
                </Text>
                <TouchableOpacity onPress={() => setStep('login')} className="mt-2">
                  <Text className="text-sm font-semibold text-green-600">Volver al login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text className="text-center text-sm text-gray-500">
                  Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                </Text>
                <TextInput
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
                  placeholder="Email"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <TouchableOpacity
                  className={`mt-2 rounded-xl py-4 ${forgotLoading ? 'bg-green-400' : 'bg-green-600'}`}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  <Text className="text-center font-semibold text-white">
                    {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Paso 3: Registro */}
        {step === 'register' && (
          <View className="gap-4">
            <TouchableOpacity onPress={() => setStep('login')} className="mb-2">
              <Text className="text-sm text-green-600">← Volver al login</Text>
            </TouchableOpacity>

            <Text className="text-center text-lg font-bold text-gray-900">Crear cuenta</Text>
            <Text className="text-center text-sm text-gray-400">
              Te unes a <Text className="font-medium text-gray-600">{selectedClub?.name}</Text>
            </Text>

            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Nombre completo"
              value={regName}
              onChangeText={setRegName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Email"
              value={regEmail}
              onChangeText={setRegEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Contraseña (mín. 6 caracteres)"
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Repetir contraseña"
              value={regPassword2}
              onChangeText={setRegPassword2}
              secureTextEntry
              autoComplete="new-password"
            />

            <TouchableOpacity
              className={`mt-2 rounded-xl py-4 ${registering ? 'bg-green-400' : 'bg-green-600'}`}
              onPress={handleRegister}
              disabled={registering}
            >
              <Text className="text-center font-semibold text-white">
                {registering ? 'Creando cuenta...' : 'Crear cuenta'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('login')} className="mt-2">
              <Text className="text-center text-sm text-gray-500">
                ¿Ya tienes cuenta?{' '}
                <Text className="font-semibold text-green-600">Inicia sesión</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
