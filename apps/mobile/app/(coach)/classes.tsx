import { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CoachClassesScreen() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [students, setStudents] = useState<Record<string, any[]>>({})
  const [groupEnrolled, setGroupEnrolled] = useState<Record<string, any[]>>({})
  const [classMakeups, setClassMakeups] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // Makeup modal
  const [makeupScheduleId, setMakeupScheduleId] = useState<string | null>(null)
  const [makeupForm, setMakeupForm] = useState({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
  const [savingMakeup, setSavingMakeup] = useState(false)

  // Exclusion modal
  const [excludeEnrollment, setExcludeEnrollment] = useState<{ scheduleId: string; enrollmentId: string; studentName: string } | null>(null)
  const [excludeDate, setExcludeDate] = useState('')
  const [excludeReason, setExcludeReason] = useState('')
  const [savingExclude, setSavingExclude] = useState(false)

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

  async function loadClassDetail(scheduleId: string) {
    if (selected === scheduleId) {
      setSelected(null)
      return
    }
    setSelected(scheduleId)

    if (students[scheduleId]) return

    const supabase = createClient()
    const [{ data: bookings }, { data: enrollments }, { data: makeups }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, student:users!bookings_student_id_fkey(name, avatar_url, currentLevel:levels(name, color))')
        .eq('schedule_id', scheduleId)
        .neq('status', 'cancelled'),
      supabase
        .from('group_enrollments')
        .select('id, monthly_price, student:users!group_enrollments_student_id_fkey(id, name, currentLevel:levels(name, color))')
        .eq('schedule_id', scheduleId)
        .eq('status', 'active'),
      supabase
        .from('makeups')
        .select('id, original_date, makeup_date, status, notes, student:users!makeups_student_id_fkey(name)')
        .eq('original_schedule_id', scheduleId)
        .order('makeup_date', { ascending: false })
        .limit(10),
    ])

    setStudents((prev) => ({ ...prev, [scheduleId]: bookings ?? [] }))
    setGroupEnrolled((prev) => ({ ...prev, [scheduleId]: enrollments ?? [] }))
    setClassMakeups((prev) => ({ ...prev, [scheduleId]: makeups ?? [] }))
  }

  async function toggleAttendance(bookingId: string, scheduleId: string, currentStatus: string) {
    const newStatus = currentStatus === 'no_show' ? 'confirmed' : 'no_show'
    setToggling(bookingId)
    const supabase = createClient()
    const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setStudents((prev) => ({
        ...prev,
        [scheduleId]: prev[scheduleId].map((b) => b.id === bookingId ? { ...b, status: newStatus } : b),
      }))
    }
    setToggling(null)
  }

  async function handleAddMakeup() {
    if (!makeupScheduleId || !makeupForm.studentId || !makeupForm.originalDate || !makeupForm.makeupDate) {
      Alert.alert('Error', 'Completa alumno, fecha original y fecha de recuperación')
      return
    }
    setSavingMakeup(true)
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('makeups').insert({
      student_id: makeupForm.studentId,
      original_schedule_id: makeupScheduleId,
      original_date: makeupForm.originalDate,
      makeup_date: makeupForm.makeupDate,
      notes: makeupForm.notes || null,
      status: 'pending',
      created_by: authData.user?.id,
    }).select('id, original_date, makeup_date, status, notes, student:users!makeups_student_id_fkey(name)').single()

    setSavingMakeup(false)
    if (error) { Alert.alert('Error', error.message); return }
    setClassMakeups((prev) => ({
      ...prev,
      [makeupScheduleId]: [data, ...(prev[makeupScheduleId] ?? [])],
    }))
    setMakeupScheduleId(null)
    setMakeupForm({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
  }

  async function handleAddExclusion() {
    if (!excludeEnrollment || !excludeDate) {
      Alert.alert('Error', 'Selecciona la fecha de la clase a cancelar')
      return
    }
    setSavingExclude(true)
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    const { error } = await supabase.from('schedule_exclusions').insert({
      group_enrollment_id: excludeEnrollment.enrollmentId,
      excluded_date: excludeDate,
      reason: excludeReason || null,
      created_by: authData.user?.id,
    })
    setSavingExclude(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert('Hecho', `Clase del ${excludeDate} cancelada para ${excludeEnrollment.studentName}`)
    setExcludeEnrollment(null)
    setExcludeDate('')
    setExcludeReason('')
  }

  async function handleMakeupStatus(makeupId: string, scheduleId: string, newStatus: 'completed' | 'cancelled') {
    const supabase = createClient()
    await supabase.from('makeups').update({ status: newStatus }).eq('id', makeupId)
    setClassMakeups((prev) => ({
      ...prev,
      [scheduleId]: prev[scheduleId].map((m) => m.id === makeupId ? { ...m, status: newStatus } : m),
    }))
  }

  const renderItem = useCallback(({ item: s }: { item: any }) => {
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    const isOpen = selected === s.id
    const classList = students[s.id] ?? []
    const groupList = groupEnrolled[s.id] ?? []
    const makeupList = classMakeups[s.id] ?? []
    const attended = classList.filter((b) => b.status === 'confirmed').length
    const noShow = classList.filter((b) => b.status === 'no_show').length
    const totalStudents = classList.length + groupList.length

    return (
      <View className="mb-3">
        <TouchableOpacity
          onPress={() => loadClassDetail(s.id)}
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
            {totalStudents > 0 && (
              <View className="mb-3 flex-row gap-3">
                <View className="flex-1 rounded-xl bg-green-50 px-3 py-2">
                  <Text className="text-center text-xs text-green-700">Presentes</Text>
                  <Text className="text-center text-xl font-bold text-green-700">{attended}</Text>
                </View>
                <View className="flex-1 rounded-xl bg-red-50 px-3 py-2">
                  <Text className="text-center text-xs text-red-700">No asistieron</Text>
                  <Text className="text-center text-xl font-bold text-red-700">{noShow}</Text>
                </View>
                <View className="flex-1 rounded-xl bg-blue-50 px-3 py-2">
                  <Text className="text-center text-xs text-blue-700">Grupo fijo</Text>
                  <Text className="text-center text-xl font-bold text-blue-700">{groupList.length}</Text>
                </View>
              </View>
            )}

            {/* Reservas puntuales */}
            {classList.length > 0 && (
              <>
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reservas</Text>
                {classList.map((b: any) => {
                  const level = b.student?.currentLevel
                  const isPresent = b.status === 'confirmed'
                  const initials = (b.student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <View key={b.id} className="flex-row items-center justify-between border-b border-gray-50 py-3">
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
                        className={`rounded-xl px-3 py-2 ${isPresent ? 'bg-green-100' : 'bg-red-100'}`}
                      >
                        <Text className={`text-sm font-semibold ${isPresent ? 'text-green-700' : 'text-red-700'}`}>
                          {toggling === b.id ? '...' : isPresent ? '✓' : '✗'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </>
            )}

            {/* Grupo fijo */}
            {groupList.length > 0 && (
              <>
                <Text className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Grupo fijo</Text>
                {groupList.map((e: any) => {
                  const level = e.student?.currentLevel
                  const initials = (e.student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <View key={e.id} className="flex-row items-center justify-between border-b border-gray-50 py-3">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                          <Text className="text-xs font-bold text-blue-600">{initials}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="font-medium text-gray-900">{e.student?.name}</Text>
                          {level && (
                            <View className="flex-row items-center gap-1 mt-0.5">
                              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: level.color }} />
                              <Text className="text-xs text-gray-400">{level.name}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setExcludeEnrollment({ scheduleId: s.id, enrollmentId: e.id, studentName: e.student?.name ?? '' })
                          setExcludeDate('')
                          setExcludeReason('')
                        }}
                        className="rounded-xl bg-orange-50 px-3 py-2"
                      >
                        <Text className="text-xs font-semibold text-orange-600">Cancelar clase</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </>
            )}

            {totalStudents === 0 && (
              <Text className="py-2 text-center text-sm text-gray-400">Sin alumnos apuntados</Text>
            )}

            {/* Recuperaciones */}
            <View className="mt-4 rounded-xl bg-orange-50 px-4 py-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-orange-600">Recuperaciones</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMakeupScheduleId(s.id)
                    setMakeupForm({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
                  }}
                  className="rounded-lg bg-orange-500 px-3 py-1"
                >
                  <Text className="text-xs font-semibold text-white">+ Añadir</Text>
                </TouchableOpacity>
              </View>
              {makeupList.length === 0 ? (
                <Text className="text-xs text-orange-400">Sin recuperaciones registradas</Text>
              ) : (
                makeupList.map((m: any) => (
                  <View key={m.id} className="mt-2 rounded-lg bg-white px-3 py-2">
                    <Text className="text-sm font-medium text-gray-900">{m.student?.name}</Text>
                    <Text className="text-xs text-gray-400">
                      Faltó: {m.original_date} · Recupera: {m.makeup_date}
                    </Text>
                    {m.notes ? <Text className="text-xs text-gray-400">{m.notes}</Text> : null}
                    <View className="flex-row gap-2 mt-2">
                      {m.status === 'pending' && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleMakeupStatus(m.id, s.id, 'completed')}
                            className="rounded-lg bg-green-100 px-3 py-1"
                          >
                            <Text className="text-xs text-green-700">✓ Realizada</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleMakeupStatus(m.id, s.id, 'cancelled')}
                            className="rounded-lg bg-red-100 px-3 py-1"
                          >
                            <Text className="text-xs text-red-700">Cancelar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {m.status === 'completed' && (
                        <Text className="text-xs font-semibold text-green-600">✓ Realizada</Text>
                      )}
                      {m.status === 'cancelled' && (
                        <Text className="text-xs font-semibold text-red-400">Cancelada</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
    )
  }, [selected, students, groupEnrolled, classMakeups, toggling])

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

      {/* Modal: Añadir recuperación */}
      <Modal visible={!!makeupScheduleId} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <ScrollView className="rounded-t-3xl bg-white px-6 pt-6 pb-10" keyboardShouldPersistTaps="handled">
            <Text className="mb-4 text-lg font-bold text-gray-900">Nueva recuperación</Text>

            <Text className="mb-1 text-xs font-medium text-gray-700">Alumno *</Text>
            <View className="mb-3 rounded-xl border border-gray-200 px-3 py-2">
              {makeupScheduleId && (groupEnrolled[makeupScheduleId] ?? []).map((e: any) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => setMakeupForm((f) => ({ ...f, studentId: e.student?.id }))}
                  className={`mb-1 rounded-lg px-3 py-2 ${makeupForm.studentId === e.student?.id ? 'bg-orange-100' : 'bg-gray-50'}`}
                >
                  <Text className={`text-sm ${makeupForm.studentId === e.student?.id ? 'font-semibold text-orange-700' : 'text-gray-700'}`}>
                    {e.student?.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {makeupScheduleId && (groupEnrolled[makeupScheduleId] ?? []).length === 0 && (
                <Text className="text-sm text-gray-400">Sin alumnos de grupo fijo</Text>
              )}
            </View>

            <Text className="mb-1 text-xs font-medium text-gray-700">Fecha en que faltó *</Text>
            <TextInput
              value={makeupForm.originalDate}
              onChangeText={(v) => setMakeupForm((f) => ({ ...f, originalDate: v }))}
              placeholder="YYYY-MM-DD"
              className="mb-3 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />

            <Text className="mb-1 text-xs font-medium text-gray-700">Fecha de recuperación *</Text>
            <TextInput
              value={makeupForm.makeupDate}
              onChangeText={(v) => setMakeupForm((f) => ({ ...f, makeupDate: v }))}
              placeholder="YYYY-MM-DD"
              className="mb-3 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />

            <Text className="mb-1 text-xs font-medium text-gray-700">Notas (opcional)</Text>
            <TextInput
              value={makeupForm.notes}
              onChangeText={(v) => setMakeupForm((f) => ({ ...f, notes: v }))}
              placeholder="Motivo, observaciones..."
              className="mb-5 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setMakeupScheduleId(null)}
                className="flex-1 rounded-xl border border-gray-200 py-3"
              >
                <Text className="text-center text-sm font-medium text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddMakeup}
                disabled={savingMakeup}
                className="flex-1 rounded-xl bg-orange-500 py-3 disabled:opacity-60"
              >
                <Text className="text-center text-sm font-bold text-white">
                  {savingMakeup ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Cancelar clase puntual */}
      <Modal visible={!!excludeEnrollment} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-6 pt-6 pb-10">
            <Text className="mb-1 text-lg font-bold text-gray-900">Cancelar clase puntual</Text>
            <Text className="mb-4 text-sm text-gray-500">{excludeEnrollment?.studentName}</Text>

            <Text className="mb-1 text-xs font-medium text-gray-700">Fecha de la clase a cancelar *</Text>
            <TextInput
              value={excludeDate}
              onChangeText={setExcludeDate}
              placeholder="YYYY-MM-DD"
              className="mb-3 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />

            <Text className="mb-1 text-xs font-medium text-gray-700">Motivo (opcional)</Text>
            <TextInput
              value={excludeReason}
              onChangeText={setExcludeReason}
              placeholder="Ej: Viaje, enfermedad..."
              className="mb-5 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setExcludeEnrollment(null)}
                className="flex-1 rounded-xl border border-gray-200 py-3"
              >
                <Text className="text-center text-sm font-medium text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddExclusion}
                disabled={savingExclude}
                className="flex-1 rounded-xl bg-orange-500 py-3 disabled:opacity-60"
              >
                <Text className="text-center text-sm font-bold text-white">
                  {savingExclude ? 'Guardando...' : 'Registrar falta'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
