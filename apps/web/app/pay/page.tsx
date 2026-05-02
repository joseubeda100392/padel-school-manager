'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PayPage() {
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 text-4xl">💳</div>
        <p className="text-gray-600">Redirigiendo al pago seguro...</p>
        <form ref={formRef} action={redsysUrl} method="POST" className="hidden">
          <input type="hidden" name="Ds_SignatureVersion" value="HMAC_SHA256_V1" />
          <input type="hidden" name="Ds_MerchantParameters" value={merchantParameters} />
          <input type="hidden" name="Ds_Signature" value={signature} />
        </form>
      </div>
    </div>
  )
}
