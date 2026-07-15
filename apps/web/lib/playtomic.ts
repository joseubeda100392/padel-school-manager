const CONSUMER_BASE = 'https://api.playtomic.io'
const OFFICIAL_BASE = 'https://thirdparty.playtomic.io/api/v1'

export type PlaytomicPlayer = {
  user_id: string
  name: string
  email: string
  phone?: string
  gender?: string
  level?: number
}

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
  private userId: string | null = null

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${CONSUMER_BASE}/v3/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'com.playtomic.app',
        'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
      },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Playtomic login failed: ${res.status} — ${body}`)
    }
    const data = await res.json()
    if (!data.access_token) throw new Error('Playtomic login: no access_token')
    this.token = data.access_token
    this.userId = data.user_id ?? null
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
    // API returns one entry per (resource_id, date). Group by resource_id and merge slots.
    // Each entry has: { resource_id, start_date: "2026-06-19", name?, slots: [{start_time: "11:00:00", duration, price: "20.8 EUR"}] }
    const raw: any[] = Array.isArray(data) ? data : (data.content ?? data.resources ?? [])
    const byResource = new Map<string, PlaytomicResource>()
    let courtIndex = 1
    for (const entry of raw) {
      const id: string = entry.resource_id
      const date: string = entry.start_date ?? ''
      if (!byResource.has(id)) {
        byResource.set(id, {
          resource_id: id,
          name: entry.name ?? entry.resource_name ?? `Pista ${courtIndex++}`,
          slots: [],
        })
      }
      const resource = byResource.get(id)!
      for (const s of (entry.slots ?? [])) {
        const start_time = date && s.start_time ? `${date}T${s.start_time}Z` : ''
        const priceRaw = s.price ?? 0
        const price = typeof priceRaw === 'string' ? parseFloat(priceRaw) : priceRaw
        resource.slots.push({ start_time, duration: s.duration ?? 90, price })
      }
    }
    return Array.from(byResource.values())
  }

  async createMatch(opts: {
    tenantId: string
    resourceId: string
    startTime: string
    durationMinutes: number
    playersNeeded?: number
  }): Promise<{ matchId: string; matchUrl: string }> {
    if (!this.token || !this.userId) throw new Error('Not authenticated')
    const numPlayers = opts.playersNeeded ?? 4

    // Step 1: Create payment intent (Playtomic's booking flow)
    const piRes = await fetch(`${CONSUMER_BASE}/v1/payment_intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        'X-Requested-With': 'com.playtomic.app',
        'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
      },
      body: JSON.stringify({
        allowed_payment_method_types: ['OFFER', 'CASH', 'MERCHANT_WALLET', 'DIRECT', 'SWISH', 'IDEAL', 'BANCONTACT', 'PAYTRAIL', 'CREDIT_CARD', 'QUICK_PAY'],
        user_id: this.userId,
        cart: {
          requested_item: {
            cart_item_type: 'CUSTOMER_MATCH',
            cart_item_voucher_id: null,
            cart_item_data: {
              supports_split_payment: true,
              payment_plan: 'SPLIT',
              number_of_players: numPlayers,
              tenant_id: opts.tenantId,
              resource_id: opts.resourceId,
              start: opts.startTime,
              duration: opts.durationMinutes,
              match_registrations: [{ user_id: this.userId, pay_now: true }],
            },
          },
        },
      }),
    })
    if (!piRes.ok) {
      const err = await piRes.text()
      throw new Error(`Playtomic createMatch (payment_intent) failed ${piRes.status}: ${err}`)
    }
    const piData = await piRes.json()
    const piId: string = piData.payment_intent_id ?? piData.id ?? ''
    if (!piId) throw new Error('No payment_intent_id in Playtomic response')

    // Step 2: Seleccionar método de pago via PATCH
    // El campo correcto es selected_payment_method_id con el payment_method_id completo del método
    const availableMethods: any[] = piData.available_payment_methods ?? []
    const walletMethod = availableMethods.find((m: any) => m.method_type === 'MERCHANT_WALLET')
    const bestMethod = walletMethod ?? availableMethods[0] ?? null

    if (bestMethod && piData.status === 'REQUIRES_PAYMENT_METHOD') {
      const fullId: string = bestMethod.payment_method_id ?? bestMethod.method_type
      await fetch(`${CONSUMER_BASE}/v1/payment_intents/${piId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'X-Requested-With': 'com.playtomic.app',
          'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
        },
        body: JSON.stringify({ selected_payment_method_id: fullId }),
      })
    }

    // Step 3: Confirm
    const confirmRes = await fetch(`${CONSUMER_BASE}/v1/payment_intents/${piId}/confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        'X-Requested-With': 'com.playtomic.app',
        'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
      },
      body: JSON.stringify({}),
    })
    if (!confirmRes.ok) {
      const err = await confirmRes.text()
      throw new Error(`Playtomic confirm failed ${confirmRes.status}: ${err}`)
    }
    const confirmData = await confirmRes.json()

    const matchId: string =
      confirmData.match_id ??
      confirmData.id ??
      confirmData.cart?.confirmed_item?.match_id ??
      confirmData.cart?.confirmed_item?.id ??
      confirmData.cart?.cart_item?.match_id ??
      piId
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

export class PlaytomicOfficialClient {
  private token: string | null = null

  async login(clientId: string, clientSecret: string): Promise<void> {
    // Playtomic uses { client_id, secret } with JSON (not oauth standard)
    const res = await fetch(`${OFFICIAL_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret: clientSecret }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Playtomic API auth failed: ${res.status} — ${text}`)
    }
    const data = await res.json()
    if (!data.token) throw new Error('Playtomic API: no token')
    this.token = data.token
  }

  async getVenuePlayers(tenantId: string): Promise<PlaytomicPlayer[]> {
    if (!this.token) throw new Error('Not authenticated')
    const players: PlaytomicPlayer[] = []
    let cursorId: string | null = null

    while (true) {
      const params = new URLSearchParams({ limit: '100' })
      if (cursorId) params.set('cursor_id', cursorId)

      const res = await fetch(`${OFFICIAL_BASE}/venues/${tenantId}/players?${params}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`getVenuePlayers failed: ${res.status} — ${text}`)
      }
      const data = await res.json()
      // Response: { has_more, next_cursor_id, data: [...] }
      const page: any[] = data.data ?? (Array.isArray(data) ? data : [])
      if (!page.length) break

      for (const p of page) {
        players.push({
          user_id: p.player_id ?? p.user_id ?? '',
          name: p.name ?? '',
          email: p.email ?? '',
          phone: p.phone ?? undefined,
          gender: p.gender ?? undefined,
        })
      }

      if (!data.has_more) break
      cursorId = data.next_cursor_id ?? null
      if (!cursorId) break
    }

    return players
  }
}
