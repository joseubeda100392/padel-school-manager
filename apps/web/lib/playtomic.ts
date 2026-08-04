const CONSUMER_BASE = 'https://api.playtomic.io'
const OFFICIAL_BASE = 'https://thirdparty.playtomic.io/api/v1'

export type PlaytomicPlayer = {
  user_id: string
  name: string
  email: string
  phone?: string
  gender?: string
  level?: number
  birthDate?: string
  lastActivity?: string
  acceptsMarketing?: boolean
  otherSports?: { sportId: string; level: number }[]
  benefits?: { name: string; type: string; expiresAt?: string }[]
  walletBalance?: string
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

// Espera progresiva ante 429 (límite de peticiones), tal como recomienda la
// documentación de Playtomic: 1s → 2s → 4s. Cap bajo a propósito para no
// alargar demasiado una respuesta HTTP de nuestra propia API.
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let lastRes: Response | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429) return res
    lastRes = res
    if (attempt < maxRetries) {
      const waitMs = 1000 * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
  return lastRes!
}

// Cache del token de login por email — evita re-autenticar en cada llamada
// (dry-run, envío real, etc.), que es justo el patrón de "muchos logins
// seguidos con la misma cuenta" que puede parecer sospechoso a Playtomic.
// Vida corta y conservadora porque no conocemos la expiración real del token.
const TOKEN_TTL_MS = 15 * 60 * 1000
const tokenCache = new Map<string, { token: string; userId: string | null; expiresAt: number }>()

export class PlaytomicClient {
  private token: string | null = null
  private userId: string | null = null

  async login(email: string, password: string): Promise<void> {
    const cached = tokenCache.get(email)
    if (cached && cached.expiresAt > Date.now()) {
      this.token = cached.token
      this.userId = cached.userId
      return
    }

    const res = await fetchWithRetry(`${CONSUMER_BASE}/v3/auth/login`, {
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
    tokenCache.set(email, { token: this.token as string, userId: this.userId, expiresAt: Date.now() + TOKEN_TTL_MS })
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
    const res = await fetchWithRetry(`${CONSUMER_BASE}/v1/availability?${params}`, {
      headers: {
        'X-Requested-With': 'com.playtomic.web',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      },
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
    dryRun?: boolean
  }): Promise<{ matchId: string; matchUrl: string; dryRun?: true; preview?: object }> {
    if (!this.token || !this.userId) throw new Error('Not authenticated')
    const numPlayers = opts.playersNeeded ?? 4
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'X-Requested-With': 'com.playtomic.app',
      'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
    }

    // Intento 1: endpoint v2 directo para SPLIT (sin payment_intent flow).
    // OJO: este POST crea el partido de verdad si tiene éxito — no hay forma
    // conocida de "probarlo" sin ejecutarlo. Por eso en dryRun nos lo
    // saltamos por completo y vamos directos a la vía de payment_intent, que
    // sí tiene un punto de parada seguro antes de confirmar/cobrar (ver Step 3).
    if (!opts.dryRun) {
      const v2Body = {
        user_id: this.userId,
        tenant_id: opts.tenantId,
        resource_id: opts.resourceId,
        start: opts.startTime,
        duration: opts.durationMinutes,
        number_of_players: numPlayers,
        supports_split_payment: true,
        match_registrations: [{ user_id: this.userId, pay_now: false }],
      }
      const v2Res = await fetchWithRetry(`${CONSUMER_BASE}/v2/matches/cart_items/customer_matches`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(v2Body),
      })
      const v2Body2 = await v2Res.text()
      console.error(`[pista-viva] v2 direct → ${v2Res.status}: ${v2Body2.slice(0, 300)}`)

      if (v2Res.ok) {
        let v2Data: any = {}
        try { v2Data = JSON.parse(v2Body2) } catch {}
        const matchId: string = v2Data.match_id ?? v2Data.id ?? ''
        if (matchId) {
          await this.publishMatch(matchId)
          return { matchId, matchUrl: `https://app.playtomic.com/matches/${matchId}` }
        }
      }
    }

    // Fallback (o único intento en dryRun): payment_intent flow con MERCHANT_WALLET (SINGLE_PAYER)
    const piRes = await fetchWithRetry(`${CONSUMER_BASE}/v1/payment_intents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        allowed_payment_method_types: ['OFFER', 'CASH', 'MERCHANT_WALLET', 'DIRECT', 'SWISH', 'IDEAL', 'BANCONTACT', 'PAYTRAIL', 'CREDIT_CARD', 'QUICK_PAY'],
        user_id: this.userId,
        cart: {
          requested_item: {
            cart_item_type: 'CUSTOMER_MATCH',
            cart_item_voucher_id: null,
            cart_item_data: {
              supports_split_payment: true,
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
    console.error('[pista-viva] pi:', JSON.stringify({ status: piData.status, price: piData.price, split_payment_parts: piData.cart?.item?.cart_item_data?.split_payment_parts, match_payment_plan_type: piData.cart?.item?.cart_item_data?.match_payment_plan_type, registrations: piData.cart?.item?.cart_item_data?.match_registrations }))
    const piId: string = piData.payment_intent_id ?? piData.id ?? ''
    if (!piId) throw new Error('No payment_intent_id in Playtomic response')

    // Step 2: Seleccionar método de pago via PATCH
    // Probando QUICK_PAY primero: crea match abierto donde cada jugador paga su parte
    // Si QUICK_PAY no disponible, fallback a MERCHANT_WALLET
    const availableMethods: any[] = piData.available_payment_methods ?? []
    const walletMethod = availableMethods.find((m: any) => m.method_type === 'MERCHANT_WALLET')
    const bestMethod = walletMethod ?? availableMethods[0] ?? null
    console.error('[pista-viva] available_methods:', availableMethods.map((m: any) => m.method_type), '| selected:', bestMethod?.method_type)

    if (bestMethod && piData.status === 'REQUIRES_PAYMENT_METHOD') {
      const fullId: string = bestMethod.payment_method_id ?? bestMethod.method_type
      const patchRes = await fetchWithRetry(`${CONSUMER_BASE}/v1/payment_intents/${piId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'X-Requested-With': 'com.playtomic.app',
          'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
        },
        body: JSON.stringify({
          selected_payment_method_id: fullId,
          split_payment_parts: numPlayers,
        }),
      })
      const pd = await patchRes.json().catch(() => ({}))
      const reg = pd.cart?.item?.cart_item_data?.match_registrations?.[0]
      console.error('[pista-viva] PATCH → price_total:', pd.price, '| reg_price:', reg?.price, '| split_parts:', pd.cart?.item?.cart_item_data?.split_payment_parts, '| method_id:', pd.selected_payment_method_id)

      if (opts.dryRun) {
        return {
          matchId: 'dry-run',
          matchUrl: 'dry-run',
          dryRun: true,
          preview: { price_total: pd.price, reg_price: reg?.price, split_parts: pd.cart?.item?.cart_item_data?.split_payment_parts, method_id: pd.selected_payment_method_id, pi_status_before_patch: piData.status, pi_status_after_patch: pd.status, available_methods: piData.available_payment_methods?.map((m: any) => m.method_type) },
        }
      }
    }

    if (opts.dryRun) {
      return {
        matchId: 'dry-run',
        matchUrl: 'dry-run',
        dryRun: true,
        preview: { pi_status: piData.status, available_methods: piData.available_payment_methods?.map((m: any) => m.method_type), note: 'no payment method selected' },
      }
    }

    // Step 3: Confirm
    const confirmRes = await fetchWithRetry(`${CONSUMER_BASE}/v1/payment_intents/${piId}/confirmation`, {
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
    console.error('[pista-viva] confirm response:', JSON.stringify(confirmData))

    const matchId: string =
      confirmData.match_id ??
      confirmData.id ??
      confirmData.cart?.confirmed_item?.match_id ??
      confirmData.cart?.confirmed_item?.id ??
      confirmData.cart?.cart_item?.match_id ??
      piId

    // Step 4: Make match visible (created as HIDDEN by default)
    await this.publishMatch(matchId)

    const matchUrl = `https://app.playtomic.com/matches/${matchId}`
    return { matchId, matchUrl }
  }

  async publishMatch(matchId: string): Promise<void> {
    if (!this.token) throw new Error('Not authenticated')
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'X-Requested-With': 'com.playtomic.app',
      'User-Agent': 'Playtomic/1 CFNetwork/1410.1 Darwin/22.6.0',
    }
    for (const visibility of ['PUBLIC', 'VISIBLE']) {
      const res = await fetchWithRetry(`${CONSUMER_BASE}/v1/matches/${matchId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ visibility }),
      })
      const body = await res.text()
      console.error(`[pista-viva] publishMatch visibility=${visibility} → ${res.status}: ${body.slice(0, 200)}`)
      if (res.ok) return
    }
  }

  async getMatchStatus(matchId: string): Promise<PlaytomicMatchStatus> {
    const res = await fetchWithRetry(`${CONSUMER_BASE}/v1/matches/${matchId}`, {
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
    const res = await fetchWithRetry(`${CONSUMER_BASE}/v1/tenants?${params}`, {
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
    const res = await fetchWithRetry(`${OFFICIAL_BASE}/oauth/token`, {
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
      const params = new URLSearchParams({ limit: '100', include: 'SPORTS,BENEFITS,WALLETS' })
      if (cursorId) params.set('cursor_id', cursorId)

      const res = await fetchWithRetry(`${OFFICIAL_BASE}/venues/${tenantId}/players?${params}`, {
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
        const sports: any[] = p.sports ?? []
        const padelSport = sports.find((s: any) => s.sport_id === 'PADEL')
        const otherSports = sports
          .filter((s: any) => s.sport_id !== 'PADEL')
          .map((s: any) => ({ sportId: s.sport_id, level: s.level_value }))
        const wallets: any[] = p.wallets ?? []
        const walletBalance = wallets.length ? wallets.map((w: any) => `${w.name ?? ''}: ${w.balance ?? 0}`).join(' / ') : undefined
        const benefits: any[] = (p.benefits ?? []).map((b: any) => ({ name: b.name, type: b.type, expiresAt: b.expires_at }))

        players.push({
          user_id: p.player_id ?? p.user_id ?? '',
          name: p.name ?? '',
          email: p.email ?? '',
          phone: p.phone ?? undefined,
          gender: p.gender ?? undefined,
          birthDate: p.birth_date ?? undefined,
          lastActivity: p.last_registration_date ?? undefined,
          acceptsMarketing: p.accepts_commercial_communications ?? undefined,
          otherSports: otherSports.length ? otherSports : undefined,
          benefits: benefits.length ? benefits : undefined,
          walletBalance,
          level: padelSport?.level_value ?? undefined,
        })
      }

      if (!data.has_more) break
      cursorId = data.next_cursor_id ?? null
      if (!cursorId) break
    }

    return players
  }

  // Diagnóstico: trae una muestra sin paginar y sin mapear, tal cual la
  // devuelve Playtomic (con SPORTS/nivel incluido) — para inspeccionar qué
  // campos trae de verdad antes de decidir si compensa importarlos.
  async getVenuePlayersSample(tenantId: string, limit = 10): Promise<unknown> {
    if (!this.token) throw new Error('Not authenticated')
    const params = new URLSearchParams({ limit: String(limit), include: 'SPORTS' })
    const res = await fetchWithRetry(`${OFFICIAL_BASE}/venues/${tenantId}/players?${params}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`getVenuePlayersSample failed: ${res.status} — ${text}`)
    }
    return res.json()
  }

  // Partidos/reservas del venue — GET /api/v1/bookings. tenant_id + rango de
  // fechas son obligatorios. resource_id/resource_name indica si ya tienen
  // pista asignada.
  //
  // El parámetro booking_type=OPEN_MATCH documentado NO filtra de forma
  // fiable en la práctica (comprobado con datos reales: devuelve también
  // RECURRING_BOOKING canceladas) — probablemente porque la doc consultada
  // vive en un dominio distinto (third-party.playtomic.io) al host real de
  // la API (thirdparty.playtomic.io) y puede no ser oficial. Por eso aquí
  // NO se manda el filtro: se pagina por `page` hasta agotar resultados
  // (paginación por página, sin cursor, según las convenciones documentadas)
  // y el filtrado real se hace en getVenuePendingOpenMatches().
  async getVenueBookingsRaw(
    tenantId: string,
    startBookingDate: string,
    endBookingDate: string,
    maxPages = 10,
  ): Promise<any[]> {
    if (!this.token) throw new Error('Not authenticated')
    const size = 200
    const all: any[] = []

    for (let page = 0; page < maxPages; page++) {
      const qs = new URLSearchParams({
        tenant_id: tenantId,
        start_booking_date: startBookingDate,
        end_booking_date: endBookingDate,
        size: String(size),
        page: String(page),
      })
      const res = await fetchWithRetry(`${OFFICIAL_BASE}/bookings?${qs}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`getVenueBookingsRaw failed: ${res.status} — ${text}`)
      }
      const data = await res.json()
      const items: any[] = Array.isArray(data) ? data : (data.data ?? [])
      all.push(...items)
      if (items.length < size) break
    }

    return all
  }

  // Partidos abiertos que aún necesitan jugadores — filtrado en nuestro
  // lado porque el filtro de servidor no es fiable (ver nota arriba).
  //
  // Comprobado con datos reales: `resource_id` NO sirve para detectar
  // "pendiente" — Playtomic reserva la pista desde que hay 2 jugadores
  // apuntados, así que un partido con pista asignada puede seguir sin
  // llenarse. El campo `status` tampoco (PENDING solo indica que aún no ha
  // empezado la hora, da igual si está lleno o no).
  //
  // La señal fiable es `payment_status`: en pago dividido cada jugador paga
  // su parte al apuntarse, así que mientras no estén todos, el pago total
  // no puede estar completo (PARTIAL_PAID). Se usa como criterio principal
  // porque no depende de asumir que un partido siempre son 4 jugadores.
  // El número de participantes se calcula igualmente solo como contexto
  // informativo (cuántos faltan), no como filtro.
  async getVenuePendingOpenMatches(
    tenantId: string,
    startBookingDate: string,
    endBookingDate: string,
  ): Promise<any[]> {
    const all = await this.getVenueBookingsRaw(tenantId, startBookingDate, endBookingDate)
    return all.filter((b) =>
      b.booking_type === 'OPEN_MATCH' &&
      !b.is_canceled &&
      b.payment_status !== 'PAID' &&
      b.payment_status !== 'VOID' &&
      b.payment_status !== 'REFUNDED',
    )
  }
}
