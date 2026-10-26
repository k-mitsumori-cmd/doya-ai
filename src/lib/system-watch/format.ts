// 通知の文面を組み立てる（純粋関数）。「読み込めませんでした」だけで終わらせず、
// どこが（画面・API・URL）、どう（状態コード・エラーの要約）、いつから・何回、どう直すか、を書く。
import type { WatchEvent } from './types'

function jst(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(iso))
}

function minutesBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000))
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `約${minutes}分`
  const h = Math.floor(minutes / 60)
  return minutes % 60 ? `約${h}時間${minutes % 60}分` : `約${h}時間`
}

const REASON_LABEL = { new: '新しい失敗', repeat: '続いている失敗', changed: '失敗の中身が変わりました' } as const

export function formatFailures(events: Extract<WatchEvent, { type: 'failure' }>[], now: string): { title: string; text: string } {
  const title = events.length === 1
    ? `${events[0].result.area}「${events[0].result.label}」の確認に失敗しました`
    : `定期確認で${events.length}件の失敗があります（${[...new Set(events.map(e => e.result.area))].join('・')}）`
  const blocks = events.map(({ result: r, state, reason }) => {
    const lines = [
      `■ ${r.area}：${r.label}（${REASON_LABEL[reason]}）`,
      r.url ? `- 確認した URL: ${r.url}` : '',
      `- 状態コード: ${r.status !== undefined ? `HTTP ${r.status}` : 'なし'}`,
      `- エラー: ${r.error ?? '（要約なし）'}`,
      r.detail ? `- 補足: ${r.detail}` : '',
      `- 最初の失敗: ${jst(state.since)}（${durationLabel(minutesBetween(state.since, now))}前から、${state.failCount}回続けて失敗）`,
      r.hints.length ? `- 直し方の候補:\n${r.hints.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}` : '',
    ]
    return lines.filter(Boolean).join('\n')
  })
  const text = [`発生時刻：${jst(now)}（日本時間）`, ...blocks, '同じ失敗は間を空けて（ふだんは6時間ごと）知らせ直します。直ったら「直りました」を送ります。'].join('\n\n')
  return { title, text }
}

export function formatRecoveries(events: Extract<WatchEvent, { type: 'recovery' }>[], now: string): { title: string; text: string } {
  const title = events.length === 1 ? `${events[0].result.area}「${events[0].result.label}」が直りました` : `${events.length}件の確認が直りました`
  const lines = events.map(e => `■ ${e.result.area}：${e.result.label}\n- 止まっていた時間: ${jst(e.downSince)} から ${durationLabel(minutesBetween(e.downSince, now))}（失敗 ${e.failCount}回）${e.result.url ? `\n- 確認した URL: ${e.result.url}` : ''}${e.result.detail ? `\n- 今の状態: ${e.result.detail}` : ''}`)
  return { title, text: [`確認した時刻：${jst(now)}（日本時間）`, ...lines].join('\n\n') }
}

export function formatObservedChanges(events: Extract<WatchEvent, { type: 'observed-change' }>[], now: string): { title: string; text: string } {
  const title = `設定の値が${events.length}件変わりました`
  const lines = events.map(e => `■ ${e.result.label}\n- 前: ${e.before ?? '（記録なし）'}\n- 今: ${e.result.observed}`)
  return { title, text: [`確認した時刻：${jst(now)}（日本時間）`, ...lines, '意図した変更なら対応は要りません。'].join('\n\n') }
}
