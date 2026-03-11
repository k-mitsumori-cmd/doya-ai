import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ヒヤリング回答 — ドヤヒヤリングAI',
  description: 'AIチャットでヒヤリングに回答します。',
}

export default function RespondLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  )
}
