'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/promane/ui/button'
import { FeedbackButton } from '@/components/promane/feedback-button'

export default function PromaneError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Promane Error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-rose-200 p-10 text-center space-y-5">
        <Image src="/character/error.png" alt="" width={120} height={120} className="mx-auto" unoptimized />
        <div>
          <h1 className="text-[24px] font-black text-rose-700 mb-2">あれれ、エラーが発生したよ</h1>
          <p className="text-[14px] text-gray-600 font-bold leading-relaxed">
            {error.message?.includes('開始日') || error.message?.includes('終了日')
              ? error.message
              : '一時的な問題かもしれません。もう一度試してみてください。'}
          </p>
        </div>

        {error.message && !error.message.includes('開始日') && (
          <details className="text-left bg-gray-50 rounded-xl p-3 text-[11px] text-gray-500 font-mono">
            <summary className="cursor-pointer font-bold text-gray-700">詳細</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
            {error.digest && <p className="mt-2 text-[10px] text-gray-400">ID: {error.digest}</p>}
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={reset}
            className="flex-1 h-12 rounded-full font-black text-[14px] bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg"
          >
            🔄 もう一度試す
          </Button>
          <Link href="/promane" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-12 rounded-full font-black text-[14px] border-2 border-gray-300 hover:bg-gray-50"
            >
              🏠 プロマネTOPへ
            </Button>
          </Link>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 font-bold mb-2">解決しない場合は不具合を報告してください</p>
          <FeedbackButton
            variant="link"
            className="text-blue-600 hover:underline font-bold text-[12px]"
          >
            🐛 不具合を報告する
          </FeedbackButton>
        </div>
      </div>
    </div>
  )
}
