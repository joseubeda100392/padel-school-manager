import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createClient } from '@/lib/supabase'

export default function StudentChatScreen() {
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    initChat()
  }, [])

  async function initChat() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    let { data: thread } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!thread) {
      const { data: newThread } = await supabase
        .from('chat_threads')
        .insert({ user_id: user.id, status: 'active' })
        .select('id')
        .single()
      thread = newThread
    }

    if (!thread) return
    setThreadId(thread.id)

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*, sender:users(name, role)')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })

    setMessages(msgs ?? [])

    const channel = supabase
      .channel(`mobile-thread-${thread.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${thread.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select('*, sender:users(name, role)')
          .eq('id', payload.new.id)
          .single()
        if (data) setMessages((prev) => [...prev, data])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  async function send() {
    if (!text.trim() || !threadId) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender_id: userId,
      content: text.trim(),
    })
    setText('')
    setSending(false)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const isMe = item.sender_id === userId
    return (
      <View className={`flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
        <View
          className={`max-w-xs rounded-2xl px-4 py-2.5 ${isMe ? 'bg-green-600' : 'bg-white'}`}
          style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
        >
          {!isMe && (
            <Text className="mb-0.5 text-xs font-semibold text-green-700">
              {item.sender?.name ?? 'Admin'}
            </Text>
          )}
          <Text className={isMe ? 'text-white' : 'text-gray-900'}>{item.content}</Text>
          <Text className={`mt-0.5 text-right text-xs ${isMe ? 'text-green-200' : 'text-gray-400'}`}>
            {new Date(item.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    )
  }, [userId])

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <Text className="text-xl font-bold text-gray-900">Soporte</Text>
        <Text className="text-sm text-gray-500">Chat con la administración</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-gray-400">
              Envía un mensaje para contactar con la administración.
            </Text>
          }
        />

        <View className="border-t border-gray-100 bg-white px-4 py-3 flex-row gap-2">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!text.trim() || sending}
            className={`rounded-xl px-4 py-2.5 ${!text.trim() || sending ? 'bg-gray-200' : 'bg-green-600'}`}
          >
            <Text className={`font-semibold ${!text.trim() || sending ? 'text-gray-400' : 'text-white'}`}>
              Enviar
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
