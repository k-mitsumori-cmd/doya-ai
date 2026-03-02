import type { Metadata } from 'next'
import VoiceLayout from '@/components/voice/VoiceLayout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ドヤボイスAI - 自然な日本語ナレーション音声を生成',
  description: 'テキストを入力するだけで自然な日本語ナレーション音声を生成。12種のボイスキャラクター、クラウド録音スタジオ、バッチ生成対応。',
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <VoiceLayout>{children}</VoiceLayout>
}
