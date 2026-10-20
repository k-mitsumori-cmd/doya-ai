'use client'

// ドヤAI質問リンク 作成画面（ログイン後）
// 流れ: URL → 抽出＋質問リンク2本（数秒〜十数秒）→ バナー3枚を1枚ずつ（1枚1〜2分）
import { useEffect, useRef, useState } from 'react'
import AskLinkAuthenticatedScope from '@/components/asklink/AskLinkAuthenticatedScope'
import { useAskLinkCreation } from '@/components/asklink/useAskLinkCreation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, Link2, Loader2 } from 'lucide-react'
import RunResult from '@/components/asklink/RunResult'
import { useBannerQueue } from '@/components/asklink/useBannerQueue'
import type { RunDto } from '@/lib/asklink/dto'
import { useUiNext } from '@/components/shell/ui-next-context'
import { ToolHero } from '@/components/ds'
import { DoneBanner, ErrorNotice } from '@/components/ds/feedback'
import styles from './Tool.module.css'

// 新しい見た目のキービジュアル。シロクマの絵（public/ui-renewal/mascots/asklink.webp）が置かれるまでは、LP の絵を仮に出す
const HERO_ART = '/asklink/hero.webp'

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
  return <AskLinkAuthenticatedScope callbackUrl="/asklink"><AskLinkCreationTool /></AskLinkAuthenticatedScope>
}

function AskLinkCreationTool() {
  const [run, setRun] = useState<RunDto | null>(null)
  const queue = useBannerQueue(setRun, run?.id ?? null)
  const uiNext = useUiNext()
  const [doneShown, setDoneShown] = useState(false)

  const [autoQueueRun, setAutoQueueRun] = useState<string | null>(null)
  const freshRun = useRef<string | null>(null)
  const creation = useAskLinkCreation(setRun, setAutoQueueRun)
  const { url, manualText, needManual } = creation.draft
  const loading = creation.busy, error = creation.error
  const limit = creation.quota ? { message: creation.quota.reason, upgradeUrl: '/asklink/pricing' } : null
  const locked = loading || !creation.ready || !!creation.intent || creation.authorityRejected

  useEffect(() => {
    if (!run || autoQueueRun !== run.id || freshRun.current === run.id) return
    freshRun.current = run.id
    setAutoQueueRun(null)
    setDoneShown(true)
    void queue.generate(run.id, run.banners.map(b => b.kind))
  }, [autoQueueRun, run, queue])

  const create = () => creation.create()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {uiNext ? (
        // 見出し（h1）は枠（ToolFrame）が出すので、ここは「何ができるか」を h2 で書く
        <div className={`mb-6 ${styles.hero}`}>
          <ToolHero
            title="URLから質問リンクを作成"
            lead="ChatGPTへの質問リンク2本と、ポップアップ用バナー3枚を作成します。"
            art={HERO_ART}
            artAlt="サイトのポップアップの「AIに聞く」ボタンから、ChatGPTで相談が始まる様子"
          />
        </div>
      ) : (
      <div className="mb-6 flex items-center gap-3">
        <Image src="/asklink/icon.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl shadow" priority />
        <div>
          <h1 className="text-2xl font-black text-slate-900">ドヤAI質問リンク</h1>
          <p className="text-sm font-bold text-slate-500">サイトのURLから「AIに聞く」リンク2本とポップアップ用バナー3枚を作ります。</p>
        </div>
      </div>
      )}

      <form
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
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="asklink-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => creation.setDraft({ url: e.target.value })}
              disabled={locked}
              placeholder="https://example.co.jp/"
              className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-3 text-sm font-bold text-slate-800 focus:border-[#0066ff] focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={locked || !url.trim() || (needManual && manualText.trim().length < 20)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-6 py-3 text-sm font-black text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
              onChange={(e) => creation.setDraft({ manualText: e.target.value })}
              disabled={locked}
              rows={5}
              maxLength={3000}
              placeholder="会社名・サービスの内容・強み・対象のお客さまなどを、20字以上で入力してください。"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:border-[#0066ff] focus:outline-none"
            />
            <p className="mt-1 text-xs font-bold text-slate-500">
              手入力のときは、質問文に入れるURLは上で入力したURLだけになります。
            </p>
          </div>
        )}

        {loading && (
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {LOADING_STEPS.map((label, i) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#0066ff]"
                style={{ animation: `pulse 1.6s ease-in-out ${i * 0.5}s infinite` }}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0066ff] text-[10px] font-black text-white">{i + 1}</span>
                {label}
              </li>
            ))}
            <li className="text-xs font-bold text-slate-500 sm:col-span-3">十数秒ほどかかります。このままお待ちください。</li>
          </ol>
        )}
        {error && uiNext && (
          <div className="mt-3">
            <ErrorNotice
              what={error}
              how={needManual ? '下の欄にサービスの説明を入れて、もう一度「作成する」を押してください。' : creation.intent ? '新しく作成せず、「保存結果を確認」を押してください。' : 'URLを確かめて、もう一度「作成する」を押してください。'}
            />
          </div>
        )}
        {error && !uiNext && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {creation.intent && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
            <p role="status">{creation.operation?.state === 'completed' ? '作成結果は保存されています。' : creation.operation?.state === 'expired' ? 'この操作の確認期間が終了しました。保存済みの結果は履歴からご確認ください。' : '前の作成操作が記録されています。新しく作成する前に結果をご確認ください。'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void creation.verify()} disabled={loading || creation.authorityRejected} className="rounded-lg border border-blue-300 bg-white px-3 py-2 font-bold disabled:opacity-50">保存結果を確認</button>
              {creation.operation && (creation.operation.state === 'missing' || creation.operation.canFinalize) && <button type="button" onClick={() => void creation.finish()} disabled={loading || creation.authorityRejected} className="rounded-lg border border-blue-300 bg-white px-3 py-2 font-bold disabled:opacity-50">この操作を終了</button>}
              {creation.operation && ['completed', 'failed', 'canceled', 'deleted', 'superseded', 'expired'].includes(creation.operation.state) && <button type="button" onClick={() => void creation.startNew()} disabled={loading || creation.authorityRejected} className="rounded-lg border border-blue-300 bg-white px-3 py-2 font-bold disabled:opacity-50">新しい作成へ進む</button>}
            </div>
          </div>
        )}
        {limit && (
          <div className="mt-3 rounded-xl bg-blue-50 p-4 text-sm font-bold text-slate-700">
            <p>{limit.message}</p>
            {limit.upgradeUrl && (
              <Link href={limit.upgradeUrl} className="mt-2 inline-block font-black text-[#0066ff] hover:underline">
                料金プランを見る
              </Link>
            )}
          </div>
        )}
      </form>

      {!run && !loading && <Guide />}

      {run && (
        <div className="mt-8">
          {uiNext && doneShown && !queue.busy && (
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
          {queue.error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{queue.error}</p>}
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
