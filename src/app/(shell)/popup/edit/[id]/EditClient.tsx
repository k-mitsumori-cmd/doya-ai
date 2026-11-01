'use client'

// ドヤポップアップ 案の編集: 文言・色・形・リンク・表示条件、その場のプレビュー、日別の推移
// ⚠️ 保存する値はサーバ側（popup-write.ts）で検査し直す。ここの検査は表示用。
// ⚠️ 色・角丸などはトークン（.pd-*）で描く。ポップアップ自体の色（利用者が選ぶ色）は値として扱う。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ImagePlus, Loader2, Monitor, Pause, Play, Save, Smartphone } from 'lucide-react'
import type { PopupDto } from '@/lib/popup/dto'
import type { EditSiteInfo, PopupDaily } from '@/lib/popup/popup-read'
import { LAYOUT_LABEL, LIMITS, POPUP_LAYOUTS, type PopupCreative, type PopupLinkItem } from '@/lib/popup/schema'
import PopupPreview from '@/components/popup/PopupPreview'
import { AreaChart } from '@/components/ds/charts'
import { DaysSwitch, ErrorState, KindBadge, PageHeader, StatTile, StatusBadge, fmt, useToast } from '@/components/popup/ui'

const len = (s: string) => Array.from(s).length

function Field({ id, label, hint, count, max, error, children }: { id: string; label: string; hint?: string; count?: number; max?: number; error?: string; children: React.ReactNode }) {
  const over = count !== undefined && max !== undefined && count > max
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="pd-label !font-bold !text-[color:var(--ink)]">
          {label}
        </label>
        {max !== undefined && (
          <span className={`pd-tabular text-xs ${over ? 'font-bold text-[color:var(--err-ink)]' : 'text-[color:var(--muted)]'}`}>
            {count ?? 0}/{max}
          </span>
        )}
      </div>
      <div className="mt-1">{children}</div>
      {(error || over) && <p className="mt-1 text-[13px] font-medium text-[color:var(--err-ink)]">{error || `${max}字以内にしてください`}</p>}
      {hint && !error && <p className="pd-label mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pd-card">
      <h2 className="pd-h2">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function UrlPicker({ id, pages, onPick }: { id: string; pages: EditSiteInfo['pages']; onPick: (p: { label: string; url: string }) => void }) {
  if (pages.length === 0) return null
  return (
    <select
      id={id}
      className="pd-input mt-2 !min-h-[40px] !text-[13px] text-[color:var(--sub)]"
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

function isUrl(v: string): boolean {
  if (!v) return true
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function StatsChart({ stats }: { stats: PopupDaily }) {
  // 共通の AreaChart（2系列）。30日・90日でも日付の文字は間引かれ、線の形でも系列を区別する
  return (
    <AreaChart
      label={`日別の表示とクリック（直近${stats.days}日）`}
      labels={stats.series.map((p) => p.day.slice(5).replace('-', '/'))}
      yTicks
      tickFormat={(n) => fmt(n)}
      format={(n) => fmt(n)}
      height={180}
      // クリックは表示より桁が小さく、同じ目盛りでは 0 に張り付くので、右の目盛りで測る（統括の指摘 2026-10-23）
      series={[
        { name: '表示', values: stats.series.map((p) => p.impressions) },
        { name: 'クリック', values: stats.series.map((p) => p.clicks), tone: 'pink', axis: 'right' },
      ]}
    />
  )
}

export default function EditClient({ initialPopup, site }: { initialPopup: PopupDto; site: EditSiteInfo }) {
  const [popup, setPopup] = useState<PopupDto>(initialPopup)
  const [draft, setDraft] = useState<PopupDto>(initialPopup)
  const [device, setDevice] = useState<'pc' | 'sp'>('pc')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [stats, setStats] = useState<PopupDaily | null>(null)
  const [statsError, setStatsError] = useState(false)
  const { show, node: toast } = useToast()

  const loadStats = useCallback(async () => {
    setStatsError(false)
    try {
      const r = await fetch(`/api/popup/popups/${initialPopup.id}/stats?days=${days}`, { cache: 'no-store' })
      if (!r.ok) throw new Error('stats')
      setStats(await r.json())
    } catch {
      setStatsError(true)
    }
  }, [initialPopup.id, days])

  useEffect(() => {
    setStats(null)
    void loadStats()
  }, [loadStats])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(popup), [draft, popup])

  // 保存する前に離れると確認を出す（§11）
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const c = draft.creative
  const setC = (patch: Partial<PopupCreative>) => setDraft({ ...draft, creative: { ...c, ...patch } })
  const setLink = (i: number, patch: Partial<PopupLinkItem>) => {
    const links = [0, 1, 2].map((k) => c.links[k] || { label: '', url: '' })
    links[i] = { ...links[i], ...patch }
    setC({ links })
  }
  const isImage = draft.kind === 'image'
  const isAsk = draft.kind === 'ask'
  const buttonUrlError = !isAsk && !isUrl(c.buttonUrl) ? 'http:// か https:// で始まるURLを入れてください' : undefined

  const save = async (status?: 'live' | 'paused') => {
    setSaving(true)
    setError(null)
    setIssues([])
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
          links: c.links.filter((l) => l && (l.label || l.url)),
          colors: c.colors,
          imageAlt: c.imageAlt,
          // AIに聞く型はURLを質問文から作る（サーバ側で組み立てる）
          ...(isAsk ? { question: c.question } : { buttonUrl: c.buttonUrl }),
        },
      }
      if (status) body.status = status
      const res = await fetch(`/api/popup/popups/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) {
        window.location.href = `/auth/signin?callbackUrl=/popup/edit/${draft.id}`
        return
      }
      if (!res.ok) {
        setError(json?.error || '保存に失敗しました。')
        setIssues(Array.isArray(json?.issues) ? json.issues : [])
        return
      }
      const before = popup.status
      setPopup(json.popup)
      setDraft(json.popup)
      show(
        status === 'live'
          ? { message: '公開しました。サイトに1分ほどで反映されます。', undo: before !== 'live' ? () => void save('paused') : undefined }
          : status === 'paused'
            ? { message: '停止しました。', undo: () => void save('live') }
            : { message: '保存しました。' }
      )
    } catch {
      setError('通信に失敗しました。接続を確かめてもう一度お試しください。')
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
      const img = { imagePath: json.popup.creative.imagePath, imageWidth: json.popup.creative.imageWidth, imageHeight: json.popup.creative.imageHeight }
      setPopup((p) => ({ ...p, creative: { ...p.creative, ...img }, imageUrl: json.popup.imageUrl, issues: json.popup.issues }))
      setDraft((d) => ({ ...d, creative: { ...d.creative, ...img }, imageUrl: json.popup.imageUrl }))
      show({ message: '画像を差し替えました。' })
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setUploading(false)
    }
  }

  const siteColors = site.colors.filter((x) => /^#[0-9a-f]{6}$/i.test(x))

  return (
    <div className="pd-page mx-auto max-w-7xl px-4 py-8 md:px-8">
      {toast}
      <PageHeader back={{ href: `/popup/sites/${site.id}`, label: site.name }} title="ポップアップの編集" />

      {/* 操作の行（スクロールしても見える） */}
      <div className="sticky top-0 z-20 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] bg-[var(--bg)] px-4 py-3 md:-mx-8 md:px-8">
        <StatusBadge status={popup.status} />
        <KindBadge kind={draft.kind} />
        <label htmlFor="popup-name" className="sr-only">
          ポップアップの名前
        </label>
        <input
          id="popup-name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          maxLength={LIMITS.name}
          className="pd-input !min-h-[40px] min-w-0 flex-1 !border-transparent !bg-transparent !text-lg !font-bold hover:!border-[color:var(--line)] focus:!border-[color:var(--blue)] focus:!bg-[var(--paper)]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving || !dirty} onClick={() => void save()} className="pd-btn-outline">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            保存
          </button>
          {popup.status === 'live' && (
            <button type="button" disabled={saving} onClick={() => void save('paused')} className="pd-btn-outline">
              <Pause className="h-4 w-4" aria-hidden />
              停止する
            </button>
          )}
          <button type="button" disabled={saving || !!buttonUrlError} onClick={() => void save('live')} className="pd-btn">
            <Play className="h-4 w-4" aria-hidden />
            {popup.status === 'live' ? '保存して公開' : '公開する'}
          </button>
        </div>
      </div>

      {error && (
        <div className="pd-error mt-4 flex items-start gap-2" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            {error}
            {issues.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 左: 設定 */}
        <div className="space-y-4">
          {isImage && (
            <Section title="画像">
              <div className="flex flex-wrap items-center gap-4">
                <label className="pd-btn-outline cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
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
                <span className="pd-label">PNG・JPEG・WebP・GIF、2MBまで</span>
              </div>
              <Field id="popup-image-url" label="画像を押したときのリンク先URL" error={buttonUrlError}>
                <input id="popup-image-url" className="pd-input" value={c.buttonUrl} onChange={(e) => setC({ buttonUrl: e.target.value })} placeholder="https://" inputMode="url" />
                <UrlPicker id="popup-image-url-pick" pages={site.pages} onPick={(p) => setC({ buttonUrl: p.url })} />
              </Field>
              <Field id="popup-image-alt" label="画像の説明（読み上げ用）" count={len(c.imageAlt)} max={100}>
                <input id="popup-image-alt" className="pd-input" value={c.imageAlt} onChange={(e) => setC({ imageAlt: e.target.value })} placeholder="例: 無料相談のご案内" />
              </Field>
            </Section>
          )}

          <Section title="形">
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="ポップアップの形">
              {POPUP_LAYOUTS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setC({ layout: l })}
                  aria-pressed={c.layout === l}
                  className={`min-h-[48px] rounded-[var(--r-sm)] border px-2 text-[13px] font-bold ${
                    c.layout === l ? 'border-[color:var(--blue)] bg-[var(--blue-soft)] text-[color:var(--blue-deep)]' : 'border-[color:var(--line-strong)] text-[color:var(--sub)] hover:border-[color:var(--blue)]'
                  }`}
                >
                  {LAYOUT_LABEL[l]}
                </button>
              ))}
            </div>
            {c.layout === 'modal' && !isImage && <p className="pd-label">スマホでは画面を覆わないよう、下からせり上がる形で表示します。</p>}
          </Section>

          {!isImage && (
            <Section title="文言">
              <Field id="popup-eyebrow" label="上の小さな文字（サイト名など）" count={len(c.eyebrow)} max={LIMITS.eyebrow}>
                <input id="popup-eyebrow" className="pd-input" value={c.eyebrow} onChange={(e) => setC({ eyebrow: e.target.value })} />
              </Field>
              <Field id="popup-headline" label="見出し" count={len(c.headline)} max={LIMITS.headline} error={!c.headline.trim() ? '見出しを入れてください' : undefined}>
                <input id="popup-headline" className="pd-input" value={c.headline} onChange={(e) => setC({ headline: e.target.value })} />
              </Field>
              <Field id="popup-sub" label="説明" count={len(c.sub)} max={LIMITS.sub}>
                <textarea id="popup-sub" className="pd-input" rows={2} value={c.sub} onChange={(e) => setC({ sub: e.target.value })} />
              </Field>
              {isAsk && (
                <Field id="popup-bubble-0" label="吹き出し（3つまで）" hint="訪問者が聞きたくなる短い疑問。">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <input
                        key={i}
                        id={`popup-bubble-${i}`}
                        aria-label={`吹き出し${i + 1}`}
                        className="pd-input"
                        value={c.bubbles[i] || ''}
                        maxLength={LIMITS.bubble}
                        onChange={(e) => {
                          const b = [0, 1, 2].map((k) => c.bubbles[k] || '')
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
                  <div key={i} className="pd-soft grid gap-2 p-3 sm:grid-cols-[1fr_1.4fr]">
                    <input className="pd-input" aria-label={`ページ${i + 1}の名前`} value={l.label} placeholder="ページ名" maxLength={LIMITS.linkLabel} onChange={(e) => setLink(i, { label: e.target.value })} />
                    <div>
                      <input className="pd-input" aria-label={`ページ${i + 1}のURL`} aria-invalid={!isUrl(l.url)} value={l.url} placeholder="https://" inputMode="url" onChange={(e) => setLink(i, { url: e.target.value })} />
                      {!isUrl(l.url) && <p className="mt-1 text-[13px] font-medium text-[color:var(--err-ink)]">http:// か https:// で始まるURLを入れてください</p>}
                      <UrlPicker id={`popup-link-${i}-pick`} pages={site.pages} onPick={(p) => setLink(i, { label: l.label || p.label, url: p.url })} />
                    </div>
                  </div>
                )
              })}
            </Section>
          )}

          {!isImage && (
            <Section title={isAsk ? 'ボタン（ChatGPTに質問を送る）' : 'ボタン'}>
              <Field id="popup-button-label" label="ボタンの文言" count={len(c.buttonLabel)} max={LIMITS.buttonLabel}>
                <input id="popup-button-label" className="pd-input" value={c.buttonLabel} onChange={(e) => setC({ buttonLabel: e.target.value })} />
              </Field>
              {isAsk ? (
                <Field
                  id="popup-question"
                  label="ChatGPTに送る質問文"
                  count={len(c.question)}
                  max={LIMITS.question}
                  hint="ボタンを押した訪問者本人の発言としてChatGPTに入ります。文中のURLはサイトで見つかったページだけが使えます。保存するとリンクを作り直します。"
                >
                  <textarea id="popup-question" className="pd-input" rows={9} value={c.question} onChange={(e) => setC({ question: e.target.value })} />
                </Field>
              ) : (
                <Field id="popup-button-url" label="リンク先URL" hint={draft.kind === 'pages' ? '空にするとボタンを出しません。' : undefined} error={buttonUrlError}>
                  <input id="popup-button-url" className="pd-input" value={c.buttonUrl} onChange={(e) => setC({ buttonUrl: e.target.value })} placeholder="https://" inputMode="url" />
                  <UrlPicker id="popup-button-url-pick" pages={site.pages} onPick={(p) => setC({ buttonUrl: p.url })} />
                </Field>
              )}
              <Field id="popup-note" label="ボタンの下の注記" count={len(c.note)} max={LIMITS.note}>
                <input id="popup-note" className="pd-input" value={c.note} onChange={(e) => setC({ note: e.target.value })} placeholder={isAsk ? 'ChatGPTが開きます' : ''} />
              </Field>
            </Section>
          )}

          {!isImage && (
            <Section title="ポップアップの色">
              <p className="pd-label">訪問者のサイトに出るポップアップの色です（このツールの画面の色ではありません）。</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(
                  [
                    ['accent', 'ボタン・強調'],
                    ['bg', '背景'],
                    ['text', '文字'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="pd-label !font-bold !text-[color:var(--ink)]">{label}</span>
                    <span className="pd-soft mt-1 flex min-h-[44px] items-center gap-2 px-2">
                      <input type="color" value={c.colors[k]} onChange={(e) => setC({ colors: { ...c.colors, [k]: e.target.value } })} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <span className="pd-tabular text-[13px] text-[color:var(--sub)]">{c.colors[k]}</span>
                    </span>
                  </label>
                ))}
              </div>
              {siteColors.length > 0 && (
                <div className="pd-label flex flex-wrap items-center gap-2">
                  サイトの色:
                  {siteColors.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setC({ colors: { ...c.colors, accent: col } })}
                      className="h-11 w-11 rounded-full border border-[color:var(--line-strong)]"
                      style={{ background: col }}
                      aria-label={`ボタンの色を${col}にする`}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="表示の条件">
            <Field id="popup-trigger" label="きっかけ">
              <select id="popup-trigger" className="pd-input" value={draft.trigger.type} onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, type: e.target.value as 'delay' | 'scroll' | 'exit' } })}>
                <option value="delay">ページを開いてから何秒後</option>
                <option value="scroll">何％スクロールしたら</option>
                <option value="exit">ページを離れそうなとき（PC）</option>
              </select>
            </Field>
            {draft.trigger.type === 'scroll' ? (
              <Field id="popup-scroll" label="スクロールの割合（％）" hint="10〜100">
                <input id="popup-scroll" type="number" min={10} max={100} className="pd-input" value={draft.trigger.scrollPct} onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, scrollPct: Number(e.target.value) } })} />
              </Field>
            ) : (
              <Field
                id="popup-delay"
                label={draft.trigger.type === 'exit' ? 'スマホで出すまでの秒数' : '秒数'}
                hint={draft.trigger.type === 'exit' ? 'スマホにはマウスが無いため、この秒数で代わりに出します。' : '0〜600'}
              >
                <input id="popup-delay" type="number" min={0} max={600} className="pd-input" value={draft.trigger.delaySec} onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, delaySec: Number(e.target.value) } })} />
              </Field>
            )}
            <Field id="popup-device" label="端末">
              <select id="popup-device" className="pd-input" value={draft.targeting.device} onChange={(e) => setDraft({ ...draft, targeting: { ...draft.targeting, device: e.target.value as 'all' | 'pc' | 'sp' } })}>
                <option value="all">PC・スマホの両方</option>
                <option value="pc">PCのみ</option>
                <option value="sp">スマホのみ</option>
              </select>
            </Field>
            <Field id="popup-pathmode" label="表示するページ">
              <select id="popup-pathmode" className="pd-input" value={draft.targeting.pathMode} onChange={(e) => setDraft({ ...draft, targeting: { ...draft.targeting, pathMode: e.target.value as 'all' | 'include' } })}>
                <option value="all">すべてのページ</option>
                <option value="include">指定したページだけ</option>
              </select>
            </Field>
            {draft.targeting.pathMode === 'include' && (
              <Field id="popup-paths" label="ページのパス（1行に1つ・10件まで）" hint="前方一致。* は任意の文字列。例: /service/  /blog/*/  /pricing">
                <textarea
                  id="popup-paths"
                  className="pd-input"
                  rows={3}
                  value={draft.targeting.paths.join('\n')}
                  onChange={(e) => setDraft({ ...draft, targeting: { ...draft.targeting, paths: e.target.value.split('\n') } })}
                  placeholder="/service/"
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="popup-hide" label="閉じたら何日表示しないか" hint="0にすると次のページでまた出ます">
                <input id="popup-hide" type="number" min={0} max={365} className="pd-input" value={draft.frequency.hideDays} onChange={(e) => setDraft({ ...draft, frequency: { ...draft.frequency, hideDays: Number(e.target.value) } })} />
              </Field>
              <label className="flex min-h-[44px] items-center gap-2 self-center pt-4 text-[15px]">
                <input
                  type="checkbox"
                  checked={draft.frequency.oncePerSession}
                  onChange={(e) => setDraft({ ...draft, frequency: { ...draft.frequency, oncePerSession: e.target.checked } })}
                  className="h-5 w-5 accent-[var(--blue)]"
                />
                1回の訪問では1度だけ表示する
              </label>
            </div>
          </Section>
        </div>

        {/* 右: プレビューと計測 */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="pd-card" aria-labelledby="popup-preview-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="popup-preview-title" className="pd-h2">
                プレビュー
              </h2>
              <div className="pd-soft inline-flex p-1" role="group" aria-label="プレビューの端末">
                {(
                  [
                    ['pc', 'PC', Monitor],
                    ['sp', 'スマホ', Smartphone],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDevice(k)}
                    aria-pressed={device === k}
                    className={`inline-flex min-h-[44px] items-center gap-1 rounded-[10px] px-3 text-[13px] font-bold ${
                      device === k ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-[var(--shadow)]' : 'text-[color:var(--sub)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <PopupPreview popup={draft} device={device} height={device === 'sp' ? 640 : 520} />
            </div>
            <p className="pd-label mt-2">サイトに出るときと同じ仕組みで表示しています。プレビューでは計測しません。</p>
          </section>

          <section className="pd-card" aria-labelledby="popup-stats-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="popup-stats-title" className="pd-h2">
                計測
              </h2>
              <DaysSwitch value={days} onChange={setDays} />
            </div>
            <div className="mt-4">
              {statsError ? (
                <ErrorState message="計測の数字を読み込めませんでした。" onRetry={() => void loadStats()} />
              ) : stats ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <StatTile label="表示" value={fmt(stats.totals.impressions)} />
                    <StatTile label="クリック" value={fmt(stats.totals.clicks)} />
                    <StatTile label="クリック率" value={stats.totals.ctr === null ? '—' : stats.totals.ctr.toFixed(1)} unit={stats.totals.ctr === null ? undefined : '%'} />
                  </div>
                  {stats.totals.impressions === 0 ? (
                    <p className="pd-label mt-4">まだ表示されていません。公開して、サイトに設置タグを貼ると数字が入ります。</p>
                  ) : (
                    <div className="mt-4">
                      <StatsChart stats={stats} />
                    </div>
                  )}
                  {draft.kind === 'pages' && Object.keys(stats.byTarget).length > 0 && (
                    <ul className="mt-4 space-y-1 text-[13px] text-[color:var(--sub)]">
                      {Object.entries(stats.byTarget).map(([t, n]) => (
                        <li key={t} className="flex justify-between">
                          <span>{t === 'main' ? 'ボタン' : c.links[Number(t.split(':')[1])]?.label || t}</span>
                          <span className="pd-tabular">{fmt(n)}クリック</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="space-y-2" aria-hidden>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="pd-skel h-[76px]" />
                    <div className="pd-skel h-[76px]" />
                    <div className="pd-skel h-[76px]" />
                  </div>
                  <div className="pd-skel h-36" />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
