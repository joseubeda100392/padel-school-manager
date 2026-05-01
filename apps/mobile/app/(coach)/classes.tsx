import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase'

export default function CoachClassesScreen() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSchedules()
  }, [])

  async function loadSchedules() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('schedules')
      .select('*, court:courts(name)')
      .eq('coach_id', user.id)
      .eq('is_active', true)
      .order('start_time')

    setSchedules(data ?? [])
    setLoading(false)
  }

  async function loadStudents(scheduleId: string) {
    if (selected === scheduleId) { setSelected(null); setStudents([]); return }
    setSelected(scheduleId)
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('status, student:users(name, current_level_id, currentLevel:levels(name, color))')
      .eq('schedule_id', scheduleId)
      .eq('status', 'confirmed')
    setStudents(data ?? [])
  }

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Mis Clases</Text>
        <Text className="text-sm text-gray-500">Toca una clase para ver los alumnos</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {loading && <Text className="text-center text-gray-400">Cargando...</Text>}
        {!loading && schedules.length === 0 && (
          <Text className="mt-8 text-center text-gray-400">No tienes clases asignadas.</Text>
        )}

        {schedules.map((s: any) => {
          const start = new Date(s.start_time)
          const end = new Date(s.end_time)
          const isOpen = selected === s.id

          return (
            <View key={s.id} className="mb-3">
              <TouchableOpacity
                onPress={() => loadStudents(s.id)}
                className={`rounded-2xl bg-white p-4 shadow-sm ${isOpen ? 'border-2 border-green-500' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-lg bg-green-50 px-2 py-0.5">
                        <Text className="text-xs font-bold text-green-700">{days[start.getDay()]}</Text>
                      </View>
                      <Text className="font-semibold text-gray-900">
                        {start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text className="mt-1 text-sm text-gray-500">{s.court?.name}</Text>
                  </View>
                  <Text className="text-lg">{isOpen ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View className="mx-2 rounded-b-2xl bg-gray-50 px-4 pb-4 pt-2">
                  {students.length === 0 ? (
                    <Text className="py-2 text-center text-sm text-gray-400">Sin alumnos apuntados</Text>
                  ) : (
                    students.map((b: any, i: number) => {
                      const level = b.student?.currentLevel
                      return (
                        <View key={i} className="flex-row items-center justify-between border-b border-gray-100 py-2.5 last:border-0">
                          <Text className="font-medium text-gray-900">{b.student?.name}</Text>
                          {level && (
                            <View className="flex-row items-center gap-1.5">
                              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: level.color }} />
                              <Text className="text-xs text-gray-500">{level.name}</Text>
                            </View>
                          )}
                        </View>
                      )
                    })
                  )}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
