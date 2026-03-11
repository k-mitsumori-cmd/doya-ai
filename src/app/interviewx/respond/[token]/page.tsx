'use client'

// ============================================
// 公開ヒヤリング回答ページ（チャットへリダイレクト）
// ============================================
// shareToken でアクセスするパブリックページ（認証不要）
// トークン検証後、常にチャットページへリダイレクト

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function RespondPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAndRedirect() {
      try {
        const res = await fetch(`/api/interviewx/public/${token}`)
        const data = await res.json()

        if (!data.success) {
          setError(data.error || 'データの取得に失敗しました')
          setErrorCode(data.code || null)
          return
        }

        // ヒヤリングAIはチャット形式のみ → 常にチャットページへ
        router.replace(`/interviewx/respond/${token}/chat`)
      } catch {
        setError('通信エラーが発生しました。ページを再読み込みしてください。')
      }
    }
    fetchAndRedirect()
  }, [token, router])

  // エラー表示
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">
            {errorCode === 'ALREADY_ANSWERED' ? '✅' : '🔒'}
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {errorCode === 'ALREADY_ANSWERED' ? '回答済みです' : 'アクセスできません'}
          </h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // ローディング（リダイレクト待ち）
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="mt-4 text-gray-500 text-sm">読み込み中...</p>
      </div>
    </div>
  )
}
