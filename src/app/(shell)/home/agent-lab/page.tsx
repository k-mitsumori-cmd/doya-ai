// 開発用の確認ページ: 複数ツールを同時に動かす「実行の仕組み」を、見本の結果で最後まで動かす（ログイン・DB・AI 不要）
// ⚠️ 本番（NODE_ENV=production）と、旗 AGENT_ORCHESTRATION_ROLLOUT が off のときは 404。
// ⚠️ 経営ホームの本番の画面は UIリニューアルが作る（src/components/home-agent/）。ここは実行の仕組みを確かめる見本の画面。
// ⚠️ ログインしていると (shell)/layout.tsx が枠を出すので、ここでは包まない（枠が二重にならないように）。
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/shell/AppShell'
import AgentOrchestrator from '@/components/agent-orchestration/AgentOrchestrator'
import { agentOrchestrationRollout } from '@/lib/agent-orchestration/flag'
import { SALES_PREP } from '@/lib/agent-orchestration/recipes'

export const dynamic = 'force-dynamic'

export default async function AgentLabPage() {
  if (process.env.NODE_ENV === 'production' || agentOrchestrationRollout() === 'off') notFound()
  const body = (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 16px 64px' }}>
      <AgentOrchestrator recipe={SALES_PREP} executor="sample" />
    </div>
  )
  const signedIn = Boolean((await getServerSession(authOptions).catch(() => null))?.user)
  return signedIn ? body : <AppShell userName="サンプル">{body}</AppShell>
}
