import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, formatPercent, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/promane/format";
import { Badge } from "@/components/promane/ui/badge";
import { Progress } from "@/components/promane/ui/progress";
import Link from "next/link";
import { ArrowRight, Plus, TrendingUp, Wallet, Briefcase, Target } from "lucide-react";
import { Button } from "@/components/promane/ui/button";
import Image from "next/image";
import { TaskPieChart, RevenueLineChart, ProfitBarChart, ActivityTimeline } from "@/components/promane/dashboard-charts";

async function getMyAssignmentsData(workspaceId: string, myMemberId: string) {
  const tasks = await prisma.promaneTask.findMany({
    where: {
      assigneeId: myMemberId,
      project: { workspaceId },
      status: { not: 'done' },
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
    },
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 30,
  });

  // 自分が担当するプロジェクトをユニークに
  const projectMap = new Map<string, { id: string; name: string; status: string; taskCount: number }>();
  for (const t of tasks) {
    const existing = projectMap.get(t.project.id);
    if (existing) {
      existing.taskCount++;
    } else {
      projectMap.set(t.project.id, {
        id: t.project.id,
        name: t.project.name,
        status: t.project.status,
        taskCount: 1,
      });
    }
  }
  const myProjects = Array.from(projectMap.values());

  return { tasks, myProjects };
}

async function getChartData(workspaceId: string) {
  // タスクステータス集計
  const allTasks = await prisma.promaneTask.findMany({
    where: { project: { workspaceId } },
    select: { status: true },
  });
  const statusCounts = new Map<string, number>();
  for (const t of allTasks) {
    statusCounts.set(t.status, (statusCounts.get(t.status) || 0) + 1);
  }
  const taskSummary = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

  // 月次売上・原価データ（直近6ヶ月）
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId },
    select: { id: true, contractAmount: true, createdAt: true, expenses: { select: { amount: true, createdAt: true } } },
  });
  const timeEntries = await prisma.promaneTimeEntry.findMany({
    where: {
      member: { workspaceId },
      startTime: { gte: sixMonthsAgo },
    },
    select: { duration: true, startTime: true, member: { select: { hourlyRate: true } } },
  });

  const monthlyData = new Map<string, { revenue: number; cost: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getMonth() + 1}月`;
    monthlyData.set(key, { revenue: 0, cost: 0 });
  }

  // 売上は契約日基準で月次配分（簡易: createdAt月に全額を計上）
  for (const p of projects) {
    if (p.createdAt < sixMonthsAgo) continue;
    const key = `${p.createdAt.getMonth() + 1}月`;
    if (monthlyData.has(key)) {
      const m = monthlyData.get(key)!;
      m.revenue += p.contractAmount;
    }
  }

  // 人件費
  for (const te of timeEntries) {
    const key = `${te.startTime.getMonth() + 1}月`;
    if (monthlyData.has(key)) {
      const cost = (te.duration / 60) * te.member.hourlyRate;
      monthlyData.get(key)!.cost += cost;
    }
  }

  // 経費
  for (const p of projects) {
    for (const e of p.expenses) {
      if (e.createdAt < sixMonthsAgo) continue;
      const key = `${e.createdAt.getMonth() + 1}月`;
      if (monthlyData.has(key)) {
        monthlyData.get(key)!.cost += e.amount;
      }
    }
  }

  const revenueData = Array.from(monthlyData.entries()).map(([month, v]) => ({
    month,
    revenue: Math.round(v.revenue),
    cost: Math.round(v.cost),
    profit: Math.round(v.revenue - v.cost),
  }));

  // 最近のアクティビティ（最新タスク更新 + プロジェクト作成）
  const recentTasks = await prisma.promaneTask.findMany({
    where: { project: { workspaceId } },
    include: { assignee: { select: { displayName: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  const activities = recentTasks.map((t) => ({
    id: t.id,
    type: 'task' as const,
    title: `「${t.title}」を ${t.status === 'done' ? '完了しました' : t.status === 'in_progress' ? '進行中にしました' : '更新しました'}`,
    user: t.assignee?.displayName || '担当者',
    time: relativeTime(t.updatedAt),
    icon: t.status === 'done' ? '✅' : t.status === 'in_progress' ? '⚡' : '📝',
  }));

  return { taskSummary, revenueData, activities };
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

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

const ROLE_LABELS_DASH: Record<string, string> = {
  owner: '👑 オーナー',
  admin: '⚙️ 管理者',
  member: '👤 メンバー',
  guest: '👁 ゲスト',
};

const TASK_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  todo: { label: 'やること', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: '進行中', color: 'bg-blue-100 text-blue-700' },
  review: { label: 'レビュー', color: 'bg-amber-100 text-amber-700' },
  done: { label: '完了', color: 'bg-emerald-100 text-emerald-700' },
};

export default async function DashboardPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");
  const myMember = workspace.members[0];
  const data = await getDashboardData(workspace.id);
  const myData = myMember ? await getMyAssignmentsData(workspace.id, myMember.id) : { tasks: [], myProjects: [] };
  const chartData = await getChartData(workspace.id);

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

      {/* 自分の役割・タスクカード */}
      {myMember && (
        <div className="mb-8 rounded-[28px] bg-gradient-to-br from-blue-500 via-violet-500 to-purple-600 p-6 text-white shadow-xl shadow-violet-500/20 animate-slide-up stagger-1">
          <div className="flex items-center gap-4 mb-4">
            <Image src="/character/focus.png" alt="" width={60} height={60} className="drop-shadow-md" unoptimized />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-black opacity-90">あなたの情報</p>
                <span className="text-[11px] font-black bg-white/20 px-2 py-0.5 rounded-full">
                  {ROLE_LABELS_DASH[myMember.role] || myMember.role}
                </span>
              </div>
              <p className="text-[22px] font-black mt-1">{myMember.displayName} さん</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-black opacity-80">担当タスク</p>
              <p className="text-[36px] font-black leading-none">{myData.tasks.length}</p>
              <p className="text-[10px] font-black opacity-70 mt-0.5">未完了</p>
            </div>
          </div>

          {myData.myProjects.length > 0 && (
            <div className="pt-4 border-t border-white/20">
              <p className="text-[11px] font-black opacity-80 mb-2">📂 参加中の案件</p>
              <div className="flex flex-wrap gap-2">
                {myData.myProjects.slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    href={`/promane/${workspaceSlug}/projects/${p.id}`}
                    className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-[12px] font-black transition-all hover:scale-105"
                  >
                    {p.name}
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{p.taskCount}</span>
                  </Link>
                ))}
                {myData.myProjects.length > 8 && (
                  <span className="text-[12px] font-black opacity-70 px-2 py-1.5">他 +{myData.myProjects.length - 8}件</span>
                )}
              </div>
            </div>
          )}

          {myData.tasks.length > 0 && (
            <div className="pt-4 mt-4 border-t border-white/20">
              <p className="text-[11px] font-black opacity-80 mb-2">⚡ 直近のタスク（最大5件）</p>
              <div className="space-y-1.5">
                {myData.tasks.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/promane/${workspaceSlug}/projects/${t.project.id}`}
                    className="flex items-center justify-between gap-3 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black truncate">{t.title}</p>
                      <p className="text-[10px] opacity-75 font-bold truncate">{t.project.name}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${TASK_STATUS_LABEL[t.status]?.color || 'bg-white/20 text-white'}`}>
                      {TASK_STATUS_LABEL[t.status]?.label || t.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {myData.tasks.length === 0 && (
            <div className="pt-4 border-t border-white/20 text-center">
              <p className="text-[13px] font-black opacity-90">タスクはまだ割り振られていません</p>
              <p className="text-[11px] opacity-75 font-bold mt-1">プロジェクトでタスクを作成・割り当てしましょう</p>
            </div>
          )}
        </div>
      )}

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

      {/* チャートグリッド (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* タスク円グラフ */}
        <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-sm p-6 animate-slide-up stagger-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[16px] font-black text-gray-900">タスクの進捗</h3>
              <p className="text-[11px] font-bold text-gray-400 mt-0.5">サマリー</p>
            </div>
            <Image src="/character/focus.png" alt="" width={32} height={32} className="animate-float" unoptimized />
          </div>
          <TaskPieChart data={chartData.taskSummary} />
        </div>

        {/* 売上推移 */}
        <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-sm p-6 animate-slide-up stagger-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[16px] font-black text-gray-900">売上・利益推移</h3>
              <p className="text-[11px] font-bold text-gray-400 mt-0.5">直近6ヶ月</p>
            </div>
            <Image src="/character/present.png" alt="" width={32} height={32} className="animate-float" unoptimized />
          </div>
          <RevenueLineChart data={chartData.revenueData} />
        </div>

        {/* 利益棒グラフ */}
        <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-sm p-6 animate-slide-up stagger-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[16px] font-black text-gray-900">月次利益</h3>
              <p className="text-[11px] font-bold text-gray-400 mt-0.5">直近6ヶ月</p>
            </div>
            <Image src="/character/success.png" alt="" width={32} height={32} className="animate-float" unoptimized />
          </div>
          <ProfitBarChart data={chartData.revenueData} />
        </div>
      </div>

      {/* メインコンテンツ: 案件一覧 + アクティビティ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* 案件一覧 (2/3) */}
        <div className="lg:col-span-2 rounded-[28px] bg-white ring-1 ring-gray-200 shadow-md overflow-hidden animate-slide-up stagger-4">
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

        {/* アクティビティ (1/3) */}
        <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-md p-6 animate-slide-up stagger-5">
          <div className="flex items-center gap-3 mb-5">
            <Image src="/character/love.png" alt="" width={40} height={40} className="animate-wiggle" unoptimized />
            <div>
              <h2 className="text-[18px] font-black text-gray-900">最近のアクティビティ</h2>
              <p className="text-[11px] font-bold text-gray-400">チームの動き</p>
            </div>
          </div>
          <ActivityTimeline items={chartData.activities} />
        </div>
      </div>
    </div>
  );
}
