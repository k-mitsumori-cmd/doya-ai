import { timeEntryBelongsToProject } from "@/lib/promane/time-entry-project";
import { laborCostForEntry } from "@/lib/promane/labor-cost";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardNext from "@/components/promane/ui-next/DashboardNext";

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
      date: { gte: sixMonthsAgo },
    },
    select: { duration: true, hourlyRateSnapshot: true, date: true, member: { select: { hourlyRate: true } } },
  });

  const monthlyData = new Map<string, { revenue: number; cost: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getMonth() + 1}月`;
    monthlyData.set(key, { revenue: 0, cost: 0 });
  }

  // 売上は契約日基準で月次配分（負の値はクランプ）
  const safe = (n: number | null | undefined) => Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0;
  for (const p of projects) {
    if (p.createdAt < sixMonthsAgo) continue;
    const key = `${p.createdAt.getMonth() + 1}月`;
    if (monthlyData.has(key)) {
      monthlyData.get(key)!.revenue += safe(p.contractAmount);
    }
  }

  // 人件費
  for (const te of timeEntries) {
    const key = `${te.date.getMonth() + 1}月`;
    if (monthlyData.has(key)) {
      const cost = laborCostForEntry(te, te.member.hourlyRate);
      monthlyData.get(key)!.cost += cost;
    }
  }

  // 経費
  for (const p of projects) {
    for (const e of p.expenses) {
      if (e.createdAt < sixMonthsAgo) continue;
      const key = `${e.createdAt.getMonth() + 1}月`;
      if (monthlyData.has(key)) {
        monthlyData.get(key)!.cost += safe(e.amount);
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

/**
 * 値を安全に正規化（NaN/Infinity/負の値を防ぐ）
 * 不正データがDBに残っていてもダッシュボードがクラッシュしないように
 */
function safeNum(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.max(0, v); // 負の値は0にクランプ
}

async function getDashboardData(workspaceId: string) {
  // 全プロジェクトを取得 (異常値は集計時に safeNum でクランプ)
  // 厳密フィルタしない理由: 一覧に正常プロジェクトも漏れていた問題対応
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
    const revenue = safeNum(project.contractAmount); // 負の契約金額は0扱い
    const doneTasks = project.tasks.filter((t) => t.status === "done").length;
    const totalTasks = project.tasks.length;
    const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
    const taskIds = project.tasks.map((t) => t.id);
    let laborCost = 0;
    members.forEach((member) => {
      member.timeEntries.filter((te) => timeEntryBelongsToProject(te, project.id, taskIds)).forEach((te) => {
        laborCost += laborCostForEntry(te, member.hourlyRate);
      });
    });
    // 経費は負値を 0 にクランプ (経費がマイナスは会計的に異常)
    const expenseCost = project.expenses.reduce((sum, e) => sum + safeNum(e.amount), 0);
    const totalProjectCost = laborCost + expenseCost;
    const profit = revenue - totalProjectCost;
    const rawRate = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitRate = rawRate;
    totalRevenue += revenue;
    totalCost += totalProjectCost;
    return { ...project, revenue, totalProjectCost, profit, profitRate, progress, doneTasks, totalTasks };
  });
  const totalProfit = totalRevenue - totalCost;
  const totalProfitRate = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return {
    projectStats,
    activeProjects: activeProjects.length,
    totalRevenue: safeNum(totalRevenue),
    totalCost: safeNum(totalCost),
    totalProfit, // 損失の場合は負になる可能性あり (これは正しい)
    totalProfitRate: Number.isFinite(totalProfitRate) ? totalProfitRate : 0,
  };
}

/** データ取得を安全化: 失敗してもダッシュボードは表示する */
async function safeDashboardData(workspaceId: string) {
  try {
    return await getDashboardData(workspaceId);
  } catch (e) {
    console.error('[dashboard] getDashboardData failed');
    return { projectStats: [], activeProjects: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, totalProfitRate: 0 };
  }
}
async function safeChartData(workspaceId: string) {
  try {
    return await getChartData(workspaceId);
  } catch (e) {
    console.error('[dashboard] getChartData failed');
    return { taskSummary: [], revenueData: [], activities: [] };
  }
}
async function safeMyAssignments(workspaceId: string, memberId: string) {
  try {
    return await getMyAssignmentsData(workspaceId, memberId);
  } catch (e) {
    console.error('[dashboard] getMyAssignmentsData failed');
    return { tasks: [] as any[], myProjects: [] as any[] };
  }
}

export default async function DashboardPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane");
  const myMember = workspace.members[0];

  // 並列実行 + 各々が独立して try-catch (1つが落ちても他が表示される)
  const [data, myData, chartData] = await Promise.all([
    safeDashboardData(workspace.id),
    myMember ? safeMyAssignments(workspace.id, myMember.id) : Promise.resolve({ tasks: [] as any[], myProjects: [] as any[] }),
    safeChartData(workspace.id),
  ]);

  return <DashboardNext workspaceSlug={workspaceSlug} data={data as any} myData={myData} chartData={chartData} myMember={myMember} />;
}
