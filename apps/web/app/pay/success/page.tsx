export const dynamic = 'force-dynamic'
import { PaymentReturn } from '../payment-return'

export default function PaySuccessPage({ searchParams }: { searchParams: { order?: string } }) {
  return <PaymentReturn order={searchParams.order} fallback="success" />
}
