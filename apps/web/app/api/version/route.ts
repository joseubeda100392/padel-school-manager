export const dynamic = 'force-dynamic'
// Deploy de prueba: comprobar que el banner de actualización salta en iOS
import { NextResponse } from 'next/server'

export async function GET() {
  const version = process.env.RAILWAY_GIT_COMMIT_SHA ?? 'dev'
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
}
