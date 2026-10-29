import { canWritePromaneWorkspace } from '@/lib/promane/ui-permissions';
import PromanePageIntro from '@/components/promane/PromanePageIntro';
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClientActions } from "@/components/promane/client-actions";

export default async function ClientsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane"); // ワークスペースが無い/権限が無い時は入口へ（/login は存在しない）

  const clients = await prisma.promaneClient.findMany({
    where: { workspaceId: workspace.id },
    include: { projects: { select: { id: true, contractAmount: true, status: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8 max-w-[1200px]">
      <PromanePageIntro
        className="flex items-center gap-5 mb-8 animate-slide-up"
        image="/character/love.png"
        imageSize={80}
        title="顧客管理"
        titleClassName="text-[28px] font-black tracking-tight text-gray-900"
        legacyLead={<>大切なお客様を管理 💛 {clients.length}社</>}
        legacyLeadClassName="text-[15px] text-gray-400 font-bold"
        lead="顧客ごとの案件数と売上をまとめます。"
      />
      <ClientActions canWrite={canWritePromaneWorkspace(workspace.members[0]?.role)} workspaceSlug={workspaceSlug} workspaceId={workspace.id} clients={clients.map((c) => ({
        ...c,
        totalRevenue: c.projects.reduce((sum, p) => sum + p.contractAmount, 0),
        projectCount: c.projects.length,
        activeCount: c.projects.filter((p) => !["completed", "cancelled"].includes(p.status)).length,
      }))} />
    </div>
  );
}
