export const dynamic = 'force-dynamic'
import { PaymentReturn } from '../payment-return'

export default function PayErrorPage({ searchParams }: { searchParams: { order?: string } }) {
  return <PaymentReturn order={searchParams.order} fallback="error" />
}
