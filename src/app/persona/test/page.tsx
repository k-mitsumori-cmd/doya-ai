'use client'

import React, { useState } from 'react'

export default function PersonaTestPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [url, setUrl] = useState('https://example.com')

  async function runTest() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          productName: 'テスト商品',
          objective: '問い合わせ獲得',
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || `API Error: ${res.status}`)
      }

      setResult(json)
    } catch (e: any) {
      setError(e?.message || 'テストに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ドヤペルソナ テストページ</h1>
        <p className="mt-2 text-sm text-slate-600">
          /api/persona/generate のAPIテスト用ページです。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">テストURL</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={loading || !url.trim()}
            onClick={runTest}
          >
            {loading ? 'テスト実行中…' : 'APIテストを実行'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="font-semibold">エラー</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <div className="font-semibold">✅ テスト成功</div>
              <div className="mt-1">モデル: {result.model}</div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-700">サイト情報</div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div><span className="font-medium">URL:</span> {result.site?.url}</div>
                <div><span className="font-medium">タイトル:</span> {result.site?.title || '(なし)'}</div>
                <div><span className="font-medium">説明:</span> {result.site?.description || '(なし)'}</div>
                <div><span className="font-medium">見出し数:</span> {result.site?.headings?.length || 0}</div>
                <div><span className="font-medium">本文文字数:</span> {result.site?.text?.length || 0}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-700">生成結果（output）</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <div><span className="font-medium">siteSummary:</span> {result.output?.siteSummary ? '✅ あり' : '❌ なし'}</div>
                <div><span className="font-medium">personas:</span> {Array.isArray(result.output?.personas) ? `✅ ${result.output.personas.length}件` : '❌ なし'}</div>
                <div><span className="font-medium">creative:</span> {result.output?.creative ? '✅ あり' : '❌ なし'}</div>
                <div><span className="font-medium">marketingChecklist:</span> {Array.isArray(result.output?.marketingChecklist) ? `✅ ${result.output.marketingChecklist.length}件` : '❌ なし'}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">RAW JSON</div>
                <button
                  className="text-xs font-medium text-slate-600 underline"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'persona-test-result.json'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  JSONダウンロード
                </button>
              </div>
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        本番ページ: <a href="/persona" className="underline">/persona</a>
      </div>
    </div>
  )
}

