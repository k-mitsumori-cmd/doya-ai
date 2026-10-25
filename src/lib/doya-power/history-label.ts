// ドヤパワーの内訳・履歴に出す名前（読むだけ。画面とテストで使う）
// ⚠️ 操作の名前は costs.ts の表と同じもの。表に足したら、ここにも名前を足す（無ければ「そのほかの操作」）
import type { HistoryEntry } from './ledger'
import type { GrantKind } from './rules'

/** 操作の名前（operationId の1つ目の欄）→ 画面の名前 */
export const ACTION_LABELS: Record<string, string> = {
  'text.generate': '文章の生成',
  'banner.generate': 'バナーの生成',
  'image.refine': '画像の修正',
  'tenjikai.image': '展示会の画像',
  'transcribe.hour': '文字起こし',
  'interview.article': 'インタビューの記事化',
  'slide.generate': 'スライドの生成',
  'seo.article': 'SEO 記事の作成',
  'persona.generate': 'ペルソナの生成',
  'voice.minute': '音声の AI商談・AI面接',
  'aio.scan.question': 'AI検索対策の調査',
  'agent.plan': 'ドヤくんの作戦づくり',
}

/** 付与の種類 → 画面の名前（内訳と履歴で同じ名前を使う） */
export const KIND_LABELS: Record<GrantKind, string> = {
  monthly: '毎月の付与',
  daily_recovery: '毎日の回復',
  bonus: 'ボーナス',
  mission: 'ミッションの達成',
  purchase: '追加の購入',
  starter: 'はじめの付与',
}

export function actionLabel(action: string | null): string {
  return (action && ACTION_LABELS[action]) || 'そのほかの操作'
}

/** 履歴の1行の名前 */
export function historyLabel(e: Pick<HistoryEntry, 'type' | 'action' | 'kind'>): string {
  if (e.type === 'consume') return actionLabel(e.action)
  if (e.type === 'refund') return `${actionLabel(e.action)}（失敗したので戻した分）`
  if (e.type === 'expire') return '期限切れ'
  return (e.kind && (KIND_LABELS as Record<string, string>)[e.kind]) || '付与'
}
