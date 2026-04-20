'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function GenerateQuestionImagesPage() {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; generated?: number; error?: string } | null>(null)
  const [count, setCount] = useState(30)

  const handleGenerate = async () => {
    setGenerating(true)
    setResult(null)

    try {
      const res = await fetch('/api/swipe/question-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })

      const json = await res.json()

      if (!res.ok || json?.error) {
        throw new Error(json?.error || '画像生成に失敗しました')
      }

      setResult({
        success: true,
        generated: json.generated,
      })
    } catch (e: any) {
      setResult({
        success: false,
        error: e.message || 'エラーが発生しました',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-black text-gray-900 mb-6">質問カード画像生成</h1>

        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              生成枚数
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 30)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none font-bold text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-2">
              各カテゴリ（記事の方向性、記事タイプ、ターゲット読者、記事の長さ、確認）から均等に生成されます
            </p>
          </div>

          {result && (
            <div
              className={`p-4 rounded-xl ${
                result.success
                  ? 'bg-emerald-50 border-2 border-emerald-200'
                  : 'bg-red-50 border-2 border-red-200'
              }`}
            >
              {result.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-700">
                    {result.generated}枚の画像を生成しました！
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-700">{result.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              画像生成中...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              画像を生成する
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 mt-4 text-center">
          注意: 画像生成には時間がかかります（1枚あたり約2秒）。生成中はページを閉じないでください。
        </p>
      </div>
    </div>
  )
}
