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

/**
 * 利益/利益率を黒字/赤字で視覚的に区別するヘルパー
 */
export type ProfitTone = 'positive' | 'negative' | 'zero'

export function profitTone(value: number | null | undefined): ProfitTone {
  const v = (value == null || !Number.isFinite(value)) ? 0 : value
  if (v > 0) return 'positive' // 黒字
  if (v < 0) return 'negative' // 赤字
  return 'zero'
}

export function profitLabel(value: number | null | undefined): string {
  const tone = profitTone(value)
  return tone === 'positive' ? '黒字' : tone === 'negative' ? '赤字' : '±0'
}

export function profitEmoji(value: number | null | undefined): string {
  const tone = profitTone(value)
  return tone === 'positive' ? '📈' : tone === 'negative' ? '📉' : '➖'
}

export function profitColorClass(value: number | null | undefined): {
  text: string; bg: string; ring: string; gradient: string;
} {
  const tone = profitTone(value)
  if (tone === 'negative') return {
    text: 'text-rose-700',
    bg: 'from-rose-100 to-red-100',
    ring: 'ring-rose-300',
    gradient: 'from-rose-500 to-red-500',
  }
  if (tone === 'positive') return {
    text: 'text-emerald-700',
    bg: 'from-emerald-100 to-green-100',
    ring: 'ring-emerald-300',
    gradient: 'from-emerald-500 to-green-500',
  }
  return {
    text: 'text-gray-600',
    bg: 'from-gray-100 to-slate-100',
    ring: 'ring-gray-200',
    gradient: 'from-gray-400 to-slate-400',
  }
}

/** 金額を ¥-12,345 のように負値も表示 */
export function formatCurrencyWithSign(amount: number | null | undefined): string {
  const v = (amount == null || !Number.isFinite(amount)) ? 0 : amount
  if (v < 0) {
    return '-' + new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(-v)
  }
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(v)
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
