// ============================================
// 帯の下に1行で出す「このツールでできること」（画面に依らない純粋な部品）
// ============================================
// 帯がある画面では、ツールの「できること」をカードの知らせにせず、帯の下の小さな1行にする
// （2026-10-27 統括の決定・案 a。375px でカードが帯のボタンに重なっていたため）
import { ALL_SHELL_TOOLS, type ShellTool } from '@/components/shell/tools'
import { getServiceById } from '@/lib/services'

export function toolForPath(pathname: string): ShellTool | undefined {
  return ALL_SHELL_TOOLS.find((t) => {
    if (t.id === 'home') return false
    const base = t.href.split('?')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/** その画面のツールでいちばん大きくできること（services.ts の features の1つ目）。分からなければ '' */
export function toolIntroLine(pathname: string): string {
  const tool = toolForPath(pathname)
  if (!tool) return ''
  return getServiceById(tool.id)?.features?.[0] ?? ''
}
