// ============================================
// 製品の設定（サーバーだけ。Prisma で読む・書く）
// ============================================
// 設計: docs/design/buddy-products-2026-11-01.md §5・§6
// 読む口: getMemberProducts(userId) → MemberProducts（枠の layout が、最初に開く製品と切り替えの並びに使う）
// 書く口: setCompanyProducts / setMemberProducts（管理者以上。/api/company/products・/api/company/members/[id]/products）
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT か COMPANY_ROLES_ROLLOUT が off、会社に入っていない、表が読めない、のどれでも
//    NO_MEMBER_PRODUCTS（全部を使い、決まりは無い）を返す。表が本番に無いあいだも、画面は段1と同じに動く。
// ⚠️ 製品は見え方だけ。ここの結果をツールの権限の判定に使わない。
import { prisma } from '@/lib/prisma'
import { companyRoleForSession } from '@/lib/company-roles/access.server'
import type { CompanyRolesSession } from '@/lib/company-roles/members.server'
import { hasMinCompanyRole, isMemberRowRole } from '@/lib/company-roles/roles'
import { companyRolesRollout } from '@/lib/company-roles/rollout'
import { productHubsRollout } from './flag'
import {
  NO_MEMBER_PRODUCTS, decideCompanyProductsUpdate, decideMemberProductsUpdate, enabledProductsFrom, memberProductsFor,
  type CompanyProductsDecision, type MemberProducts, type MemberProductsDecision,
} from './settings'
import { PRODUCT_IDS, type ProductId } from '@/lib/products'

const settingsOn = () => productHubsRollout() !== 'off' && companyRolesRollout() !== 'off'

/** 会社が使う製品（行が無ければ全部） */
export async function getCompanyEnabledProducts(companyId: string): Promise<ProductId[]> {
  const rows = await prisma.accountCompanyProduct.findMany({ where: { companyId }, select: { productId: true, enabled: true } })
  return enabledProductsFrom(rows)
}

/** 今の人の製品（画面に渡す形） */
export async function getMemberProducts(userId: string, email?: string | null): Promise<MemberProducts> {
  if (!settingsOn() || !userId) return NO_MEMBER_PRODUCTS
  try {
    const ctx = await companyRoleForSession({ userId, email })
    if (!ctx) return NO_MEMBER_PRODUCTS
    const [enabled, row] = await Promise.all([
      getCompanyEnabledProducts(ctx.companyId),
      prisma.accountCompanyMemberProduct.findUnique({
        where: { companyId_userId: { companyId: ctx.companyId, userId } },
        select: { products: true, defaultProduct: true },
      }),
    ])
    return memberProductsFor({ role: ctx.role, row, enabled })
  } catch {
    console.error('[products] 製品の設定を読めませんでした')
    return NO_MEMBER_PRODUCTS
  }
}

/** 会社のメンバー全員の担当と既定（設定の画面用。userId → 値） */
export async function listCompanyMemberProducts(s: CompanyRolesSession): Promise<Record<string, { products: ProductId[]; defaultProduct: ProductId | null }>> {
  const rows = await prisma.accountCompanyMemberProduct.findMany({ where: { companyId: s.companyId }, select: { userId: true, products: true, defaultProduct: true } })
  return Object.fromEntries(rows.map((r) => {
    const v = memberProductsFor({ role: null, row: r, enabled: [...PRODUCT_IDS] })
    return [r.userId, { products: v.assigned, defaultProduct: v.adminDefault }]
  }))
}

/** 操作する人が、いまも管理者以上か（トランザクションの中で読み直す。役割の変更と同じ決まり） */
async function stillAdmin(tx: Pick<typeof prisma, 'accountCompanyMember'>, s: CompanyRolesSession, ownerUserId: string): Promise<boolean> {
  if (ownerUserId === s.userId) return true
  const me = await tx.accountCompanyMember.findFirst({ where: { companyId: s.companyId, userId: s.userId, status: 'active' }, select: { role: true } })
  return Boolean(me && hasMinCompanyRole(isMemberRowRole(me.role) ? me.role : 'guest', 'admin'))
}

/** 会社が使う製品を決める（管理者以上） */
export async function setCompanyProducts(s: CompanyRolesSession, raw: unknown): Promise<CompanyProductsDecision | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_FOUND' }> {
  if (!hasMinCompanyRole(s.role, 'admin')) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const d = decideCompanyProductsUpdate(raw)
  if (!d.ok) return d
  const company = await prisma.accountCompany.findUnique({ where: { id: s.companyId }, select: { userId: true } })
  if (!company) return { ok: false, status: 404, code: 'NOT_FOUND' }
  const denied = await prisma.$transaction(async (tx) => {
    if (!(await stillAdmin(tx, s, company.userId))) return true
    for (const productId of PRODUCT_IDS) {
      const enabled = d.enabled.includes(productId)
      await tx.accountCompanyProduct.upsert({
        where: { companyId_productId: { companyId: s.companyId, productId } },
        create: { companyId: s.companyId, productId, enabled, updatedBy: s.userId },
        update: { enabled, updatedBy: s.userId },
      })
    }
    return false
  })
  if (denied) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  return d
}

/** メンバーの担当と既定を決める（管理者以上）。memberId は account_company_members の id。持ち主は 'owner' */
export async function setMemberProducts(s: CompanyRolesSession, memberId: string, raw: unknown): Promise<MemberProductsDecision | { ok: false; status: number; code: 'NOT_ALLOWED' | 'NOT_FOUND' }> {
  if (!hasMinCompanyRole(s.role, 'admin')) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  const d = decideMemberProductsUpdate(raw)
  if (!d.ok) return d
  const company = await prisma.accountCompany.findUnique({ where: { id: s.companyId }, select: { userId: true } })
  if (!company) return { ok: false, status: 404, code: 'NOT_FOUND' }
  let targetUserId: string
  if (memberId === 'owner') {
    targetUserId = company.userId
  } else {
    // 他社のメンバーは引けない（id と会社の二重条件）。参加前の人（userId が無い）は決められない
    const m = await prisma.accountCompanyMember.findFirst({ where: { id: memberId, companyId: s.companyId, status: 'active' }, select: { userId: true } })
    if (!m?.userId) return { ok: false, status: 404, code: 'NOT_FOUND' }
    targetUserId = m.userId
  }
  const denied = await prisma.$transaction(async (tx) => {
    if (!(await stillAdmin(tx, s, company.userId))) return true
    await tx.accountCompanyMemberProduct.upsert({
      where: { companyId_userId: { companyId: s.companyId, userId: targetUserId } },
      create: { companyId: s.companyId, userId: targetUserId, products: d.products, defaultProduct: d.defaultProduct, updatedBy: s.userId },
      update: { products: d.products, defaultProduct: d.defaultProduct, updatedBy: s.userId },
    })
    return false
  })
  if (denied) return { ok: false, status: 403, code: 'NOT_ALLOWED' }
  return d
}

export interface MemberProductsRow {
  /** account_company_members の id。持ち主は 'owner' */
  memberId: string
  email: string
  name: string | null
  role: string
  isSelf: boolean
  products: ProductId[]
  defaultProduct: ProductId | null
}

/** 設定の画面の表（持ち主を先頭に、参加しているメンバーだけ。招待中の人は参加してから決める） */
export async function listMembersForProducts(s: CompanyRolesSession): Promise<MemberProductsRow[]> {
  const [company, members, values] = await Promise.all([
    prisma.accountCompany.findUnique({ where: { id: s.companyId }, select: { userId: true, user: { select: { email: true, name: true } } } }),
    prisma.accountCompanyMember.findMany({ where: { companyId: s.companyId, status: 'active', userId: { not: null } }, select: { id: true, userId: true, email: true, role: true }, orderBy: { joinedAt: 'asc' } }),
    listCompanyMemberProducts(s),
  ])
  if (!company) return []
  const users = await prisma.user.findMany({ where: { id: { in: members.map((m) => m.userId as string) } }, select: { id: true, name: true } })
  const names = new Map(users.map((u) => [u.id, u.name]))
  const empty = { products: [] as ProductId[], defaultProduct: null }
  const owner: MemberProductsRow = { memberId: 'owner', email: company.user?.email ?? '', name: company.user?.name ?? null, role: 'owner', isSelf: company.userId === s.userId, ...(values[company.userId] ?? empty) }
  return [owner, ...members.filter((m) => m.userId !== company.userId).map((m) => ({
    memberId: m.id, email: m.email, name: names.get(m.userId as string) ?? null, role: m.role, isSelf: m.userId === s.userId, ...(values[m.userId as string] ?? empty),
  }))]
}
