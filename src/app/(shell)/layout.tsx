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
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { isGuidePopupsEnabled } from '@/lib/notice/flag'
import { isDepartmentsEnabled } from '@/lib/departments/flag'
import { DEPARTMENTS_COOKIE, parseDepartmentsCookie } from '@/lib/departments'
import { isProductHubsEnabled } from '@/lib/products/flag'
import { PRODUCT_COOKIE, PRODUCT_DEFAULT_COOKIE, parseProductId, productOfDepartment, resolveStartProduct } from '@/lib/products'
import { getMemberProducts } from '@/lib/products/settings.server'
import { orderProductsForSwitcher } from '@/lib/products/settings'
import { isSupportChatEnabled } from '@/lib/support-chat/flag'
import { isOneButtonEnabled } from '@/lib/one-button/flag'
import { doyaPowerCharger } from '@/lib/doya-power/charge'
import { loadDoyaPowerFxForUser } from '@/lib/doya-power/fx.server'
import { getAccountCompanyName } from '@/lib/shell/company.server'
import { shellToolHrefs } from '@/lib/shell/tool-hrefs.server'
import { cookies } from 'next/headers'
import { parseRecent, RECENT_COOKIE } from '@/lib/shell/recent'
import { NAV_GROUPS_COOKIE, parseNavGroups } from '@/lib/shell/nav-groups'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import ShellGate from '@/components/shell/ShellGate'

export default async function ShellGroupLayout({ children }: { children: ReactNode }) {
  // ⚠️ ここで落ちると (shell) の下の全ツールが開けなくなる。ログインが分からないときは「未ログイン」として枠を出さない
  const session = await getServerSession(authOptions).catch(() => null)
  const signedIn = Boolean(session?.user)
  // ドヤパワー（DOYA_POWER_ROLLOUT）。ログインしている人のときだけ見る。off ならセッションも DB も読まずに false
  const doyaPower = signedIn ? await isDoyaPowerEnabled() : false
  // ドヤくんの知らせ（GUIDE_POPUPS_ROLLOUT）。off ならセッションを読まずに false
  const guide = signedIn ? await isGuidePopupsEnabled() : false
  // 右下のサポートチャット（SUPPORT_CHAT_ROLLOUT）。off ならセッションを読まずに false
  const supportChat = signedIn ? await isSupportChatEnabled() : false
  // 「これ1つで全部進む」帯（旗 ONE_BUTTON_ROLLOUT。off ならセッションも読まない）
  const oneButton = signedIn ? await isOneButtonEnabled() : false
  // 部署ごとの入口（DEPARTMENTS_ROLLOUT）。off ならセッションを読まずに false。on のときだけ、主の部署を cookie から読む
  const departmentsOn = signedIn ? await isDepartmentsEnabled() : false
  const departments = departmentsOn ? { enabled: true, primary: parseDepartmentsCookie((await cookies()).get(DEPARTMENTS_COOKIE)?.value) } : undefined
  // 部門ごとの製品（PRODUCT_HUBS_ROLLOUT。docs/design/buddy-products-2026-11-01.md）。off ならセッションも cookie も読まず、今のメニューのまま。
  // on のときは部署の入口より先に使う。最初の製品は「本人が既定にした製品 → 最後に開いた製品 → 部署の入口で選んでいた部署 → 経営管理」
  const productsOn = signedIn ? await isProductHubsEnabled() : false
  const products = productsOn
    ? await (async () => {
        const jar = await cookies()
        const formerDept = parseDepartmentsCookie(jar.get(DEPARTMENTS_COOKIE)?.value)[0]
        const last = parseProductId(jar.get(PRODUCT_COOKIE)?.value) ?? (formerDept ? productOfDepartment(formerDept) : null)
        // 段2: 会社が使う製品と、担当・既定（本人が決めた値が先、無ければ管理者の値）。会社の役割の旗も on のときだけ表を読む。読めなければ決まりは無いものとする
        const mine = await getMemberProducts((session?.user as { id?: string } | undefined)?.id ?? '', session?.user?.email ?? null)
        // 管理者が「本人に変えさせない」にした人は、切り替えの一覧で選んだ既定（cookie）も使わない
        const selfDefault = mine.locked ? null : parseProductId(jar.get(PRODUCT_DEFAULT_COOKIE)?.value)
        const start = resolveStartProduct({ selfDefault, adminDefault: mine.defaultProduct, last, isAdmin: mine.all, assigned: mine.assigned })
        return { enabled: true, start, selfDefault, order: orderProductsForSwitcher(mine), canManage: mine.canManage, canEditSelf: mine.canEditSelf, locked: mine.locked }
      })()
    : undefined
  // 左下の「登録会社」（UI 品質 B-1）。失敗しても枠は出す
  const [company, toolHrefs] = signedIn
    ? await Promise.all([getAccountCompanyName().catch(() => null), shellToolHrefs().catch(() => ({}))])
    : [undefined, {}]
  // 最近使ったツール（最初の描画から並べ、あとから押し下げない）
  const initialRecent = signedIn ? parseRecent((await cookies()).get(RECENT_COOKIE)?.value) : undefined
  // 左のメニューのまとまり（ドヤマーケAI など）の開閉。最初の描画から開いた形で出し、あとから動かさない
  const navGroups = signedIn ? parseNavGroups((await cookies()).get(NAV_GROUPS_COOKIE)?.value) : undefined
  // 左のメニューの「動いているタスク」（ドヤくんに任せた ToDo）。旗 AGENT_ORCHESTRATION_ROLLOUT の内側だけ（off ならセッションも読まない）
  const agentTasks = signedIn ? await isAgentOrchestrationEnabled() : false
  // ドヤパワーの残り（枠のゲージ）。旗が出すと決めた人だけ、本人の会社の台帳を読む（毎月の付与・毎日の回復は読むときに足す）。
  // ⚠️ 旗が off・会社が未登録・読めないときは null（ゲージは出ない）。off なら台帳に触れない
  const doyaPowerState = doyaPower ? await doyaPowerCharger.shellState().catch(() => null) : null
  // ドヤくんの絵と演出の設定（会社・個人）。旗が出すと決めた人だけ読む（off なら DB に触れない）。枠のゲージや中のツールの部品が見る
  const userId = (session?.user as { id?: string } | undefined)?.id
  const doyaPowerFx = doyaPower && userId ? (await loadDoyaPowerFxForUser(userId).catch(() => null))?.fx ?? undefined : undefined
  return (
    <ShellGate session={session} signedIn={signedIn} userName={session?.user?.name ?? null} guide={guide} supportChat={supportChat} oneButton={oneButton} doyaPower={doyaPower} doyaPowerState={doyaPowerState} doyaPowerFx={doyaPowerFx} company={company} toolHrefs={toolHrefs} initialRecent={initialRecent} departments={departments} products={products} agentTasks={agentTasks} navGroups={navGroups}>
      {children}
    </ShellGate>
  )
}
