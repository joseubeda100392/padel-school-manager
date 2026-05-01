import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { createClient } from '@/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleLogin() {
    setLoading(true)
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      Alert.alert('Error', error.message)
      setLoading(false)
      return
    }

    const role = data.user?.user_metadata?.role
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
        <View className="mb-10 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-green-600">
            <Text className="text-2xl font-bold text-white">P</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">Padel School</Text>
          <Text className="mt-1 text-gray-500">Accede a tu cuenta</Text>
        </View>

        <View className="gap-4">
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
      </View>
    </KeyboardAvoidingView>
  )
}
