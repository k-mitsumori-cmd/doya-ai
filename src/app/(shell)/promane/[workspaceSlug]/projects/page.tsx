import { canWritePromaneWorkspace } from '@/lib/promane/ui-permissions';
import { timeEntryBelongsToProject } from "@/lib/promane/time-entry-project";
import { laborCostForEntry } from "@/lib/promane/labor-cost";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProjectsNext from "@/components/promane/ui-next/ProjectsNext";

export default async function ProjectsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane"); // ワークスペースが無い/権限が無い時は入口へ（/login は存在しない）

  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId: workspace.id },
    include: {
      client: true,
      tasks: {
        select: { id: true, status: true, assignee: { select: { displayName: true } } },
      },
      expenses: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // メンバー時給参照用
  const members = await prisma.promaneMember.findMany({
    where: { workspaceId: workspace.id },
    include: { timeEntries: { select: { duration: true, hourlyRateSnapshot: true, taskId: true, projectId: true } } },
  });

  // 安全な数値正規化 (負値/NaN を 0 にクランプ)
  const safe = (n: number | null | undefined) => (n == null || !Number.isFinite(n)) ? 0 : Math.max(0, n);
  // 集計
  const projectStats = projects.map((p) => {
    const done = p.tasks.filter((t) => t.status === "done").length;
    const total = p.tasks.length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const taskIds = p.tasks.map((t) => t.id);
    let laborCost = 0;
    for (const m of members) {
      for (const entry of m.timeEntries) {
        if (timeEntryBelongsToProject(entry, p.id, taskIds)) laborCost += laborCostForEntry(entry, m.hourlyRate);
      }
    }
    // 経費は負値を 0 にクランプ (会計的に経費マイナスは異常)
    const expenseCost = p.expenses.reduce((s, e) => s + safe(e.amount), 0);
    const totalCost = laborCost + expenseCost;
    const revenue = safe(p.contractAmount);
    const profit = revenue - totalCost;
    const rawRate = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitRate = rawRate;
    // ユニーク担当者
    const assignees = Array.from(new Set(p.tasks.map((t) => t.assignee?.displayName).filter(Boolean) as string[]));
    return { ...p, done, total, progress, totalCost, profit, profitRate, assignees };
  });

  const activeCount = projectStats.filter((p) => !["completed", "cancelled", "draft"].includes(p.status)).length;
  const totalRevenue = projectStats.reduce((s, p) => s + p.contractAmount, 0);
  const totalProfit = projectStats.reduce((s, p) => s + p.profit, 0);
  const avgProfitRate = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  // 新しい見た目（UI 品質の直し）。偽のときは下の今までの画面のまま（チェックリスト §5.1）
  return <ProjectsNext canWrite={canWritePromaneWorkspace(workspace.members[0]?.role)} workspaceSlug={workspaceSlug} rows={projectStats} activeCount={activeCount} totalRevenue={totalRevenue} avgProfitRate={avgProfitRate} />;
}
