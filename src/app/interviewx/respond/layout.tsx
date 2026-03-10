import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'アンケート回答 — ドヤインタビューAI-X',
  description: 'インタビュー記事のためのアンケートに回答します。',
}

export default function RespondLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  )
}
