// @ts-expect-error - cache exists in React 18.3 runtime but is missing from @types/react 18.x
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
}

export const getClubFeatures = cache(async (clubId: string | null | undefined): Promise<ClubFeatures> => {
  if (!clubId) return DEFAULT_FEATURES
  const admin = getAdminClient()
  const { data } = await admin.from('clubs').select('features').eq('id', clubId).single()
  return { ...DEFAULT_FEATURES, ...(data?.features ?? {}) }
})
