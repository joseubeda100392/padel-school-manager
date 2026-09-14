import { getAdminClient } from '@/lib/supabase/admin'

export interface ClubLegalInfo {
  clubName: string
  slug: string
  companyName: string
  cif: string
  address: string
  email: string
  phone: string
  cancellationHours: number
}

// Lectura pública (sin sesión) de los datos legales de un club por su slug —
// solo se leen name/slug/config, nunca credenciales (redsys_secret_key,
// playtomic_password, etc.), aunque el admin client bypasa RLS.
export async function getClubLegalInfo(slug: string): Promise<ClubLegalInfo | null> {
  const admin = getAdminClient()
  const { data } = await admin
    .from('clubs')
    .select('name, slug, config, is_active')
    .eq('slug', slug)
    .single()

  if (!data || data.is_active === false) return null

  const config = (data.config ?? {}) as Record<string, unknown>
  return {
    clubName: data.name as string,
    slug: data.slug as string,
    companyName: (config.legal_company_name as string) || (data.name as string),
    cif: (config.legal_cif as string) || '',
    address: (config.legal_address as string) || '',
    email: (config.legal_email as string) || '',
    phone: (config.legal_phone as string) || '',
    cancellationHours: typeof config.cancellation_hours === 'number' ? config.cancellation_hours : 24,
  }
}
