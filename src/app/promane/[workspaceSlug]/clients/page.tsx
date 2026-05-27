import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ClientActions } from "@/components/promane/client-actions";
import Image from "next/image";

export default async function ClientsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");

  const clients = await prisma.promaneClient.findMany({
    where: { workspaceId: workspace.id },
    include: { projects: { select: { id: true, contractAmount: true, status: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center gap-5 mb-8 animate-slide-up">
        <Image src="/character/love.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-gray-900">顧客管理</h1>
          <p className="text-[15px] text-gray-400 font-bold">大切なお客様を管理 💛 {clients.length}社</p>
        </div>
      </div>
      <ClientActions workspaceSlug={workspaceSlug} clients={clients.map((c) => ({
        ...c,
        totalRevenue: c.projects.reduce((sum, p) => sum + p.contractAmount, 0),
        projectCount: c.projects.length,
        activeCount: c.projects.filter((p) => !["completed", "cancelled"].includes(p.status)).length,
      }))} />
    </div>
  );
}
