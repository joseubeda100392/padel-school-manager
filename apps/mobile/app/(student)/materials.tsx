import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'
import { createClient } from '@/lib/supabase'

export default function StudentMaterialsScreen() {
  const [classMaterials, setClassMaterials] = useState<any[]>([])
  const [levelMaterials, setLevelMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    loadMaterials()
  }, [])

  async function loadMaterials() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: userData }, { data: allMaterials }, { data: enrollments }] = await Promise.all([
      supabase.from('users').select('current_level_id').eq('id', user.id).single(),
      supabase
        .from('materials')
        .select('*, material_levels(level_id), schedule:schedules(start_time, court:courts(name))')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      supabase.from('group_enrollments')
        .select('schedule_id')
        .eq('student_id', user.id)
        .eq('status', 'active'),
    ])

    const myScheduleIds = new Set((enrollments ?? []).map((e: any) => e.schedule_id))

    const byClass: any[] = []
    const byLevel: any[] = []
    for (const m of allMaterials ?? []) {
      if (m.schedule_id) {
        if (myScheduleIds.has(m.schedule_id)) byClass.push(m)
      } else {
        const levels = m.material_levels ?? []
        if (levels.length === 0 || levels.some((ml: any) => ml.level_id === userData?.current_level_id)) {
          byLevel.push(m)
        }
      }
    }

    setClassMaterials(byClass)
    setLevelMaterials(byLevel)
    setLoading(false)
  }

  async function openPDF(material: any) {
    if (material.file_url) {
      Linking.openURL(material.file_url)
    }
  }

  async function downloadPDF(material: any) {
    if (!material.file_url) return
    setDownloading(material.id)

    try {
      const filename = `${material.title.replace(/[^a-z0-9]/gi, '_')}.pdf`
      const path = `${FileSystem.documentDirectory}${filename}`
      const { uri } = await FileSystem.downloadAsync(material.file_url, path)
      Alert.alert('Descargado', `Guardado en: ${uri}`)
    } catch {
      Alert.alert('Error', 'No se pudo descargar el archivo.')
    }
    setDownloading(null)
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Material</Text>
        <Text className="text-sm text-gray-500">Documentos de tu nivel</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {loading && <Text className="text-center text-gray-400">Cargando...</Text>}
        {!loading && classMaterials.length === 0 && levelMaterials.length === 0 && (
          <Text className="mt-8 text-center text-gray-400">
            No hay materiales disponibles para tu nivel.
          </Text>
        )}

        {classMaterials.length > 0 && (
          <>
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Material de tus clases</Text>
            {classMaterials.map((m: any) => {
              const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
              const start = m.schedule?.start_time ? new Date(m.schedule.start_time) : null
              const classLabel = start
                ? `${DAYS[start.getDay()]} ${start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${m.schedule?.court?.name ?? ''}`
                : null
              return (
                <View key={m.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                      <Text className="text-xs font-bold text-blue-600">PDF</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900">{m.title}</Text>
                      {classLabel && <Text className="mt-0.5 text-xs text-blue-500">{classLabel}</Text>}
                      {m.description && (
                        <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={2}>{m.description}</Text>
                      )}
                    </View>
                  </View>
                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity onPress={() => openPDF(m)} className="flex-1 rounded-xl bg-blue-600 py-2.5">
                      <Text className="text-center text-sm font-semibold text-white">Abrir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadPDF(m)} disabled={downloading === m.id} className="flex-1 rounded-xl border border-gray-200 py-2.5">
                      <Text className="text-center text-sm font-semibold text-gray-600">
                        {downloading === m.id ? 'Descargando...' : 'Descargar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </>
        )}

        {levelMaterials.length > 0 && (
          <>
            {classMaterials.length > 0 && (
              <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Material de tu nivel</Text>
            )}
            {levelMaterials.map((m: any) => (
              <View key={m.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                    <Text className="text-xs font-bold text-red-600">PDF</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">{m.title}</Text>
                    {m.description && (
                      <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={2}>{m.description}</Text>
                    )}
                  </View>
                </View>

                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity onPress={() => openPDF(m)} className="flex-1 rounded-xl bg-green-600 py-2.5">
                    <Text className="text-center text-sm font-semibold text-white">Abrir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => downloadPDF(m)} disabled={downloading === m.id} className="flex-1 rounded-xl border border-gray-200 py-2.5">
                    <Text className="text-center text-sm font-semibold text-gray-600">
                      {downloading === m.id ? 'Descargando...' : 'Descargar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
