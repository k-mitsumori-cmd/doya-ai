import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, formatCurrencyWithSign, formatPercent, profitEmoji, profitLabel, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, BILLING_TYPE_LABELS } from "@/lib/promane/format";
import { Badge } from "@/components/promane/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/promane/ui/tabs";
import { KanbanBoard } from "@/components/promane/kanban-board";
import { GanttChart } from "@/components/promane/gantt-chart";
import { TaskCreateForm } from "@/components/promane/task-create-form";
import { FinanceTab } from "@/components/promane/finance-tab";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/promane/ui/button";
import { Progress } from "@/components/promane/ui/progress";
import { CharacterOnly } from "@/components/promane/character";
import { ProjectDeleteButton } from "@/components/promane/project-delete-button";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const session = await requirePromaneAuth();
  const { workspaceSlug, projectId } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/promane");

  // IDOR防止: workspaceId も where条件に追加 (他WSの project は見せない)
  const project = await prisma.promaneProject.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: {
      client: true,
      tasks: {
        include: { assignee: true, timeEntries: true },
        orderBy: { order: "asc" },
      },
      expenses: { orderBy: { date: "desc" } },
    },
  });

  if (!project) redirect(`/promane/${workspaceSlug}/projects`);

  const members = await prisma.promaneMember.findMany({
    where: { workspaceId: workspace.id },
    include: { timeEntries: { where: { taskId: { in: project.tasks.map((t) => t.id) } } } },
  });

  let laborCost = 0;
  let totalMinutes = 0;
  members.forEach((member) => {
    const minutes = member.timeEntries.reduce((sum, te) => sum + te.duration, 0);
    totalMinutes += minutes;
    laborCost += (minutes / 60) * member.hourlyRate;
  });
  const expenseCost = project.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCost = laborCost + expenseCost;
  const profit = project.contractAmount - totalCost;
  const profitRate = project.contractAmount > 0 ? (profit / project.contractAmount) * 100 : 0;
  const doneTasks = project.tasks.filter((t) => t.status === "done").length;
  const progress = project.tasks.length > 0 ? Math.round((doneTasks / project.tasks.length) * 100) : 0;

  const kpis = [
    { icon: "/character/present.png", label: "売上", value: formatCurrency(project.contractAmount), bg: "bg-gradient-to-br from-blue-50 to-indigo-50 ring-blue-200/50", text: "text-blue-700" },
    { icon: "/character/working.png", label: "原価", value: formatCurrency(totalCost), bg: "bg-gradient-to-br from-orange-50 to-amber-50 ring-orange-200/50", text: "text-orange-700" },
    {
      icon: profit > 0 ? "/character/success.png" : profit < 0 ? "/character/error.png" : "/character/working.png",
      label: `利益 (${profitLabel(profit)})`,
      value: `${profitEmoji(profit)} ${formatCurrencyWithSign(profit)}`,
      bg: profit > 0
        ? "bg-gradient-to-br from-emerald-100 to-green-100 ring-emerald-300/60"
        : profit < 0
          ? "bg-gradient-to-br from-rose-100 to-red-100 ring-rose-300/60"
          : "bg-gradient-to-br from-gray-100 to-slate-100 ring-gray-200/60",
      text: profit > 0 ? "text-emerald-700" : profit < 0 ? "text-rose-700" : "text-gray-600",
    },
    {
      icon: profit > 0 ? "/character/jump.png" : profit < 0 ? "/character/error.png" : "/character/working.png",
      label: `利益率 (${profitLabel(profit)})`,
      value: project.contractAmount > 0 ? `${profitEmoji(profit)} ${formatPercent(profitRate)}` : "—",
      bg: profit > 0
        ? "bg-gradient-to-br from-emerald-100 to-green-100 ring-emerald-300/60"
        : profit < 0
          ? "bg-gradient-to-br from-rose-100 to-red-100 ring-rose-300/60"
          : "bg-gradient-to-br from-gray-100 to-slate-100 ring-gray-200/60",
      text: profit > 0 ? "text-emerald-700" : profit < 0 ? "text-rose-700" : "text-gray-600",
    },
  ];

  const moodForProgress = progress >= 80 ? "jump" : progress >= 50 ? "thumbsup" : progress >= 20 ? "working" : "thinking";

  return (
    <div className="p-8 max-w-[1200px] space-y-6">
      {/* パンくず + ヘッダー */}
      <div className="animate-slide-up">
        <Link href={`/promane/${workspaceSlug}/projects`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-400 hover:text-blue-600 transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          プロジェクト一覧
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <CharacterOnly mood={moodForProgress} size={48} animate="bounce-in" />
              <h1 className="text-[26px] font-extrabold tracking-tight text-gray-900">{project.name}</h1>
              <Badge variant="secondary" className={`${PROJECT_STATUS_COLORS[project.status]} font-bold text-[12px] rounded-full px-3 py-1`}>
                {PROJECT_STATUS_LABELS[project.status]}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 text-[14px] text-gray-400 font-medium ml-12">
              {project.client && <span>👤 {project.client.name}</span>}
              <span>💳 {BILLING_TYPE_LABELS[project.billingType]} {formatCurrency(project.contractAmount)}</span>
              {project.endDate && <span>📅 納期 {new Date(project.endDate).toLocaleDateString("ja-JP")}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/promane/${workspaceSlug}/projects/${projectId}/edit`}>
              <Button variant="outline" className="rounded-2xl font-bold text-[14px] h-10 px-4">
                <Pencil className="mr-1.5 h-4 w-4" />
                編集
              </Button>
            </Link>
            <ProjectDeleteButton workspaceSlug={workspaceSlug} projectId={projectId} projectName={project.name} />
          </div>
        </div>
      </div>

      {/* KPI + 進捗バー */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5 animate-slide-up stagger-2">
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className={`rounded-3xl ${kpi.bg} ring-1 p-4 transition-all hover:scale-105 hover:shadow-lg cursor-default`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[12px] font-bold ${kpi.text}`}>{kpi.label}</span>
              <Image src={kpi.icon} alt="" width={30} height={30} className="animate-float drop-shadow-sm" unoptimized />
            </div>
            <p className={`text-[22px] font-extrabold ${kpi.text} leading-none`}>{kpi.value}</p>
          </div>
        ))}
        <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50 ring-1 ring-purple-200/50 p-4 transition-all hover:scale-105 hover:shadow-lg cursor-default">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-purple-700">進捗</span>
            <CharacterOnly mood={moodForProgress} size={30} animate="float" />
          </div>
          <p className="text-[22px] font-extrabold text-purple-700 leading-none mb-2">{progress}%</p>
          <Progress value={progress} className="h-2.5" />
          <p className="text-[11px] font-semibold text-purple-400 mt-1.5">{doneTasks} / {project.tasks.length} タスク完了</p>
        </div>
      </div>

      {/* タブ */}
      <Tabs defaultValue="gantt">
        <TabsList className="rounded-2xl bg-gray-100 p-1.5 h-auto">
          <TabsTrigger value="gantt" className="rounded-xl font-bold text-[14px] px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📊 ガントチャート
          </TabsTrigger>
          <TabsTrigger value="kanban" className="rounded-xl font-bold text-[14px] px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            📋 カンバン
          </TabsTrigger>
          <TabsTrigger value="finance" className="rounded-xl font-bold text-[14px] px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            💰 収支詳細
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-5 space-y-4">
          <TaskCreateForm
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          />
          <GanttChart
            tasks={project.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assigneeId: t.assigneeId,
              assigneeName: t.assignee?.displayName || null,
              startDate: t.startDate?.toISOString() || null,
              dueDate: t.dueDate?.toISOString() || null,
            }))}
            workspaceSlug={workspaceSlug}
            projectStartDate={project.startDate?.toISOString() || null}
            projectEndDate={project.endDate?.toISOString() || null}
            members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-5 space-y-4">
          <TaskCreateForm
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          />
          <KanbanBoard
            tasks={project.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              order: t.order,
              assigneeId: t.assigneeId,
              assigneeName: t.assignee?.displayName || null,
              startDate: t.startDate?.toISOString() || null,
              dueDate: t.dueDate?.toISOString() || null,
              totalMinutes: t.timeEntries.reduce((sum, te) => sum + te.duration, 0),
            }))}
            workspaceSlug={workspaceSlug}
            members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
          />
        </TabsContent>

        <TabsContent value="finance" className="mt-5">
          <FinanceTab
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            laborCost={laborCost}
            totalMinutes={totalMinutes}
            expenses={project.expenses.map((e) => ({
              id: e.id,
              category: e.category,
              amount: e.amount,
              description: e.description,
              date: e.date.toISOString(),
            }))}
            members={members.map((m) => ({
              id: m.id,
              displayName: m.displayName,
              hourlyRate: m.hourlyRate,
              minutes: m.timeEntries.reduce((sum, te) => sum + te.duration, 0),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
