import type { Metadata, Viewport } from 'next'
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'ePadel School — Panel Admin',
  description: 'La plataforma digital para gestionar tu escuela de pádel. Clases, alumnos, reservas y pagos en un solo lugar.',
  robots: { index: false, follow: false },
  verification: { google: 'd855c92217cfc88d' },
  manifest: '/manifest.json',
  openGraph: {
    title: 'ePadel School',
    description: 'La plataforma digital para gestionar tu escuela de pádel. Clases, alumnos, reservas y pagos en un solo lugar.',
    url: 'https://epadelschool.app',
    siteName: 'ePadel School',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ePadel School',
    description: 'La plataforma digital para gestionar tu escuela de pádel.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ePadel School',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sora.variable} ${dmSans.variable} font-sans antialiased`}>
        <SwipeGuard />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
