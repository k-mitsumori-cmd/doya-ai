import { redirect } from 'next/navigation'
import { getAioContext } from '@/lib/aio/access'
import AioShellFrame from '@/components/aio/AioShellFrame'

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

  // ツール内のナビ（ToolFrame）だけを出す。枠そのものは (shell)/layout.tsx が出す
  return <AioShellFrame orgSlug={orgSlug}>{children}</AioShellFrame>
}
