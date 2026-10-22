'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { usePreparationList } from '@/lib/shodan/use-preparation-list'
import { DoyaKun, sym } from '@/components/shodan/ui'
import { useUiNext } from '@/components/shell/ui-next-context'
import { Button, EmptyState, ErrorNotice, FirstSteps, Skeleton, ToolHero } from '@/components/ds'
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
  const uiNext = useUiNext()
  if (list.requiresLogin) return <div className="p-10 text-center"><p>ログイン状態をご確認ください。</p><Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/shodan/${orgSlug}`)}`} className="underline">ログインする</Link></div>

  // 新しい見た目（UI 品質 §5.1）: ToolHero・使い方・空状態の絵・ブランドの青。ページの見出しは h2（h1 は枠の ToolFrame）
  if (uiNext) {
    const base = `/shodan/${encodeURIComponent(orgSlug)}`
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

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-6 py-6 mb-6 shadow-lg shadow-purple-500/20">
        <div className="relative z-10 pr-28">
          <h1 className="text-2xl font-black">商談準備一覧</h1>
          <p className="text-sm font-bold text-white/80 mt-1">今、ドヤれる商談を、URL1本で。</p>
          <Link href={`/shodan/${encodeURIComponent(orgSlug)}/new`}
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-white text-purple-700 font-black text-sm shadow hover:-translate-y-0.5 transition-all">
            {sym('add')}新規作成
          </Link>
        </div>
        <DoyaKun mood="present" size={120} className="!absolute bottom-0 right-3" />
      </div>

      {list.error && items && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{list.error}</p>}
      {list.notice && <p role="status" className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">{list.notice}</p>}
      {(list.unknown || list.confirmed || list.profileError) && <div className="mb-4"><p className="text-sm text-slate-600">{list.profileError ? '自社情報の登録状態を確認できませんでした。' : list.confirmed ? '削除済みです。一覧の読込を再試行してください。' : '削除結果を確認できていません。重ねて送信せず、まず保存状態をご確認ください。'}</p><button onClick={load} disabled={list.busy} className="mt-2 underline disabled:opacity-50">保存状態と一覧を再確認</button></div>}

      {list.canRetryPending && <button onClick={list.retryPending} className="mb-4 underline">確認した対象を改めて削除</button>}

      {hasProfile === false && (
        <Link href={`/shodan/${encodeURIComponent(orgSlug)}/settings`}
          className="relative flex items-center gap-3 mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 pr-24 hover:bg-amber-100/70 transition-colors overflow-hidden">
          <div>
            <div className="flex items-center gap-1.5 text-amber-800 font-black text-sm">{sym('lightbulb')}まず「自社情報」を登録しましょう</div>
            <p className="text-xs font-bold text-amber-700/80 mt-1">自社URLを入れるだけでAIが自動入力。提案資料の精度が大きく上がります。</p>
          </div>
          <DoyaKun mood="point" size={64} className="!absolute -bottom-1 right-3" float={false} />
        </Link>
      )}

      {refreshError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">調査状況を自動更新できませんでした。一覧を更新すると最新の状態を確認できます。 <button onClick={load} disabled={list.busy} className="underline">一覧を更新</button></p>}

      {loadError ? (
        <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
          <p className="font-bold text-rose-800">{loadError}</p>
          <button onClick={load} disabled={list.busy} className="mt-4 rounded-xl bg-white border border-rose-300 px-5 py-2 text-sm font-black text-rose-700 hover:bg-rose-100">再試行</button>
        </div>
      ) : items === null ? (
        <div className="py-20 text-center"><DoyaKun mood="thinking" size={72} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-white py-12 px-6 text-center">
          <div className="flex justify-center"><DoyaKun mood="hello" size={110} /></div>
          <p className="font-black text-slate-800 mt-2 text-lg">ようこそ！3ステップで商談準備が完成します</p>
          <p className="text-sm font-bold text-slate-400 mt-1 mb-6">むずかしい設定は不要。URLを入れるだけ。</p>
          <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-7 text-left">
            {[
              { n: 1, icon: 'business_center', title: '自社情報を登録', desc: '自社URLからAIが自動入力。提案精度UP', href: `/shodan/${encodeURIComponent(orgSlug)}/settings` },
              { n: 2, icon: 'language', title: '商談先のURLを入力', desc: 'AIが企業を深掘り調査', href: `/shodan/${encodeURIComponent(orgSlug)}/new` },
              { n: 3, icon: 'slideshow', title: '提案資料・スライド完成', desc: 'そのまま商談で使える', href: null },
            ].map((s) => {
              const inner = (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="grid place-items-center w-6 h-6 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white text-xs font-black">{s.n}</span>
                    <span className="material-symbols-outlined text-purple-500" style={{ fontSize: 20 }}>{s.icon}</span>
                  </div>
                  <div className="font-black text-slate-800 text-sm">{s.title}</div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5">{s.desc}</div>
                </>
              )
              return s.href ? (
                <Link key={s.n} href={s.href} className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 hover:border-purple-300 hover:shadow-md transition-all">{inner}</Link>
              ) : (
                <div key={s.n} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">{inner}</div>
              )
            })}
          </div>
          <Link href={`/shodan/${encodeURIComponent(orgSlug)}/new`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all">
            {sym('bolt')}最初の商談準備をつくる
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const st = STATUS[it.status] || STATUS.processing
            return (
              <div key={it.id} className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 px-5 py-4 hover:shadow-md hover:border-purple-200 transition-all">
                <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${it.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 truncate">{it.targetName || it.targetUrl}</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-400 truncate mt-0.5">{it.targetUrl}</div>
                </Link>
                <span className="text-xs font-bold text-slate-400 hidden md:block">{new Date(it.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={() => remove(it.id)} disabled={!list.canDelete(it.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="削除">{sym('delete')}</button>
              </div>
            )
          })}
          {nextCursor && (
            <div className="space-y-2 pt-3 text-center">
              <p className="text-xs font-bold text-slate-500">{items.length} / {total}件を表示</p>
              {moreError && <p role="alert" className="text-sm font-bold text-rose-700">{moreError}</p>}
              <div className="flex justify-center gap-3">
                <button onClick={loadMore} disabled={!list.canLoadMore} className="rounded-xl border border-purple-300 bg-white px-5 py-2.5 text-sm font-black text-purple-700 disabled:opacity-50">{moreLoading ? '読み込み中…' : moreError ? '再試行' : 'さらに表示'}</button>
                {moreError && <button onClick={load} disabled={list.busy} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-black text-slate-700">一覧を更新</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
