import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, formatPercent, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/promane/format";
import { Badge } from "@/components/promane/ui/badge";
import { Progress } from "@/components/promane/ui/progress";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/promane/ui/button";
import Image from "next/image";

async function getDashboardData(workspaceId: string) {
  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId },
    include: { client: true, tasks: true, expenses: true },
  });
  const members = await prisma.promaneMember.findMany({
    where: { workspaceId },
    include: { timeEntries: true },
  });
  let totalRevenue = 0;
  let totalCost = 0;
  const activeProjects = projects.filter((p) => !["completed", "cancelled", "draft"].includes(p.status));
  const projectStats = projects.map((project) => {
    const revenue = project.contractAmount;
    const doneTasks = project.tasks.filter((t) => t.status === "done").length;
    const totalTasks = project.tasks.length;
    const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
    const taskIds = project.tasks.map((t) => t.id);
    let laborCost = 0;
    members.forEach((member) => {
      const memberTime = member.timeEntries.filter((te) => te.taskId && taskIds.includes(te.taskId)).reduce((sum, te) => sum + te.duration, 0);
      laborCost += (memberTime / 60) * member.hourlyRate;
    });
    const expenseCost = project.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalProjectCost = laborCost + expenseCost;
    const profit = revenue - totalProjectCost;
    const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
    totalRevenue += revenue;
    totalCost += totalProjectCost;
    return { ...project, revenue, totalProjectCost, profit, profitRate, progress, doneTasks, totalTasks };
  });
  const totalProfit = totalRevenue - totalCost;
  const totalProfitRate = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return { projectStats, activeProjects: activeProjects.length, totalRevenue, totalCost, totalProfit, totalProfitRate };
}

export default async function DashboardPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");
  const data = await getDashboardData(workspace.id);

  const kpiCards = [
    { icon: "/character/present.png", label: "売上合計", value: formatCurrency(data.totalRevenue), bg: "from-blue-100 to-indigo-100", text: "text-blue-800", ring: "ring-blue-200" },
    { icon: "/character/working.png", label: "原価合計", value: formatCurrency(data.totalCost), bg: "from-orange-100 to-amber-100", text: "text-orange-800", ring: "ring-orange-200" },
    { icon: "/character/success.png", label: "利益率", value: formatPercent(data.totalProfitRate), bg: "from-green-100 to-emerald-100", text: "text-green-800", ring: "ring-green-200" },
    { icon: "/character/focus.png", label: "進行中", value: `${data.activeProjects} 件`, bg: "from-violet-100 to-purple-100", text: "text-violet-800", ring: "ring-violet-200" },
  ];

  return (
    <div className="p-8 max-w-[1200px]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8 animate-slide-up">
        <div className="flex items-center gap-5">
          <Image src="/character/hello.png" alt="ドヤプロマネくん" width={100} height={100} className="animate-bounce-in drop-shadow-xl" unoptimized />
          <div>
            <h1 className="text-[32px] font-black tracking-tight text-gray-900">ダッシュボード</h1>
            <p className="mt-0.5 text-[16px] text-gray-400 font-bold">今日も一緒にがんばろう！💪</p>
          </div>
        </div>
        <Link href={`/promane/${workspaceSlug}/projects/new`}>
          <Button className="rounded-full h-12 px-7 text-[16px] font-black shadow-lg bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 transition-all hover:scale-105 active:scale-95">
            <Plus className="mr-2 h-5 w-5" />
            新規プロジェクト
          </Button>
        </Link>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4 mb-8">
        {kpiCards.map((card, i) => (
          <div key={card.label} className={`rounded-[28px] bg-gradient-to-br ${card.bg} ring-1 ${card.ring} p-6 animate-slide-up stagger-${i + 1} transition-all hover:scale-105 hover:shadow-xl cursor-default`}>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[15px] font-black ${card.text}`}>{card.label}</span>
              <Image src={card.icon} alt="" width={52} height={52} className="animate-float drop-shadow-md" unoptimized />
            </div>
            <p className={`text-[32px] font-black ${card.text} leading-none tracking-tight`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* 案件一覧 */}
      <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-md overflow-hidden animate-slide-up stagger-5">
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Image src="/character/point.png" alt="" width={40} height={40} className="animate-wiggle" unoptimized />
            <h2 className="text-[22px] font-black text-gray-900">案件一覧</h2>
          </div>
          <Link href={`/promane/${workspaceSlug}/projects`} className="flex items-center gap-1.5 text-[15px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
            すべて見る <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {data.projectStats.length === 0 ? (
          <div className="py-24 text-center animate-bounce-in">
            <Image src="/character/thinking.png" alt="" width={160} height={160} className="mx-auto animate-float" unoptimized />
            <p className="mt-5 text-[22px] font-black text-gray-400">まだ案件がないよ〜</p>
            <p className="text-[16px] text-gray-300 font-bold mt-1">最初のプロジェクトを作ってみよう！</p>
            <Link href={`/promane/${workspaceSlug}/projects/new`}>
              <Button className="mt-6 rounded-full h-12 px-8 text-[16px] font-black shadow-lg hover:scale-105 transition-all">
                はじめる 🚀
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.projectStats.map((project, i) => (
              <Link
                key={project.id}
                href={`/promane/${workspaceSlug}/projects/${project.id}`}
                className={`flex items-center gap-5 px-7 py-5 hover:bg-blue-50/60 transition-all group animate-slide-up stagger-${Math.min(i + 1, 5)}`}
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-100 transition-all group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg">
                  <Image src="/character/working.png" alt="" width={40} height={40} className="drop-shadow-sm" unoptimized />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {project.name}
                  </p>
                  <p className="text-[14px] text-gray-400 font-bold mt-0.5">
                    {project.client?.name || "顧客未設定"}
                  </p>
                </div>

                <Badge variant="secondary" className={`${PROJECT_STATUS_COLORS[project.status]} font-black text-[13px] rounded-full px-4 py-1.5 transition-transform group-hover:scale-110`}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>

                <div className="text-right w-32 flex-shrink-0">
                  <p className="text-[18px] font-black text-gray-900">{formatCurrency(project.revenue)}</p>
                </div>

                <div className="w-36 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Progress value={project.progress} className="h-3 flex-1" />
                    <span className="text-[14px] font-black text-gray-500 w-12 text-right">
                      {Math.round(project.progress)}%
                    </span>
                  </div>
                </div>

                <div className="w-20 flex-shrink-0 text-right">
                  <span className={`text-[18px] font-black ${project.profitRate >= 30 ? "text-green-600" : "text-red-500"}`}>
                    {project.revenue > 0 ? formatPercent(project.profitRate) : "—"}
                  </span>
                </div>

                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
