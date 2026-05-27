"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type ChartData = { name: string; revenue: number; cost: number; profit: number };

function formatYen(value: number) {
  if (value >= 10000) return `${Math.round(value / 10000)}万`;
  return `${value}`;
}

export function ReportChart({ data }: { data: ChartData[] }) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 overflow-hidden">
      <h3 className="text-[18px] font-black text-gray-900 mb-5">📊 プロジェクト別 売上・原価・利益</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" fontSize={13} fontWeight={700} tick={{ fill: "#6b7280" }} />
          <YAxis tickFormatter={formatYen} fontSize={12} fontWeight={700} tick={{ fill: "#9ca3af" }} />
          <Tooltip
            formatter={(value) => `¥${Number(value).toLocaleString()}`}
            contentStyle={{ borderRadius: "16px", fontWeight: 700, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          />
          <Legend wrapperStyle={{ fontWeight: 700, fontSize: "14px" }} />
          <Bar dataKey="revenue" name="💰 売上" fill="#6366f1" radius={[8, 8, 0, 0]} />
          <Bar dataKey="cost" name="📊 原価" fill="#f97316" radius={[8, 8, 0, 0]} />
          <Bar dataKey="profit" name="💎 利益" fill="#22c55e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
