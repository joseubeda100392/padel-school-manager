import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const ALLOWED_KEYS = ['tarifas_pdf_url', 'calendario_pdf_url', 'terms_pdf_url'] as const
const STORAGE_PATHS: Record<string, string> = {
  tarifas_pdf_url: 'tarifas',
  calendario_pdf_url: 'calendario',
  terms_pdf_url: 'terms',
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const key = formData.get('key') as string | null

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  if (!key || !ALLOWED_KEYS.includes(key as typeof ALLOWED_KEYS[number])) {
    return NextResponse.json({ error: 'Clave de documento no válida' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const folder = STORAGE_PATHS[key]
  const path = `${folder}/${profile.club_id ?? 'global'}/${Date.now()}.pdf`

  const { error } = await admin.storage.from('materials').upload(path, buffer, {
    upsert: true,
    contentType: 'application/pdf',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ path })
}
