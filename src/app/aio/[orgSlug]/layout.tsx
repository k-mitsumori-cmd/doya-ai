import { redirect } from 'next/navigation'
import { getAioContext } from '@/lib/aio/access'
import { prisma } from '@/lib/prisma'
import AioAppLayout from '@/components/aio/AioAppLayout'

export const dynamic = 'force-dynamic'

type Params = { orgSlug: string }

export default async function AioOrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Params> | Params
}) {
  const p = 'then' in (params as any) ? await (params as Promise<Params>) : (params as Params)
  const orgSlug = decodeURIComponent(p.orgSlug)

  const ctx = await getAioContext(orgSlug)
  if (!ctx || ctx.organizationSlug !== orgSlug) redirect('/aio')

  const org = await prisma.aioOrganization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } })

  return (
    <AioAppLayout orgSlug={orgSlug} orgName={org?.name}>
      {children}
    </AioAppLayout>
  )
}
