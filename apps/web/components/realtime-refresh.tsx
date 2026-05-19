'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Sub = {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

export function RealtimeRefresh({ channelName, subs }: { channelName: string; subs: Sub[] }) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current

    function refresh() {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => router.refresh(), 400)
    }

    const channel = supabase.channel(channelName)
    for (const sub of subs) {
      channel.on(
        'postgres_changes' as any,
        { event: sub.event ?? '*', schema: 'public', table: sub.table, ...(sub.filter ? { filter: sub.filter } : {}) },
        refresh
      )
    }
    channel.subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, []) // props son valores estáticos del servidor, no cambian

  return null
}
