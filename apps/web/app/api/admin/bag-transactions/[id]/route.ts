export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// Borra un movimiento del historial de bolsa — SOLO super admin. Pensado
// para limpiar rastro de pruebas (ej. cuentas de prueba usadas para probar
// el módulo de particulares), no para "corregir" saldos: esto NUNCA toca
// class_bag.balance — si el saldo también hay que ajustarlo, se hace con
// la herramienta de ajuste manual normal (BagAdjustForm).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo el super admin puede borrar movimientos del historial' }, { status: 403 })
  }

  const { error } = await admin.from('bag_transactions').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Error al borrar el movimiento' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
