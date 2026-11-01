'use client'

// ドヤポップアップ ログイン後のトップ: 提案の作成とサイト一覧
// 流れ: URL → 読み取り＋質問リンク＋3案（十数秒〜数十秒）→ サイト詳細へ
// ⚠️ 初期表示のサイト一覧はサーバ（page.tsx → popup-read.ts）で取って渡す
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Globe, Sparkles } from 'lucide-react'
import type { SiteDto } from '@/lib/popup/dto'
import { EmptyState, PageHeader, ProcessingSteps, fmt, pct } from '@/components/popup/ui'
import { useInPopupShell } from '@/components/popup/shell-context'
import { ToolHero } from '@/components/ds'
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { FirstSteps } from '@/components/ds/feedback'
import { useDoyaPrefill } from '@/components/agent-router/useDoyaPrefill'

const LOADING_STEPS = ['サイトを読み取っています', '「AIに聞く」の質問文を作っています', 'ポップアップの案をまとめています']

function SiteCard({ s }: { s: SiteDto }) {
  return (
    <Link href={`/popup/sites/${s.id}`} className="pd-card group block transition-shadow hover:shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="pd-h2 truncate">{s.name}</p>
          <p className="pd-label mt-1 flex items-center gap-1 truncate">
            <Globe className="h-4 w-4 shrink-0" aria-hidden />
            {s.domain}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-[color:var(--muted)] group-hover:text-[color:var(--blue)]" aria-hidden />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {s.lastSeenAt ? (
          <span className="pd-chip pd-chip-ok">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            タグ設置済み
          </span>
        ) : (
          <span className="pd-chip pd-chip-note">
            <CircleDashed className="h-3.5 w-3.5" aria-hidden />
            タグ未設置
          </span>
        )}
        <span className="pd-chip">公開中 {s.liveCount}件</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--line)] pt-4">
        <div>
          <dt className="pd-label">表示（30日）</dt>
          <dd className="pd-tabular text-xl font-bold">{fmt(s.totals.impressions)}</dd>
        </div>
        <div>
          <dt className="pd-label">クリック</dt>
          <dd className="pd-tabular text-xl font-bold">{fmt(s.totals.clicks)}</dd>
        </div>
        <div>
          <dt className="pd-label">クリック率</dt>
          <dd className="pd-tabular text-xl font-bold text-[color:var(--blue)]">{pct(s.totals.ctr)}</dd>
        </div>
      </dl>
    </Link>
  )
}

export default function PopupTool({ initialSites }: { initialSites: SiteDto[] }) {
  const router = useRouter()
  // 共通シェルの中では ToolFrame が同じ見出しと説明を出すので、ここでは出さない
  const inShell = useInPopupShell()
  // 新しい見た目（UI 品質の直し。チェックリスト §5.1）
  const [url, setUrl] = useState('')
  // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人）
  useDoyaPrefill((read) => { const u = read('url', 'url'); if (u) setUrl(u) })
  const [manualText, setManualText] = useState('')
  const [needManual, setNeedManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const oneButton = useOneButton()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<{ message: string; upgradeUrl?: string } | null>(null)
  const sites = initialSites

  useEffect(() => {
    if (!loading) return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 7000)
    return () => clearInterval(t)
  }, [loading])

  const urlLooksValid = /^(https?:\/\/)?[^\s/]+\.[^\s]+/.test(url.trim())

  const create = async () => {
    if (loading || !urlLooksValid) return
    setLoading(true)
    setError(null)
    setLimit(null)
    try {
      const res = await fetch('/api/popup/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, manualText: needManual ? manualText : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        window.location.href = '/auth/signin?callbackUrl=/popup'
        return
      }
      if (res.status === 429 && data?.limitReached) {
        setLimit({ message: data.error, upgradeUrl: data.upgradeUrl })
        return
      }
      if (res.status === 422 && data?.canUseManualInput) {
        setNeedManual(true)
        setError(data.error)
        return
      }
      if (!res.ok || !data?.site?.id) {
        setError(data?.error || '提案の作成に失敗しました。時間をおいてもう一度お試しください。')
        return
      }
      window.dispatchEvent(new Event('popup:generated'))
      // 作った案はサーバに残っているので、途中で画面を閉じても結果は消えない
      router.push(`/popup/sites/${data.site.id}?created=1`)
    } catch {
      setError('通信に失敗しました。接続を確かめてもう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pd-page mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      {!inShell && (
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              ドヤポップアップ
              <span className="pd-chip pd-chip-blue">BETA</span>
            </span>
          }
          sub="URLを入れるだけで、AIがサイトに合ったポップアップを提案します。"
        />
      )}

      {oneButton ? (
        <div className="mb-6">
          <OneButtonBar
            eyebrow="ドヤポップアップ"
            cta={loading ? 'ポップアップの案を作っています。このままお待ちください' : 'サイトの URL を入れたら、押してください'}
            label="提案を作る"
            scope="入れた URL のサイトを読み、ポップアップの下書きを3案作ります。公開するまで、サイトには何も出ません。"
            onRun={() => void create()}
            disabled={loading || !urlLooksValid}
            disabledReason="サイトの URL を入れると押せます。"
            running={loading}
          />
        </div>
      ) : null}
      <div className="mb-6 space-y-4">
          {/* キービジュアルを 375px でも出す（今までは md 以上だけ）。主ボタンは下の「提案を作る」1つ（UI 品質 H-3・S-22） */}
          <ToolHero
            title={<>URLを入れるだけで、<wbr />サイトに合う<wbr />ポップアップを3案</>}
            lead={<>「AIに聞く」・相談への案内・<wbr />おすすめページの3案を、<wbr />下書きで作ります。<wbr />公開するまで、<wbr />サイトには何も出ません。</>}
            tool="popup"
          />
          <FirstSteps
            id="popup"
            steps={[
              { title: 'サイトのURLを入れる', body: 'AIがサイトを読み取り、3つの案を作ります' },
              { title: '案を直して公開する', body: '文言・色・出すページを選びます' },
              { title: 'タグを1行貼る', body: 'サイトに貼ると表示され、クリック率まで測れます' },
            ]}
          />
        </div>

      <section className={`pd-card ${inShell ? '' : 'mt-8'}`} aria-labelledby="popup-create">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <h2 id="popup-create" className="pd-h2">
              ポップアップを出したいサイトのURL
            </h2>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="popup-url" className="sr-only">
                サイトのURL
              </label>
              <input
                id="popup-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void create()
                }}
                placeholder="https://example.co.jp/"
                disabled={loading}
                aria-invalid={url.trim().length > 0 && !urlLooksValid}
                aria-describedby="popup-url-help"
                className="pd-input min-w-0 flex-1"
              />
              <button type="button" onClick={() => void create()} disabled={loading || !urlLooksValid} className="pd-btn">
                <Sparkles className="h-4 w-4" aria-hidden />
                提案を作る
              </button>
            </div>
            <p id="popup-url-help" className="pd-label mt-2">
              {url.trim().length > 0 && !urlLooksValid
                ? 'URLの形になっていません（例: https://example.co.jp/）'
                : '例: https://example.co.jp/ 。トップページのURLで大丈夫です。'}
            </p>
          </div>
        </div>

        {needManual && (
          <div className="mt-4">
            <label htmlFor="popup-manual" className="pd-label">
              サービスの説明（サイトを読み取れなかったときの手入力。20〜3000字）
            </label>
            <textarea
              id="popup-manual"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={4}
              className="pd-input mt-1"
              placeholder="何を提供しているか、強み、対象のお客さまなど"
            />
          </div>
        )}
        {error && (
          <p className="pd-error mt-4 flex items-start gap-2" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {limit && (
          <p className="pd-note mt-4" role="alert">
            {limit.message}
            {limit.upgradeUrl && (
              <Link href={limit.upgradeUrl} className="ml-2 font-bold underline">
                料金プランを見る
              </Link>
            )}
          </p>
        )}
      </section>

      {loading && (
        <div className="mt-4">
          <ProcessingSteps steps={LOADING_STEPS} current={step} note="30秒ほどかかります。画面を閉じても、できた案はサイト一覧に残ります" />
        </div>
      )}

      <section className="mt-12" aria-labelledby="popup-sites">
        <h2 id="popup-sites" className="pd-h2">
          あなたのサイト
        </h2>
        <div className="mt-4">
          {sites.length === 0 ? (
            <EmptyState
              image="/popup/empty-sites.webp"
              title="まだサイトがありません"
              body="上の欄にサイトのURLを入れると、最初の提案ができます。"
              action={
                <button type="button" className="pd-btn-outline" onClick={() => document.getElementById('popup-url')?.focus()}>
                  URLを入れる
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sites.map((s) => (
                <SiteCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
