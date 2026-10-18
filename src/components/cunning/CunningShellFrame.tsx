'use client'

// ============================================
// ドヤカンニング 共通の枠での表示（ToolFrame だけ）
// ============================================
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは AppShell を使わない。
// ⚠️ 今の CunningLayoutShell と同じく、アカウントが切り替わったら子の入力を捨て、確定前は子を隠して操作させない
import { useActorServicePlan } from '@/components/sidebar/useActorServicePlan'
import { Toaster } from 'react-hot-toast'
import ToolFrame from '@/components/shell/ToolFrame'
import { CUNNING_NAV } from '@/lib/cunning/nav'

export default function CunningShellFrame({ children }: { children: React.ReactNode }) {
  const account = useActorServicePlan('cunning')

  if (account.status === 'loading' && !account.knownActor) return <div role="status" className="p-6 text-center">認証情報を確認しています。</div>
  if (account.status === 'authenticated' && !account.actor) return <div role="alert" className="p-6 text-center">ログイン情報を確認できません。<a href="/auth/signin" className="ml-2 underline">再度ログインする</a></div>

  return (
    <div key={account.actorKey}>
      <Toaster position="top-center" />
      <ToolFrame
        serviceId="cunning"
        title="ドヤカンニング"
        description="Web会議中の質問に、AIが回答の案をその場で表示します。"
        nav={CUNNING_NAV}
      >
        {account.failed && <div role="alert" className="p-3 text-sm text-amber-900 bg-amber-50">プランを確認できませんでした。<button type="button" className="ml-2 underline" onClick={account.refresh}>再確認する</button></div>}
        {account.status === 'loading' && <p role="status" className="p-3 text-sm">認証情報を確認しています。</p>}
        <div hidden={account.status === 'loading'} ref={element => { if (element) element.inert = account.status === 'loading' }}>{children}</div>
      </ToolFrame>
    </div>
  )
}
