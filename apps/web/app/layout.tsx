import type { Metadata, Viewport } from 'next'
import { Sora, DM_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import { SwipeGuard } from '@/components/swipe-guard'
import { UpdateChecker } from '@/components/update-checker'
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
  // Cabecera de la app en blanco: barra de estado clara con iconos oscuros.
  themeColor: '#FFFFFF',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://epadelschool.app'),
  title: { default: 'ePadel School', template: '%s · ePadel School' },
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
    statusBarStyle: 'default',
    title: 'ePadel School',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const currentVersion = process.env.RAILWAY_GIT_COMMIT_SHA ?? 'dev'

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${sora.variable} ${dmSans.variable} font-sans antialiased`}>
        <SwipeGuard />
        {children}
        <Toaster
          position="top-center"
          offset="calc(var(--safe-top) + 12px)"
          toastOptions={{
            classNames: {
              toast: 'font-sans rounded-card border border-line bg-surface text-ink shadow-overlay',
              title: 'text-label text-ink',
              description: 'text-meta text-ink-2',
              success: '[&_[data-icon]]:text-accent-ink',
              error: '[&_[data-icon]]:text-danger-ink',
            },
          }}
        />
        <UpdateChecker currentVersion={currentVersion} />
      </body>
    </html>
  )
}
