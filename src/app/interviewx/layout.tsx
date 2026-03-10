import { Metadata } from 'next'
import InterviewXLayout from '@/components/interviewx/InterviewXLayout'

export const metadata: Metadata = {
  title: 'ドヤインタビューAI-X — アンケート型AI記事生成',
  description: 'アンケートを送るだけで、プロ品質のインタビュー記事が自動完成。テンプレート選択→質問生成→共有→記事生成→フィードバック→品質チェックまで一気通貫。',
  openGraph: {
    title: 'ドヤインタビューAI-X — アンケート型AI記事生成',
    description: 'アンケートを送るだけで、プロ品質のインタビュー記事が自動完成。',
    url: 'https://doya-ai.surisuta.jp/interviewx',
    siteName: 'ドヤAI',
    type: 'website',
    locale: 'ja_JP',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <InterviewXLayout>
        {children}
      </InterviewXLayout>
    </>
  )
}
