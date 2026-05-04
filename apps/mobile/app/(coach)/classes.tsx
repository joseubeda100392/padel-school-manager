import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CoachClassesScreen() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [students, setStudents] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

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
    if (selected === scheduleId) {
      setSelected(null)
      return
    }
    setSelected(scheduleId)

    if (students[scheduleId]) return

    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('id, status, student:users!bookings_student_id_fkey(name, avatar_url, currentLevel:levels(name, color))')
      .eq('schedule_id', scheduleId)
      .neq('status', 'cancelled')

    setStudents((prev) => ({ ...prev, [scheduleId]: data ?? [] }))
  }

  async function toggleAttendance(bookingId: string, scheduleId: string, currentStatus: string) {
    const newStatus = currentStatus === 'no_show' ? 'confirmed' : 'no_show'
    setToggling(bookingId)
    const supabase = createClient()
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setStudents((prev) => ({
        ...prev,
        [scheduleId]: prev[scheduleId].map((b) =>
          b.id === bookingId ? { ...b, status: newStatus } : b
        ),
      }))
    }
    setToggling(null)
  }

  const renderItem = useCallback(({ item: s }: { item: any }) => {
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    const isOpen = selected === s.id
    const classList = students[s.id] ?? []
    const attended = classList.filter((b) => b.status === 'confirmed').length
    const noShow = classList.filter((b) => b.status === 'no_show').length

    return (
      <View className="mb-3">
        <TouchableOpacity
          onPress={() => loadStudents(s.id)}
          className={`rounded-2xl bg-white p-4 shadow-sm ${isOpen ? 'border-2 border-green-500' : ''}`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-green-50 px-2 py-0.5">
                  <Text className="text-xs font-bold text-green-700">{DAYS[start.getDay()]}</Text>
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
          <View className="mx-2 rounded-b-2xl bg-white px-4 pb-4 pt-3 shadow-sm">
            {classList.length > 0 && (
              <View className="mb-3 flex-row gap-3">
                <View className="flex-1 rounded-xl bg-green-50 px-3 py-2">
                  <Text className="text-center text-xs text-green-700">Presentes</Text>
                  <Text className="text-center text-xl font-bold text-green-700">{attended}</Text>
                </View>
                <View className="flex-1 rounded-xl bg-red-50 px-3 py-2">
                  <Text className="text-center text-xs text-red-700">No asistieron</Text>
                  <Text className="text-center text-xl font-bold text-red-700">{noShow}</Text>
                </View>
              </View>
            )}

            {classList.length === 0 ? (
              <Text className="py-2 text-center text-sm text-gray-400">Sin alumnos apuntados</Text>
            ) : (
              classList.map((b: any) => {
                const level = b.student?.currentLevel
                const isPresent = b.status === 'confirmed'
                const initials = (b.student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

                return (
                  <View key={b.id} className="flex-row items-center justify-between border-b border-gray-50 py-3 last:border-0">
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                        <Text className="text-xs font-bold text-gray-600">{initials}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-gray-900">{b.student?.name}</Text>
                        {level && (
                          <View className="flex-row items-center gap-1 mt-0.5">
                            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: level.color }} />
                            <Text className="text-xs text-gray-400">{level.name}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => toggleAttendance(b.id, s.id, b.status)}
                      disabled={toggling === b.id}
                      className={`rounded-xl px-4 py-2 ${isPresent ? 'bg-green-100' : 'bg-red-100'}`}
                    >
                      <Text className={`text-sm font-semibold ${isPresent ? 'text-green-700' : 'text-red-700'}`}>
                        {toggling === b.id ? '...' : isPresent ? '✓ Presente' : '✗ No vino'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })
            )}
          </View>
        )}
      </View>
    )
  }, [selected, students, toggling])

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Mis Clases</Text>
        <Text className="text-sm text-gray-500">Toca una clase para pasar lista</Text>
      </View>

      <FlatList
        data={schedules}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
        ListEmptyComponent={
          loading ? (
            <Text className="text-center text-gray-400">Cargando...</Text>
          ) : (
            <Text className="mt-8 text-center text-gray-400">No tienes clases asignadas.</Text>
          )
        }
      />
    </SafeAreaView>
  )
}
