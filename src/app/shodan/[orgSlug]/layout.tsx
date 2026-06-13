import { redirect } from 'next/navigation'
import { getShodanContext } from '@/lib/shodan/access'
import { prisma } from '@/lib/prisma'
import ShodanAppLayout from '@/components/shodan/ShodanAppLayout'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ドヤ商談準備 | 商談先のURLだけで提案準備を一括生成',
  description: '商談先のURLを入れるだけで、企業リサーチ・課題仮説・解決策・提案資料までAIが一括作成。',
}

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
    <ShodanAppLayout orgSlug={orgSlug} orgName={org?.name}>
      {children}
    </ShodanAppLayout>
  )
}
