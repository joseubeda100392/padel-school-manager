import { redirect } from 'next/navigation'

export default function LegalIndexPage({ params }: { params: { slug: string } }) {
  redirect(`/legal/${params.slug}/aviso-legal`)
}
