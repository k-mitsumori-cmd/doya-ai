'use client'

// ドヤAI質問リンク 作成画面（ログイン後）
// 流れ: URL → 抽出＋質問リンク2本（数秒〜十数秒）→ バナー3枚を1枚ずつ（1枚1〜2分）
import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Link2, Loader2 } from 'lucide-react'
import RunResult from '@/components/asklink/RunResult'
import { useBannerQueue } from '@/components/asklink/useBannerQueue'
import type { RunDto } from '@/lib/asklink/dto'
import { ToolHero } from '@/components/ds'
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { DoneBanner, ErrorNotice } from '@/components/ds/feedback'
import AskLinkErrorNotice from '@/components/asklink/AskLinkErrorNotice'
import { statusError, statusOf } from '@/components/asklink/errors'

// 新しい見た目のキービジュアル。シロクマの絵（public/ui-renewal/mascots/asklink.webp）が置かれるまでは、LP の絵を仮に出す
const HERO_ART = '/ui-renewal/keyart/asklink.webp'

const LOADING_STEPS = ['サイトを読み取っています', '質問文を作っています', 'URLと文字数を確認しています']

// 結果ができるまでの案内。何ができあがって、どこに貼るのかを先に見せる
const GUIDE = [
  { src: '/asklink/shots/1-input.webp', title: 'URLを入れる', desc: '自社サイトのトップページなど、URLを1つ入れて「作成する」を押します。' },
  { src: '/asklink/shots/2-process.webp', title: 'リンク2本とバナー3枚ができる', desc: 'リンクは十数秒、バナーは1枚1〜2分でできます。リンクは先にお使いいただけます。' },
  { src: '/asklink/shots/3-output.webp', title: 'ポップアップに貼る', desc: 'リンクのURLとバナー画像をコピーして、ポップアップ作成ツールに貼るだけです。' },
]

function Guide() {
  return (
    <section className="mt-8" aria-labelledby="asklink-guide">
      <h2 id="asklink-guide" className="mb-3 text-sm font-black text-slate-800">
        できあがるまでの流れ
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {GUIDE.map((g, i) => (
          <li key={g.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image src={g.src} alt="" width={1200} height={800} className="aspect-[3/2] w-full bg-blue-50 object-cover" />
            <div className="p-4">
              <p className="flex items-center gap-2 text-sm font-black text-slate-900">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0066ff] text-xs text-white">{i + 1}</span>
                {g.title}
              </p>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-slate-500">{g.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function AskLinkTool() {
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [needManual, setNeedManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const oneButton = useOneButton()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  // 新しい見た目では、サーバーの文言ではなく状態から案内を決める（0 は通信の失敗）
  const [errStatus, setErrStatus] = useState<number | null>(null)
  const [limit, setLimit] = useState<{ message: string; upgradeUrl?: string } | null>(null)
  const [run, setRun] = useState<RunDto | null>(null)
  const queue = useBannerQueue(setRun)
  const [doneShown, setDoneShown] = useState(false)

  // 入力の誤り（400）を、どの欄の誤りかとして支援技術に伝える
  const urlInvalid = Boolean(error) && errStatus === 400 && !needManual
  const manualInvalid = Boolean(error) && errStatus === 400 && needManual

  const create = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    setErrStatus(null)
    setLimit(null)
    try {
      const res = await fetch('/api/asklink/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, manualText: needManual ? manualText : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        window.location.href = '/auth/signin?callbackUrl=/asklink'
        return
      }
      if (res.status === 429 && data?.limitReached) {
        setLimit({ message: data.error, upgradeUrl: data.upgradeUrl })
        return
      }
      if (res.status === 422 && data?.canUseManualInput) {
        setNeedManual(true)
        setError(data.error)
        setErrStatus(422)
        return
      }
      if (!res.ok || !data?.run) throw statusError(data?.error || '作成に失敗しました。', res.status)
      setRun(data.run)
      setNeedManual(false)
      setManualText('')
      setDoneShown(true)
      window.dispatchEvent(new Event('asklink:generated'))
      // リンクを先に見せ、画像は順に作る
      void queue.generate(data.run.id, data.run.banners.map((b: { kind: string }) => b.kind))
    } catch (e) {
      setError((e as Error).message)
      setErrStatus(statusOf(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {oneButton ? (
        <div className="mb-6">
          <OneButtonBar
            eyebrow="ドヤAI質問リンク"
            cta={loading ? 'リンクとバナーを作っています。このまま待ってね' : '自社サイトの URL を入れたら、押してね'}
            label="作成する"
            scope="入れた URL から、ChatGPT に質問が届くリンク2本と、ポップアップ用のバナー3枚を作ります。"
            onRun={() => formRef.current?.requestSubmit()}
            disabled={loading || !url.trim() || (needManual && manualText.trim().length < 20)}
            disabledReason={needManual && url.trim() ? 'サイトの文章を20文字以上入れると押せます。' : '自社サイトの URL を入れると押せます。'}
            running={loading}
          />
        </div>
      ) : null}
      <div className="mb-6">
          <ToolHero
            title={<>サイトのURLから、<wbr />「AIに聞く」リンクを</>}
            lead="URLを1つ入れると、ChatGPTに質問が届くリンク2本と、ポップアップ用のバナー3枚を作ります。"
            art={HERO_ART}
            artAlt="サイトのポップアップの「AIに聞く」ボタンから、ChatGPTで相談が始まる様子"
          />
        </div>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <label htmlFor="asklink-url" className="text-sm font-black text-slate-800">
          自社サイトのURL
        </label>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Link2 aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="asklink-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.co.jp/"
              className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-3 text-sm font-bold text-slate-800 focus:border-[#0066ff] focus:outline-none min-h-11 min-w-0 text-base focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-0 sm:text-sm"
              required
              aria-invalid={urlInvalid ? true : undefined}
              aria-describedby={urlInvalid ? 'asklink-form-error' : undefined}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim() || (needManual && manualText.trim().length < 20)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-6 py-3 text-sm font-black text-white shadow transition hover:bg-blue-700 disabled:opacity-50 min-h-11 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {loading ? '作成しています' : '作成する'}
          </button>
        </div>

        {needManual && (
          <div className="mt-4">
            <label htmlFor="asklink-manual" className="text-sm font-black text-slate-800">
              サービスの説明（サイトを読み取れなかったときの手入力）
            </label>
            <textarea
              id="asklink-manual"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder="会社名・サービスの内容・強み・対象のお客さまなどを、20字以上で入力してください。"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:border-[#0066ff] focus:outline-none text-base focus-visible:ring-2 focus-visible:ring-[#0066ff] sm:text-sm"
              aria-invalid={manualInvalid ? true : undefined}
              aria-describedby={`asklink-manual-note${error ? ' asklink-form-error' : ''}`}
            />
            <p id="asklink-manual-note" className="mt-1 text-xs font-bold text-slate-500">
              手入力のときは、質問文に入れるURLは上で入力したURLだけになります。
            </p>
          </div>
        )}

        {loading && (
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {LOADING_STEPS.map((label, i) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#0066ff] motion-reduce:![animation:none]"
                style={{ animation: `pulse 1.6s ease-in-out ${i * 0.5}s infinite` }}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0066ff] text-[10px] font-black text-white">{i + 1}</span>
                {label}
              </li>
            ))}
            <li className="text-xs font-bold text-slate-500 sm:col-span-3">十数秒ほどかかります。このままお待ちください。</li>
          </ol>
        )}
        {error && (
          <div id="asklink-form-error" className="mt-3">
            {errStatus === 422 ? (
              <ErrorNotice
                what="このサイトは読み取れませんでした。"
                how="下の欄にサービスの説明を入れて、もう一度「作成する」を押してください。"
              />
            ) : errStatus === 400 ? (
              <ErrorNotice
                what={needManual ? 'サービスの説明の長さが合っていません。' : 'URLの形が正しくないようです。'}
                how={needManual ? 'サービスの説明を20〜3,000字で入れて、もう一度「作成する」を押してください。' : '「https://」から始まるサイトのURLを入れて、もう一度「作成する」を押してください。'}
              />
            ) : (
              <AskLinkErrorNotice status={errStatus ?? 500} action="create" onRetry={() => void create()} />
            )}
          </div>
        )}
        {limit && (
          <div className="mt-3">
            <AskLinkErrorNotice status={429} action="create" />
          </div>
        )}
      </form>

      {!run && !loading && <Guide />}

      {run && (
        <div className="mt-8">
          {doneShown && !queue.busy && (
            <div className="mb-4">
              <DoneBanner
                title="質問リンクとバナーができました。下のボタンでコピーして、ポップアップに貼ってください。"
                next={<Link href="/asklink/history" className="text-sm font-bold text-[#0066ff] hover:underline">これまでの結果を見る</Link>}
                onClose={() => setDoneShown(false)}
              />
            </div>
          )}
          {queue.busy && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-[#0066ff]">
              <Loader2 className="h-4 w-4 animate-spin" />
              バナー画像を作成しています（{run.banners.findIndex((b) => b.kind === queue.busy) + 1}/{run.banners.length}）。リンクは先にお使いいただけます。
            </p>
          )}
          {(
            queue.errorStatus !== null && (
              <div className="mb-4">
                <AskLinkErrorNotice status={queue.errorStatus} action="banner" />
              </div>
            )
          )}
          <RunResult
            run={run}
            onChange={setRun}
            bannerBusy={queue.busy}
            onGenerateBanner={(kind) => void queue.generate(run.id, [kind])}
          />
        </div>
      )}
    </div>
  )
}
