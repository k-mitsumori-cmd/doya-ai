// 開発用プレビュー: 共通の枠（左のメニュー）を「動いているタスク」つきで表示する（ログイン・DB不要）
// ⚠️ 本番では 404。画面確認・デザイン調整のためだけに使う。件数は /api/agent/runs/summary の答えで決まる（撮影では差し替える）
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import AppShell from '@/components/shell/AppShell'
import { NAV_GROUPS_COOKIE, parseNavGroups } from '@/lib/shell/nav-groups'

export const dynamic = 'force-dynamic'

export default async function ShellPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const navGroups = parseNavGroups((await cookies()).get(NAV_GROUPS_COOKIE)?.value)
  return (
    <AppShell userName="サンプル" agentTasks navGroups={navGroups}>
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>左のメニューの見本</h1>
        <p style={{ color: '#5b6478', marginTop: 8 }}>経営ホーム、動いているタスク、部署ごとのツールのまとまりを確かめるためのページです。</p>
      </div>
    </AppShell>
  )
}
