// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type UserRole = 'student' | 'coach' | 'admin' | 'super_admin'
export type ClubPlan = 'trial' | 'basic' | 'pro'
export type CourtType = 'indoor' | 'outdoor' | 'covered'
export type RecurrenceType = 'none' | 'weekly' | 'biweekly'
export type BookingStatus = 'confirmed' | 'no_show' | 'cancelled' | 'pending'
export type BookingSource = 'subscription' | 'bag' | 'pay_per_class'
export type PaymentType = 'subscription' | 'pay_per_class' | 'class_pack'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type ThreadStatus = 'active' | 'resolved'
export type BagTransactionType = 'credit' | 'debit'
export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'class_reminder'
  | 'chat_message'
  | 'level_updated'
  | 'payment_succeeded'
  | 'payment_failed'

// ─────────────────────────────────────────────
// CLUB (tabla maestra multi-tenant)
// ─────────────────────────────────────────────

export interface Club {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  plan: ClubPlan
  isActive: boolean
  redsysMerchantCode?: string | null
  redsysMerchantKey?: string | null
  redsysMerchantTerminal?: string | null
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────
// ENTIDADES BASE
// ─────────────────────────────────────────────

export interface User {
  id: string
  email: string
  role: UserRole
  name: string
  avatarUrl?: string | null
  phone?: string | null
  isActive: boolean
  clubId?: string | null
  currentLevelId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Level {
  id: string
  name: string
  description?: string | null
  color: string
  order: number
  clubId?: string | null
  createdAt: Date
}

export interface UserLevel {
  id: string
  userId: string
  levelId: string
  assignedBy: string
  notes?: string | null
  createdAt: Date
}

export interface Court {
  id: string
  name: string
  type: CourtType
  isActive: boolean
  clubId?: string | null
  createdAt: Date
}

export interface Schedule {
  id: string
  courtId: string
  coachId: string
  startTime: Date
  endTime: Date
  recurrence: RecurrenceType
  maxStudents: number
  isActive: boolean
  clubId?: string | null
  createdAt: Date
}

export interface Booking {
  id: string
  scheduleId: string
  studentId: string
  status: BookingStatus
  source: BookingSource
  notes?: string | null
  clubId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ClassBag {
  id: string
  userId: string
  balance: number
  clubId?: string | null
  updatedAt: Date
}

export interface BagTransaction {
  id: string
  userId: string
  classBagId: string
  delta: number
  type: BagTransactionType
  reason: string
  bookingId?: string | null
  clubId?: string | null
  createdAt: Date
}

export interface Payment {
  id: string
  userId: string
  bookingId?: string | null
  stripePaymentIntentId?: string | null
  stripeSubscriptionId?: string | null
  redsysOrderId?: string | null
  amount: number
  currency: string
  type: PaymentType
  status: PaymentStatus
  metadata?: Record<string, unknown> | null
  clubId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ChatThread {
  id: string
  userId: string
  status: ThreadStatus
  subject?: string | null
  clubId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  id: string
  threadId: string
  senderId: string
  content: string
  readAt?: Date | null
  createdAt: Date
}

export interface Material {
  id: string
  title: string
  description?: string | null
  fileUrl: string
  fileSize?: number | null
  uploadedBy: string
  isPublished: boolean
  clubId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MaterialLevel {
  materialId: string
  levelId: string
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown> | null
  isRead: boolean
  clubId?: string | null
  createdAt: Date
}

// ─────────────────────────────────────────────
// TIPOS COMPUESTOS (con relaciones incluidas)
// ─────────────────────────────────────────────

export interface UserWithLevel extends User {
  currentLevel?: Level | null
}

export interface ScheduleWithDetails extends Schedule {
  court: Court
  coach: User
  bookings: Booking[]
  spotsAvailable: number
}

export interface BookingWithDetails extends Booking {
  schedule: ScheduleWithDetails
  student: UserWithLevel
}

export interface ChatThreadWithMessages extends ChatThread {
  user: User
  messages: ChatMessage[]
  lastMessage?: ChatMessage | null
  unreadCount: number
}

export interface MaterialWithLevels extends Material {
  levels: Level[]
}

// ─────────────────────────────────────────────
// TIPOS DE API / RESPUESTA
// ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ─────────────────────────────────────────────
// PAYLOADS DE ACCIÓN
// ─────────────────────────────────────────────

export interface BookClassPayload {
  scheduleId: string
  source: BookingSource
}

export interface CreatePaymentIntentPayload {
  bookingId: string
  amount: number
}

export interface SendMessagePayload {
  threadId: string
  content: string
}

export interface UpdateLevelPayload {
  userId: string
  levelId: string
  notes?: string
}

export interface UploadMaterialPayload {
  title: string
  description?: string
  levelIds: string[]
  file: File
}
