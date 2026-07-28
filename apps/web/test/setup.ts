import { vi } from 'vitest'

// Mock Next.js server internals
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
  headers: vi.fn(() => ({ get: vi.fn() })),
}))
