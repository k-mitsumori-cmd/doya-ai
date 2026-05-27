import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, BILLING_TYPE_LABELS } from "@/lib/promane/format";
import { Badge } from "@/components/promane/ui/badge";
import { Progress } from "@/components/promane/ui/progress";
import { Button } from "@/components/promane/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Plus, ArrowRight } from "lucide-react";

export default async function ProjectsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");

  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId: workspace.id },
    include: { client: true, tasks: { select: { id: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-8 animate-slide-up">
        <div className="flex items-center gap-5">
          <Image src="/character/working.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
          <div>
            <h1 className="text-[28px] font-black tracking-tight text-gray-900">プロジェクト</h1>
            <p className="text-[15px] text-gray-400 font-bold">全 {projects.length} 件の案件を管理中 📋</p>
          </div>
        </div>
        <Link href={`/promane/${workspaceSlug}/projects/new`}>
          <Button className="rounded-full h-12 px-7 text-[15px] font-black shadow-lg bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 hover:scale-105 active:scale-95 transition-all">
            <Plus className="mr-2 h-5 w-5" />
            新規作成
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm py-24 text-center animate-bounce-in">
          <Image src="/character/thinking.png" alt="" width={140} height={140} className="mx-auto animate-float" unoptimized />
          <p className="mt-5 text-[22px] font-black text-gray-400">まだ案件がないよ〜</p>
          <p className="text-[15px] text-gray-300 font-bold mt-1">最初のプロジェクトを作ってみよう！</p>
          <Link href={`/promane/${workspaceSlug}/projects/new`}>
            <Button className="mt-6 rounded-full h-12 px-8 text-[16px] font-black shadow-lg hover:scale-105 transition-all">はじめる 🚀</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => {
            const done = project.tasks.filter((t) => t.status === "done").length;
            const total = project.tasks.length;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Link key={project.id} href={`/promane/${workspaceSlug}/projects/${project.id}`}>
                <div className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] hover:ring-blue-300 cursor-pointer group animate-slide-up stagger-${Math.min(i + 1, 5)}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 group-hover:scale-110 group-hover:rotate-3 transition-all">
                        <Image src="/character/working.png" alt="" width={32} height={32} className="drop-shadow-sm" unoptimized />
                      </div>
                      <div>
                        <p className="text-[16px] font-black text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</p>
                        <p className="text-[13px] font-bold text-gray-400">{project.client?.name || "顧客未設定"}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all mt-1" />
                  </div>

                  <Badge variant="secondary" className={`${PROJECT_STATUS_COLORS[project.status]} font-black text-[12px] rounded-full px-3 py-1 mb-4`}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[14px]">
                      <span className="font-bold text-gray-500">{BILLING_TYPE_LABELS[project.billingType]}</span>
                      <span className="font-black text-gray-900">{formatCurrency(project.contractAmount)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[13px] font-bold text-gray-400">進捗</span>
                        <span className="text-[13px] font-black text-gray-600">{done}/{total} ({progress}%)</span>
                      </div>
                      <Progress value={progress} className="h-2.5" />
                    </div>
                    {project.endDate && (
                      <div className="flex justify-between text-[13px]">
                        <span className="font-bold text-gray-400">📅 納期</span>
                        <span className="font-bold text-gray-600">{new Date(project.endDate).toLocaleDateString("ja-JP")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
