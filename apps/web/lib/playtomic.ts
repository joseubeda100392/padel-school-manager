const CONSUMER_BASE = 'https://api.playtomic.io'

export type PlaytomicSlot = {
  start_time: string
  duration: number
  price: number
}

export type PlaytomicResource = {
  resource_id: string
  name: string
  slots: PlaytomicSlot[]
}

export type PlaytomicTenant = {
  tenant_id: string
  tenant_name: string
  main_info?: { address?: { street?: string; city?: string } }
}

export type PlaytomicMatchStatus = {
  matchId: string
  playersJoined: number
  playersNeeded: number
  isConverted: boolean
}

export class PlaytomicClient {
  private token: string | null = null

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${CONSUMER_BASE}/v3/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'com.playtomic.web' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error(`Playtomic login failed: ${res.status}`)
    const data = await res.json()
    if (!data.access_token) throw new Error('Playtomic login: no access_token')
    this.token = data.access_token
  }

  async getAvailableSlots(
    tenantId: string,
    startMin: string,
    startMax: string,
    duration = 90,
  ): Promise<PlaytomicResource[]> {
    const params = new URLSearchParams({
      tenant_id: tenantId,
      sport_id: 'PADEL',
      start_min: startMin,
      start_max: startMax,
      duration: String(duration),
    })
    const res = await fetch(`${CONSUMER_BASE}/v1/availability?${params}`, {
      headers: { 'X-Requested-With': 'com.playtomic.web' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Playtomic availability ${res.status}: ${text}`)
    }
    const data = await res.json()
    const raw: any[] = Array.isArray(data) ? data : (data.content ?? data.resources ?? [])
    // Normalize slot field names — Playtomic may use "start" instead of "start_time"
    return raw.map((r: any) => ({
      ...r,
      slots: (r.slots ?? []).map((s: any) => ({
        ...s,
        start_time: s.start_time ?? s.start ?? s.startTime ?? '',
        duration: s.duration ?? s.duration_minutes ?? 90,
        price: s.price ?? s.slot_price ?? 0,
      })),
    }))
  }

  async createMatch(opts: {
    tenantId: string
    resourceId: string
    startTime: string
    durationMinutes: number
    playersNeeded?: number
  }): Promise<{ matchId: string; matchUrl: string }> {
    if (!this.token) throw new Error('Not authenticated')
    const res = await fetch(`${CONSUMER_BASE}/v1/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        'X-Requested-With': 'com.playtomic.web',
      },
      body: JSON.stringify({
        tenant_id: opts.tenantId,
        resource_id: opts.resourceId,
        start: opts.startTime,
        duration: opts.durationMinutes,
        sport_id: 'PADEL',
        type: 'REGULAR',
        number_of_players: opts.playersNeeded ?? 4,
        is_open: true,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Playtomic createMatch failed ${res.status}: ${err}`)
    }
    const data = await res.json()
    const matchId: string = data.match_id ?? data.id ?? ''
    const matchUrl = `https://playtomic.io/match/${matchId}`
    return { matchId, matchUrl }
  }

  async getMatchStatus(matchId: string): Promise<PlaytomicMatchStatus> {
    const res = await fetch(`${CONSUMER_BASE}/v1/matches/${matchId}`, {
      headers: { 'X-Requested-With': 'com.playtomic.web' },
    })
    if (!res.ok) throw new Error(`getMatchStatus failed: ${res.status}`)
    const data = await res.json()

    const registrations: any[] = data.registration_info?.registrations ?? []
    const playersJoined = registrations.filter(
      (r: any) => r.payment_status !== 'CANCELED',
    ).length
    const playersNeeded: number = data.number_of_players ?? 4
    const isConverted = playersJoined >= playersNeeded

    return { matchId, playersJoined, playersNeeded, isConverted }
  }

  async searchTenants(text: string): Promise<PlaytomicTenant[]> {
    // La API de Playtomic requiere coordenadas para que el texto filtre correctamente.
    // Sin coordenadas devuelve clubs aleatorios ignorando el texto.
    // Usamos un radio muy grande centrado en España para cubrir clubs españoles.
    const params = new URLSearchParams({
      sport_ids: 'PADEL',
      text,
      size: '20',
      coordinate: '40.4168,-3.7038',
      radius: '2000000',
    })
    const res = await fetch(`${CONSUMER_BASE}/v1/tenants?${params}`, {
      headers: { 'X-Requested-With': 'com.playtomic.web' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.content ?? [])
  }
}

export function getPlaytomicClient(): PlaytomicClient {
  return new PlaytomicClient()
}
