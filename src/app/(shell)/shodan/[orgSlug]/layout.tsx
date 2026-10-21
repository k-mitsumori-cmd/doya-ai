import OrganizationUnavailable from '@/components/OrganizationUnavailable'
import { getShodanContext } from '@/lib/shodan/access'
import { prisma } from '@/lib/prisma'
import { getShodanBilling } from '@/lib/shodan/billing'
import ShodanAppLayout from '@/components/shodan/ShodanAppLayout'
import ShodanShellFrame from '@/components/shodan/ShodanShellFrame'
import { isShellEnabled } from '@/lib/ui-shell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ドヤ商談準備 | 商談先のURLだけで提案準備を一括生成',
  description: '商談先のURLを入れるだけで、企業リサーチ・課題仮説・解決策・提案資料までAIが一括作成。',
}

type Params = { orgSlug: string }

export default async function ShodanOrgLayout(
  props: {
    children: React.ReactNode
    params: Promise<Params>
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const p = params
  const orgSlug = p.orgSlug

  const ctx = await getShodanContext(orgSlug)
  // 他組織へ自動で切り替えず、権限や組織が変わったことを案内する。
  if (!ctx || ctx.organizationSlug !== orgSlug) return <OrganizationUnavailable serviceHref="/shodan" serviceName="商談準備" />

  const [org, billing] = await Promise.all([
    prisma.shodanOrganization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } }),
    getShodanBilling(prisma, ctx.organizationId),
  ])

  // 共通シェルが有効なら ToolFrame だけ（枠は (shell)/layout.tsx が出す）。無効の間は今のレイアウト
  if (isShellEnabled('shodan')) {
    return <ShodanShellFrame orgSlug={orgSlug} orgName={org?.name}>{children}</ShodanShellFrame>
  }

  return (
    <ShodanAppLayout orgSlug={orgSlug} orgName={org?.name} organizationPlan={billing?.plan ?? null} canManageBilling={ctx.role === 'owner' && ctx.userId === billing?.ownerUserId}>
      {children}
    </ShodanAppLayout>
  )
}
