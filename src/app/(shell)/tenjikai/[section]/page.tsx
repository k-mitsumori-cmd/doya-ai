import { notFound } from 'next/navigation'
import { SECTIONS } from '@/lib/tenjikai/nav'

// /tenjikai/<section>。画面は layout.tsx の TenjikaiApp が URL を見て描く。ここは知らないパスを 404 にするだけ

export default async function TenjikaiSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (section === 'new' || !(SECTIONS as readonly string[]).includes(section)) notFound()
  return null
}
