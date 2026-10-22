'use client'

// ============================================
// ドヤAI商談 設定
// ============================================
// メンバー招待。年に数回しか触らないので、ホームには置かない。
// ⚠️ 以前は「直近の商談」と「その場で答えられなかった質問」の間に挟まっていて、
//    日々見る内容の真ん中で読む流れが切れていた。ここに戻さないこと。

import MemberPanel from '@/components/org/MemberPanel'
import AishodanHeading from '@/components/aishodan/AishodanHeading'
import SignInReturnLink from '@/components/SignInReturnLink'
import { useOptionalOrganizationWorkspace, useWorkspaceProof } from '@/components/org/OrganizationWorkspaceBoundary'
import OwnerTransferPanel from '@/components/org/OwnerTransferPanel'

export default function AishodanSettingsPage() {
  const workspace = useOptionalOrganizationWorkspace()
  if (!workspace) return <main className="p-8"><SignInReturnLink fallback="/aishodan/settings" className="text-blue-700 underline">ログインして設定を開く</SignInReturnLink></main>
  return <AishodanSettingsWorkspace onCommitted={workspace.retry} />
}

function AishodanSettingsWorkspace({ onCommitted }: { onCommitted: () => void }) {
  const proof = useWorkspaceProof()
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <AishodanHeading className="text-xl font-bold text-slate-900">設定</AishodanHeading>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          この組織で商材・商談シナリオ・商談ログを扱える方を管理します。
        </p>
      </div>

      <MemberPanel
        basePath="/api/aishodan"
        service="aishodan"
        workspaceProof={proof}
        description="招待した方は、この組織の商材・商談シナリオと商談ログを扱えるようになります。"
      />
      <OwnerTransferPanel service="aishodan" organizationSlug={proof.organization.slug}
        organizationId={proof.organization.id} role={proof.organization.role} proof={proof} onCommitted={onCommitted} />
    </main>
  )
}
