'use client'
// ============================================
// 新しい見た目かどうかを、クライアントの部品に伝える
// ============================================
// 判定はサーバー（src/lib/ui-next.ts の uiNextMode()）。src/app/(shell)/layout.tsx が値を渡す。
// ⚠️ ここでは cookie を読まない。サーバーが決めた値を使うだけ。
import { createContext, useCallback, useContext } from 'react'
import type { UiNextMode } from '@/lib/ui-next'

export const UiNextContext = createContext<UiNextMode>(null)

/** 新しい見た目（UI 品質の直し）を出すか */
export function useUiNext(): boolean {
  return useContext(UiNextContext) !== null
}

export function useUiNextMode(): UiNextMode {
  return useContext(UiNextContext)
}

/**
 * 組織を選ぶツール（shodan・aio・sfa）の、リンクの行き先（ツールの id → 組織のページ）。
 * サーバー（src/lib/shell/tool-hrefs.server.ts）が決めて渡す。無いツールは入口のまま。新しい見た目のときだけ中身がある。
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
