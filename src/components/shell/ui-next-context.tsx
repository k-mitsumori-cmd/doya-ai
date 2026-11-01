'use client'
// ============================================
// 新しい見た目と、組織を選ぶツールのリンクの行き先
// ============================================
// 新しい見た目は全員に出し終えた（2026-10-24）。useUiNext() はいつも true。
import { createContext, useCallback, useContext } from 'react'

/** 新しい見た目（UI 品質の直し）を出すか。全員に出し終えたので、いつも true */
export function useUiNext(): boolean {
  return true
}

/**
 * 組織を選ぶツール（shodan・aio・sfa）の、リンクの行き先（ツールの id → 組織のページ）。
 * サーバー（src/lib/shell/tool-hrefs.server.ts）が決めて渡す。無いツールは入口のまま。
 */
export const ShellToolHrefsContext = createContext<Record<string, string>>({})

/** 入口の href を、分かっていれば組織のページに置き換える（/shodan → /shodan/<組織>） */
export function useToolHref(): (href: string) => string {
  const map = useContext(ShellToolHrefsContext)
  return useCallback((href: string) => {
    const m = /^\/([a-z0-9-]+)\/?$/.exec(href)
    return (m && map[m[1]]) || href
  }, [map])
}
