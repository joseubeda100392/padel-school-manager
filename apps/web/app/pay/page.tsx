'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function PayForm() {
  const params = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)

  const redsysUrl = params.get('url') ?? ''
  const merchantParameters = params.get('Ds_MerchantParameters') ?? ''
  const signature = params.get('Ds_Signature') ?? ''

  useEffect(() => {
    if (formRef.current && redsysUrl) {
      formRef.current.submit()
    }
  }, [redsysUrl])

  return (
    <form ref={formRef} action={redsysUrl} method="POST" className="hidden">
      <input type="hidden" name="Ds_SignatureVersion" value="HMAC_SHA256_V1" />
      <input type="hidden" name="Ds_MerchantParameters" value={merchantParameters} />
      <input type="hidden" name="Ds_Signature" value={signature} />
    </form>
  )
}

export default function PayPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex flex-col items-center text-center">
        <span aria-hidden className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <Loader2 className="h-6 w-6 animate-spin" />
        </span>
        <p role="status" className="text-body text-ink-2">Redirigiendo al pago seguro...</p>
        <Suspense>
          <PayForm />
        </Suspense>
      </div>
    </div>
  )
}
