'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TARGETS = [10000, 20000, 30000, 40000, 50000, 60000]
const TONES = ['丁寧', 'フランク', 'ビジネス', '専門的'] as const

export default function SeoNewPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [keywords, setKeywords] = useState('')
  const [persona, setPersona] = useState('')
  const [searchIntent, setSearchIntent] = useState('')
  const [targetChars, setTargetChars] = useState<number>(20000)
  const [referenceUrls, setReferenceUrls] = useState('')
  const [tone, setTone] = useState<(typeof TONES)[number]>('丁寧')
  const [forbidden, setForbidden] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        title,
        keywords: keywords
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        persona,
        searchIntent,
        targetChars,
        referenceUrls: referenceUrls
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        tone,
        forbidden: forbidden
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      }
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '作成に失敗しました')
      router.push(`/seo/jobs/${json.jobId}`)
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-gray-900">新規作成</h1>
      <p className="text-gray-600 mt-1">記事生成の条件を入力してください（日本語固定）。</p>

      {error ? (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <div>
          <label className="block text-sm font-bold text-gray-800">記事タイトル（仮でも可）*</label>
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例）LLMOとは？SEOとの違いと実務で勝つための設計"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800">取りたいキーワード（複数可）*</label>
          <input
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="例）LLMO, AI検索最適化, SEO"
          />
          <p className="text-xs text-gray-500 mt-1">カンマ区切り or 改行で複数入力できます。</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-800">目標文字数*</label>
            <select
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200"
              value={targetChars}
              onChange={(e) => setTargetChars(Number(e.target.value))}
            >
              {TARGETS.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString('ja-JP')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-800">トーン*</label>
            <select
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200"
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800">想定読者（ペルソナ）</label>
          <textarea
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-28"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="例）BtoBマーケ担当。AI検索の影響が不安。社内稟議が必要。"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800">検索意図</label>
          <textarea
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-24"
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value)}
            placeholder="例）LLMOの定義と実装手順、失敗例、比較、チェックリストが欲しい"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800">参考URL（複数入力可）</label>
          <textarea
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-28"
            value={referenceUrls}
            onChange={(e) => setReferenceUrls(e.target.value)}
            placeholder={`https://example.com/article\nhttps://example.com/another`}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800">禁止事項（競合名を出さない等）</label>
          <textarea
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 min-h-20"
            value={forbidden}
            onChange={(e) => setForbidden(e.target.value)}
            placeholder="例）競合A社名を出さない, 誇大表現NG"
          />
        </div>

        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            className="px-5 py-3 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
            onClick={() => router.push('/seo')}
            disabled={loading}
          >
            キャンセル
          </button>
          <button
            className="px-6 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-60"
            onClick={submit}
            disabled={loading}
          >
            {loading ? '作成中...' : 'ジョブ作成して開始'}
          </button>
        </div>
      </div>
    </main>
  )
}


