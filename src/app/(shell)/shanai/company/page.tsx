'use client'

// ドヤ社内インタビュー 会社情報: URL登録 → サイト読み取り → プロフィール確認
// ⚠️ ここで確認した項目（approved）だけが記事の「会社の事実」になる
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, Globe, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ActionError, api, Button, Card, describeError, EmptyState, ErrorState, Field, inputCls, Notice, PageSkeleton, ProgressSteps, SectionTitle, useLeaveGuard, useTimedStep, PageTitle } from '@/components/shanai/ui'
import { useUiNext } from '@/components/shell/ui-next-context'
import { DEFAULT_BRAND_COLOR, PROFILE_CATEGORY_LABELS, SOURCE_KIND_LABELS, type ProfileCategory, type SourceKind } from '@/lib/shanai/types'

interface Source {
  id?: string
  kind: SourceKind
  label: string
  url: string
  lastCrawledAt?: string | null
  error?: string | null
}
interface Item {
  id: string
  category: ProfileCategory
  statement: string
  quote: string | null
  origin: 'site' | 'manual'
  approved: boolean
  pageUrl: string | null
  pageTitle: string | null
}
interface Company {
  name: string
  brandColor: string
  colors: string[]
  manualNote: string
  crawledAt: string | null
  sources: Source[]
  items: Item[]
}

const CATEGORY_ORDER: ProfileCategory[] = ['mission', 'business', 'service', 'number', 'culture', 'benefit', 'other']

export default function ShanaiCompanyPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [name, setName] = useState('')
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR)
  const [sources, setSources] = useState<Source[]>([])
  const [saving, setSaving] = useState(false)
  const [crawling, setCrawling] = useState(false)
  // err: 失敗の中身（status 付き）。新しい見た目では text（生の文）ではなく、ここから伝える文を組み立てる
  const [message, setMessage] = useState<{ tone: 'info' | 'error' | 'warn'; text: string; err?: unknown } | null>(null)
  const [newItem, setNewItem] = useState<{ category: ProfileCategory; statement: string }>({ category: 'culture', statement: '' })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadFailure, setLoadFailure] = useState<unknown>(null)
  const uiNext = useUiNext()
  const crawlStep = useTimedStep(crawling, 3, 25000)

  // 保存前に離れようとしたら確認を出す（会社名・色・URLを変えたとき）
  const dirty =
    !!company &&
    (name !== company.name ||
      brandColor !== company.brandColor ||
      JSON.stringify(sources.filter((x) => x.url.trim()).map((x) => [x.kind, x.label, x.url])) !== JSON.stringify(company.sources.map((x) => [x.kind, x.label, x.url])))
  useLeaveGuard(dirty)

  const apply = (c: Company) => {
    setCompany(c)
    setName(c.name)
    setBrandColor(c.brandColor)
    setSources(c.sources.length ? c.sources : [{ kind: 'corporate', label: '', url: '' }])
  }

  const load = () => {
    setLoadError(null)
    api<{ company: Company }>('/api/shanai/company')
      .then((d) => apply(d.company))
      .catch((e) => {
        if ((e as any)?.status === 401) window.location.href = '/auth/signin?callbackUrl=/shanai/company'
        setLoadError((e as Error).message)
        setLoadFailure(e)
      })
  }

  useEffect(load, [])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const d = await api<{ company: Company }>('/api/shanai/company', { method: 'PUT', json: { name, brandColor, sources: sources.filter((s) => s.url.trim()) } })
      apply(d.company)
      toast.success('保存しました', { duration: 3000 })
      return true
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message, err: e })
      return false
    } finally {
      setSaving(false)
    }
  }

  const crawl = async () => {
    if (!(await save())) return
    setCrawling(true)
    setMessage(null)
    try {
      const d = await api<{ company: Company; summary: { pagesRead: number; itemsAdded: number; robotsSkipped: number; failures: unknown[] } }>('/api/shanai/company/crawl', { method: 'POST' })
      apply(d.company)
      const s = d.summary
      toast.success(`${s.itemsAdded}件の項目を読み取りました`, { duration: 3000 })
      setMessage({
        tone: s.failures.length ? 'warn' : 'info',
        text: `${s.pagesRead}ページを読み取り、${s.itemsAdded}件の項目を追加しました。${s.robotsSkipped ? `robots.txt で許可されていない${s.robotsSkipped}ページは読み取っていません。` : ''}${s.failures.length ? '読み取れなかったURLがあります。下の一覧をご確認ください。' : ''}`,
      })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message, err: e })
    } finally {
      setCrawling(false)
    }
  }

  const updateItems = async (items: unknown[]) => {
    try {
      const d = await api<{ company: Company }>('/api/shanai/company/items', { method: 'PUT', json: { items } })
      setCompany(d.company)
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message, err: e })
    }
  }

  if (loadError) return <ErrorState message={loadError} error={loadFailure} onRetry={load} />
  if (!company) return <PageSkeleton variant="form" />

  const grouped = CATEGORY_ORDER.map((c) => ({ category: c, items: company.items.filter((i) => i.category === c) })).filter((g) => g.items.length)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle>会社情報</PageTitle>
      <p className="mt-1 text-[13px] font-medium leading-[1.5] text-[var(--sub)]">ここで登録した内容を、すべてのインタビュー記事で使います。</p>

      {message && (
        <div className="mt-4">
          {uiNext && message.tone === 'error' ? <ActionError error={describeError(message.err)} /> : <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      )}

      <Card className="mt-6">
        <SectionTitle title="会社の基本" />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="会社名">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="株式会社サンプル" maxLength={120} />
          </Field>
          <Field label="サムネの色">
            <div className={uiNext ? 'flex flex-wrap items-center gap-2' : 'flex items-center gap-2'}>
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className={uiNext ? 'h-11 w-12 cursor-pointer rounded-lg border border-[var(--line)]' : 'h-10 w-12 cursor-pointer rounded-lg border border-[var(--line)]'} aria-label="サムネの色" />
              {company.colors.slice(0, 3).map((c) => (
                <button key={c} type="button" onClick={() => setBrandColor(c)} className={uiNext ? 'h-11 w-11 rounded-full border border-[var(--line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2' : 'h-7 w-7 rounded-full border border-[var(--line)]'} style={{ backgroundColor: c }} aria-label={`サイトの色 ${c} を使う`} />
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle title="読み取るURL" desc="会社サイト・サービスサイト・採用ページなど、6件まで登録できます。トップページから会社概要や採用情報のページを自動で探して読み取ります。" />
        <div className="space-y-3">
          {sources.map((s, i) => (
            <div key={s.id || i} className="rounded-[var(--r-sm)] border border-[var(--line)] p-3">
              <div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
                <select className={inputCls} value={s.kind} aria-label={uiNext ? 'URLの種類' : undefined} onChange={(e) => setSources((l) => l.map((x, j) => (j === i ? { ...x, kind: e.target.value as SourceKind } : x)))}>
                  {Object.entries(SOURCE_KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input className={inputCls} value={s.label} onChange={(e) => setSources((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={s.kind === 'service' ? 'サービス名' : '名前（任意）'} maxLength={60} aria-label={uiNext ? '名前' : undefined} />
                <input className={inputCls} value={s.url} onChange={(e) => setSources((l) => l.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://example.co.jp" inputMode="url" id={uiNext ? `shanai-source-url-${i}` : undefined} aria-label={uiNext ? 'URL' : undefined} />
                <button type="button" onClick={() => setSources((l) => l.filter((_, j) => j !== i))} className={
                    uiNext
                      ? 'grid h-11 w-11 place-items-center justify-self-end rounded-[var(--r-sm)] text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]'
                      : 'rounded-[var(--r-sm)] px-3 text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600'
                  }
                  aria-label="このURLを外す"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {(s.error || s.lastCrawledAt) && (
                <p className={`mt-2 text-xs font-bold ${uiNext ? 'break-words ' : ''}${s.error ? 'text-rose-600' : 'text-[var(--muted)]'}`}>
                  {s.error || `最終読み取り: ${new Date(s.lastCrawledAt!).toLocaleString('ja-JP')}`}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {sources.length < 6 && (
            <Button variant="secondary" onClick={() => setSources((l) => [...l, { kind: l.some((x) => x.kind === 'corporate') ? 'service' : 'corporate', label: '', url: '' }])}>
              <Plus className="h-4 w-4" />
              URLを追加
            </Button>
          )}
          <div className={uiNext ? 'ml-auto flex flex-wrap justify-end gap-2' : 'ml-auto flex gap-2'}>
            <Button variant="secondary" onClick={save} loading={saving} disabled={crawling}>
              保存
            </Button>
            <Button onClick={crawl} loading={crawling} disabled={saving}>
              <RefreshCw className="h-4 w-4" />
              {company.crawledAt ? '読み取り直す' : 'サイトを読み取る'}
            </Button>
          </div>
        </div>
        {crawling && (
          <ProgressSteps
            steps={['トップページと会社概要・採用ページを探しています', 'ページの本文を読み取っています', 'ミッション・事業・制度などを原文つきで整理しています']}
            current={crawlStep}
            note='ページ数によっては1〜2分かかります。'
          />
        )}
      </Card>

      <Card className="mt-4">
        <SectionTitle
          title="会社プロフィール"
          desc="サイトから読み取った項目です。記事に使ってよいものにチェックを入れてください。原文はサイトに書かれていた文章で、変更できません。"
        />
        {grouped.length === 0 ? (
          uiNext ? (
            // 新しい見た目: ツールの絵＋次にやること1つ（URL を登録済みなら読み取り、まだなら入力欄へ）
            <EmptyState
              image="/shanai/empty-interviews.webp"
              title="まだ会社プロフィールがありません"
              desc="上で会社サイトのURLを登録して「サイトを読み取る」を押すと、ここに項目が並びます。"
              action={
                sources.some((x) => x.url.trim()) ? (
                  <Button onClick={crawl} loading={crawling} disabled={saving}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    サイトを読み取る
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => document.getElementById('shanai-source-url-0')?.focus()}>
                    会社サイトのURLを入れる
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState
              image="/empty/not-generated.svg"
              title="まだ会社プロフィールがありません"
              desc="上で会社サイトのURLを登録して「サイトを読み取る」を押すと、ここに項目が並びます。"
            />
          )
        ) : (
          <div className="space-y-6">
            {grouped.map((g) => (
              <div key={g.category}>
                <p className="text-xs font-black text-[var(--blue-deep)]">{PROFILE_CATEGORY_LABELS[g.category]}</p>
                <ul className="mt-2 space-y-2">
                  {g.items.map((it) => (
                    <li key={it.id} className={`rounded-[var(--r-sm)] border p-3 ${it.approved ? 'border-[var(--line)] bg-[var(--paper)]' : 'border-[var(--line)] bg-[var(--bg)] opacity-70'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={it.approved}
                          onChange={(e) => updateItems([{ id: it.id, category: it.category, approved: e.target.checked }])}
                          className="mt-1 h-4 w-4 accent-[var(--blue)]"
                          aria-label={uiNext ? `「${it.statement}」を記事に使う` : '記事に使う'}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black text-[var(--ink)]${uiNext ? ' break-words' : ''}`}>{it.statement}</p>
                          {it.quote && <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--sub)]">原文: {it.quote}</p>}
                          {it.pageUrl ? (
                            <a href={it.pageUrl} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--blue-deep)]${uiNext ? ' max-w-full' : ''}`}>
                              <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {uiNext ? <span className="min-w-0 truncate">{it.pageTitle || it.pageUrl}</span> : it.pageTitle || it.pageUrl}
                              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {uiNext && <span className="sr-only">（新しいタブで開きます）</span>}
                            </a>
                          ) : (
                            it.origin === 'manual' && <p className="mt-1 text-[11px] font-bold text-[var(--muted)]">手入力</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateItems([{ id: it.id, delete: true }])}
                          className={
                            uiNext
                              ? '-my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]'
                              : 'rounded-lg p-1.5 text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600'
                          }
                          aria-label="この項目を削除"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <p className="text-xs font-black text-[var(--sub)]">サイトに無い情報を追加する</p>
          <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)]">社内の制度や数字など、事実として記事に書いてよいことだけを入れてください。</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
            <select className={inputCls} value={newItem.category} aria-label={uiNext ? '項目の種類' : undefined} onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value as ProfileCategory }))}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {PROFILE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input className={inputCls} value={newItem.statement} onChange={(e) => setNewItem((n) => ({ ...n, statement: e.target.value }))} placeholder="例: 毎月1回、全社で成果を共有する会を開いている" maxLength={300} aria-label={uiNext ? '追加する内容' : undefined} />
            <Button
              variant="secondary"
              disabled={!newItem.statement.trim()}
              onClick={async () => {
                await updateItems([{ category: newItem.category, statement: newItem.statement }])
                setNewItem((n) => ({ ...n, statement: '' }))
              }}
            >
              追加
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
