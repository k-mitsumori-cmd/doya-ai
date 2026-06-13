import { redirect } from 'next/navigation'
import { getShodanContext } from '@/lib/shodan/access'
import { prisma } from '@/lib/prisma'
import ShodanSidebar from '@/components/shodan/ShodanSidebar'

export const dynamic = 'force-dynamic'

type Params = { orgSlug: string }

export default async function ShodanOrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Params> | Params
}) {
  const p = 'then' in (params as any) ? await (params as Promise<Params>) : (params as Params)
  const orgSlug = decodeURIComponent(p.orgSlug)

  const ctx = await getShodanContext(orgSlug)
  // 当該組織のACTIVEメンバーでなければ入口へ（他組織は解決されない＝IDOR安全）
  if (!ctx || ctx.organizationSlug !== orgSlug) redirect('/shodan')

  const org = await prisma.shodanOrganization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true },
  })

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ShodanSidebar orgSlug={orgSlug} orgName={org?.name} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
