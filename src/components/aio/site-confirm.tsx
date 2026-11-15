'use client'

import { useEffect, useState } from 'react'

export type ConfirmedProfile = { summary: string; audience: string; industry: string; competitorKind: string; edited: boolean }
type Fields = Omit<ConfirmedProfile, 'edited'>
type Evidence = Partial<Record<keyof Fields, string>>
type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unreadable'; message: string; detail: string }
  | { kind: 'ready'; initial: Fields; evidence: Evidence; chars: number; pages: number }

const LABELS: Array<[keyof Fields, string, string]> = [
  ['summary', '何のサービスか', '例: 人材紹介会社の応募から初回面談の設定までを引き受けるサービス'],
  ['audience', '誰向けか', '例: 人材紹介会社の経営者・責任者'],
  ['industry', '業種', '例: 人材紹介'],
  ['competitorKind', '競合の種類', '例: 面談設定の代行会社、自社で行う方法'],
]
const UNKNOWN = '不明'

/** 組織を作る前に、サイトから読み取ったサービスの内容を見せて、利用者が直せるようにする 1 画面 */
export function AioSiteConfirm({ url, onConfirm, onCancel }: { url: string; onConfirm: (p: ConfirmedProfile) => void; onCancel: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [fields, setFields] = useState<Fields>({ summary: '', audience: '', industry: '', competitorKind: '' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    fetch('/api/aio/quick-start/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok || !data) { setState({ kind: 'error', message: typeof data?.error === 'string' ? data.error : 'サイトを読み取れませんでした。しばらくしてからもう一度お試しください。' }); return }
        if (data.readable && data.profile) {
          const p = data.profile as Fields & { evidence?: Evidence }
          const initial = { summary: p.summary, audience: p.audience, industry: p.industry, competitorKind: p.competitorKind }
          setFields({ summary: initial.summary, audience: initial.audience === UNKNOWN ? '' : initial.audience, industry: initial.industry === UNKNOWN ? '' : initial.industry, competitorKind: initial.competitorKind === UNKNOWN ? '' : initial.competitorKind })
          setState({ kind: 'ready', initial, evidence: p.evidence || {}, chars: data.read?.totalChars ?? 0, pages: data.read?.pagesRead?.length ?? 1 })
        } else {
          setState({ kind: 'unreadable', message: String(data.message || 'サービスの内容を読み取れませんでした。'), detail: String(data.detail || '') })
        }
      })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: 'error', message: 'サイトを読み取れませんでした。通信を確認してもう一度お試しください。' }) })
    return () => controller.abort()
  }, [url])

  if (state.kind === 'loading') {
    return (
      <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
        サイトを読み取っています。数十秒かかることがあります。
      </div>
    )
  }
  const canStart = fields.summary.trim().length >= 15
  const changed = state.kind !== 'ready' || (Object.keys(fields) as Array<keyof Fields>).some(k => (fields[k].trim() || UNKNOWN) !== state.initial[k])
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-left" role="group" aria-label="読み取ったサービスの内容">
      {state.kind === 'ready' ? (
        <p className="text-sm font-bold text-slate-800">読み取ったサービスの内容です。違う所は直してください。</p>
      ) : (
        <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">{state.kind === 'unreadable' ? state.message : state.message}</p>
          {state.kind === 'unreadable' && state.detail && <p className="mt-1">{state.detail}</p>}
          {state.kind === 'unreadable' && <p className="mt-1">サービスの説明を入力すると、その内容で質問を作ります。</p>}
        </div>
      )}
      {state.kind === 'ready' && <p className="mt-1 text-xs font-bold text-slate-500">{state.pages}ページから、題名を除いて{state.chars}文字を読み取りました。「不明」の項目は、サイトに書かれていなかった所です。</p>}
      {state.kind !== 'error' && (
        <div className="mt-3 space-y-3">
          {LABELS.map(([key, label, ph]) => (
            <div key={key}>
              <label htmlFor={`aio-confirm-${key}`} className="mb-1 block text-xs font-bold text-slate-700">{label}{key === 'summary' ? '（必須）' : ''}</label>
              <textarea id={`aio-confirm-${key}`} rows={key === 'summary' ? 3 : 1} value={fields[key]} maxLength={key === 'summary' ? 300 : 120}
                placeholder={state.kind === 'ready' && state.initial[key] === UNKNOWN ? `${UNKNOWN}（${ph}）` : ph}
                onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                className="w-full resize-none rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#0066ff]" />
              {state.kind === 'ready' && state.evidence[key] && <p className="mt-0.5 text-[11px] text-slate-500">根拠: {state.evidence[key]}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {state.kind !== 'error' && (
          <button type="button" disabled={!canStart} onClick={() => onConfirm({ summary: fields.summary.trim(), audience: fields.audience.trim(), industry: fields.industry.trim(), competitorKind: fields.competitorKind.trim(), edited: changed })}
            className="rounded-xl bg-[#0066ff] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            この内容で調べ始める
          </button>
        )}
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">URLを入れ直す</button>
      </div>
    </div>
  )
}
