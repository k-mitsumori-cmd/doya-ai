import { Metadata } from 'next'
import InterviewXLayout from '@/components/interviewx/InterviewXLayout'

export const metadata: Metadata = {
  title: 'ドヤヒヤリングAI — AIチャットで自動ヒヤリング',
  description: 'AIチャットでヒヤリングを実施、要約まで自動生成。商談・サービス調査・顧客満足度など多様なカテゴリに対応。URL事前調査で的確な質問を自動生成。',
  openGraph: {
    title: 'ドヤヒヤリングAI — AIチャットで自動ヒヤリング',
    description: 'AIチャットでヒヤリングを実施、要約まで自動生成。',
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
