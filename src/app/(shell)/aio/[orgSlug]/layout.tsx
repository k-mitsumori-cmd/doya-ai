import { redirect } from 'next/navigation'
import { getAioContext } from '@/lib/aio/access'
import { getAioBilling } from '@/lib/aio/billing'
import { prisma } from '@/lib/prisma'
import AioAppLayout from '@/components/aio/AioAppLayout'
import AioShellFrame from '@/components/aio/AioShellFrame'
import { isShellEnabled } from '@/lib/ui-shell'

export const dynamic = 'force-dynamic'

type Params = { orgSlug: string }

export default async function AioOrgLayout(
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
  const orgSlug = decodeURIComponent(p.orgSlug)

  const ctx = await getAioContext(orgSlug)
  if (!ctx || ctx.organizationSlug !== orgSlug) redirect('/aio')

  // 共通の枠が有効なときは、ツール内のナビ（ToolFrame）だけを出す。枠そのものは (shell)/layout.tsx が出す
  if (isShellEnabled('aio')) return <AioShellFrame orgSlug={orgSlug}>{children}</AioShellFrame>

  const org = await prisma.aioOrganization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } })

  const billing = await getAioBilling(prisma, ctx.organizationId)

  return (
    <AioAppLayout organizationPlan={billing?.plan ?? null} isOwner={ctx.role === 'owner'} orgSlug={orgSlug} orgName={org?.name}>
      {children}
    </AioAppLayout>
  )
}
