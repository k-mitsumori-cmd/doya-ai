'use client'

// ドヤAI質問リンク 結果画面（4-4）。作成直後と履歴の詳細で共用する
// ⚠️ 編集中の機械チェックは表示用。保存する値はサーバーで作り直す（PATCH /api/asklink/runs/[id]）
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Check, Code2, Copy, Download, ExternalLink, ImageIcon, Loader2, Pencil, RefreshCw,
} from 'lucide-react'
import { buildLink, QUESTION_MAX_CHARS, URL_MAX_LENGTH } from '@/lib/asklink/link'
import type { AskLink, Audience } from '@/lib/asklink/types'
import type { BannerDto, RunDto } from '@/lib/asklink/dto'

// ---------- コピー ----------

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 5000)
}

function useFlash(): [string | null, (key: string) => void] {
  const [flash, setFlash] = useState<string | null>(null)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(t)
  }, [flash])
  return [flash, setFlash]
}

function CopyButton({
  label, done, onClick, primary, icon: Icon = Copy,
}: { label: string; done: boolean; onClick: () => void; primary?: boolean; icon?: typeof Copy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'inline-flex items-center gap-1.5 rounded-lg bg-[#0066ff] px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50'
      }
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      {done ? 'コピーしました' : label}
    </button>
  )
}

// ---------- 質問リンク ----------

function CheckBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
      <Check className="h-3 w-3" />
      合格
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      要確認
    </span>
  )
}

function LinkCard({
  link, index, allowedUrls, onSave,
}: { link: AskLink; index: number; allowedUrls: string[]; onSave: (key: string, buttonLabel: string, question: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState(link.question)
  const [buttonLabel, setButtonLabel] = useState(link.buttonLabel)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useFlash()
  const selectId = `asklink-q-${link.key}`

  useEffect(() => {
    setQuestion(link.question)
    setButtonLabel(link.buttonLabel)
  }, [link.question, link.buttonLabel])

  // 編集中は入力のたびにURLと機械チェックを作り直す
  const view = useMemo(
    () => (editing ? buildLink(link.key, link.title, buttonLabel, question, allowedUrls) : link),
    [editing, link, buttonLabel, question, allowedUrls]
  )

  const copy = async (key: string, text: string) => {
    if (await copyText(text)) return setFlash(key)
    // 失敗時はテキストを選択状態にして手でコピーできるようにする
    const el = document.getElementById(selectId) as HTMLTextAreaElement | null
    if (el) {
      el.focus()
      el.select()
    }
  }

  const save = async () => {
    setSaving(true)
    const ok = await onSave(link.key, buttonLabel, question)
    setSaving(false)
    if (ok) setEditing(false)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black text-[#0066ff]">リンク {index + 1}｜{link.title}</p>
          {editing ? (
            <input
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-slate-300 px-2 py-1 text-base font-black text-slate-900"
              aria-label="ボタン名"
            />
          ) : (
            <p className="mt-1 text-lg font-black text-slate-900">{view.buttonLabel || '（ボタン名なし）'}</p>
          )}
        </div>
        <CheckBadge ok={view.check.ok} />
      </div>

      <textarea
        id={selectId}
        value={editing ? question : view.question}
        readOnly={!editing}
        onChange={(e) => setQuestion(e.target.value)}
        rows={editing ? 9 : 6}
        className={`mt-3 w-full resize-y rounded-xl border p-3 text-sm leading-relaxed text-slate-700 ${
          editing ? 'border-[#0066ff] bg-white' : 'border-slate-200 bg-slate-50'
        }`}
        aria-label="質問文"
      />

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
        <span className={view.check.chars > QUESTION_MAX_CHARS ? 'text-rose-600' : ''}>
          {view.check.chars}字 / {QUESTION_MAX_CHARS}字
        </span>
        <span className={view.check.urlLength > URL_MAX_LENGTH ? 'text-rose-600' : ''}>
          URL {view.check.urlLength.toLocaleString()}文字 / {URL_MAX_LENGTH.toLocaleString()}文字
        </span>
      </div>
      {view.check.issues.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-800">
          {view.check.issues.map((i) => (
            <li key={i}>・{i}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0066ff] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              保存する
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setQuestion(link.question)
                setButtonLabel(link.buttonLabel)
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
            >
              やめる
            </button>
          </>
        ) : (
          <>
            <CopyButton primary label="URLをコピー" done={flash === 'url'} onClick={() => void copy('url', view.url)} />
            <CopyButton label="質問文をコピー" done={flash === 'q'} onClick={() => void copy('q', view.question)} />
            <a
              href={view.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              ChatGPTで試す
            </a>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
            >
              <Pencil className="h-3.5 w-3.5" />
              編集する
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- バナー ----------

function bannerHtml(linkUrl: string, b: BannerDto, alt: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return `<a href="${esc(linkUrl)}" target="_blank" rel="noopener"><img src="asklink-${b.kind}.png" alt="${esc(alt)}" width="${b.w}" height="${b.h}" style="max-width:100%;height:auto;"></a>`
}

function BannerCard({
  banner, linkUrl, alt, busy, onGenerate,
}: { banner: BannerDto; linkUrl: string; alt: string; busy: boolean; onGenerate: () => void }) {
  const [flash, setFlash] = useFlash()
  const [copyError, setCopyError] = useState<string | null>(null)
  const filename = `asklink-${banner.kind}.png`

  const copyImage = async () => {
    setCopyError(null)
    if (!banner.url) return
    const blob = await fetchBlob(banner.url)
    if (!blob) return setCopyError('画像を取得できませんでした。ページを開き直してお試しください。')
    try {
      const png = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setFlash('img')
    } catch {
      // 画像のコピーに対応していないブラウザではダウンロードに落とす
      downloadBlob(blob, filename)
      setCopyError('このブラウザは画像のコピーに対応していないため、ダウンロードしました。')
    }
  }

  const download = async () => {
    if (!banner.url) return
    const blob = await fetchBlob(banner.url)
    if (blob) downloadBlob(blob, filename)
    else window.open(banner.url, '_blank', 'noopener')
  }

  const copyHtml = async () => {
    if (await copyText(bannerHtml(linkUrl, banner, alt))) setFlash('html')
  }

  const generating = busy || banner.status === 'generating'

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-900">{banner.label}</p>
          <p className="text-[11px] font-bold text-slate-500">
            {banner.w}×{banner.h}｜{banner.use}
          </p>
        </div>
        {banner.status === 'done' && banner.verify && <CheckBadge ok={banner.verify.ok} />}
      </div>

      <div
        className="mt-3 grid w-full place-items-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
        style={{ aspectRatio: `${banner.w} / ${banner.h}` }}
      >
        {generating ? (
          <div className="flex flex-col items-center gap-2 text-xs font-bold text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#0066ff]" />
            作成中です（1枚あたり1〜2分）
          </div>
        ) : banner.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.url} alt={alt} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-xs font-bold text-slate-400">
            <ImageIcon className="h-6 w-6" />
            {banner.status === 'failed' ? '作成に失敗しました' : 'まだ作成していません'}
          </div>
        )}
      </div>

      {banner.status === 'done' && banner.verify && !banner.verify.ok && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-bold leading-relaxed text-amber-800">
          {banner.verify.missing.length > 0
            ? `次の文字が正しく描けていない可能性があります: ${banner.verify.missing.join('、')}`
            : '文字の検査ができませんでした。画像の文字を目で確認してからお使いください。'}
        </p>
      )}
      {copyError && <p className="mt-2 text-[11px] font-bold text-slate-500">{copyError}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {banner.url && !generating && (
          <>
            <CopyButton primary label="画像をコピー" done={flash === 'img'} onClick={() => void copyImage()} />
            <button
              type="button"
              onClick={() => void download()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              ダウンロード
            </button>
            <CopyButton label="コードをコピー" icon={Code2} done={flash === 'html'} onClick={() => void copyHtml()} />
          </>
        )}
        {!generating && banner.remaining > 0 && (banner.status !== 'done' || !banner.url || (banner.verify && !banner.verify.ok)) && (
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {banner.status === 'none' ? '作成する' : `作り直す（残り${banner.remaining}回）`}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- 全体 ----------

export interface RunResultProps {
  run: RunDto
  onChange: (run: RunDto) => void
  /** 生成中のバナー（親が順番に回す） */
  bannerBusy: string | null
  onGenerateBanner: (kind: string) => void
}

export default function RunResult({ run, onChange, bannerBusy, onGenerateBanner }: RunResultProps) {
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const site = run.site

  const switchAudience = async (audience: Audience) => {
    if (audience === run.audience || switching) return
    setSwitching(true)
    setError(null)
    try {
      const res = await fetch(`/api/asklink/runs/${run.id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || '切り替えに失敗しました。')
      onChange(data.run)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSwitching(false)
    }
  }

  const saveLink = async (key: string, buttonLabel: string, question: string) => {
    setError(null)
    const res = await fetch(`/api/asklink/runs/${run.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: [{ key, buttonLabel, question }] }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || '保存に失敗しました。')
      return false
    }
    onChange(data.run)
    return true
  }

  const found: { label: string; url: string | null }[] = [
    { label: '問い合わせ・無料相談', url: site.contactUrl },
    { label: '資料ダウンロード', url: site.downloadUrl },
    { label: '料金', url: site.pricingUrl },
  ]
  const firstLink = run.links[0]

  return (
    <div className="space-y-8">
      {/* 読み取った内容 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-slate-400">{run.source === 'manual' ? '入力した説明から作成' : '読み取ったサイト'}</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">{site.name}</h2>
            <a href={run.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs font-bold text-[#0066ff] hover:underline">
              {run.sourceUrl}
            </a>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-black text-slate-400">
              判定: {run.detectedAudience === 'b2b' ? 'ToB（法人向け）' : 'ToC（個人向け）'}
            </p>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(['b2b', 'b2c'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={switching}
                  onClick={() => void switchAudience(a)}
                  className={`rounded-lg px-4 py-1.5 text-xs font-black transition ${
                    run.audience === a ? 'bg-white text-[#0066ff] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {a === 'b2b' ? 'ToB' : 'ToC'}
                </button>
              ))}
            </div>
            {switching && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                質問を作り直しています
              </p>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-[11px] font-black text-slate-400">サービス内容</dt>
            <dd className="font-bold text-slate-700">{site.summary || '未確認'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-black text-slate-400">対象顧客</dt>
            <dd className="font-bold text-slate-700">{site.target || '未確認'}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-[11px] font-black text-slate-400">強み</dt>
            <dd className="font-bold text-slate-700">{site.strengths.length ? site.strengths.join(' / ') : '未確認'}</dd>
          </div>
          {found.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] font-black text-slate-400">{f.label}のページ</dt>
              <dd className="break-all font-bold text-slate-700">
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[#0066ff] hover:underline">
                    {f.url}
                  </a>
                ) : (
                  <span className="text-slate-400">未確認</span>
                )}
              </dd>
            </div>
          ))}
          {site.pages.length > 0 && (
            <div className="md:col-span-2">
              <dt className="text-[11px] font-black text-slate-400">その他の主要ページ</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {site.pages.map((p) => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    {p.label}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}

      {/* 質問リンク */}
      <section>
        <h3 className="mb-3 text-base font-black text-slate-900">AI質問リンク</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {run.links.map((l, i) => (
            <LinkCard key={l.key} link={l} index={i} allowedUrls={run.allowedUrls} onSave={saveLink} />
          ))}
        </div>
      </section>

      {/* バナー */}
      <section>
        <h3 className="mb-1 text-base font-black text-slate-900">ポップアップ用バナー</h3>
        <p className="mb-3 text-xs font-bold text-slate-500">
          リンク先には1本目のリンク（{firstLink?.buttonLabel || '1本目'}）を使います。設置用のコードも1本目のURLで作ります。
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {run.banners.map((b) => (
            <BannerCard
              key={b.kind}
              banner={b}
              linkUrl={firstLink?.url || ''}
              alt={firstLink?.buttonLabel || 'AIに聞く'}
              busy={bannerBusy === b.kind}
              onGenerate={() => onGenerateBanner(b.kind)}
            />
          ))}
        </div>
      </section>

      {/* 使い方 */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
        <h3 className="mb-2 text-base font-black text-slate-900">使い方</h3>
        <ol className="list-decimal space-y-1.5 pl-5 font-bold">
          <li>HubSpotなどのポップアップ作成画面で、画像に「画像をコピー」またはダウンロードしたバナーを設定します。</li>
          <li>ボタン（またはバナー画像）のリンク先に「URLをコピー」で取ったURLを貼り、新しいタブで開く設定にします。</li>
          <li>
            HTMLを直接置ける場所では「コードをコピー」を使えます。画像はダウンロードしてサイトにアップロードし、コード内の
            <code className="mx-1 rounded bg-white px-1 text-xs">asklink-○○.png</code>
            をそのURLに置き換えてください。
          </li>
          <li>ChatGPT経由で再訪した人は、GA4の参照元「chatgpt.com」で確認できます。</li>
        </ol>
        <p className="mt-3 text-xs font-bold text-slate-500">
          ChatGPTに質問文を渡す仕組み（URLの q と hints の指定）はOpenAIの公式仕様ではありません。将来ChatGPT側の変更で動かなくなる可能性があります。
        </p>
      </section>
    </div>
  )
}
