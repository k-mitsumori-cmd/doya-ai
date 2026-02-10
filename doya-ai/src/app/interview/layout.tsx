import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import InterviewLayout from '@/components/interview/InterviewLayout'

export const metadata: Metadata = {
  title: 'Doya Interview AI — AI記事生成',
  description: 'インタビュー音声からプロ品質の記事をAIが自動生成。文字起こし→構成→執筆→校正まで一気通貫。',
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
      {/* Material Symbols Outlined font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
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
        .interview-root * {
          font-family: inherit !important;
        }
        .interview-root .material-symbols-outlined {
          font-family: 'Material Symbols Outlined' !important;
        }
        /* 全体的にフォントウェイトを底上げ */
        .interview-root p,
        .interview-root span,
        .interview-root div,
        .interview-root a,
        .interview-root button,
        .interview-root label,
        .interview-root input,
        .interview-root textarea,
        .interview-root select {
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
