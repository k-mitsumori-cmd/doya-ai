'use client'

// ドヤポップアップ: 画面の読み込みに失敗したとき（§11 のエラー表示）
// ⚠️ 技術的な文言（ステータスコード・例外名）は出さない
import { ErrorState } from '@/components/popup/ui'

export default function PopupError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pd-page mx-auto max-w-3xl px-4 py-12 md:px-8">
      <ErrorState message="通信がうまくいかなかったか、一時的に混み合っています。少し待ってからもう一度お試しください。" onRetry={reset} />
    </div>
  )
}
