// ============================================
// 404（ページが見つからない）
// ============================================
// 新しい見た目（ドヤマーケAI の青）にそろえる。古いブランドの紫のグラデーションと、
// 今は無い入口（カンタンドヤAI・ドヤバナーAI）へのリンクは出さない（2026-10-24 メインの全画面の点検）。
// ⚠️ ログインの有無で中身を変えない（どの画面の下でも同じ文字にする）。行き先は、経営ホーム・トップ・料金の3つだけ
import Link from 'next/link'
import tokens from '@/components/ds/tokens.module.css'
import { Button, EmptyState } from '@/components/ds'

export default function NotFound() {
  return (
    <main className={`${tokens.ds} grid min-h-[100dvh] place-items-center bg-[var(--bg)] px-4 py-12`}>
      <div className="w-full max-w-lg rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-6 shadow-[var(--shadow)] sm:p-8">
        <p className="m-0 text-center text-[13px] font-bold tracking-[0.12em] text-[var(--blue)]">404</p>
        <EmptyState
          kind="no-results"
          title="ページが見つかりません"
          description="URL が変わったか、ページが削除された可能性があります。経営ホームから、使いたいツールを選んでください。"
          action={<Button href="/home" icon="LayoutDashboard">経営ホームへ</Button>}
        />
        <nav aria-label="ほかの行き先" className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[var(--line)] pt-5 text-[14px] font-bold">
          <Link href="/" className="text-[var(--blue)] hover:underline">トップページ</Link>
          <Link href="/pricing" className="text-[var(--blue)] hover:underline">料金プラン</Link>
          <Link href="/auth/signin" className="text-[var(--blue)] hover:underline">ログイン</Link>
        </nav>
      </div>
    </main>
  )
}
