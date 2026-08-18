// ドヤAI商談 LP用 製品モック（サンプルデータ。実在の企業名は使わない）
import React from 'react'
import { Sym } from '@/components/lp'

/** 商談の会話（ヒーロー用） */
export function AishodanTalkMock() {
  const lines = [
    { who: 'ai', t: '本日はお時間をいただきありがとうございます。まず御社の現在の課題からお聞かせください。' },
    { who: 'guest', t: '問い合わせは来るのですが、一次対応が追いつかず取りこぼしていて。' },
    { who: 'ai', t: '月にどのくらいのお問い合わせがありますか。' },
    { who: 'guest', t: '30件くらいです。' },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sym name="forum" size={18} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-sm font-black text-slate-800">一次商談</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-600">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />実施中
        </span>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.who === 'guest' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[10px] font-bold leading-relaxed ${
                l.who === 'guest' ? 'bg-slate-100 text-slate-700' : 'text-white'
              }`}
              style={l.who === 'ai' ? { background: 'var(--lp-accent)' } : undefined}
            >
              {l.t}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Sym name="mic" size={12} className="text-slate-400" />
        <span className="text-[10px] font-bold text-slate-400">音声で進行・テキストでも参加できます</span>
      </div>
    </div>
  )
}

/** ヒアリング項目の自動記録 */
export function AishodanSlotsMock() {
  const slots = [
    { k: '課題', v: '一次対応が追いつかず取りこぼし', ok: true },
    { k: '月間問い合わせ数', v: '約30件', ok: true },
    { k: '想定予算', v: '未取得', ok: false },
    { k: '導入時期', v: '3か月以内', ok: true },
    { k: '決裁者', v: '未取得', ok: false },
  ]
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="space-y-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {slots.map((s, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
            <Sym
              name={s.ok ? 'check_circle' : 'radio_button_unchecked'}
              size={13}
              className={s.ok ? 'text-emerald-500' : 'text-slate-300'}
            />
            <span className="w-28 shrink-0 text-[10px] font-bold text-slate-500">{s.k}</span>
            <span className={`truncate text-[10px] font-bold ${s.ok ? 'text-slate-800' : 'text-slate-300'}`}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 適合度の判定 */
export function AishodanFitMock() {
  return (
    <div className="bg-slate-50/60 p-4">
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400">適合度</p>
            <p className="text-2xl font-black tabular-nums text-slate-900">78</p>
          </div>
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700 ring-1 ring-orange-100">
            条件付き推奨
          </span>
        </div>
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-bold leading-relaxed text-slate-600">
          課題と提供価値が合致。導入時期も近い。予算と決裁者が未取得のため、次回で確認が必要。
        </p>
        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
          <Sym name="event_available" size={12} className="text-emerald-500" />
          <span className="text-[9px] font-bold text-slate-500">日程調整: 予約ページを開きました</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] font-bold text-slate-400">判定は参考値です。最終的な判断は担当者が行います</p>
    </div>
  )
}
