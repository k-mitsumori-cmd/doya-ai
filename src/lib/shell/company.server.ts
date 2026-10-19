// ============================================
// アカウントの会社を読む・保存する（UI 品質 B-1・B-2）
// ============================================
// - 正本は AccountCompany（本人が登録した会社）。userId はいつもセッションから決める（他人の会社は読めない・書けない）
// - 登録が無ければ、各ツールの組織の名前を、下の SOURCES の順に読み、最初に見つかった1つを仮に出す
// ⚠️ 各ツールの組織の名前は書き換えない。読むだけ（各ツールの listMemberships は findMany だけ）。
// ⚠️ 1つのツールが失敗しても、次のツールを見る。失敗の中身はログに出さない。
// ⚠️ 新しい見た目（src/lib/ui-next.ts）の人のときだけ、(shell)/layout.tsx と /api/account/company から呼ぶ。
// ⚠️ 本番の DB に account_companies の表が入るまでは、読むと失敗する。そのときは仮の名前に戻る。
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pickAccountCompany, uniqueCandidateNames, type AccountCompany, type CompanyInput } from './company'

type Lister = () => Promise<{ slug: string; name: string }[]>

/**
 * 会社の名前を探す順（仮。2026-10-19 統括・メインの了承済みの案4）。
 * 本番では、見積・商談準備・面接・AI商談に正式な会社名が入り、営業管理は略した名前だった。
 * ⚠️ AI検索対策（aio）の組織は、見張る対象のブランドの一覧なので、会社名に使わない。
 */
const SOURCES: (() => Promise<Lister>)[] = [
  async () => (await import('@/lib/quote/access')).listMemberships,
  async () => (await import('@/lib/shodan/access')).listMemberships,
  async () => (await import('@/lib/mensetsu/access')).listMemberships,
  async () => (await import('@/lib/aishodan/access')).listMemberships,
  async () => (await import('@/lib/sfa/access')).listMemberships,
  async () => (await import('@/lib/expense/access')).listMemberships as Lister,
]

/** ログイン中の人の id。メールしか無いセッションでは、メールから引く（各ツールの access.ts と同じ） */
export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions).catch(() => null)
  const id = (session?.user as { id?: string } | undefined)?.id
  if (id) return id
  const email = session?.user?.email
  if (!email) return null
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null)
  return u?.id ?? null
}

/** 本人が登録した会社。無ければ null */
export async function getOwnCompany(userId: string) {
  return prisma.accountCompany.findUnique({
    where: { userId },
    select: { name: true, websiteUrl: true, industry: true, updatedAt: true },
  })
}

/** 本人の会社を保存する（無ければ作る）。⚠️ userId は呼ぶ側がセッションから決めたものだけを渡す */
export async function saveOwnCompany(userId: string, input: CompanyInput) {
  return prisma.accountCompany.upsert({
    where: { userId },
    create: { userId, name: input.name, websiteUrl: input.websiteUrl, industry: input.industry },
    update: { name: input.name, websiteUrl: input.websiteUrl, industry: input.industry },
    select: { name: true, websiteUrl: true, industry: true, updatedAt: true },
  })
}

/** 登録の候補（各ツールの組織の名前）。読むだけ */
export async function listCompanyCandidates(): Promise<string[]> {
  const settled = await Promise.allSettled(SOURCES.map(async (load) => (await (await load())()).map((r) => r?.name)))
  return uniqueCandidateNames(settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])))
}

async function fallbackFromTools(): Promise<AccountCompany | null> {
  for (const load of SOURCES) {
    try {
      const found = pickAccountCompany(await (await load())())
      if (found) return found
    } catch {
      // このツールが読めなくても、次のツールを見る
    }
  }
  return null
}

/** 左下・ホーム・ツールの見出しの帯に出す、アカウントの会社 */
export async function getAccountCompanyName(): Promise<AccountCompany | null> {
  const userId = await currentUserId()
  if (userId) {
    try {
      const own = await getOwnCompany(userId)
      if (own) return { name: own.name, source: 'company', websiteUrl: own.websiteUrl, industry: own.industry }
    } catch {
      // 表がまだ無い（本番に反映する前）などのときは、仮の名前に戻る
    }
  }
  return fallbackFromTools()
}
