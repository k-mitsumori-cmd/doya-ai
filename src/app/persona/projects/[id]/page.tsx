import { notFound } from 'next/navigation'
import PersonaSavedProject from '@/components/persona/PersonaSavedProject'

export const metadata = { robots: { index: false, follow: false } }

export default async function PersonaProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) notFound()
  return <PersonaSavedProject projectId={id} />
}
