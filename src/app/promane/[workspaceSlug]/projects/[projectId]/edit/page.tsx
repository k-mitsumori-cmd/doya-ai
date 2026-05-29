import { requirePromaneAuth, getWorkspaceBySlug } from '@/lib/promane/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { ProjectForm } from '@/components/promane/project-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>
}) {
  const session = await requirePromaneAuth()
  const { workspaceSlug, projectId } = await params
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!)
  if (!workspace) redirect('/login')

  const [project, clients] = await Promise.all([
    prisma.promaneProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id },
    }),
    prisma.promaneClient.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!project) notFound()

  // ProjectForm が要求する形に整形
  const projectData = {
    id: project.id,
    name: project.name,
    clientId: project.clientId,
    description: project.description,
    status: project.status,
    billingType: project.billingType,
    contractAmount: project.contractAmount,
    monthlyAmount: project.monthlyAmount,
    hourlyRate: project.hourlyRate,
    estimatedHours: project.estimatedHours,
    startDate: project.startDate?.toISOString().split('T')[0] || null,
    endDate: project.endDate?.toISOString().split('T')[0] || null,
    tags: project.tags,
  }

  return (
    <div className="p-8 max-w-[800px]">
      <Link
        href={`/promane/${workspaceSlug}/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-[13px] font-bold text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        プロジェクト詳細に戻る
      </Link>
      <h1 className="text-[28px] font-black text-gray-900 mb-1">プロジェクトを編集</h1>
      <p className="text-[13px] font-bold text-gray-400 mb-6">{project.name}</p>
      <ProjectForm workspaceSlug={workspaceSlug} clients={clients} project={projectData} />
    </div>
  )
}
