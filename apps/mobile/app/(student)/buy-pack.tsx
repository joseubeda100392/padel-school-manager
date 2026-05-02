import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://padel-school-manager-production.up.railway.app'

export default function BuyPackScreen() {
  const [config, setConfig] = useState<{ packPrice: number; classesPerPack: number; singlePrice: number } | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: cfg }, { data: bag }] = await Promise.all([
      supabase.from('app_config').select('key, value').in('key', ['pack_price', 'classes_per_pack', 'pay_per_class_price']),
      supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
    ])

    const map = Object.fromEntries((cfg ?? []).map((c: any) => [c.key, c.value]))
    setConfig({
      packPrice: parseInt(map.pack_price ?? '9000'),
      classesPerPack: parseInt(map.classes_per_pack ?? '10'),
      singlePrice: parseInt(map.pay_per_class_price ?? '1200'),
    })
    setBalance(bag?.balance ?? 0)
    setLoading(false)
  }

  async function handleBuyPack() {
    setPaying(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ type: 'class_pack' }),
      })

      const json = await res.json()
      if (!res.ok) { Alert.alert('Error', json.error); setPaying(false); return }

      const payUrl = `${API_BASE}/pay?url=${encodeURIComponent(json.redsysUrl)}&Ds_MerchantParameters=${encodeURIComponent(json.merchantParameters)}&Ds_Signature=${encodeURIComponent(json.signature)}`
      await Linking.openURL(payUrl)
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el pago')
    }
    setPaying(false)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#16a34a" />
      </SafeAreaView>
    )
  }

  const pricePerClass = config ? (config.packPrice / config.classesPerPack / 100).toFixed(2) : '0'
  const saving = config ? Math.round((1 - config.packPrice / config.classesPerPack / config.singlePrice) * 100) : 0

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Comprar bono</Text>
        <Text className="text-sm text-gray-500">Bolsa actual: <Text className="font-semibold text-green-600">{balance} clases</Text></Text>
      </View>

      <View className="flex-1 px-4 py-6">
        {/* Bono */}
        <View className="mb-4 rounded-2xl bg-green-600 p-6">
          <Text className="text-sm font-medium text-green-100">Bono de clases</Text>
          <Text className="mt-1 text-5xl font-bold text-white">{config?.classesPerPack}</Text>
          <Text className="mt-1 text-green-100">clases · {pricePerClass}€/clase</Text>
          {saving > 0 && (
            <View className="mt-3 self-start rounded-full bg-white/20 px-3 py-1">
              <Text className="text-xs font-semibold text-white">Ahorra un {saving}%</Text>
            </View>
          )}
          <Text className="mt-4 text-3xl font-bold text-white">
            {config ? (config.packPrice / 100).toFixed(2) : '0'}€
          </Text>
        </View>

        {/* Clase suelta comparativa */}
        <View className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-600">Precio clase suelta</Text>
            <Text className="font-semibold text-gray-900">
              {config ? (config.singlePrice / 100).toFixed(2) : '0'}€/clase
            </Text>
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-sm text-gray-600">Precio con bono</Text>
            <Text className="font-semibold text-green-600">{pricePerClass}€/clase</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleBuyPack}
          disabled={paying}
          className={`rounded-xl py-4 ${paying ? 'bg-green-400' : 'bg-green-600'}`}
        >
          <Text className="text-center text-base font-bold text-white">
            {paying ? 'Redirigiendo al pago...' : `Comprar bono · ${config ? (config.packPrice / 100).toFixed(2) : '0'}€`}
          </Text>
        </TouchableOpacity>

        <Text className="mt-4 text-center text-xs text-gray-400">
          Pago seguro procesado por Redsys. Las clases se añaden a tu bolsa automáticamente tras el pago.
        </Text>
      </View>
    </SafeAreaView>
  )
}
