'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/promane/ui/button'
import { FeedbackButton } from '@/components/promane/feedback-button'
import { Bug, Home, RotateCcw } from 'lucide-react'

export default function PromaneError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Promane Error]')
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-rose-200 p-10 text-center space-y-5">
        <Image src="/character/error.png" alt="" width={120} height={120} className="mx-auto" unoptimized />
        <div>
          <h1 className="text-[24px] font-black text-rose-700 mb-2">画面を表示できませんでした</h1>
          <p className="text-[14px] text-gray-600 font-bold leading-relaxed">
            {/* 例外の文・digest は出さない。日付の入力ミス（日本語の決まった文）だけはそのまま案内する */}
            {/[\u3040-\u30ff\u4e00-\u9fff]/.test(error.message || '') && (error.message.includes('開始日') || error.message.includes('終了日'))
              ? error.message
              : '一時的な不具合です。少し待って、もう一度お試しください。'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={reset}
            className="flex-1 h-12 rounded-full font-black text-[14px] bg-gradient-to-r from-blue-500 to-brand-500 hover:from-blue-600 hover:to-brand-600 shadow-lg"
          >
            <RotateCcw size={16} aria-hidden className="mr-1.5" />もう一度試す
          </Button>
          <Link href="/promane" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-12 rounded-full font-black text-[14px] border-2 border-gray-300 hover:bg-gray-50"
            >
              <Home size={16} aria-hidden className="mr-1.5" />プロマネのトップへ戻る
            </Button>
          </Link>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 font-bold mb-2">解決しない場合は不具合を報告してください</p>
          <FeedbackButton
            variant="link"
            className="text-blue-600 hover:underline font-bold text-[12px]"
          >
            <Bug size={16} aria-hidden className="inline-block -mt-0.5 mr-1" />不具合を報告する
          </FeedbackButton>
        </div>
      </div>
    </div>
  )
}
