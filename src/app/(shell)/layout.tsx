// ============================================
// 共通の枠を持つツールの layout（ルートグループ (shell)）
// ============================================
// (shell) の下のツール（/popup・/income など）を移っても、この layout は作り直されない。
// そのため枠（AppShell）をここに1つだけ置き、ツールの側の layout では枠で包まない。
// どのパスで枠を出すかは src/components/shell/registry.ts が決める。
// ⚠️ ルートグループの名前（(shell)）は URL に出ない。/popup はそのまま /popup。
// ⚠️ ここでは枠だけを出す。ツール内のナビ（ToolFrame）・組織の切り替え・認可は、各ツールの layout が持つ。
// 手順: docs/architecture/management-agent/SHELL-MIGRATION.md
import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { shellEnabledIds } from '@/lib/ui-shell'
import { uiNextMode } from '@/lib/ui-next'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { doyaPowerCharger } from '@/lib/doya-power/charge'
import { loadDoyaPowerFxForUser } from '@/lib/doya-power/fx.server'
import { getAccountCompanyName } from '@/lib/shell/company.server'
import { shellToolHrefs } from '@/lib/shell/tool-hrefs.server'
import { cookies } from 'next/headers'
import { parseRecent, RECENT_COOKIE } from '@/lib/shell/recent'
import ShellGate from '@/components/shell/ShellGate'

export default async function ShellGroupLayout({ children }: { children: ReactNode }) {
  // ⚠️ ここで落ちると (shell) の下の全ツールが開けなくなる。ログインが分からないときは「未ログイン」として枠を出さない
  const session = await getServerSession(authOptions).catch(() => null)
  // 新しい見た目（UI 品質の直し）を出すか。サーバーで決めて、クライアントの部品には context で渡す（チェックリスト §5.1）
  const uiNext = session?.user ? await uiNextMode() : null
  // ドヤパワー（DOYA_POWER_ROLLOUT）。新しい見た目の人のときだけ見る。off ならセッションも DB も読まずに false
  const doyaPower = uiNext ? await isDoyaPowerEnabled() : false
  // 左下の「登録会社」（UI 品質 B-1）。新しい見た目のときだけ読む。失敗しても枠は出す
  const [company, toolHrefs] = uiNext
    ? await Promise.all([getAccountCompanyName().catch(() => null), shellToolHrefs().catch(() => ({}))])
    : [undefined, {}]
  // 最近使ったツール（新しい見た目のときだけ。最初の描画から並べ、あとから押し下げない）
  const initialRecent = uiNext ? parseRecent((await cookies()).get(RECENT_COOKIE)?.value) : undefined
  // ドヤパワーの残り（枠のゲージ）。旗が出すと決めた人だけ、本人の会社の台帳を読む（毎月の付与・毎日の回復は読むときに足す）。
  // ⚠️ 旗が off・会社が未登録・読めないときは null（ゲージは出ない）。off なら台帳に触れない
  const doyaPowerState = doyaPower ? await doyaPowerCharger.shellState().catch(() => null) : null
  // ドヤくんの絵と演出の設定（会社・個人）。旗が出すと決めた人だけ読む（off なら DB に触れない）。枠のゲージや中のツールの部品が見る
  const userId = (session?.user as { id?: string } | undefined)?.id
  const doyaPowerFx = doyaPower && userId ? (await loadDoyaPowerFxForUser(userId).catch(() => null))?.fx ?? undefined : undefined
  return (
    <ShellGate signedIn={Boolean(session?.user)} userName={session?.user?.name ?? null} enabledIds={shellEnabledIds()} uiNext={uiNext} doyaPower={doyaPower} doyaPowerState={doyaPowerState} doyaPowerFx={doyaPowerFx} company={company} toolHrefs={toolHrefs} initialRecent={initialRecent}>
      {children}
    </ShellGate>
  )
}
