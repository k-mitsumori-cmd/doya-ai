import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import InterviewLayout from '@/components/interview/InterviewLayout'

export const metadata: Metadata = {
  title: 'ドヤインタビューAI — AI記事生成',
  description: 'インタビュー音声からプロ品質の記事をAIが自動生成。文字起こし→構成→執筆→校正まで一気通貫。',
  openGraph: {
    title: 'ドヤインタビューAI — AI記事生成',
    description: 'インタビュー音声からプロ品質の記事をAIが自動生成。文字起こし→構成→執筆→校正まで一気通貫。',
    url: 'https://doya-ai.surisuta.jp/interview',
    siteName: 'ドヤAI',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ドヤインタビューAI — AI記事生成',
    description: 'インタビュー音声からプロ品質の記事をAIが自動生成。',
  },
  alternates: {
    canonical: 'https://doya-ai.surisuta.jp/interview',
  },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  const isLoggedIn = !!user?.id
  let currentPlan = 'GUEST'
  if (isLoggedIn) {
    const raw = user?.interviewPlan || user?.plan || 'FREE'
    currentPlan = String(raw).toUpperCase()
    if (!['FREE', 'PRO', 'ENTERPRISE'].includes(currentPlan)) {
      currentPlan = 'FREE'
    }
  }

  return (
    <>
      {/* Material Symbols Outlined font（root layout と同じ URL パラメータ） */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />
      {/* Noto Sans JP — リッチなフォント */}
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .interview-root {
          font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          font-weight: 600;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .interview-root *:not(.material-symbols-outlined) {
          font-family: inherit !important;
        }
        .interview-root .material-symbols-outlined {
          font-family: 'Material Symbols Outlined' !important;
          font-weight: normal !important;
          font-style: normal !important;
          opacity: 1 !important;
        }
        /* 全体的にフォントウェイトを底上げ（アイコンは除外） */
        .interview-root p:not(.material-symbols-outlined),
        .interview-root span:not(.material-symbols-outlined),
        .interview-root div:not(.material-symbols-outlined),
        .interview-root a:not(.material-symbols-outlined),
        .interview-root button:not(.material-symbols-outlined),
        .interview-root label:not(.material-symbols-outlined),
        .interview-root input:not(.material-symbols-outlined),
        .interview-root textarea:not(.material-symbols-outlined),
        .interview-root select:not(.material-symbols-outlined) {
          font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif !important;
        }
        /* font-normal (400) → 500, font-medium (500) → 600 に底上げ */
        .interview-root .font-normal { font-weight: 600 !important; }
        .interview-root .font-medium { font-weight: 600 !important; }
        .interview-root .font-semibold { font-weight: 700 !important; }
        .interview-root .font-bold { font-weight: 800 !important; }
        .interview-root .font-extrabold { font-weight: 900 !important; }
        .interview-root .font-black { font-weight: 900 !important; }
      `}</style>
      <div className="interview-root">
        <InterviewLayout currentPlan={currentPlan} isLoggedIn={isLoggedIn}>
          {children}
        </InterviewLayout>
      </div>
    </>
  )
}
