// ドヤ広告バナーAI LP 用 製品モック（実機能の様子を表す・サンプルデータ・実在ブランドなし）
import React from 'react'
import { Sym } from '@/components/lp'

// サンプルのバナー（色面＋ダミー見出し/CTA＋採点スコア）
const BANNERS = [
  { media: 'Meta 1:1', label: '正方形', bg: 'linear-gradient(135deg,#0066ff,#00e0ff)', h: '新発売キャンペーン', cta: '今すぐ購入', score: 92, ratio: '1 / 1' },
  { media: 'Google 1.91:1', label: 'レクタングル', bg: 'linear-gradient(135deg,#f97316,#fb7185)', h: '期間限定30%OFF', cta: '詳しく見る', score: 88, ratio: '1.91 / 1' },
  { media: 'LINE 1200×628', label: 'バナー', bg: 'linear-gradient(135deg,#0284c7,#0066ff)', h: '無料ではじめる', cta: '登録する', score: 85, ratio: '1.91 / 1' },
  { media: 'X 16:9', label: '横長', bg: 'linear-gradient(135deg,#7c3aed,#0066ff)', h: '導入事例を公開', cta: '資料請求', score: 90, ratio: '16 / 9' },
]

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 text-[10px] font-black text-white rounded-md px-1.5 py-0.5 backdrop-blur-sm"
      style={{ background: 'rgba(15,23,42,0.55)' }}>
      <Sym name="star" size={11} fill style={{ color: '#ffd400' }} />{score}点
    </span>
  )
}

/** 生成バナーグリッド（ヒーロー用・媒体別サイズを量産） */
export function AdBannerGridMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="grid_view" size={18} className="text-[color:#f97316]" />
          <span className="font-black text-slate-800 text-sm">生成したバナー</span>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">4媒体</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-2.5 py-1.5" style={{ background: '#0066ff' }}>
          <Sym name="auto_awesome" size={13} />一括生成
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {BANNERS.map((b, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <div className="relative w-full grid place-items-center px-2.5" style={{ aspectRatio: b.ratio, background: b.bg }}>
              <ScoreBadge score={b.score} />
              <div className="text-center">
                <p className="text-white font-black text-[13px] leading-tight drop-shadow-sm">{b.h}</p>
                <span className="inline-block mt-1.5 text-[9px] font-black text-slate-900 bg-white/95 rounded px-1.5 py-0.5">{b.cta}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[10px] font-black text-slate-600">{b.media}</span>
              <span className="text-[9px] font-bold text-slate-400">{b.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** URL・ブランド入力 → 量産（ショーケース用） */
export function AdBannerInputMock() {
  const media = ['Meta', 'Google', 'LINE', 'X']
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="link" size={18} className="text-[color:#f97316]" />
        <span className="font-black text-slate-800 text-sm">ブランドから量産</span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2.5 shadow-sm">
        <div>
          <p className="text-[10px] font-bold text-slate-400 mb-1">サービスURL</p>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Sym name="public" size={13} className="text-slate-300" />
            <span className="text-[11px] text-slate-500 font-bold truncate">example.co.jp</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 mb-1">ブランドカラー</p>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: '#0066ff' }} />
              <span className="text-[11px] text-slate-500 font-bold">#0066ff</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-400 mb-1">ロゴ</p>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Sym name="image" size={13} className="text-slate-300" />
              <span className="text-[11px] text-slate-500 font-bold">logo.png</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 mb-1">配信媒体</p>
          <div className="flex flex-wrap gap-1.5">
            {media.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-black rounded-md px-2 py-1"
                style={{ background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent)' }}>
                <Sym name="check" size={11} fill />{m}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-white rounded-lg px-3 py-1.5" style={{ background: '#0066ff' }}>
          <Sym name="auto_awesome" size={13} />バナーを量産
        </span>
      </div>
    </div>
  )
}

/** AI採点カード（5項目スコアバー＋改善提案＋再生成） */
export function AdBannerScoreMock() {
  const scores = [
    { l: '視認性', v: 94 },
    { l: '訴求', v: 82 },
    { l: 'CTA', v: 76 },
    { l: '媒体適合', v: 90 },
    { l: 'ブランド整合', v: 88 },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="rate_review" size={18} className="text-[color:#f97316]" />
          <span className="font-black text-slate-800 text-sm">AI採点</span>
        </div>
        <span className="inline-flex items-baseline gap-0.5 text-white rounded-lg px-2.5 py-1" style={{ background: 'var(--lp-accent)' }}>
          <span className="text-[15px] font-black leading-none">86</span><span className="text-[10px] font-bold">点</span>
        </span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2 shadow-sm mb-3">
        {scores.map((s, i) => (
          <div key={i}>
            <div className="flex justify-between text-[11px] font-bold mb-1"><span className="text-slate-500">{s.l}</span><span className="text-slate-800">{s.v}</span></div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.v}%`, background: 'linear-gradient(90deg,#0066ff,var(--lp-accent))' }} /></div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sym name="lightbulb" size={14} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-[11px] font-black text-slate-700">改善提案</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          CTAボタンの文言をより行動的にし、コントラストを高めると訴求が強まります。見出しは要素を絞ると…
        </p>
        <div className="flex justify-end mt-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-black rounded-md px-2 py-1" style={{ background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent)' }}>
            <Sym name="refresh" size={12} />提案を反映して再生成
          </span>
        </div>
      </div>
    </div>
  )
}
