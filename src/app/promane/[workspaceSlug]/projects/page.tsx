import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/promane/format";
import { Badge } from "@/components/promane/ui/badge";
import { Button } from "@/components/promane/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Plus, ArrowRight, FolderKanban, Wallet, TrendingUp, CheckCircle2 } from "lucide-react";

export default async function ProjectsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");

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
    include: { timeEntries: { select: { duration: true, taskId: true } } },
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
      const min = m.timeEntries.filter((te) => te.taskId && taskIds.includes(te.taskId)).reduce((s, te) => s + safe(te.duration), 0);
      laborCost += (min / 60) * safe(m.hourlyRate);
    }
    // 経費は負値を 0 にクランプ (会計的に経費マイナスは異常)
    const expenseCost = p.expenses.reduce((s, e) => s + safe(e.amount), 0);
    const totalCost = laborCost + expenseCost;
    const revenue = safe(p.contractAmount);
    const profit = revenue - totalCost;
    // 利益率は -100% 〜 100% でクランプ
    const rawRate = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitRate = Math.min(100, Math.max(-100, rawRate));
    // ユニーク担当者
    const assignees = Array.from(new Set(p.tasks.map((t) => t.assignee?.displayName).filter(Boolean) as string[]));
    return { ...p, done, total, progress, totalCost, profit, profitRate, assignees };
  });

  const activeCount = projectStats.filter((p) => !["completed", "cancelled", "draft"].includes(p.status)).length;
  const totalRevenue = projectStats.reduce((s, p) => s + p.contractAmount, 0);
  const totalProfit = projectStats.reduce((s, p) => s + p.profit, 0);
  const avgProfitRate = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const kpis = [
    { icon: FolderKanban, label: "総プロジェクト", value: `${projects.length}件`, color: "from-blue-500 to-violet-500", bg: "from-blue-50 to-violet-50" },
    { icon: TrendingUp, label: "進行中", value: `${activeCount}件`, color: "from-orange-500 to-amber-500", bg: "from-orange-50 to-amber-50" },
    { icon: Wallet, label: "総売上", value: formatCurrency(totalRevenue), color: "from-emerald-500 to-teal-500", bg: "from-emerald-50 to-teal-50" },
    { icon: CheckCircle2, label: "平均利益率", value: `${avgProfitRate}%`, color: "from-rose-500 to-pink-500", bg: "from-rose-50 to-pink-50" },
  ];

  return (
    <div className="p-8 max-w-[1300px]">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6 animate-slide-up">
        <div className="flex items-center gap-5">
          <Image src="/character/working.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
          <div>
            <h1 className="text-[28px] font-black tracking-tight text-gray-900">プロジェクト一覧</h1>
            <p className="text-[14px] text-gray-400 font-bold">すべてのプロジェクトを一覧で確認</p>
          </div>
        </div>
        <Link href={`/promane/${workspaceSlug}/projects/new`}>
          <Button className="rounded-full h-12 px-6 text-[14px] font-black shadow-lg bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 hover:scale-105 active:scale-95 transition-all">
            <Plus className="mr-2 h-5 w-5" />
            新規プロジェクト
          </Button>
        </Link>
      </div>

      {/* KPI 4枚 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <div key={k.label} className={`rounded-3xl bg-gradient-to-br ${k.bg} ring-1 ring-white/50 p-5 animate-slide-up stagger-${i + 1} shadow-sm hover:shadow-md hover:scale-[1.02] transition-all`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-black text-gray-600">{k.label}</p>
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center text-white shadow-md`}>
                <k.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[24px] font-black text-gray-900 leading-none">{k.value}</p>
          </div>
        ))}
      </div>

      {/* テーブル */}
      {projects.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm py-20 text-center animate-bounce-in">
          <Image src="/character/thinking.png" alt="" width={140} height={140} className="mx-auto animate-float" unoptimized />
          <p className="mt-5 text-[22px] font-black text-gray-400">まだ案件がないよ〜</p>
          <p className="text-[14px] text-gray-300 font-bold mt-1">最初のプロジェクトを作ってみよう！</p>
          <Link href={`/promane/${workspaceSlug}/projects/new`}>
            <Button className="mt-6 rounded-full h-12 px-8 text-[15px] font-black shadow-lg hover:scale-105 transition-all">
              はじめる 🚀
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-[28px] bg-white ring-1 ring-gray-200 shadow-md overflow-hidden animate-slide-up stagger-5">
          {/* テーブルヘッダー */}
          <div className="hidden md:grid grid-cols-12 gap-3 px-6 py-3 bg-gray-50/70 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">プロジェクト</div>
            <div className="col-span-2">ステータス</div>
            <div className="col-span-1 text-center">期日</div>
            <div className="col-span-1 text-right">予算</div>
            <div className="col-span-2 text-center">担当者</div>
            <div className="col-span-2 text-right">利益率</div>
          </div>

          {/* テーブル本体 */}
          <div className="divide-y divide-gray-50">
            {projectStats.map((p, i) => (
              <Link
                key={p.id}
                href={`/promane/${workspaceSlug}/projects/${p.id}`}
                className={`group grid grid-cols-1 md:grid-cols-12 gap-3 items-center px-6 py-4 hover:bg-blue-50/30 transition-all animate-slide-up stagger-${Math.min(i + 1, 5)}`}
              >
                {/* プロジェクト名 */}
                <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Image src="/character/working.png" alt="" width={26} height={26} unoptimized />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate">{p.name}</p>
                    <p className="text-[11px] font-bold text-gray-400 truncate">{p.client?.name || "顧客未設定"}</p>
                  </div>
                </div>

                {/* ステータス */}
                <div className="md:col-span-2">
                  <Badge variant="secondary" className={`${PROJECT_STATUS_COLORS[p.status]} font-black text-[11px] rounded-full px-2.5 py-1`}>
                    {PROJECT_STATUS_LABELS[p.status]}
                  </Badge>
                </div>

                {/* 期日 */}
                <div className="md:col-span-1 text-center">
                  {p.endDate ? (
                    <p className="text-[11px] font-bold text-gray-600">
                      {new Date(p.endDate).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-300">—</p>
                  )}
                </div>

                {/* 予算 */}
                <div className="md:col-span-1 text-right">
                  <p className="text-[13px] font-black text-gray-900">{formatCurrency(p.contractAmount)}</p>
                </div>

                {/* 担当者アバター */}
                <div className="md:col-span-2 flex items-center justify-center -space-x-2">
                  {p.assignees.slice(0, 4).map((name, j) => (
                    <div
                      key={j}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-black ring-2 ring-white shadow-sm"
                      title={name}
                    >
                      {name.charAt(0)}
                    </div>
                  ))}
                  {p.assignees.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-[10px] font-black ring-2 ring-white">
                      +{p.assignees.length - 4}
                    </div>
                  )}
                  {p.assignees.length === 0 && (
                    <span className="text-[10px] text-gray-300 font-bold">未割当</span>
                  )}
                </div>

                {/* 利益率 + バー */}
                <div className="md:col-span-2 flex items-center gap-2 justify-end">
                  <div className="flex-1 max-w-[120px] h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        p.profitRate >= 30 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : p.profitRate >= 10 ? 'bg-gradient-to-r from-blue-400 to-violet-500'
                        : 'bg-gradient-to-r from-rose-400 to-rose-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, p.profitRate))}%` }}
                    />
                  </div>
                  <span className={`text-[12px] font-black w-12 text-right ${
                    p.profitRate >= 30 ? 'text-emerald-600'
                    : p.profitRate >= 10 ? 'text-blue-600'
                    : 'text-rose-600'
                  }`}>
                    {p.contractAmount > 0 ? `${Math.round(p.profitRate)}%` : '—'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          {/* テーブルフッター */}
          <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-[12px] font-bold text-gray-500">
            <span>{projects.length} 件のプロジェクト</span>
            <Link href={`/promane/${workspaceSlug}/projects/new`} className="text-blue-600 hover:underline font-black">
              + 新しく追加
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
