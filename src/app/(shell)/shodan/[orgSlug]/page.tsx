'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { usePreparationList } from '@/lib/shodan/use-preparation-list'
import { Button, EmptyState, ErrorNotice, FirstSteps, Skeleton, ToolHero, ToolNextStep, type NextStepView } from '@/components/ds'
import { Stagger, StaggerItem } from '@/components/ds/motion'
import { ChevronRight, Lightbulb, Trash2 } from 'lucide-react'

const STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: '調査中', cls: 'bg-amber-100 text-amber-700' },
  researched: { label: '調査済み', cls: 'bg-sky-100 text-sky-700' },
  done: { label: '完了', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '失敗', cls: 'bg-rose-100 text-rose-700' },
}

export default function ShodanListPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = String(params.orgSlug)
  const list = usePreparationList(orgSlug)
  const {items,load,loadMore,remove,total,nextCursor,hasProfile,refreshError,moreError} = list
  const loadError = !items ? list.error : ''
  const moreLoading = list.busy
  if (list.requiresLogin) return <div className="p-10 text-center"><p>ログイン状態をご確認ください。</p><Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/shodan/${orgSlug}`)}`} className="underline">ログインする</Link></div>

  // 新しい見た目（UI 品質 §5.1）: ToolHero・使い方・空状態の絵・ブランドの青。ページの見出しは h2（h1 は枠の ToolFrame）
  const base = `/shodan/${encodeURIComponent(orgSlug)}`
  // 次にやること帯（ds/next-step）。調査中 → 読み込みの失敗 → 最新の準備の状態 の順に決める
  const nextStep: NextStepView = (() => {
    const running = items?.find((it) => it.status === 'processing')
    if (running) return { key: 'working', state: 'working', href: `${base}/p/${running.id}` }
    if (loadError) return { key: 'loadError', state: 'error', onClick: load }
    if (items === null) return null
    const latest = items[0]
    if (!latest) return hasProfile === false
      ? { key: 'setup', state: 'empty', href: `${base}/settings` }
      : { key: 'empty', state: 'empty', href: `${base}/new`, icon: 'Plus' }
    if (latest.status === 'failed') return { key: 'error', state: 'error', href: `${base}/p/${latest.id}` }
    const done = items.find((it) => it.status === 'researched' || it.status === 'done')
    if (done) return { key: 'done', state: 'done', href: `${base}/p/${done.id}` }
    return { key: 'empty', state: 'empty', href: `${base}/new`, icon: 'Plus' }
  })()
  return (
    <div className="mx-auto grid max-w-5xl gap-5 p-4 sm:p-6">
      <ToolHero
        title="今、ドヤれる商談を、URL1本で。"
        lead="商談先のURLを入れるだけで、企業の調査・課題の仮説・提案資料までAIがまとめます。"
        action={<Button href={`${base}/new`} icon="Plus">商談準備をつくる</Button>}
        tool="shodan"
      />
      <FirstSteps
        id="shodan"
        steps={[
          { title: '自社情報を登録する', body: '自社のURLを入れると、AIが商材と強みを読み取ります。' },
          { title: '商談先のURLを入れる', body: 'AIが企業を調べ、課題の仮説を立てます。' },
          { title: '提案資料とスライドを受け取る', body: 'そのまま商談で使える形に仕上がります。' },
        ]}
      />
      <ToolNextStep tool="shodan" view={nextStep} />

      {list.error && items && <ErrorNotice what={list.error} onRetry={load} retryLabel="一覧を更新" />}
      {list.notice && <p role="status" className="rounded-xl border border-[#0066ff]/20 bg-[#0066ff]/5 p-4 text-sm text-slate-800">{list.notice}</p>}
      {(list.unknown || list.confirmed || list.profileError) && <div><p className="text-sm text-slate-600">{list.profileError ? '自社情報の登録状態を確認できませんでした。' : list.confirmed ? '削除済みです。一覧の読込を再試行してください。' : '削除結果を確認できていません。重ねて送信せず、まず保存状態をご確認ください。'}</p><button onClick={load} disabled={list.busy} className="mt-2 text-sm text-[#0066ff] underline disabled:opacity-50">保存状態と一覧を再確認</button></div>}
      {list.canRetryPending && <button onClick={list.retryPending} className="justify-self-start text-sm text-[#0066ff] underline">確認した対象を改めて削除</button>}

      {hasProfile === false && (
        <Link href={`${base}/settings`} className="group flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 transition-colors hover:bg-amber-100/70 sm:px-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-amber-900">まず「自社情報」を登録しましょう</span>
            <span className="mt-1 block text-xs text-amber-800">自社のURLを入れるだけでAIが自動で入力します。提案資料の精度が大きく上がります。</span>
          </span>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}

      {refreshError && <ErrorNotice what="調査状況を自動で更新できませんでした。" how="一覧を更新すると、最新の状態を確かめられます。" onRetry={load} retryLabel="一覧を更新" />}

      {loadError ? (
        <ErrorNotice what={loadError} onRetry={load} retryLabel="再試行" />
      ) : items === null ? (
        <div aria-busy="true" aria-label="読み込み中"><Skeleton lines={4} height={56} /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            title="まだ商談準備がありません"
            description="商談先のURLを入れるだけで、調査から提案資料まで自動で作れます。"
            art="/shodan/empty-meetings.webp"
            action={<Button href={`${base}/new`} icon="Plus">最初の商談準備をつくる</Button>}
          />
        </div>
      ) : (
        <section aria-label="商談準備の一覧" className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {/* 列の幅を画面の幅までに収める（minmax(0,1fr)）。長い商談先の名前で 375px の画面が横に広がっていた（2026-10-23） */}
          <Stagger className="grid grid-cols-[minmax(0,1fr)] gap-3" step={40}>
            {items.map((it, i) => {
              const st = STATUS[it.status] || STATUS.processing
              return (
                <StaggerItem key={it.id} index={Math.min(i, 12)}>
                  <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-[box-shadow,border-color] hover:border-[#0066ff]/40 hover:shadow-md sm:gap-4 sm:px-5">
                    <Link href={`${base}/p/${it.id}`} className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-bold text-slate-900">{it.targetName || it.targetUrl}</span>
                        <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{it.targetUrl}</span>
                    </Link>
                    <span className="hidden whitespace-nowrap text-xs tabular-nums text-slate-500 md:block">{new Date(it.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <button onClick={() => remove(it.id)} disabled={!list.canDelete(it.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" aria-label={`${it.targetName || it.targetUrl}を削除`} title="削除"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
          {nextCursor && (
            <div className="space-y-2 pt-2 text-center">
              <p className="text-xs text-slate-500 tabular-nums">{items.length} / {total}件を表示</p>
              {moreError && <p role="alert" className="text-sm font-bold text-rose-700">{moreError}</p>}
              <div className="flex justify-center gap-3">
                <button onClick={loadMore} disabled={!list.canLoadMore} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{moreLoading ? '読み込み中…' : moreError ? '再試行' : 'さらに表示'}</button>
                {moreError && <button onClick={load} disabled={list.busy} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700">一覧を更新</button>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
