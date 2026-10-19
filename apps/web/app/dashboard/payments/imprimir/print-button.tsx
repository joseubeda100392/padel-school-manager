'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="w-full sm:w-auto">
      <Printer className="h-4 w-4" aria-hidden />
      Imprimir o guardar en PDF
    </Button>
  )
}
