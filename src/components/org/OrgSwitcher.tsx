'use client'

// ============================================
// 組織切替（組織スコープ型サービス共通）
// ============================================
// ⚠️ これが無いと、他組織に招待されて受諾した利用者が
//    自分の組織へ戻れなくなる（2026-08-10 のレビューで発覚）。
//
// ⚠️ 選択は localStorage に持ち、以降のAPI呼び出しに ?org= を付ける。
//    PDFやZIPの取得は素の <a> なのでヘッダを送れない。
//    クエリなら <a href> にも載せられるため、クエリで統一する。

import { useCallback, useEffect, useState } from 'react'

export interface Membership {
  slug: string
  name: string
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
}

/** 選択中の組織slugを保存するキー */
export function orgStorageKey(service: string): string {
  return `doya.${service}.org`
}

const selectionOverride = new Map<string, string | null>()

/** 選択中の組織slug（未選択なら null） */
export function getSelectedOrg(service: string): string | null {
  if (typeof window === 'undefined') return null
  const key = orgStorageKey(service)
  if (selectionOverride.has(key)) return selectionOverride.get(key) || null
  try {
    return window.localStorage.getItem(key) || null
  } catch {
    return null
  }
}

export function clearSelectedOrg(service: string): void {
  if (typeof window === 'undefined') return
  const key = orgStorageKey(service)
  try {
    window.localStorage.removeItem(key)
    selectionOverride.delete(key)
  } catch {
    selectionOverride.set(key, null)
  }
}

/** 所属組織一覧で確認できない端末保存の選択を破棄する。 */
export function reconcileSelectedOrg(service: string, memberships: Membership[]): string | null {
  const selected = getSelectedOrg(service)
  if (!selected) return null
  if (memberships.some((member) => member.slug === selected)) return selected
  clearSelectedOrg(service)
  return null
}

/** 詳細画面を直接開いた場合も、端末に残る組織が現在の所属先か確認する。 */
export async function ensureSelectedOrg(service: 'quote' | 'aishodan'): Promise<void> {
  if (!getSelectedOrg(service)) return
  const response = await fetch(`/api/${service}/organizations`)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : '組織一覧を取得できませんでした')
  }
  if (!Array.isArray(data?.memberships) || !data.memberships.every((member: unknown) =>
    member !== null && typeof member === 'object' && typeof (member as Membership).slug === 'string')) {
    throw new Error('組織一覧を確認できませんでした')
  }
  reconcileSelectedOrg(service, data.memberships)
}

/**
 * APIのURLに ?org= を付ける。
 * ⚠️ 全てのAPI呼び出しとダウンロードリンクでこれを通すこと。
 *    片方でも素通しすると、そこだけ別の組織を見て挙動が食い違う。
 */
export function withOrg(service: string, url: string): string {
  const org = getSelectedOrg(service)
  if (!org) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}org=${encodeURIComponent(org)}`
}

export interface OrgSwitcherProps {
  /** 'quote' / 'aishodan' */
  service: string
  memberships: Membership[]
  currentSlug: string | null
  /** 切替後に呼ばれる（呼び出し側で再読み込みする） */
  onChange: () => void
}

export default function OrgSwitcher({ service, memberships, currentSlug, onChange }: OrgSwitcherProps) {
  const [value, setValue] = useState(currentSlug ?? '')

  useEffect(() => {
    setValue(currentSlug ?? '')
  }, [currentSlug])

  const change = useCallback(
    (slug: string) => {
      setValue(slug)
      const key = orgStorageKey(service)
      try {
        window.localStorage.setItem(key, slug)
        selectionOverride.delete(key)
      } catch {
        // プライベートモード等で保存できなくても、この場の切替は成立させる。
        selectionOverride.set(key, slug)
      }
      onChange()
    },
    [onChange, service]
  )

  // 1つしか所属していないなら出さない（迷わせない）
  if (memberships.length <= 1) return null

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      組織
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:border-[#0066ff] focus:outline-none"
      >
        {memberships.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name}（{ROLE_LABEL[m.role] || m.role}）
          </option>
        ))}
      </select>
    </label>
  )
}
