// ドヤコピーAI LP 用 製品モック（実機能の様子を表す・サンプルデータ・実在企業/実績数値なし）
import React from 'react'
import { Sym } from '@/components/lp'

const AV = ['#f59e0b', '#0066ff', '#ef4444', '#0891b2', '#8b5cf6', '#f97316']
function Avatar({ i, initial, size = 36 }: { i: number; initial: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-full text-white font-black shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, ${AV[i % AV.length]}, ${AV[(i + 2) % AV.length]})` }}>
      {initial}
    </span>
  )
}

// トーン別のバッジ色（アクセント基調＋差し色）
const TONE: Record<string, string> = {
  王道: '#f59e0b',
  共感: '#ef4444',
  論理: '#0066ff',
  攻め: '#8b5cf6',
  物語: '#0891b2',
}
function ToneTag({ t }: { t: string }) {
  const c = TONE[t] ?? '#f59e0b'
  return (
    <span className="text-[10px] font-black rounded-md px-1.5 py-0.5 shrink-0"
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>{t}</span>
  )
}

const COPIES = [
  { h: '「探す」を、もう終わりにしよう。', s: '欲しいものが、開いた瞬間に並んでいる。', t: '王道' },
  { h: 'その残業、AIが巻き取ります。', s: '定型作業を手放して、本当の仕事に集中を。', t: '共感' },
  { h: '導入初月で工数を約40%削減。', s: '数字で語れる、はじめての業務改善ツール。', t: '論理' },
  { h: 'まだ手作業で消耗してるの？', s: '一歩先の現場は、もう自動化を始めている。', t: '攻め' },
  { h: '毎晩の締め作業に追われた私が、定時で帰れた話。', s: 'きっかけは、たった一度の無料登録でした。', t: '物語' },
  { h: '面倒な入力、ぜんぶまとめて。', s: 'クリックひとつで、その先の作業まで完了。', t: '王道' },
]

/** 生成コピー一覧（ヒーロー用・20案量産の雰囲気） */
export function CopyListMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="format_quote" size={18} style={{ color: 'var(--lp-accent)' }} />
          <span className="font-black text-slate-800 text-sm">生成されたコピー案</span>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">全24案</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-2.5 py-1.5" style={{ background: '#0066ff' }}>
          <Sym name="download" size={13} />書き出し
        </span>
      </div>
      <div className="space-y-2">
        {COPIES.map((c, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-2.5 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[12px] font-black text-slate-800 leading-snug">{c.h}</p>
              <ToneTag t={c.t} />
            </div>
            <p className="text-[10px] font-bold text-slate-400 leading-snug">{c.s}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const WRITERS = [
  { n: 'ストレート', tag: '王道', d: 'ベネフィットを一直線に訴求', i: 0 },
  { n: 'エモーショナル', tag: '共感', d: '悩みに寄り添い心を動かす', i: 2 },
  { n: 'ロジカル', tag: '論理', d: 'データと実績で納得させる', i: 1 },
  { n: 'プロボカティブ', tag: '攻め', d: '常識を覆す切り口で目を引く', i: 4 },
  { n: 'ストーリー', tag: '物語', d: 'ビフォーアフターで語る', i: 3 },
]

/** 5人のAIコピーライター（切り口の違いを表現） */
export function CopyWritersMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="groups" size={18} style={{ color: 'var(--lp-accent)' }} />
        <span className="font-black text-slate-800 text-sm">5人のAIコピーライター</span>
      </div>
      <div className="space-y-2">
        {WRITERS.map((w, k) => (
          <div key={k} className="bg-white border border-slate-100 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm">
            <Avatar i={w.i} initial={w.n[0]} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-black text-slate-800 truncate">{w.n}</p>
                <ToneTag t={w.tag} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 truncate">{w.d}</p>
            </div>
            <Sym name="edit_note" size={16} className="text-slate-300 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** チャットでブラッシュアップ */
export function CopyRefineMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="tune" size={18} style={{ color: 'var(--lp-accent)' }} />
        <span className="font-black text-slate-800 text-sm">コピーをブラッシュアップ</span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm mb-2.5">
        <p className="text-[10px] font-bold text-slate-400 mb-1">選択中のコピー</p>
        <p className="text-[12px] font-black text-slate-800 leading-snug">「探す」を、もう終わりにしよう。</p>
      </div>
      <div className="space-y-2 mb-2.5">
        <div className="flex justify-end">
          <span className="text-[11px] font-bold text-white rounded-2xl rounded-br-sm px-3 py-1.5 max-w-[80%] leading-snug" style={{ background: '#0066ff' }}>
            もっとカジュアルに、数字も入れて
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Avatar i={0} initial="A" size={26} />
          <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-3 py-1.5 max-w-[82%] leading-snug shadow-sm">
            探す時間、平均5分をゼロに。開いた瞬間に、もう並んでる。
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
        <Sym name="chat" size={14} className="text-slate-300" />
        <span className="text-[11px] text-slate-300 font-bold flex-1">指示を入力…</span>
        <span className="grid place-items-center rounded-md w-6 h-6" style={{ background: 'var(--lp-accent)' }}>
          <Sym name="arrow_upward" size={14} className="text-white" />
        </span>
      </div>
    </div>
  )
}
