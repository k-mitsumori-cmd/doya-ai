// ドヤ商談準備 LP 用 製品モック（実機能の様子を表す・サンプルデータ・PIIなし）
import React from 'react'
import { Sym } from '@/components/lp'

/** 企業調査結果カード（ヒーロー用） */
export function ShodanResearchMock() {
  const facts = [
    { icon: 'domain', l: '会社名', v: '株式会社みらい製作所' },
    { icon: 'link', l: 'URL', v: 'mirai-seisaku.example.jp' },
    { icon: 'groups', l: '従業員数', v: '約120名' },
    { icon: 'campaign', l: 'マーケ実施状況', v: 'リスティング・SNS運用あり' },
    { icon: 'article', l: 'オウンドメディア', v: '記事48本／技術ブログ' },
    { icon: 'update', l: '更新頻度', v: '月4〜6本（直近3ヶ月）' },
  ]
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="travel_explore" size={18} className="text-[color:#7c3aed]" />
          <span className="font-black text-slate-800 text-sm">企業調査レポート</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-black text-white rounded-md px-2 py-1" style={{ background: '#0066ff' }}>
          <Sym name="check_circle" size={12} />調査完了
        </span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl divide-y divide-slate-100 shadow-sm overflow-hidden">
        {facts.map((f, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2">
            <Sym name={f.icon} size={15} className="text-slate-300 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 w-24 shrink-0">{f.l}</span>
            <span className="text-[11px] font-black text-slate-800 truncate flex-1">{f.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sym name="auto_awesome" size={14} style={{ color: 'var(--lp-accent)' }} />
          <span className="text-[11px] font-black text-slate-700">AIサマリー</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          BtoB製造業。オウンドメディアは運用中だが更新が不定期で、リード獲得の導線が…
        </p>
      </div>
    </div>
  )
}

/** 課題仮説リスト */
export function ShodanHypothesisMock() {
  const items = [
    { p: '高', t: 'メディア更新が不定期でリードが伸び悩む', d: '記事数はあるが導線設計と更新体制に課題' },
    { p: '中', t: '問い合わせ後のフォロー導線が弱い', d: 'CTAはあるが資料DL・ナーチャリング未整備' },
    { p: '中', t: '技術の強みが顧客言語で伝わっていない', d: '製品説明が専門用語中心で訴求が届きにくい' },
  ]
  const pcolor: Record<string, string> = { 高: '#ff1e72', 中: '#7c3aed' }
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-3">
        <Sym name="psychology" size={18} className="text-[color:#7c3aed]" />
        <span className="font-black text-slate-800 text-sm">課題仮説</span>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">3件</span>
      </div>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
            <span className="text-[9px] font-black text-white rounded px-1.5 py-1 mt-0.5 shrink-0" style={{ background: pcolor[it.p] }}>優先度{it.p}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black text-slate-800 leading-snug">{it.t}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">{it.d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 提案資料プレビュー（Markdown提案書） */
export function ShodanProposalMock() {
  return (
    <div className="p-4 bg-slate-50/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sym name="description" size={18} className="text-[color:#7c3aed]" />
          <span className="font-black text-slate-800 text-sm">提案資料（Markdown）</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-black rounded-md px-2 py-1" style={{ background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)', color: 'var(--lp-accent)' }}>
          <Sym name="content_copy" size={12} />コピー
        </span>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-3">
        <div>
          <p className="text-[13px] font-black text-slate-900">株式会社みらい製作所 様 ご提案</p>
          <div className="h-px bg-slate-100 mt-1.5" />
        </div>
        <div>
          <p className="text-[11px] font-black flex items-center gap-1" style={{ color: 'var(--lp-accent)' }}><span className="text-slate-300">##</span>現状分析</p>
          <ul className="mt-1 space-y-1">
            {['オウンドメディアは運用中だが更新が不定期', 'リスティング流入はあるが受け皿が弱い'].map((t, i) => (
              <li key={i} className="text-[10px] text-slate-500 font-medium flex gap-1.5"><span className="text-slate-300">-</span>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-black flex items-center gap-1" style={{ color: 'var(--lp-accent)' }}><span className="text-slate-300">##</span>課題仮説</p>
          <ul className="mt-1 space-y-1">
            {['更新体制の属人化でコンテンツが停滞', '問い合わせ後のフォロー導線が未整備'].map((t, i) => (
              <li key={i} className="text-[10px] text-slate-500 font-medium flex gap-1.5"><span className="text-slate-300">-</span>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-black flex items-center gap-1" style={{ color: 'var(--lp-accent)' }}><span className="text-slate-300">##</span>解決策</p>
          <ul className="mt-1 space-y-1">
            {['編集カレンダーとAI下書きで更新を仕組み化', '資料DL・ステップ配信でリードを育成'].map((t, i) => (
              <li key={i} className="text-[10px] text-slate-500 font-medium flex gap-1.5"><span className="text-slate-300">-</span>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
