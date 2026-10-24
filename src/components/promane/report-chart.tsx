"use client";

import { GroupedColumnChart } from "@/components/ds/charts";

type ChartData = { name: string; revenue: number; cost: number; profit: number };


const yen = (n: number) => `${n < 0 ? "−" : ""}¥${Math.abs(Math.round(n)).toLocaleString("ja-JP")}`;

export function ReportChart({ data }: { data: ChartData[] }) {
  if (data.length === 0) return null;

  // 新しい見た目: 共通の GroupedColumnChart。系列は凡例の文字でも区別し、赤字は 0 の線の下へ伸びる
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 sm:p-6 overflow-hidden">
      <h3 className="text-base font-bold text-slate-900 mb-4">プロジェクト別の売上・原価・利益</h3>
      <GroupedColumnChart
        label="プロジェクト別の売上・原価・利益"
        height={280}
        labels={data.map((d) => d.name)}
        format={yen}
        series={[
          { name: "売上", values: data.map((d) => d.revenue), tone: "blue" },
          { name: "原価", values: data.map((d) => d.cost), tone: "yellow" },
          { name: "利益", values: data.map((d) => d.profit), tone: "good" },
        ]}
      />
    </div>
  );
}
