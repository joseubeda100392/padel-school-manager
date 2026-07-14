// @ts-ignore - cache exists in React 18.3 runtime; @types/react version varies by environment
import { cache } from 'react'
import { getAdminClient } from './supabase/admin'

export type ClubFeatures = {
  enable_60min: boolean
  enable_90min: boolean
  enable_payments: boolean
  enable_spots: boolean
  enable_bag: boolean
  enable_chat: boolean
  enable_materials: boolean
  enable_objectives: boolean
  enable_tournaments: boolean
  enable_intensivos: boolean
  enable_pista_viva: boolean
  enable_terms: boolean
  terms_pdf_url: string
}

export const DEFAULT_FEATURES: ClubFeatures = {
  enable_60min: true,
  enable_90min: true,
  enable_payments: true,
  enable_spots: true,
  enable_bag: true,
  enable_chat: true,
  enable_materials: true,
  enable_objectives: true,
  enable_tournaments: true,
  enable_intensivos: true,
  enable_pista_viva: false,
  enable_terms: false,
  terms_pdf_url: '',
}

export const getClubFeatures = cache(async (clubId: string | null | undefined): Promise<ClubFeatures> => {
  if (!clubId) return DEFAULT_FEATURES
  const admin = getAdminClient()
  const { data } = await admin.from('clubs').select('features').eq('id', clubId).single()
  const merged = { ...DEFAULT_FEATURES, ...(data?.features ?? {}) }
  return {
    ...merged,
    terms_pdf_url: typeof merged.terms_pdf_url === 'string' ? merged.terms_pdf_url : '',
  }
})
