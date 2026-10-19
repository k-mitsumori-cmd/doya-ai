'use client'

import { useParams } from 'next/navigation'
import { useAioPrompts } from '@/lib/aio/use-prompts'
import { AIO_MAX_PROMPTS_PER_SCAN } from '@/lib/aio/types'
import { TrialNote } from '@/components/TrialCallout'
import Link from 'next/link'
import { PageHeader } from '@/components/aio/ui'

// どの業種でも使える汎用テンプレート（〔  〕を自社カテゴリ・課題に置き換えて使う想定の編集可能な例）
const SUGGESTIONS = [
  '〔カテゴリ〕でおすすめのサービスは？',
  '〔カテゴリ〕を比較したい。主な選択肢を教えて',
  '初心者・中小企業向けの〔カテゴリ〕は？',
  '〔課題〕を解決できるツール・サービスは？',
  '〔カテゴリ〕の人気・定番どころを教えて',
]

export default function AioPromptsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const state = useAioPrompts(orgSlug)
  const { prompts, text, busy, quota, error, notice, loaded, pending } = state
  const disabled = busy || pending || !state.allowed || !state.canEdit
  if (state.requiresLogin) return <div className="p-6" role="alert">ログイン状態を確認できません。再ログインしてください。<Link href="/auth/signin" className="ml-2 underline">ログインする</Link></div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PageHeader icon="quiz" title="監視プロンプト" subtitle="AIに投げて言及をチェックする質問を登録します" />

      {loaded && !error && <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
        <p>表示中の有効な質問：{prompts.filter(p => p.isActive).length}件 ／ 1回の測定は最大{AIO_MAX_PROMPTS_PER_SCAN}件</p>
        <p>有効な質問をすべて測定します。上限を超える場合は、今回測定しない質問のスイッチを無効にしてください。登録した質問は残ります。</p>
        <Link href={`/aio/${encodeURIComponent(orgSlug)}`} className="font-bold underline">ダッシュボードに戻る</Link>
      </div>}

      {quota && <div role="alert" className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
        <p className="font-black">監視プロンプトの利用枠に達しました</p>
        <p className="mt-1">{quota.message}</p>
        {quota.canManageBilling === true && quota.upgradeUrl ? <>
          <Link href={`/aio/pricing?org=${encodeURIComponent(orgSlug)}`} className="mt-2 inline-block font-black underline">料金プランを確認する</Link>
          <TrialNote className="mt-2" />
        </> : <p className="mt-2">利用枠について組織オーナーにご相談ください。</p>}
      </div>}

      {notice && <p role="status" className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">{notice}</p>}
      {pending && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>処理結果を確認中です。確認が終わるまで、新しい追加・切替・保管はできません。</p>
        <button disabled={busy} onClick={() => void state.recover()} className="mt-2 mr-4 underline disabled:opacity-50">操作結果を確認</button>
        <button disabled={busy} onClick={state.retry} className="mt-2 underline disabled:opacity-50">同じ操作を再送</button>
      </div>}
      {state.canEdit && <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
        <div className="flex gap-2">
          <input aria-label="監視する質問" maxLength={500} value={text} onChange={(e) => state.edit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); state.add() } }}
            placeholder="例: 〔自社のカテゴリ〕でおすすめのサービスは？"
            className="flex-1 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none px-4 py-2.5 font-bold transition-colors" />
          <button onClick={state.add} disabled={disabled || !text.trim()}
            className="px-5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black shadow disabled:opacity-50">追加</button>
        </div>
        <p className="text-xs text-slate-400 font-bold mt-3">編集可能な例文です。〔  〕を自社のカテゴリや課題に置き換えて登録してください。</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => state.edit(s)} className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full px-3 py-1.5 transition-colors">＋ {s}</button>
          ))}
        </div>
      </div>}

      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p></div>}
      <button disabled={busy || !state.allowed} onClick={() => void state.load()} className="mb-4 font-bold underline disabled:opacity-50">先頭から再読み込み</button>
      {busy ? (
        <p className="text-slate-400 font-bold">読み込み中…</p>
      ) : !loaded ? <p className="text-slate-500">一覧の確認が必要です。</p> : prompts.length === 0 ? (
        <p className="text-slate-400 font-bold text-center py-8">まだプロンプトがありません。上から追加してください。</p>
      ) : (
        <div className="space-y-2">
          {prompts.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 bg-white rounded-xl border p-3 ${p.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <button onClick={() => state.toggle(p)} disabled={disabled} role="switch" aria-checked={p.isActive} aria-label={`「${p.text}」の監視`} title={p.isActive ? '有効' : '無効'}
                className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${p.isActive ? 'bg-purple-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${p.isActive ? 'left-4' : 'left-0.5'}`} />
              </button>
              <p className="flex-1 text-sm font-bold text-slate-800">{p.text}</p>
              <button onClick={() => state.archive(p)} disabled={disabled} title="保管" aria-label="質問を保管" className="text-slate-400 hover:text-purple-700 transition-colors">
                <span className="material-symbols-outlined text-[20px]">archive</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {loaded && state.nextCursor && <button disabled={busy || !state.allowed} onClick={() => void state.more()} className="mt-4 font-bold underline disabled:opacity-50">続きを表示</button>}
    </div>
  )
}
