'use client'

import { useMemo, useState } from 'react'
import LoadingProgress from '@/components/LoadingProgress'

type Mood = 'japanese_modern' | 'wa_tech' | 'minimal' | 'bold' | 'startup'
type Industry = 'saas' | 'hr' | 'ai' | 'marketing' | 'fintech' | 'other'

type PreviewPattern = {
  id: 'A' | 'B' | 'C'
  title: string
  description: string
  reasons: string
  oneLiner: string
  logos: Array<{ layout: 'horizontal' | 'square'; mode: 'default' | 'dark' | 'mono' | 'invert'; svg: string }>
}

export default function DoyaLogoPage() {
  const [serviceName, setServiceName] = useState('ドヤロゴ')
  const [serviceDescription, setServiceDescription] = useState('サービス名と内容だけで、日本っぽくてイケてるロゴを自動生成')
  const [mood, setMood] = useState<Mood>('japanese_modern')
  const [industry, setIndustry] = useState<Industry>('saas')
  const [mainColor, setMainColor] = useState('#1D4ED8')
  const [subColor, setSubColor] = useState('')
  const [useAI, setUseAI] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patterns, setPatterns] = useState<PreviewPattern[] | null>(null)

  const payload = useMemo(
    () => ({
      serviceName,
      serviceDescription,
      mood,
      industry,
      mainColor: mainColor || undefined,
      subColor: subColor || undefined,
      useAI,
    }),
    [serviceName, serviceDescription, mood, industry, mainColor, subColor, useAI]
  )

  async function generatePreview() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/logo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, returnMode: 'json' }),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.error || '生成に失敗しました')
      setPatterns(json.patterns as PreviewPattern[])
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  async function downloadZip() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/logo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, returnMode: 'zip' }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'ZIP生成に失敗しました')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${serviceName}-logo-kit.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  const moodOptions: Array<{ value: Mood; label: string }> = [
    { value: 'japanese_modern', label: '日本的モダン' },
    { value: 'wa_tech', label: '和×テック' },
    { value: 'minimal', label: 'ミニマル' },
    { value: 'bold', label: '力強い' },
    { value: 'startup', label: 'スタートアップ感' },
  ]

  const industryOptions: Array<{ value: Industry; label: string }> = [
    { value: 'saas', label: 'SaaS' },
    { value: 'hr', label: 'HR' },
    { value: 'ai', label: 'AI' },
    { value: 'marketing', label: 'マーケ' },
    { value: 'fintech', label: 'Fintech' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <LoadingProgress isLoading={loading} />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">ドヤロゴ（DOYA LOGO）</h1>
          <p className="mt-2 text-slate-600">サービス名と内容だけで、日本っぽくてイケてるロゴキットを一括生成します。</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">サービス名（必須）</label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="例）ドヤロゴ"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">サービス内容（必須）</label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  rows={3}
                  placeholder="例）サービス名と内容だけで日本っぽいロゴを自動生成"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">ロゴの雰囲気</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
                    value={mood}
                    onChange={(e) => setMood(e.target.value as Mood)}
                  >
                    {moodOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">業界</label>
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value as Industry)}
                  >
                    {industryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">メインカラー（任意）</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
                    value={mainColor}
                    onChange={(e) => setMainColor(e.target.value)}
                    placeholder="#1D4ED8"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">サブカラー（任意）</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
                    value={subColor}
                    onChange={(e) => setSubColor(e.target.value)}
                    placeholder="#06B6D4"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
                OpenAIで「生成理由」をリッチにする（`OPENAI_API_KEY` が必要）
              </label>

              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={generatePreview}
                  disabled={loading}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading ? '生成中…' : 'プレビュー生成（JSON）'}
                </button>
                <button
                  onClick={downloadZip}
                  disabled={loading}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
                >
                  {loading ? '生成中…' : 'ロゴキットをZIPでDL'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">プレビュー（A/B/C）</h2>
            <p className="mt-1 text-sm text-slate-600">各パターンの横長ロゴ（default）を表示します。</p>

            {!patterns && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                まず「プレビュー生成」を押してください。
              </div>
            )}

            {patterns && (
              <div className="mt-6 grid gap-6">
                {patterns.map((p) => {
                  const horiz = p.logos.find((l) => l.layout === 'horizontal' && l.mode === 'default')?.svg
                  return (
                    <div key={p.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Pattern {p.id}: {p.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">{p.description}</div>
                        </div>
                        <div className="text-xs text-slate-500">社内共有一文: {p.oneLiner}</div>
                      </div>
                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                        {horiz ? (
                          <div className="w-full" dangerouslySetInnerHTML={{ __html: horiz }} />
                        ) : (
                          <div className="text-sm text-slate-500">SVGがありません</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


