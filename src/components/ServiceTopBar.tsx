'use client'

// ============================================
// サービス共通のヘッダー
// ============================================
// ⚠️ 新しく作った4サービス（見積もり / AI商談 / 広告画像 / 面接官）には
//    ナビゲーションが一切入っておらず、**一度入ると他のツールへ移れず、
//    トップへ戻る導線も無かった**（ブラウザの戻るしか手段が無い）。
//    サービスを追加したら、必ずこのヘッダーを layout.tsx に入れること。
//
// ⚠️ 応募者・見込み客など**第三者が開く画面には出さないこと**。
//    自社サービスの一覧を外部の方に見せることになる。
//    （/mensetsu/live/[token] や /m/[token] など）

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToolSwitcherMenu } from '@/components/ToolSwitcherMenu'

interface ServiceTopBarProps {
  /** services.ts の id。ツール一覧で現在地を示すために使う */
  serviceId: string
  /** 画面に出すサービス名 */
  serviceName: string
}

/**
 * 第三者（応募者・見込み客・招待された方）が開く画面。
 * ⚠️ layout.tsx はその配下すべてに掛かるため、`/mensetsu/live/[token]` のような
 *    ゲスト画面にもヘッダーが出てしまう。ここで自衛する。
 *    ゲスト経路を増やしたらここにも追加すること。
 */
const GUEST_PATH_PATTERNS = [/^\/mensetsu\/live\//, /^\/aishodan\/invite\//, /^\/m\//]

export function ServiceTopBar({ serviceId, serviceName }: ServiceTopBarProps) {
  const pathname = usePathname() || ''
  if (GUEST_PATH_PATTERNS.some((re) => re.test(pathname))) return null

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            ドヤマーケAI
          </Link>
          <span className="shrink-0 text-slate-300">/</span>
          <span className="truncate text-sm font-black text-[#0a0f3c]">{serviceName}</span>
        </div>

        <ToolSwitcherMenu currentService={serviceId} showLabel isCollapsed={false} className="shrink-0" />
      </div>
    </div>
  )
}
