'use client'
// ドヤ記事作成 LP の「画面の再現」。製品の画面をコードで描く（画像は使わない）。
// ⚠️ 表示するのはサンプルのデータ。実在の会社名・人名・他社 URL は入れない（example.com は予約済みの例示用ドメイン）。
import { Check, FileText, Link2, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '@/components/lp-kit/hooks'
import type { LpKitVisuals } from '@/components/lp-kit/types'
import './lp-visuals.css'

const KEYWORD = 'BtoB マーケティング AI活用'
const OUTLINE = ['AI活用で変わる業務', '導入前に決めること', 'ツール選定の比較軸', '小さく始める手順', '運用とふり返り', 'よくある失敗と対策']
const AUDIT = [
  ['主張の整合性', '確認済み'],
  ['参考情報との重複', '問題なし'],
  ['根拠が薄い箇所', '2件を修正'],
  ['リンク切れ', '0件'],
]
const URLS = ['example.com/guide-1', 'example.com/guide-2', 'example.com/guide-3']

const on = (t: number, at: number) => t >= at

/* ================= 実演（入力 → 構成 → 点検 → 完成） ================= */
function Demo({ t, tab }: { t: number; tab: number }) {
  const typed = Math.max(0, Math.min(KEYWORD.length, Math.floor((t - 300) / 55)))
  const typing = t >= 300 && typed < KEYWORD.length
  const pressed = t >= 2300 && t < 2560
  const outlineN = OUTLINE.filter((_, i) => on(t, 2750 + i * 300)).length
  const auditN = AUDIT.filter((_, i) => on(t, 5350 + i * 450)).length
  const done = t >= 7600
  return (
    <>
      <div className="sv-pane sv-left">
        <p className="sv-cap">記事の条件</p>
        <div className="sv-field">
          <span className="sv-flabel">キーワード</span>
          <span className="sv-input">
            {KEYWORD.slice(0, typed)}
            <i className={cx('sv-caret', (typing || (t < 300 && tab === 0)) && 'blink')} />
          </span>
        </div>
        <div className="sv-chips">
          <span className={cx('sv-in', on(t, 1400) && 'on')}>読者: マーケ責任者</span>
          <span className={cx('sv-in', on(t, 1650) && 'on')}>目的: 比較検討</span>
        </div>
        <ul className="sv-urls">
          {URLS.map((u, i) => (
            <li key={u} className={cx('sv-in', on(t, 1900 + i * 150) && 'on')}>
              <Link2 size={13} aria-hidden="true" />
              <span>{u}</span>
              <em className={cx(on(t, 2400 + i * 200) && 'ok')}>{on(t, 2400 + i * 200) ? '要点化' : ''}</em>
            </li>
          ))}
        </ul>
        <span className={cx('sv-go', pressed && 'pressed', on(t, 2560) && 'sent')}>
          {on(t, 2560) ? '構成を作成しました' : '構成を作る'}
        </span>
      </div>

      <div className="sv-pane sv-right">
        <div className="sv-rhead">
          <p className="sv-cap">{tab === 0 ? 'できあがる記事' : tab === 1 ? '検索意図から構成を作成中' : tab === 2 ? '公開前の点検' : '完成'}</p>
          <span className={cx('sv-badge', done && 'done')}>
            {tab === 0 ? '待機中' : tab === 1 ? `${outlineN} / ${OUTLINE.length}` : tab === 2 ? `${auditN} / ${AUDIT.length}` : '点検済み'}
          </span>
        </div>

        <div className={cx('sv-empty', t < 2600 && 'on')}>
          <FileText size={28} aria-hidden="true" />
          <p>条件を入れると、ここに構成が出ます</p>
          <div className="sv-skel"><i /><i /><i /></div>
        </div>

        <ol className="sv-outline">
          {OUTLINE.map((r, i) => (
            <li key={r} className={cx('sv-in', on(t, 2750 + i * 300) && 'on')}>
              <b>{i + 1}</b>
              <span>{r}</span>
              <Check size={14} className={cx('sv-tick', on(t, 5250 + i * 120) && 'on')} aria-hidden="true" />
            </li>
          ))}
        </ol>

        <ul className="sv-audit">
          {AUDIT.map(([k, v], i) => (
            <li key={k} className={cx('sv-in', on(t, 5350 + i * 450) && 'on')}>
              <Check size={14} aria-hidden="true" />
              <span>{k}</span>
              <em>{v}</em>
            </li>
          ))}
        </ul>

        <div className={cx('sv-article', done && 'on')} aria-hidden={!done}>
          <Article compact />
          <div className="sv-export">
            {['テキスト', 'Markdown', 'HTML', 'JSON'].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ================= 出力の見本 ================= */
function Article({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cx('sv-art', compact && 'compact')}>
      <p className="sv-art-kicker">SEO記事</p>
      <h4>BtoB マーケティングにAIを活用する、小さな始め方</h4>
      <div className="sv-bars"><i style={{ width: '96%' }} /><i style={{ width: '88%' }} /><i style={{ width: '62%' }} /></div>
      <h5>1. AI活用で変わる業務</h5>
      <div className="sv-bars"><i style={{ width: '94%' }} /><i style={{ width: '70%' }} /></div>
      <h5>2. 導入前に決めること</h5>
      <div className="sv-bars"><i style={{ width: '90%' }} /><i style={{ width: '54%' }} /></div>
    </div>
  )
}

function OutlineCard() {
  return (
    <div className="sv-card-pad">
      <div className="sv-rhead"><p className="sv-cap">構成</p><span className="sv-badge done">6 / 6</span></div>
      <ol className="sv-outline static">
        {OUTLINE.slice(0, 5).map((r, i) => (
          <li key={r} className="sv-in on"><b>{i + 1}</b><span>{r}</span></li>
        ))}
      </ol>
    </div>
  )
}

function InfographicCard() {
  return (
    <svg viewBox="0 0 320 200" className="sv-svg" role="img" aria-label="AI活用の導入ステップを示す図解のサンプル">
      <rect width="320" height="200" fill="#f5f9ff" />
      <g fontFamily="Inter, 'Noto Sans JP', sans-serif" fontWeight="700" fontSize="12" textAnchor="middle">
        {[
          ['1', '現状を整理', '#0066ff'],
          ['2', '小さく試す', '#009bff'],
          ['3', '全体へ広げる', '#0a1f44'],
        ].map(([n, l, c], i) => (
          <g key={n} transform={`translate(${20 + i * 100},58)`}>
            <rect width="88" height="84" rx="14" fill="#fff" stroke="#d6e4ff" />
            <circle cx="44" cy="26" r="13" fill={c} />
            <text x="44" y="31" fill="#fff" fontSize="13">{n}</text>
            <text x="44" y="62" fill="#0a1f44">{l}</text>
          </g>
        ))}
        <path d="M108 100h4M208 100h4" stroke="#0066ff" strokeWidth="2.5" strokeLinecap="round" />
        <text x="160" y="32" fill="#475569" fontSize="12">AI活用 導入ステップ</text>
        <text x="160" y="172" fill="#475569" fontSize="10" fontWeight="500">図解の画像として本文に入れられます</text>
      </g>
    </svg>
  )
}

function EyecatchCard() {
  return (
    <div className="sv-eye">
      <span className="sv-eye-tag">BtoB</span>
      <p>マーケティングに、<br />AIをどう使う？</p>
      <i className="sv-eye-a" />
      <i className="sv-eye-b" />
      <i className="sv-eye-c" />
    </div>
  )
}

function HtmlCard() {
  return (
    <pre className="sv-code" aria-label="書き出した HTML のサンプル">
      <span className="d">{'<article>'}</span>{'\n'}
      {'  '}<span className="t">{'<h1>'}</span>BtoB マーケティングに…<span className="t">{'</h1>'}</span>{'\n'}
      {'  '}<span className="t">{'<h2>'}</span>AI活用で変わる業務<span className="t">{'</h2>'}</span>{'\n'}
      {'  '}<span className="t">{'<p>'}</span>…<span className="t">{'</p>'}</span>{'\n'}
      {'  '}<span className="t">{'<h2>'}</span>導入前に決めること<span className="t">{'</h2>'}</span>{'\n'}
      {'  '}<span className="t">{'<p>'}</span>…<span className="t">{'</p>'}</span>{'\n'}
      <span className="d">{'</article>'}</span>
    </pre>
  )
}

function FreeRangeCard() {
  return (
    <svg viewBox="0 0 320 200" className="sv-svg" role="img" aria-label="無料プランでできる範囲を示す図">
      <rect width="320" height="200" fill="#f5f9ff" />
      <g fontFamily="Inter, 'Noto Sans JP', sans-serif" fontWeight="700">
        <text x="24" y="38" fontSize="12" fill="#475569">無料プラン</text>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${24 + i * 56},50)`}>
            <rect width="46" height="58" rx="8" fill="#fff" stroke="#0066ff" strokeWidth="2" />
            <rect x="8" y="10" width="30" height="5" rx="2.5" fill="#0066ff" />
            <rect x="8" y="22" width="30" height="3" rx="1.5" fill="#d6e4ff" />
            <rect x="8" y="30" width="24" height="3" rx="1.5" fill="#d6e4ff" />
            <rect x="8" y="38" width="28" height="3" rx="1.5" fill="#d6e4ff" />
          </g>
        ))}
        <text x="200" y="88" fontSize="40" fill="#0066ff" fontWeight="800">3</text>
        <text x="228" y="88" fontSize="14" fill="#0a1f44">本 / 月</text>
        <g fontSize="12" fill="#0a1f44">
          {['構成の作成', '章ごとの執筆と点検', '書き出し'].map((x, i) => (
            <g key={x} transform={`translate(24,${132 + i * 22})`}>
              <circle cx="7" cy="-4" r="7" fill="#0066ff" />
              <path d="M3.5 -4l2.5 2.5l4.5 -5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <text x="20" y="0">{x}</text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}

/* ================= 機能の画面（小さな実演つき） ================= */
function F1() {
  return (
    <div className="sv-f">
      <p className="sv-cap">記事の条件</p>
      <div className="sv-field"><span className="sv-flabel">キーワード</span><span className="sv-input">{KEYWORD}</span></div>
      <div className="sv-chips">
        <span className="sv-a" style={{ ['--d' as string]: '300ms' }}>読者: マーケ責任者</span>
        <span className="sv-a" style={{ ['--d' as string]: '500ms' }}>目的: 比較検討</span>
      </div>
      <ul className="sv-urls">
        {URLS.map((u, i) => (
          <li key={u} className="sv-a" style={{ ['--d' as string]: `${700 + i * 200}ms` }}>
            <Link2 size={13} aria-hidden="true" /><span>{u}</span><em className="ok">要点化</em>
          </li>
        ))}
      </ul>
      <div className="sv-question sv-a" style={{ ['--d' as string]: '1500ms' }}>
        <Search size={15} aria-hidden="true" />
        <span>記事が答えるべき問い: 何から始めればよいか</span>
      </div>
    </div>
  )
}
function F2() {
  return (
    <div className="sv-f">
      <p className="sv-cap">アウトライン</p>
      <ol className="sv-tree">
        {OUTLINE.slice(0, 4).map((r, i) => (
          <li key={r} className="sv-a" style={{ ['--d' as string]: `${i * 260}ms` }}>
            <b>{i + 1}</b><span>{r}</span>
            <small>役割: {['現状', '準備', '選定', '実行'][i]}</small>
          </li>
        ))}
      </ol>
      <div className="sv-link sv-a" style={{ ['--d' as string]: '1200ms' }}>前後のつながりを確かめています</div>
    </div>
  )
}
function F3() {
  return (
    <div className="sv-f">
      <p className="sv-cap">公開前チェック</p>
      <ul className="sv-audit show">
        {AUDIT.map(([k, v], i) => (
          <li key={k} className="sv-a" style={{ ['--d' as string]: `${i * 320}ms` }}>
            <Check size={14} aria-hidden="true" /><span>{k}</span><em>{v}</em>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ================= 流れの図（実演の下） ================= */
function Flow() {
  const steps: [string, string][] = [
    ['キーワードと参考URL', '条件を入れる'],
    ['構成', '検索意図からアウトラインを作る'],
    ['執筆', '章ごとに書き、つながりを確かめる'],
    ['点検', '事実の食い違いや薄い箇所を直す'],
    ['書き出し', 'テキスト・Markdown・HTML・JSON'],
  ]
  return (
    <ol className="sv-flow" aria-label="記事ができるまでの流れ">
      {steps.map(([a, b], i) => (
        <li key={a}>
          <span className="sv-flow-n">{i + 1}</span>
          <b>{a}</b>
          <small>{b}</small>
          {i < steps.length - 1 && (
            <svg className="sv-flow-ar" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"><path d="M2 6h22M19 1.5L24.5 6L19 10.5" fill="none" stroke="#0066ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </li>
      ))}
    </ol>
  )
}

const wrap = (n: ReactNode) => <div className="sv-fill">{n}</div>

export const SEO_VISUALS: LpKitVisuals = {
  demo: (t, tab) => <Demo t={t} tab={tab} />,
  flow: <Flow />,
  outputs: [
    wrap(<div className="sv-card-pad"><Article /></div>),
    wrap(<OutlineCard />),
    wrap(<InfographicCard />),
    wrap(<EyecatchCard />),
    wrap(<HtmlCard />),
    wrap(<FreeRangeCard />),
  ],
  features: [<F1 key="1" />, <F2 key="2" />, <F3 key="3" />],
}
