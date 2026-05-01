import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'
import { createClient } from '@/lib/supabase'

export default function CoachMaterialsScreen() {
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    loadMaterials()
  }, [])

  async function loadMaterials() {
    const supabase = createClient()
    const { data } = await supabase
      .from('materials')
      .select('*, material_levels(level:levels(name, color))')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    setMaterials(data ?? [])
    setLoading(false)
  }

  async function downloadPDF(material: any) {
    if (!material.file_url) return
    setDownloading(material.id)
    try {
      const filename = `${material.title.replace(/[^a-z0-9]/gi, '_')}.pdf`
      const { uri } = await FileSystem.downloadAsync(
        material.file_url,
        `${FileSystem.documentDirectory}${filename}`
      )
      Alert.alert('Descargado', `Guardado: ${uri}`)
    } catch {
      Alert.alert('Error', 'No se pudo descargar el archivo.')
    }
    setDownloading(null)
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Material</Text>
        <Text className="text-sm text-gray-500">Todos los documentos disponibles</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {loading && <Text className="text-center text-gray-400">Cargando...</Text>}
        {!loading && materials.length === 0 && (
          <Text className="mt-8 text-center text-gray-400">No hay materiales publicados.</Text>
        )}

        {materials.map((m: any) => (
          <View key={m.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                <Text className="text-xs font-bold text-red-600">PDF</Text>
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">{m.title}</Text>
                {m.description && (
                  <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>{m.description}</Text>
                )}
                <View className="mt-1 flex-row flex-wrap gap-1">
                  {m.material_levels?.map((ml: any, i: number) => (
                    <View key={i} className="rounded-full px-2 py-0.5" style={{ backgroundColor: ml.level?.color + '22' }}>
                      <Text className="text-xs font-medium" style={{ color: ml.level?.color }}>{ml.level?.name}</Text>
                    </View>
                  ))}
                  {(!m.material_levels || m.material_levels.length === 0) && (
                    <Text className="text-xs text-gray-400">Todos los niveles</Text>
                  )}
                </View>
              </View>
            </View>

            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => Linking.openURL(m.file_url)}
                className="flex-1 rounded-xl bg-green-600 py-2.5"
              >
                <Text className="text-center text-sm font-semibold text-white">Abrir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => downloadPDF(m)}
                disabled={downloading === m.id}
                className="flex-1 rounded-xl border border-gray-200 py-2.5"
              >
                <Text className="text-center text-sm font-semibold text-gray-600">
                  {downloading === m.id ? 'Descargando...' : 'Descargar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
