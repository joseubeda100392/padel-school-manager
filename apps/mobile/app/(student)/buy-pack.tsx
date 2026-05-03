import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Linking, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://padel-school-manager-production.up.railway.app'

interface PackConfig {
  price: number
  count: number
}

export default function BuyPackScreen() {
  const [pack60, setPack60] = useState<PackConfig>({ price: 9000, count: 10 })
  const [pack90, setPack90] = useState<PackConfig>({ price: 12000, count: 10 })
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<'60' | '90' | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: cfg }, { data: bag }] = await Promise.all([
      supabase.from('app_config').select('key, value').in('key', [
        'pack_price_60', 'classes_per_pack_60',
        'pack_price_90', 'classes_per_pack_90',
      ]),
      supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
    ])

    const map = Object.fromEntries((cfg ?? []).map((c: any) => [c.key, c.value]))
    setPack60({
      price: parseInt(map.pack_price_60 ?? '9000'),
      count: parseInt(map.classes_per_pack_60 ?? '10'),
    })
    setPack90({
      price: parseInt(map.pack_price_90 ?? '12000'),
      count: parseInt(map.classes_per_pack_90 ?? '10'),
    })
    setBalance(bag?.balance ?? 0)
    setLoading(false)
  }

  async function handleBuyPack(packType: '60' | '90') {
    setPaying(packType)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ type: 'class_pack', packType }),
      })

      const json = await res.json()
      if (!res.ok) { Alert.alert('Error', json.error); setPaying(null); return }

      const payUrl = `${API_BASE}/pay?url=${encodeURIComponent(json.redsysUrl)}&Ds_MerchantParameters=${encodeURIComponent(json.merchantParameters)}&Ds_Signature=${encodeURIComponent(json.signature)}`
      await Linking.openURL(payUrl)
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el pago')
    }
    setPaying(null)
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#16a34a" />
      </SafeAreaView>
    )
  }

  const pricePerClass60 = pack60.count > 0 ? (pack60.price / pack60.count / 100).toFixed(2) : '0'
  const pricePerClass90 = pack90.count > 0 ? (pack90.price / pack90.count / 100).toFixed(2) : '0'

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Comprar bono</Text>
        <Text className="text-sm text-gray-500">
          Bolsa actual: <Text className="font-semibold text-green-600">{balance} {balance === 1 ? 'clase' : 'clases'}</Text>
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-6">
        {/* Bono 1 hora */}
        <View className="mb-4 rounded-2xl bg-green-600 p-6">
          <Text className="text-sm font-medium text-green-100">Bono · Clases de 1 hora</Text>
          <Text className="mt-1 text-5xl font-bold text-white">{pack60.count}</Text>
          <Text className="mt-1 text-green-100">clases · {pricePerClass60}€/clase</Text>
          <Text className="mt-4 text-3xl font-bold text-white">
            {(pack60.price / 100).toFixed(2)}€
          </Text>
          <TouchableOpacity
            onPress={() => handleBuyPack('60')}
            disabled={paying !== null}
            className={`mt-5 rounded-xl py-3 ${paying === '60' ? 'bg-white/30' : 'bg-white/20'}`}
          >
            <Text className="text-center text-base font-bold text-white">
              {paying === '60' ? 'Redirigiendo...' : `Comprar · ${(pack60.price / 100).toFixed(2)}€`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bono 1h 30min */}
        <View className="mb-6 rounded-2xl bg-green-700 p-6">
          <Text className="text-sm font-medium text-green-100">Bono · Clases de 1h 30min</Text>
          <Text className="mt-1 text-5xl font-bold text-white">{pack90.count}</Text>
          <Text className="mt-1 text-green-100">clases · {pricePerClass90}€/clase</Text>
          <Text className="mt-4 text-3xl font-bold text-white">
            {(pack90.price / 100).toFixed(2)}€
          </Text>
          <TouchableOpacity
            onPress={() => handleBuyPack('90')}
            disabled={paying !== null}
            className={`mt-5 rounded-xl py-3 ${paying === '90' ? 'bg-white/30' : 'bg-white/20'}`}
          >
            <Text className="text-center text-base font-bold text-white">
              {paying === '90' ? 'Redirigiendo...' : `Comprar · ${(pack90.price / 100).toFixed(2)}€`}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-center text-xs text-gray-400">
          Pago seguro procesado por Redsys. Las clases se añaden a tu bolsa automáticamente tras el pago.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
