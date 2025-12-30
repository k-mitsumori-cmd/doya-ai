'use client'

import React, { useEffect, useMemo, useState } from 'react'

type PersonaGenerateResponse = {
  site: {
    url: string
    title: string
    description: string
    headings: string[]
    text: string
  }
  output: any
  model: string
}

type TabKey = 'summary' | 'personas' | 'creative' | 'checklist' | 'json'

async function copyText(text: string) {
  const s = String(text || '')
  if (!s) return
  try {
    await navigator.clipboard.writeText(s)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = s
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function badgeClass(priority: string) {
  const p = String(priority || '').toLowerCase()
  if (p === 'high') return 'bg-red-100 text-red-800'
  if (p === 'medium') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-800'
}

export default function PersonaPage() {
  const [tab, setTab] = useState<TabKey>('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PersonaGenerateResponse | null>(null)

  const [url, setUrl] = useState('')
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [features, setFeatures] = useState('')
  const [target, setTarget] = useState('')
  const [objective, setObjective] = useState('問い合わせ/資料DL')
  const [mustInclude, setMustInclude] = useState('')
  const [avoid, setAvoid] = useState('')
  const [notes, setNotes] = useState('')

  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const parsedJson = useMemo(() => {
    if (!jsonText) return null
    try {
      return JSON.parse(jsonText)
    } catch {
      return null
    }
  }, [jsonText])

  useEffect(() => {
    if (!jsonText) {
      setJsonError(null)
      return
    }
    try {
      JSON.parse(jsonText)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(e?.message || 'JSONの解析に失敗しました')
    }
  }, [jsonText])

  async function onGenerate() {
    setError(null)
    setLoading(true)
    setData(null)
    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          productName: productName || undefined,
          price: price || undefined,
          features: features || undefined,
          target: target || undefined,
          objective: objective || undefined,
          mustInclude: mustInclude || undefined,
          avoid: avoid || undefined,
          notes: notes || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as any
      if (!res.ok) {
        throw new Error(json?.error || `生成に失敗しました（status=${res.status}）`)
      }
      const payload = json as PersonaGenerateResponse
      setData(payload)
      setJsonText(JSON.stringify(payload.output ?? {}, null, 2))
      setTab('summary')
    } catch (e: any) {
      setError(e?.message || '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const out = data?.output || {}
  const site = data?.site

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
          /persona
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">ドヤペルソナ</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">サイトURLから「売れる」ペルソナ＆クリエイティブを一括生成</h1>
        <p className="mt-2 text-slate-600">
          URLを入れるだけで、サイト情報を読み取り、ペルソナ設計・キャッチコピー・LP要素・広告文・メール文までまとめて提案します。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">入力</h2>
            <p className="mt-1 text-sm text-slate-600">URL + 任意の追加情報を入れると、精度が上がります。</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">サイトURL（必須）</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">商品/サービス名（任意）</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">価格/プラン（任意）</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">特徴/機能/強み（任意）</label>
                <textarea
                  className="mt-1 h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">ターゲット補足（任意）</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  placeholder="例）40代の中小企業経営者 / SNS担当者 など"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">目的（CV）</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">必ず入れる要素（任意）</label>
                  <textarea
                    className="mt-1 h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    value={mustInclude}
                    onChange={(e) => setMustInclude(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">避ける表現/NG（任意）</label>
                  <textarea
                    className="mt-1 h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                    value={avoid}
                    onChange={(e) => setAvoid(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">その他メモ（任意）</label>
                <textarea
                  className="mt-1 h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={loading || !url.trim()}
                onClick={onGenerate}
              >
                {loading ? '解析・生成中…' : 'ペルソナ＆クリエイティブを生成'}
              </button>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
              ) : null}

              {data?.model ? (
                <div className="text-xs text-slate-500">モデル: {data.model}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">結果</h2>
                <p className="mt-1 text-sm text-slate-600">生成結果は必要に応じて編集し、コピーしてそのまま使えます。</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  disabled={!data}
                  onClick={() => data && downloadJson('doya-persona.json', data)}
                >
                  JSON保存
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  disabled={!jsonText}
                  onClick={() => copyText(jsonText)}
                >
                  JSONをコピー
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ['summary', 'サイト要約'],
                  ['personas', 'ペルソナ'],
                  ['creative', 'クリエイティブ'],
                  ['checklist', 'チェックリスト'],
                  ['json', 'JSON編集'],
                ] as Array<[TabKey, string]>
              ).map(([k, label]) => (
                <button
                  key={k}
                  className={[
                    'rounded-full px-3 py-1.5 text-sm font-medium',
                    tab === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  ].join(' ')}
                  onClick={() => setTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            {!data ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                左のフォームにURLを入れて「生成」を押すと、ここに結果が出ます。
              </div>
            ) : null}

            {data && tab === 'summary' ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">サイト</div>
                  <div className="mt-2 text-sm text-slate-700">
                    <div className="break-all">
                      <span className="font-medium">URL:</span> {site?.url}
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">タイトル:</span> {site?.title || '（不明）'}
                    </div>
                    <div className="mt-1">
                      <span className="font-medium">説明:</span> {site?.description || '（不明）'}
                    </div>
                    {site?.headings?.length ? (
                      <div className="mt-2">
                        <div className="font-medium">見出し（抜粋）</div>
                        <ul className="mt-1 list-disc pl-5">
                          {site.headings.slice(0, 10).map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">提案の核（siteSummary）</div>
                    <button className="text-sm font-medium text-slate-700 underline" onClick={() => copyText(JSON.stringify(out.siteSummary ?? {}, null, 2))}>
                      コピー
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">業界</div>
                      <div className="mt-1 text-sm text-slate-900">{out?.siteSummary?.industry || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">オファー</div>
                      <div className="mt-1 text-sm text-slate-900">{out?.siteSummary?.offer || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                      <div className="text-xs font-semibold text-slate-600">価値提案</div>
                      <div className="mt-1 text-sm text-slate-900">{out?.siteSummary?.valueProposition || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">主CTA</div>
                      <div className="mt-1 text-sm text-slate-900">{out?.siteSummary?.primaryCTA || '—'}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">副CTA</div>
                      <div className="mt-1 text-sm text-slate-900">{out?.siteSummary?.secondaryCTA || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {data && tab === 'personas' ? (
              <div className="mt-6 space-y-4">
                {(Array.isArray(out?.personas) ? out.personas : []).map((p: any, idx: number) => (
                  <div key={p?.id || idx} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {p?.name || `ペルソナ${idx + 1}`} {p?.archetype ? <span className="text-slate-500">/ {p.archetype}</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {p?.demographics?.jobTitle ? `${p.demographics.jobTitle}` : ''}{p?.demographics?.companySize ? ` / ${p.demographics.companySize}` : ''}
                          {p?.demographics?.ageRange ? ` / ${p.demographics.ageRange}` : ''}
                        </div>
                      </div>
                      <button className="text-sm font-medium text-slate-700 underline" onClick={() => copyText(JSON.stringify(p, null, 2))}>
                        コピー
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">状況</div>
                        <div className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{p?.situation || '—'}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">目標</div>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-900">
                          {(Array.isArray(p?.goals) ? p.goals : []).filter(Boolean).slice(0, 8).map((x: string, i: number) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">悩み</div>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-900">
                          {(Array.isArray(p?.pains) ? p.pains : []).filter(Boolean).slice(0, 8).map((x: string, i: number) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs font-semibold text-slate-600">刺さる訴求角度</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {(Array.isArray(p?.messagingAngles) ? p.messagingAngles : [])
                            .filter(Boolean)
                            .slice(0, 10)
                            .map((x: string, i: number) => (
                              <button
                                key={i}
                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                                onClick={() => copyText(x)}
                              >
                                {x}
                              </button>
                            ))}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">最適オファー</div>
                        <div className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{p?.bestOffer || '—'}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-600">推奨CTA</div>
                        <div className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{p?.recommendedCTA || '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {!(Array.isArray(out?.personas) && out.personas.length) ? (
                  <div className="text-sm text-slate-600">ペルソナがありません（JSON生成に失敗した可能性があります）。</div>
                ) : null}
              </div>
            ) : null}

            {data && tab === 'creative' ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">キャッチコピー</div>
                    <button className="text-sm font-medium text-slate-700 underline" onClick={() => copyText(JSON.stringify(out?.creative?.catchCopy ?? {}, null, 2))}>
                      コピー
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                      <div className="text-xs font-semibold text-slate-600">ヒーロー見出し</div>
                      <div className="mt-2 space-y-2">
                        {(Array.isArray(out?.creative?.catchCopy?.heroHeadlines) ? out.creative.catchCopy.heroHeadlines : [])
                          .filter(Boolean)
                          .slice(0, 10)
                          .map((x: string, i: number) => (
                            <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-white p-2 ring-1 ring-slate-200">
                              <div className="text-sm font-medium text-slate-900">{x}</div>
                              <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(x)}>
                                コピー
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">CTAボタン</div>
                      <div className="mt-2 space-y-2">
                        {(Array.isArray(out?.creative?.catchCopy?.ctaButtons) ? out.creative.catchCopy.ctaButtons : [])
                          .filter(Boolean)
                          .slice(0, 10)
                          .map((x: string, i: number) => (
                            <button
                              key={i}
                              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-semibold text-white"
                              onClick={() => copyText(x)}
                              title="クリックでコピー"
                            >
                              {x}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">LP構成（叩き台）</div>
                  <div className="mt-3 space-y-2">
                    {(Array.isArray(out?.creative?.lpStructure) ? out.creative.lpStructure : []).map((s: any, i: number) => (
                      <div key={i} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{s?.section || `セクション${i + 1}`}</div>
                          <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(String(s?.copy || ''))}>
                            コピー
                          </button>
                        </div>
                        {s?.goal ? <div className="mt-1 text-xs text-slate-600">目的: {s.goal}</div> : null}
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{s?.copy || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">広告（Google検索）</div>
                    <div className="mt-3 space-y-2">
                      {(Array.isArray(out?.creative?.ads?.googleSearch) ? out.creative.ads.googleSearch : []).slice(0, 6).map((ad: any, i: number) => (
                        <div key={i} className="rounded-lg bg-slate-50 p-3">
                          <div className="text-sm font-semibold text-slate-900">{ad?.headline1 || '—'} / {ad?.headline2 || '—'}</div>
                          <div className="mt-1 text-sm text-slate-700">{ad?.description || '—'}</div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">{ad?.path1 ? `/${ad.path1}` : ''}{ad?.path2 ? `/${ad.path2}` : ''}</div>
                            <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(JSON.stringify(ad, null, 2))}>
                              コピー
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">広告（Meta/SNS）</div>
                    <div className="mt-3 space-y-2">
                      {(Array.isArray(out?.creative?.ads?.metaAds) ? out.creative.ads.metaAds : []).slice(0, 6).map((ad: any, i: number) => (
                        <div key={i} className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-600">Primary</div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{ad?.primaryText || '—'}</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{ad?.headline || '—'}</div>
                          <div className="mt-1 text-sm text-slate-700">{ad?.description || '—'}</div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">CTA: {ad?.cta || '—'}</div>
                            <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(JSON.stringify(ad, null, 2))}>
                              コピー
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">メール</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-slate-600">件名</div>
                        <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(JSON.stringify(out?.creative?.email?.subjectLines ?? [], null, 2))}>
                          コピー
                        </button>
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-900">
                        {(Array.isArray(out?.creative?.email?.subjectLines) ? out.creative.email.subjectLines : []).filter(Boolean).slice(0, 10).map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">本文（ドラフト）</div>
                      <div className="mt-2 space-y-2">
                        {(Array.isArray(out?.creative?.email?.bodyDrafts) ? out.creative.email.bodyDrafts : []).filter(Boolean).slice(0, 4).map((x: string, i: number) => (
                          <div key={i} className="rounded-md bg-white p-2 text-sm text-slate-900 ring-1 ring-slate-200 whitespace-pre-wrap">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="text-xs font-semibold text-slate-600">ドラフト {i + 1}</div>
                              <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(x)}>
                                コピー
                              </button>
                            </div>
                            {x}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {data && tab === 'checklist' ? (
              <div className="mt-6 space-y-3">
                {(Array.isArray(out?.marketingChecklist) ? out.marketingChecklist : []).slice(0, 50).map((c: any, i: number) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(c?.priority)}`}>
                          {String(c?.priority || 'medium')}
                        </span>
                        <div className="text-sm font-semibold text-slate-900">{c?.item || '—'}</div>
                      </div>
                      <button className="text-xs font-semibold text-slate-700 underline" onClick={() => copyText(JSON.stringify(c, null, 2))}>
                        コピー
                      </button>
                    </div>
                    {c?.reason ? <div className="mt-2 text-sm text-slate-700">理由: {c.reason}</div> : null}
                    {c?.example ? (
                      <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-900 whitespace-pre-wrap">{c.example}</div>
                    ) : null}
                  </div>
                ))}

                {!(Array.isArray(out?.marketingChecklist) && out.marketingChecklist.length) ? (
                  <div className="text-sm text-slate-600">チェックリストがありません。</div>
                ) : null}
              </div>
            ) : null}

            {data && tab === 'json' ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  JSONを直接編集できます（必要ならここを修正して、そのままコピー/保存してください）。
                </div>

                <textarea
                  className="h-[520px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-slate-900"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {jsonError ? <span className="text-red-700">JSONエラー: {jsonError}</span> : 'JSON OK'}
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" onClick={() => copyText(jsonText)}>
                      コピー
                    </button>
                    <button
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={!parsedJson || !!jsonError}
                      onClick={() => parsedJson && downloadJson('doya-persona-output.json', parsedJson)}
                    >
                      編集版を保存
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}


