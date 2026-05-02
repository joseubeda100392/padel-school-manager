import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { createClient } from '@/lib/supabase'

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ code?: string }>()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function exchangeCode() {
      if (!params.code) return
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(params.code)
      if (error) {
        Alert.alert('Enlace inválido', 'El enlace ha expirado. Solicita uno nuevo.', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ])
      } else {
        setReady(true)
      }
    }
    exchangeCode()
  }, [params.code])

  async function handleReset() {
    if (!password || !password2) {
      Alert.alert('Error', 'Rellena los dos campos')
      return
    }
    if (password !== password2) {
      Alert.alert('Error', 'Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setDone(true)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-10 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-green-600">
            <Text className="text-2xl font-bold text-white">P</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">Nueva contraseña</Text>
        </View>

        {done ? (
          <View className="items-center gap-4 rounded-xl bg-green-50 p-8">
            <Text className="text-4xl">✅</Text>
            <Text className="text-center font-semibold text-green-800">
              ¡Contraseña actualizada!
            </Text>
            <TouchableOpacity
              className="mt-2 rounded-xl bg-green-600 px-8 py-3"
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text className="font-semibold text-white">Ir al login</Text>
            </TouchableOpacity>
          </View>
        ) : !ready ? (
          <Text className="text-center text-gray-400">Verificando enlace...</Text>
        ) : (
          <View className="gap-4">
            <Text className="text-center text-sm text-gray-500">
              Elige una nueva contraseña para tu cuenta.
            </Text>
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <TextInput
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900"
              placeholder="Repetir contraseña"
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry
              autoComplete="new-password"
            />
            <TouchableOpacity
              className={`mt-2 rounded-xl py-4 ${loading ? 'bg-green-400' : 'bg-green-600'}`}
              onPress={handleReset}
              disabled={loading}
            >
              <Text className="text-center font-semibold text-white">
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
