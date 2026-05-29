import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatCurrency, formatCurrencyWithSign, formatPercent, formatDuration, profitEmoji, profitColorClass, PROJECT_STATUS_LABELS } from "@/lib/promane/format";
import { ReportChart } from "@/components/promane/report-chart";
import Image from "next/image";

export default async function ReportsPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const session = await requirePromaneAuth();
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) redirect("/login");

  const projects = await prisma.promaneProject.findMany({
    where: { workspaceId: workspace.id },
    include: { client: true, tasks: { select: { id: true, status: true } }, expenses: true },
  });
  const members = await prisma.promaneMember.findMany({
    where: { workspaceId: workspace.id },
    include: { timeEntries: true },
  });

  // 安全な数値正規化 (負値/NaN を 0 にクランプ)
  const safe = (n: number | null | undefined) => (n == null || !Number.isFinite(n)) ? 0 : Math.max(0, n);

  const projectReports = projects.map((project) => {
    const taskIds = project.tasks.map((t) => t.id);
    let laborCost = 0;
    let totalMinutes = 0;
    members.forEach((member) => {
      const minutes = member.timeEntries.filter((te) => te.taskId && taskIds.includes(te.taskId)).reduce((sum, te) => sum + safe(te.duration), 0);
      totalMinutes += minutes;
      laborCost += (minutes / 60) * safe(member.hourlyRate);
    });
    // 経費の負値を 0 にクランプ (会計的に経費マイナスは異常)
    const expenseCost = project.expenses.reduce((sum, e) => sum + safe(e.amount), 0);
    const totalCost = laborCost + expenseCost;
    const revenue = safe(project.contractAmount);
    const profit = revenue - totalCost;
    // 利益率を -100% 〜 100% でクランプ
    const rawRate = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitRate = Math.min(100, Math.max(-100, rawRate));
    return {
      name: project.name, clientName: project.client?.name || "—", status: project.status,
      revenue, laborCost: Math.round(laborCost), expenseCost,
      totalCost: Math.round(totalCost), profit: Math.round(profit), profitRate, totalMinutes,
    };
  });

  const clientSummary = new Map<string, { revenue: number; cost: number; projects: number }>();
  projectReports.forEach((pr) => {
    const existing = clientSummary.get(pr.clientName) || { revenue: 0, cost: 0, projects: 0 };
    clientSummary.set(pr.clientName, { revenue: existing.revenue + pr.revenue, cost: existing.cost + pr.totalCost, projects: existing.projects + 1 });
  });

  const chartData = projectReports.map((pr) => ({
    name: pr.name.length > 10 ? pr.name.slice(0, 10) + "…" : pr.name,
    revenue: pr.revenue, cost: pr.totalCost, profit: pr.profit,
  }));

  return (
    <div className="p-8 max-w-[1200px] space-y-8">
      <div className="flex items-center gap-5 animate-slide-up">
        <Image src="/character/present.png" alt="" width={80} height={80} className="animate-bounce-in drop-shadow-xl" unoptimized />
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-gray-900">レポート</h1>
          <p className="text-[15px] text-gray-400 font-bold">数字で振り返ろう 📊</p>
        </div>
      </div>

      {projectReports.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm py-24 text-center animate-bounce-in">
          <Image src="/character/thinking.png" alt="" width={120} height={120} className="mx-auto animate-float" unoptimized />
          <p className="mt-4 text-[20px] font-black text-gray-400">レポートデータがないよ</p>
          <p className="text-[15px] text-gray-300 font-bold mt-1">プロジェクトを作成すると表示されるよ！</p>
        </div>
      ) : (
        <>
          <div className="animate-slide-up stagger-1">
            <ReportChart data={chartData} />
          </div>

          <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm overflow-hidden animate-slide-up stagger-2">
            <div className="flex items-center gap-2.5 px-7 py-5 border-b border-gray-100">
              <Image src="/character/point.png" alt="" width={28} height={28} unoptimized />
              <h2 className="text-[18px] font-black text-gray-900">プロジェクト別収支</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-4 text-[12px] font-black text-gray-400 uppercase">案件名</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase">顧客</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">売上</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">人件費</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">経費</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">利益</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">利益率</th>
                    <th className="px-6 py-4 text-[12px] font-black text-gray-400 uppercase text-right">稼働</th>
                  </tr>
                </thead>
                <tbody>
                  {projectReports.map((pr) => (
                    <tr key={pr.name} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4 text-[15px] font-black text-gray-900">{pr.name}</td>
                      <td className="px-4 py-4 text-[14px] font-bold text-gray-500">{pr.clientName}</td>
                      <td className="px-4 py-4 text-right text-[15px] font-black text-gray-900">{formatCurrency(pr.revenue)}</td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-gray-600">{formatCurrency(pr.laborCost)}</td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-gray-600">{formatCurrency(pr.expenseCost)}</td>
                      <td className={`px-4 py-4 text-right text-[15px] font-black ${
                        pr.profit > 0 ? "text-emerald-600"
                        : pr.profit < 0 ? "text-rose-600"
                        : "text-gray-500"
                      }`}>
                        {profitEmoji(pr.profit)} {formatCurrencyWithSign(pr.profit)}
                      </td>
                      <td className={`px-4 py-4 text-right text-[15px] font-black ${
                        pr.profit > 0 ? "text-emerald-600"
                        : pr.profit < 0 ? "text-rose-600"
                        : "text-gray-500"
                      }`}>
                        {pr.revenue > 0 ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full ${
                            pr.profit > 0 ? "bg-emerald-100" : pr.profit < 0 ? "bg-rose-100" : "bg-gray-100"
                          }`}>
                            {pr.profit > 0 ? "黒字" : pr.profit < 0 ? "赤字" : "±0"} {formatPercent(pr.profitRate)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right text-[14px] font-bold text-gray-500">{formatDuration(pr.totalMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm overflow-hidden animate-slide-up stagger-3">
            <div className="flex items-center gap-2.5 px-7 py-5 border-b border-gray-100">
              <span className="text-xl">🏢</span>
              <h2 className="text-[18px] font-black text-gray-900">顧客別集計</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-4 text-[12px] font-black text-gray-400 uppercase">顧客名</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">案件数</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">売上合計</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">原価合計</th>
                    <th className="px-4 py-4 text-[12px] font-black text-gray-400 uppercase text-right">利益</th>
                    <th className="px-6 py-4 text-[12px] font-black text-gray-400 uppercase text-right">利益率</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(clientSummary.entries()).map(([name, data]) => {
                    const profit = data.revenue - data.cost;
                    const rate = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
                    return (
                      <tr key={name} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                        <td className="px-6 py-4 text-[15px] font-black text-gray-900">{name}</td>
                        <td className="px-4 py-4 text-right text-[15px] font-black text-gray-700">{data.projects}</td>
                        <td className="px-4 py-4 text-right text-[15px] font-black text-gray-900">{formatCurrency(data.revenue)}</td>
                        <td className="px-4 py-4 text-right text-[14px] font-bold text-gray-600">{formatCurrency(data.cost)}</td>
                        <td className={`px-4 py-4 text-right text-[15px] font-black ${
                          profit > 0 ? "text-emerald-600"
                          : profit < 0 ? "text-rose-600"
                          : "text-gray-500"
                        }`}>
                          {profitEmoji(profit)} {formatCurrencyWithSign(profit)}
                        </td>
                        <td className={`px-6 py-4 text-right text-[15px] font-black ${
                          profit > 0 ? "text-emerald-600"
                          : profit < 0 ? "text-rose-600"
                          : "text-gray-500"
                        }`}>
                          {data.revenue > 0 ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full ${
                              profit > 0 ? "bg-emerald-100" : profit < 0 ? "bg-rose-100" : "bg-gray-100"
                            }`}>
                              {profit > 0 ? "黒字" : profit < 0 ? "赤字" : "±0"} {formatPercent(rate)}
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
