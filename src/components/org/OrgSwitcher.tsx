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

/** 選択中の組織slug（未選択なら null） */
export function getSelectedOrg(service: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(orgStorageKey(service)) || null
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
      try {
        window.localStorage.setItem(orgStorageKey(service), slug)
      } catch {
        // プライベートモード等で保存できなくても、この場の切替は成立させる
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
