export function formatCurrency(amount: number | null | undefined): string {
  const v = (amount == null || !Number.isFinite(amount)) ? 0 : amount;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatPercent(value: number | null | undefined): string {
  const v = (value == null || !Number.isFinite(value)) ? 0 : value;
  return `${Math.round(v * 10) / 10}%`;
}

export function formatDuration(minutes: number | null | undefined): string {
  const v = (minutes == null || !Number.isFinite(minutes) || minutes < 0) ? 0 : minutes;
  const h = Math.floor(v / 60);
  const m = v % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  quoting: "見積中",
  ordered: "受注",
  in_progress: "進行中",
  delivered: "納品",
  invoiced: "請求済",
  completed: "完了",
  cancelled: "中止",
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-200 text-gray-800",
  quoting: "bg-yellow-100 text-yellow-800",
  ordered: "bg-blue-100 text-blue-800",
  in_progress: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  invoiced: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "未着手",
  in_progress: "進行中",
  review: "レビュー",
  done: "完了",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "🐢 のんびり",
  medium: "🚶 ふつう",
  high: "🏃 いそぎ",
  urgent: "🔥 超キンキュウ！",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-sky-100 text-sky-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-200 text-red-800 animate-shake",
};

export const BILLING_TYPE_LABELS: Record<string, string> = {
  fixed: "一括",
  monthly: "月額",
  hourly: "時間単価",
  milestone: "マイルストーン",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  outsource: "外注費",
  travel: "交通費",
  material: "資材費",
  license: "ライセンス",
  other: "その他",
};
