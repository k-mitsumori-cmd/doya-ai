import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import VoiceLayout from '@/components/voice/VoiceLayout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: {
    canonical: '/voice',
  },
  title: 'ドヤボイスAI - 自然な日本語ナレーション音声を生成',
  description: 'テキストを入力するだけで自然な日本語ナレーション音声を生成。12種のボイスキャラクター、クラウド録音スタジオ、バッチ生成対応。',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/voice', name: 'ドヤボイスAI', description: '自然な日本語ナレーション音声をAIで生成するツール。', category: 'MultimediaApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <VoiceLayout>{children}</VoiceLayout>
    </>
  )
}
