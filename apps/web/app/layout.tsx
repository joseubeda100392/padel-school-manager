import type { Metadata } from 'next'
import { Sora, DM_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import { SwipeGuard } from '@/components/swipe-guard'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ePadel School — Panel Admin',
  description: 'Panel de gestión para escuelas de pádel',
  robots: { index: false, follow: false },
  verification: { google: 'd855c92217cfc88d' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ePadel School',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/*
        viewport-fit=cover injected as static HTML — NOT via Next.js viewport export.
        Next.js removes/re-adds viewport meta during client navigations which resets
        env(safe-area-inset-top/bottom) to 0. Static <head> tags survive navigations intact.
      */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${sora.variable} ${dmSans.variable} font-sans antialiased`}>
        <SwipeGuard />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
