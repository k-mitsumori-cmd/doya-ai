// ============================================
// LP共通シェル（マーケLP用ヘッダー＋フッター）
// 各サービスLPで個別にベタ書きしていた <header>/<footer> を統一。
// ============================================
import React from 'react'
import Link from 'next/link'
import { Sym, accentVars } from './primitives'

export interface LpShellProps {
  /** サービス名（例: ドヤ商談準備） */
  serviceName: string
  /** ブランドマークのMaterial Symbolアイコン名（絵文字は使わない） */
  icon: string
  /** ヘッダー右のCTA遷移先（ダッシュボード等） */
  ctaHref: string
  /** ヘッダーCTAの文言 */
  ctaLabel?: string
  /** サービス別アクセント色 */
  accent?: string
  children: React.ReactNode
}

/** ブランドマーク（Material Symbolタイル＋サービス名。絵文字禁止） */
export function BrandMark({ serviceName, icon, size = 'md' }: { serviceName: string; icon: string; size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg'
  const tile = size === 'lg' ? 'w-11 h-11' : size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'
  return (
    <span className={`inline-flex items-center gap-2.5 font-black ${text}`}>
      <span
        className={`grid place-items-center ${tile} rounded-xl text-white shadow-lg`}
        style={{ background: 'linear-gradient(135deg, #0066ff, var(--lp-accent))', boxShadow: '0 8px 20px rgba(0,102,255,0.25)' }}
      >
        <Sym name={icon} size={size === 'lg' ? 24 : 18} />
      </span>
      <span className="text-slate-900 tracking-tight">{serviceName}</span>
    </span>
  )
}

export function LpShell({ serviceName, icon, ctaHref, ctaLabel = 'はじめる', accent, children }: LpShellProps) {
  return (
    <div className="min-h-screen relative bg-white text-slate-900 overflow-x-hidden" style={accentVars(accent)}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="shrink-0" aria-label="ドヤマーケAI トップ">
            <BrandMark serviceName={serviceName} icon={icon} />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/auth/signin" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
              ログイン
            </Link>
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-black text-white rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ background: '#0066ff', boxShadow: '0 6px 16px rgba(0,102,255,0.28)' }}
            >
              {ctaLabel}
              <Sym name="arrow_forward" size={18} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Body */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="relative border-t border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-5 py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div>
              <BrandMark serviceName="ドヤマーケAI" icon="workspaces" size="sm" />
              <p className="mt-3 text-sm text-slate-400 max-w-xs leading-relaxed">
                中小企業のためのAI SaaSサービス群。1つの契約で、すべてのプロプランが使えます。
              </p>
            </div>
            <nav className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-2 text-sm">
              <Link href="/" className="text-slate-500 hover:text-[color:#0066ff] font-bold">サービス一覧</Link>
              <Link href="/pricing" className="text-slate-500 hover:text-[color:#0066ff] font-bold">料金プラン</Link>
              <Link href={ctaHref} className="text-slate-500 hover:text-[color:#0066ff] font-bold">はじめる</Link>
              <Link href="/terms" className="text-slate-500 hover:text-[color:#0066ff] font-bold">利用規約</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-[color:#0066ff] font-bold">プライバシー</Link>
              <Link href="/tokushoho" className="text-slate-500 hover:text-[color:#0066ff] font-bold">特定商取引法</Link>
            </nav>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-slate-400">運営: 株式会社スリスタ</p>
            <p className="text-xs text-slate-400">&copy; 2026 ドヤマーケAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
