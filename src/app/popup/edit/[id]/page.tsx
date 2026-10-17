'use client'

// ドヤポップアップ 案の編集: 文言・色・形・リンク・表示条件、その場のプレビュー、日別の推移
// ⚠️ 保存する値はサーバ側（PATCH /api/popup/popups/[id]）で検査し直す。ここの検査は表示用。
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ImagePlus, Loader2, Monitor, Pause, Play, Save, Smartphone } from 'lucide-react'
import type { PopupDto } from '@/lib/popup/dto'
import { LAYOUT_LABEL, LIMITS, POPUP_LAYOUTS, type PopupCreative, type PopupLinkItem } from '@/lib/popup/schema'
import PopupPreview from '@/components/popup/PopupPreview'
import { DaysSwitch, KindBadge, StatTile, StatusBadge, fmt, pct } from '@/components/popup/ui'

interface SiteInfo {
  id: string
  name: string
  domain: string
  embedCode: string
  colors: string[]
  pages: { label: string; url: string }[]
}

interface Stats {
  days: number
  series: { day: string; impressions: number; clicks: number; closes: number }[]
  byTarget: Record<string, number>
  totals: { impressions: number; clicks: number; closes: number; ctr: number | null }
}

const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#ff5a36] focus:ring-2 focus:ring-orange-100'

function Field({ label, hint, count, max, children }: { label: string; hint?: string; count?: number; max?: number; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-black text-slate-700">{label}</span>
        {max !== undefined && (
          <span className={`text-[10px] font-bold tabular-nums ${count !== undefined && count > max ? 'text-rose-600' : 'text-slate-400'}`}>
            {count ?? 0}/{max}
          </span>
        )}
      </span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-[11px] font-bold text-slate-400">{hint}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-black text-slate-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const len = (s: string) => Array.from(s).length

function UrlPicker({ pages, onPick }: { pages: SiteInfo['pages']; onPick: (p: { label: string; url: string }) => void }) {
  if (pages.length === 0) return null
  return (
    <select
      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-600"
      value=""
      onChange={(e) => {
        const p = pages[Number(e.target.value)]
        if (p) onPick(p)
      }}
      aria-label="サイトのページから選ぶ"
    >
      <option value="">サイトのページから選ぶ</option>
      {pages.map((p, i) => (
        <option key={p.url} value={i}>
          {p.label} — {p.url}
        </option>
      ))}
    </select>
  )
}

function StatsChart({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.series.map((p) => p.impressions))
  return (
    <div>
      <div className="flex h-36 items-end gap-[2px]" role="img" aria-label="日別の表示とクリック">
        {stats.series.map((p) => (
          <div key={p.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${p.day} 表示${p.impressions} クリック${p.clicks}`}>
            <div className="w-full rounded-t-sm bg-orange-200" style={{ height: `${(p.impressions / max) * 100}%` }} />
            <div className="absolute bottom-0 w-full rounded-t-sm bg-[#e0442c]" style={{ height: `${(p.clicks / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
        <span>{stats.series[0]?.day.slice(5).replace('-', '/')}</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-orange-200" />表示</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#e0442c]" />クリック</span>
        </span>
        <span>{stats.series[stats.series.length - 1]?.day.slice(5).replace('-', '/')}</span>
      </div>
    </div>
  )
}

export default function PopupEditPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [popup, setPopup] = useState<PopupDto | null>(null)
  const [site, setSite] = useState<SiteInfo | null>(null)
  const [draft, setDraft] = useState<PopupDto | null>(null)
  const [device, setDevice] = useState<'pc' | 'sp'>('pc')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [stats, setStats] = useState<Stats | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/popup/popups/${id}`, { cache: 'no-store' })
    if (res.status === 401) {
      window.location.href = `/auth/signin?callbackUrl=/popup/edit/${id}`
      return
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || '読み込めませんでした。')
      return
    }
    setPopup(json.popup)
    setDraft(json.popup)
    setSite(json.site)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!id) return
    fetch(`/api/popup/popups/${id}/stats?days=${days}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setStats(j))
      .catch(() => {})
  }, [id, days])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(popup), [draft, popup])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  if (error && !draft) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
        <Link href="/popup" className="mt-4 inline-block text-sm font-black text-slate-600 underline">一覧に戻る</Link>
      </div>
    )
  }
  if (!draft || !site || !popup) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#ff5a36]" />
      </div>
    )
  }

  const c = draft.creative
  const setC = (patch: Partial<PopupCreative>) => setDraft({ ...draft, creative: { ...c, ...patch } })
  const setLink = (i: number, patch: Partial<PopupLinkItem>) => {
    const links = [...c.links]
    links[i] = { ...links[i], ...patch }
    setC({ links })
  }
  const isImage = draft.kind === 'image'
  const isAsk = draft.kind === 'ask'

  const save = async (status?: 'live' | 'paused') => {
    setSaving(true)
    setError(null)
    setIssues([])
    setSaved(null)
    try {
      const body: Record<string, unknown> = {
        name: draft.name,
        trigger: draft.trigger,
        targeting: draft.targeting,
        frequency: draft.frequency,
        creative: {
          layout: c.layout,
          eyebrow: c.eyebrow,
          headline: c.headline,
          sub: c.sub,
          bubbles: c.bubbles,
          buttonLabel: c.buttonLabel,
          note: c.note,
          links: c.links,
          colors: c.colors,
          imageAlt: c.imageAlt,
          // AIに聞く型はURLを質問文から作る（サーバ側で組み立てる）
          ...(isAsk ? { question: c.question } : { buttonUrl: c.buttonUrl }),
        },
      }
      if (status) body.status = status
      const res = await fetch(`/api/popup/popups/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || '保存に失敗しました。')
        setIssues(Array.isArray(json?.issues) ? json.issues : [])
        return
      }
      setPopup(json.popup)
      setDraft(json.popup)
      setSaved(status === 'live' ? '公開しました。サイトに1分ほどで反映されます。' : status === 'paused' ? '停止しました。' : '保存しました。')
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError('画像は2MBまでです。')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/popup/popups/${draft.id}/image`, { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || 'アップロードに失敗しました。')
        return
      }
      // 画像まわりだけ反映し、編集中の文言は残す
      setPopup((p) => (p ? { ...p, creative: { ...p.creative, ...pickImage(json.popup.creative) }, imageUrl: json.popup.imageUrl, issues: json.popup.issues } : p))
      setDraft((d) => (d ? { ...d, creative: { ...d.creative, ...pickImage(json.popup.creative) }, imageUrl: json.popup.imageUrl } : d))
    } finally {
      setUploading(false)
    }
  }

  const siteColors = site.colors.filter((x) => /^#[0-9a-f]{6}$/i.test(x))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <Link href={`/popup/sites/${site.id}`} className="inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" />
        {site.name}
      </Link>

      <div className="sticky top-0 z-20 -mx-4 mt-2 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <StatusBadge status={popup.status} />
        <KindBadge kind={draft.kind} />
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          maxLength={LIMITS.name}
          aria-label="ポップアップの名前"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-black text-slate-900 outline-none hover:border-slate-200 focus:border-[#ff5a36] focus:bg-white"
        />
        <div className="flex items-center gap-2">
          <button type="button" disabled={saving || !dirty} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </button>
          {popup.status === 'live' ? (
            <button type="button" disabled={saving} onClick={() => void save('paused')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <Pause className="h-3.5 w-3.5" />
              停止する
            </button>
          ) : null}
          <button type="button" disabled={saving} onClick={() => void save('live')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff5a36] px-3 py-2 text-xs font-black text-white hover:bg-[#e8482a] disabled:opacity-40">
            <Play className="h-3.5 w-3.5" />
            {popup.status === 'live' ? '保存して公開' : '公開する'}
          </button>
        </div>
      </div>

      {(error || saved) && (
        <div className="mt-4 space-y-1" role={error ? 'alert' : 'status'}>
          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error}
                {issues.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </span>
            </p>
          )}
          {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{saved}</p>}
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 左: 設定 */}
        <div className="space-y-5">
          {isImage && (
            <Section title="画像">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  {c.imagePath ? '画像を差し替える' : '画像をアップロード'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void upload(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                <span className="text-[11px] font-bold text-slate-400">PNG・JPEG・WebP・GIF、2MBまで</span>
              </div>
              <Field label="画像を押したときのリンク先URL">
                <input className={input} value={c.buttonUrl} onChange={(e) => setC({ buttonUrl: e.target.value })} placeholder="https://" />
                <UrlPicker pages={site.pages} onPick={(p) => setC({ buttonUrl: p.url })} />
              </Field>
              <Field label="画像の説明（読み上げ用）" count={len(c.imageAlt)} max={100}>
                <input className={input} value={c.imageAlt} onChange={(e) => setC({ imageAlt: e.target.value })} placeholder="例: 無料相談のご案内" />
              </Field>
            </Section>
          )}

          <Section title="形">
            <div className="grid grid-cols-3 gap-2">
              {POPUP_LAYOUTS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setC({ layout: l })}
                  aria-pressed={c.layout === l}
                  className={`rounded-xl border px-2 py-3 text-xs font-black ${c.layout === l ? 'border-[#ff5a36] bg-orange-50 text-[#d9362b]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {LAYOUT_LABEL[l]}
                </button>
              ))}
            </div>
            {c.layout === 'modal' && !isImage && <p className="text-[11px] font-bold text-slate-400">スマホでは画面を覆わないよう、下からせり上がる形で表示します。</p>}
          </Section>

          {!isImage && (
            <Section title="文言">
              <Field label="上の小さな文字（サイト名など）" count={len(c.eyebrow)} max={LIMITS.eyebrow}>
                <input className={input} value={c.eyebrow} onChange={(e) => setC({ eyebrow: e.target.value })} />
              </Field>
              <Field label="見出し" count={len(c.headline)} max={LIMITS.headline}>
                <input className={input} value={c.headline} onChange={(e) => setC({ headline: e.target.value })} />
              </Field>
              <Field label="説明" count={len(c.sub)} max={LIMITS.sub}>
                <textarea className={input} rows={2} value={c.sub} onChange={(e) => setC({ sub: e.target.value })} />
              </Field>
              {isAsk && (
                <Field label="吹き出し（3つまで）" hint="訪問者が聞きたくなる短い疑問。">
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                      <input
                        key={i}
                        className={input}
                        value={c.bubbles[i] || ''}
                        maxLength={LIMITS.bubble}
                        onChange={(e) => {
                          const b = [...c.bubbles]
                          b[i] = e.target.value
                          setC({ bubbles: b })
                        }}
                      />
                    ))}
                  </div>
                </Field>
              )}
            </Section>
          )}

          {!isImage && draft.kind === 'pages' && (
            <Section title="おすすめのページ（3件まで）">
              {[0, 1, 2].map((i) => {
                const l = c.links[i] || { label: '', url: '' }
                return (
                  <div key={i} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-[1fr_1.4fr]">
                    <input className={input} value={l.label} placeholder="ページ名" maxLength={LIMITS.linkLabel} onChange={(e) => setLink(i, { label: e.target.value, url: l.url })} />
                    <div>
                      <input className={input} value={l.url} placeholder="https://" onChange={(e) => setLink(i, { url: e.target.value, label: l.label })} />
                      <UrlPicker pages={site.pages} onPick={(p) => setLink(i, { label: l.label || p.label, url: p.url })} />
                    </div>
                  </div>
                )
              })}
            </Section>
          )}

          {!isImage && (
            <Section title={isAsk ? 'ボタン（ChatGPTに質問を送る）' : 'ボタン'}>
              <Field label="ボタンの文言" count={len(c.buttonLabel)} max={LIMITS.buttonLabel}>
                <input className={input} value={c.buttonLabel} onChange={(e) => setC({ buttonLabel: e.target.value })} />
              </Field>
              {isAsk ? (
                <Field
                  label="ChatGPTに送る質問文"
                  count={len(c.question)}
                  max={LIMITS.question}
                  hint="ボタンを押した訪問者本人の発言としてChatGPTに入ります。文中のURLはサイトで見つかったページだけが使えます。保存するとリンクを作り直します。"
                >
                  <textarea className={input} rows={9} value={c.question} onChange={(e) => setC({ question: e.target.value })} />
                </Field>
              ) : (
                <Field label="リンク先URL" hint={draft.kind === 'pages' ? '空にするとボタンを出しません。' : undefined}>
                  <input className={input} value={c.buttonUrl} onChange={(e) => setC({ buttonUrl: e.target.value })} placeholder="https://" />
                  <UrlPicker pages={site.pages} onPick={(p) => setC({ buttonUrl: p.url })} />
                </Field>
              )}
              <Field label="ボタンの下の注記" count={len(c.note)} max={LIMITS.note}>
                <input className={input} value={c.note} onChange={(e) => setC({ note: e.target.value })} placeholder={isAsk ? 'ChatGPTが開きます' : ''} />
              </Field>
            </Section>
          )}

          {!isImage && (
            <Section title="色">
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ['accent', 'ボタン・強調'],
                    ['bg', '背景'],
                    ['text', '文字'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="text-xs font-black text-slate-700">{label}</span>
                    <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                      <input type="color" value={c.colors[k]} onChange={(e) => setC({ colors: { ...c.colors, [k]: e.target.value } })} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <span className="text-xs font-bold tabular-nums text-slate-500">{c.colors[k]}</span>
                    </span>
                  </label>
                ))}
              </div>
              {siteColors.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                  サイトの色:
                  {siteColors.map((col) => (
                    <button key={col} type="button" onClick={() => setC({ colors: { ...c.colors, accent: col } })} className="h-6 w-6 rounded-full border border-slate-200" style={{ background: col }} aria-label={`ボタンの色を${col}にする`} />
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="表示の条件">
            <Field label="きっかけ">
              <select className={input} value={draft.trigger.type} onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, type: e.target.value as 'delay' | 'scroll' | 'exit' } })}>
                <option value="delay">ページを開いてから何秒後</option>
                <option value="scroll">何％スクロールしたら</option>
                <option value="exit">ページを離れそうなとき（PC）</option>
              </select>
            </Field>
            {draft.trigger.type === 'scroll' ? (
              <Field label="スクロールの割合（％）" hint="10〜100">
                <input type="number" min={10} max={100} className={input} value={draft.trigger.scrollPct} onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, scrollPct: Number(e.target.value) } })} />
              </Field>
            ) : (
              <Field label={draft.trigger.type === 'exit' ? 'スマホで出すまでの秒数' : '秒数'} hint={draft.trigger.type === 'exit' ? 'スマホにはマウスが無いため、この秒数で代わりに出します。' : '0〜600'}>
                <input type="number" min={0} max={600} className={input} value={draft.trigger.delaySec} onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, delaySec: Number(e.target.value) } })} />
              </Field>
            )}
            <Field label="端末">
              <select className={input} value={draft.targeting.device} onChange={(e) => setDraft({ ...draft, targeting: { ...draft.targeting, device: e.target.value as 'all' | 'pc' | 'sp' } })}>
                <option value="all">PC・スマホの両方</option>
                <option value="pc">PCのみ</option>
                <option value="sp">スマホのみ</option>
              </select>
            </Field>
            <Field label="表示するページ">
              <select className={input} value={draft.targeting.pathMode} onChange={(e) => setDraft({ ...draft, targeting: { ...draft.targeting, pathMode: e.target.value as 'all' | 'include' } })}>
                <option value="all">すべてのページ</option>
                <option value="include">指定したページだけ</option>
              </select>
            </Field>
            {draft.targeting.pathMode === 'include' && (
              <Field label="ページのパス（1行に1つ・10件まで）" hint="前方一致。* は任意の文字列。例: /service/  /blog/*/  /pricing">
                <textarea
                  className={input}
                  rows={3}
                  value={draft.targeting.paths.join('\n')}
                  onChange={(e) => setDraft({ ...draft, targeting: { ...draft.targeting, paths: e.target.value.split('\n') } })}
                  placeholder="/service/"
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="閉じたら何日表示しないか" hint="0にすると次のページでまた出ます">
                <input type="number" min={0} max={365} className={input} value={draft.frequency.hideDays} onChange={(e) => setDraft({ ...draft, frequency: { ...draft.frequency, hideDays: Number(e.target.value) } })} />
              </Field>
              <label className="flex items-center gap-2 self-center pt-4 text-xs font-black text-slate-700">
                <input type="checkbox" checked={draft.frequency.oncePerSession} onChange={(e) => setDraft({ ...draft, frequency: { ...draft.frequency, oncePerSession: e.target.checked } })} className="h-4 w-4 accent-[#ff5a36]" />
                1回の訪問では1度だけ表示する
              </label>
            </div>
          </Section>
        </div>

        {/* 右: プレビューと計測 */}
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">プレビュー</h2>
              <div className="inline-flex rounded-xl border border-slate-200 p-0.5 text-xs font-black">
                <button type="button" onClick={() => setDevice('pc')} aria-pressed={device === 'pc'} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${device === 'pc' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                  <Monitor className="h-3.5 w-3.5" />
                  PC
                </button>
                <button type="button" onClick={() => setDevice('sp')} aria-pressed={device === 'sp'} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 ${device === 'sp' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                  <Smartphone className="h-3.5 w-3.5" />
                  スマホ
                </button>
              </div>
            </div>
            <PopupPreview popup={draft} device={device} height={device === 'sp' ? 640 : 520} />
            <p className="mt-2 text-[11px] font-bold text-slate-400">サイトに出るときと同じ仕組みで表示しています。プレビューでは計測しません。</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">計測</h2>
              <DaysSwitch value={days} onChange={setDays} />
            </div>
            {stats ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="表示" value={fmt(stats.totals.impressions)} />
                  <StatTile label="クリック" value={fmt(stats.totals.clicks)} />
                  <StatTile label="クリック率" value={pct(stats.totals.ctr)} accent />
                </div>
                <div className="mt-4">
                  <StatsChart stats={stats} />
                </div>
                {draft.kind === 'pages' && Object.keys(stats.byTarget).length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs font-bold text-slate-600">
                    {Object.entries(stats.byTarget).map(([t, n]) => (
                      <li key={t} className="flex justify-between">
                        <span>{t === 'main' ? 'ボタン' : c.links[Number(t.split(':')[1])]?.label || t}</span>
                        <span className="tabular-nums">{fmt(n)}クリック</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function pickImage(c: PopupCreative): Partial<PopupCreative> {
  return { imagePath: c.imagePath, imageWidth: c.imageWidth, imageHeight: c.imageHeight }
}
