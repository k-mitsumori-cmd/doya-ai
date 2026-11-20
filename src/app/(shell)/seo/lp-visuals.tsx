'use client'
// ドヤ記事作成 LP の「画面の再現」。製品の画面をコードで描く（画像は使わない）。
// ⚠️ 表示するのはサンプルのデータ。実在の会社名・人名・他社 URL は入れない（example.com は予約済みの例示用ドメイン）。
import { Check, FileText, Link2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cx, useInView, useMotion } from '@/components/lp-kit/hooks'
import type { LpKitVisuals } from '@/components/lp-kit/types'
import './lp-visuals.css'

// ⚠️ 項目名・ラベルは実際の製品画面（create/page.tsx、Tool.tsx、articles/[id]/{outline,check,export}）に合わせている。
//    チェックの結果は「問題ありません」までにとどめ、実際の画面にない件数や文言は作らない。
const KEYWORD = 'BtoB マーケティング AI活用'
const OUTLINE = ['AI活用で変わる業務', '導入前に決めること', 'ツール選定の比較軸', '小さく始める手順', '運用とふり返り', 'よくある失敗と対策']
const CHECKS = ['レギュレーション', 'コピペ', 'ファクト']
const URLS = ['example.com/guide-1', 'example.com/guide-2', 'example.com/guide-3']
const EXPORTS = ['HTML', 'Markdown', 'note', 'テキスト']

const on = (t: number, at: number) => t >= at

/* ================= 実演（キーワード → 構成 → 本文 → チェック → 完成） ================= */
function Demo({ t, tab }: { t: number; tab: number }) {
  const typed = Math.max(0, Math.min(KEYWORD.length, Math.floor((t - 250) / 50)))
  const typing = t >= 250 && typed < KEYWORD.length
  const pressed = t >= 1950 && t < 2180
  const outlineN = OUTLINE.filter((_, i) => on(t, 2400 + i * 260)).length
  const writtenN = OUTLINE.filter((_, i) => on(t, 4600 + i * 260)).length
  const checkN = CHECKS.filter((_, i) => on(t, 6550 + i * 450)).length
  const done = t >= 8200
  const head = tab === 0 ? 'Step 1: 記事の軸' : tab === 1 ? '構成生成' : tab === 2 ? '本文執筆' : done ? '完成' : '品質チェック'
  const badge = tab === 0 ? '入力中' : tab === 1 ? `${outlineN} / ${OUTLINE.length}` : tab === 2 ? `${writtenN} / ${OUTLINE.length}` : done ? '完成' : `${checkN} / ${CHECKS.length}`
  return (
    <>
      <div className="sv-pane sv-left">
        <p className="sv-cap">SEO記事を作成する</p>
        <div className="sv-field">
          <span className="sv-flabel">主キーワード</span>
          <span className="sv-input">
            {KEYWORD.slice(0, typed)}
            <i className={cx('sv-caret', (typing || t < 250) && tab === 0 && 'blink')} />
          </span>
        </div>
        <div className="sv-two">
          <div className={cx('sv-in', on(t, 1100) && 'on')}><span className="sv-flabel">記事タイプ</span><b>比較記事</b></div>
          <div className={cx('sv-in', on(t, 1300) && 'on')}><span className="sv-flabel">想定読者</span><b>マーケ担当者</b></div>
        </div>
        <span className="sv-flabel sv-urllabel">参考URL</span>
        <ul className="sv-urls">
          {URLS.map((u, i) => (
            <li key={u} className={cx('sv-in', on(t, 1500 + i * 150) && 'on')}>
              <Link2 size={13} aria-hidden="true" />
              <span>{u}</span>
            </li>
          ))}
        </ul>
        <span className={cx('sv-go', pressed && 'pressed', on(t, 2180) && 'sent')}>
          {on(t, 2180) ? '生成中...' : '記事を生成する'}
        </span>
      </div>

      <div className="sv-pane sv-right">
        <div className="sv-rhead">
          <p className="sv-cap">{head}</p>
          <span className={cx('sv-badge', done && 'done')}>{badge}</span>
        </div>

        <div className={cx('sv-empty', t < 2400 && 'on')}>
          <FileText size={28} aria-hidden="true" />
          <p>キーワードを入れると、ここに構成が出ます</p>
          <div className="sv-skel"><i /><i /><i /></div>
        </div>

        <ol className="sv-outline">
          {OUTLINE.map((r, i) => (
            <li key={r} className={cx('sv-in', on(t, 2400 + i * 260) && 'on')}>
              <b>{i + 1}</b>
              <span>{r}</span>
              <i className={cx('sv-bar', on(t, 4400) && 'show')} aria-hidden="true"><u style={{ width: on(t, 4500 + i * 260) ? '100%' : '0%' }} /></i>
              <Check size={14} className={cx('sv-tick', on(t, 4600 + i * 260 + 700) && 'on')} aria-hidden="true" />
            </li>
          ))}
        </ol>

        <ul className="sv-audit">
          {CHECKS.map((k, i) => (
            <li key={k} className={cx('sv-in', on(t, 6550 + i * 450) && 'on')}>
              <Check size={14} aria-hidden="true" />
              <span>{k}</span>
              <em>問題ありません</em>
            </li>
          ))}
        </ul>

        <div className={cx('sv-article', done && 'on')} aria-hidden={!done}>
          <Article compact />
          <p className="sv-allok"><Check size={14} aria-hidden="true" />すべて確認しました</p>
          <div className="sv-export">
            {EXPORTS.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ================= ヒーロー案A: 実演の縮小版（入力 → 構成 → 点検 → 完成を、短く繰り返す） ================= */
const HM_DONE = 4800
const HM_HOLD = 3200
function HeroMini() {
  const { ok } = useMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '40px' })
  const [t, setT] = useState(HM_DONE)
  const [boot, setBoot] = useState(false)
  useLayoutEffect(() => {
    if (!ok) { setT(HM_DONE); return }
    setBoot(true); setT(0)
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setBoot(false)))
    return () => cancelAnimationFrame(r)
  }, [ok])
  useEffect(() => {
    if (!ok || !inView) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const n = performance.now(); const dt = n - last; last = n
      setT((p) => (p + dt > HM_DONE + HM_HOLD ? 0 : p + dt))
    }, 60)
    return () => window.clearInterval(id)
  }, [ok, inView])
  const typed = Math.max(0, Math.min(KEYWORD.length, Math.floor((t - 200) / 55)))
  const done = t >= 4400
  return (
    <div ref={ref} className={cx('hm', boot && 'boot')} role="img" aria-label="記事の条件を入れると、構成が作られ、点検が済むまでの画面のサンプル">
      <div className="hm-bar"><i /><i /><i /><span>SEO記事を作成する</span></div>
      <div className="hm-body">
        <div className="hm-input"><span>主キーワード</span><b>{KEYWORD.slice(0, typed)}<i className={cx('sv-caret', t < 1300 && 'blink')} /></b></div>
        <ol className="hm-rows">
          {OUTLINE.slice(0, 4).map((r, i) => (
            <li key={r} className={cx('sv-in', t >= 1400 + i * 330 && 'on')}>
              <em>{i + 1}</em><span>{r}</span>
              <Check size={13} className={cx('sv-tick', t >= 3000 + i * 300 && 'on')} aria-hidden="true" />
            </li>
          ))}
        </ol>
        <p className={cx('hm-done', done && 'on')}><Check size={14} aria-hidden="true" />完成</p>
      </div>
    </div>
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
      <div className="sv-rhead"><p className="sv-cap">見出し構成</p><span className="sv-badge done">6 / 6</span></div>
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
        {[0].map((i) => (
          <g key={i} transform={`translate(${24 + i * 56},50)`}>
            <rect width="46" height="58" rx="8" fill="#fff" stroke="#0066ff" strokeWidth="2" />
            <rect x="8" y="10" width="30" height="5" rx="2.5" fill="#0066ff" />
            <rect x="8" y="22" width="30" height="3" rx="1.5" fill="#d6e4ff" />
            <rect x="8" y="30" width="24" height="3" rx="1.5" fill="#d6e4ff" />
            <rect x="8" y="38" width="28" height="3" rx="1.5" fill="#d6e4ff" />
          </g>
        ))}
        <text x="90" y="86" fontSize="22" fill="#0066ff" fontWeight="800">まず無料で試せる</text>
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
      <p className="sv-cap">SEO記事を作成する</p>
      <div className="sv-field"><span className="sv-flabel">主キーワード</span><span className="sv-input">{KEYWORD}</span></div>
      <div className="sv-two">
        <div className="sv-a" style={{ ['--d' as string]: '300ms' }}><span className="sv-flabel">記事タイプ</span><b>比較記事</b></div>
        <div className="sv-a" style={{ ['--d' as string]: '500ms' }}><span className="sv-flabel">想定読者</span><b>マーケ担当者</b></div>
      </div>
      <span className="sv-flabel">参考URL</span>
      <ul className="sv-urls">
        {URLS.map((u, i) => (
          <li key={u} className="sv-a" style={{ ['--d' as string]: `${700 + i * 200}ms` }}>
            <Link2 size={13} aria-hidden="true" /><span>{u}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
function F2() {
  return (
    <div className="sv-f">
      <p className="sv-cap">見出し構成</p>
      <ol className="sv-tree">
        {OUTLINE.slice(0, 5).map((r, i) => (
          <li key={r} className="sv-a" style={{ ['--d' as string]: `${i * 260}ms` }}>
            <b>{i + 1}</b><span>{r}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
function F3() {
  return (
    <div className="sv-f">
      <p className="sv-cap">品質チェック</p>
      <ul className="sv-audit show">
        {CHECKS.map((k, i) => (
          <li key={k} className="sv-a" style={{ ['--d' as string]: `${i * 320}ms` }}>
            <Check size={14} aria-hidden="true" /><span>{k}</span><em>問題ありません</em>
          </li>
        ))}
      </ul>
      <p className="sv-allok sv-a" style={{ ['--d' as string]: '1300ms' }}><Check size={14} aria-hidden="true" />すべて確認しました</p>
    </div>
  )
}

/* ================= 流れの図（実演の下） ================= */
function Flow() {
  const steps: [string, string][] = [
    ['キーワードと参考URL', '条件を入れる'],
    ['構成', '検索意図からアウトラインを作る'],
    ['執筆', '章ごとに書き、つながりを確かめる'],
    ['チェック', '事実の食い違いや薄い箇所を確かめる'],
    ['書き出し', 'HTML・Markdown・note・テキスト'],
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
  heroA: <HeroMini />,
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
