import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind CSSクラス名をマージするユーティリティ
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 日付を相対的なフォーマットで表示
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  if (hours < 24) return `${hours}時間前`
  if (days < 7) return `${days}日前`
  
  return date.toLocaleDateString('ja-JP', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 数値を日本語フォーマット（カンマ区切り）
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ja-JP').format(num)
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * ランダムなIDを生成
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * 遅延実行
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * カラーコードからRGB値を取得
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * 明度を判定（テキストカラー決定用）
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return true
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > 155
}

