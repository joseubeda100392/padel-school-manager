export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  const version = process.env.RAILWAY_GIT_COMMIT_SHA ?? 'dev'
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
}
