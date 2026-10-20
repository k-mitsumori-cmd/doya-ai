// 実行: npm run test:expense
// メンバーの権限変更の規則（システム点検 EXP-006 / EXP-F02）と、メール登録の有無を漏らさないこと（EXP-F05）を確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXPENSE_ROLES, type ExpenseRole } from './constants'
import { canGrantRole, canManageMember, grantableRoles } from './member-policy'

const ROLES = EXPENSE_ROLES as readonly ExpenseRole[]

test('owner は誰でも変更・除外でき、どのロールでも付与できる', () => {
  for (const r of ROLES) {
    assert.equal(canManageMember('owner', r), true, r)
    assert.equal(canGrantRole('owner', r), true, r)
  }
})

test('admin は同格の admin と owner を変更・除外できない', () => {
  assert.equal(canManageMember('admin', 'owner'), false)
  assert.equal(canManageMember('admin', 'admin'), false)
  assert.equal(canManageMember('admin', 'manager'), true)
  assert.equal(canManageMember('admin', 'member'), true)
})

test('admin は admin と owner を付与できない（新規追加・変更とも）', () => {
  assert.equal(canGrantRole('admin', 'owner'), false)
  assert.equal(canGrantRole('admin', 'admin'), false)
  assert.equal(canGrantRole('admin', 'manager'), true)
  assert.deepEqual(grantableRoles('admin', ROLES), ['manager', 'member'])
})

test('manager・member は誰も変えられない（API の最小ロールは admin だが、規則としても閉じている）', () => {
  assert.equal(canManageMember('manager', 'member'), true)
  assert.equal(canManageMember('manager', 'manager'), false)
  assert.equal(canGrantRole('member', 'member'), false)
  assert.deepEqual(grantableRoles('member', ROLES), [])
})

const API = join(process.cwd(), 'src/app/api/expense/members')
const post = readFileSync(join(API, 'route.ts'), 'utf8')
const byId = readFileSync(join(API, '[id]/route.ts'), 'utf8')

test('POST は付与するロールを canGrantRole で確かめる', () => {
  assert.match(post, /const currentContext = \(scope: LifecycleOrganizationContext\) => \(\{ \.\.\.ctx, role: scope\.memberRows\.find\(member => member\.id === ctx\.memberId\)!\.role as ExpenseRole \}\)/)
  assert.match(post, /await withLifecycleExpenseInvitation\(prisma,/)
  assert.match(post, /scope => \{\s*if \(!canGrantRole\(currentContext\(scope\)\.role, role\)\) throw new ExpenseHttpError\(403/)
  assert.match(post, /async \(tx, scope, recipient\) => \{/)
  assert.match(post, /await tx\.expenseMember\.update\(\{ where: \{ id: recipient\.existingMemberId, organizationId: ctx\.organizationId \}, data \}\)/)
  assert.match(post, /await audit\(tx, currentContext\(scope\), 'member\.add'/)
  assert.ok(post.indexOf('if (!canGrantRole(currentContext(scope).role, role))') < post.indexOf('await tx.expenseMember.update'))
})

test('PATCH は相手を canManageMember、付与を canGrantRole で確かめる', () => {
  const patch = byId.slice(byId.indexOf('export async function PATCH'), byId.indexOf('export async function DELETE'))
  assert.match(patch, /return withExpenseMemberWrite\(ctx,/)
  assert.match(patch, /async \(tx, current\) => \{\s*const m = await target\(tx, current\.organizationId, id\)/)
  assert.match(patch, /canManageMember\(current\.role, asRole\(m\.role\)\)/)
  assert.match(patch, /canGrantRole\(current\.role, role\)/)
  assert.match(patch, /await assertOwnerRemains\(tx, current\.organizationId, m\.id\)/)
  assert.match(patch, /await tx\.expenseMember\.update/)
  assert.match(patch, /await audit\(tx, current, 'member\.role'/)
  assert.doesNotMatch(patch, /prisma\.expenseMember/)
  assert.ok(patch.indexOf('await assertOwnerRemains(tx,') < patch.indexOf('await tx.expenseMember.update'))
})

test('DELETE は相手を canManageMember で確かめ、最後のオーナーを残す', () => {
  const del = byId.slice(byId.indexOf('export async function DELETE'))
  assert.match(del, /return withExpenseMemberWrite\(ctx,/)
  assert.match(del, /async \(tx, current\) => \{\s*const m = await target\(tx, current\.organizationId, id\)/)
  assert.match(del, /canManageMember\(current\.role, asRole\(m\.role\)\)/)
  assert.match(del, /await assertOwnerRemains\(tx, current\.organizationId, m\.id\)/)
  assert.match(del, /await tx\.expenseMember\.update/)
  assert.match(del, /await audit\(tx, current,/)
  assert.doesNotMatch(del, /prisma\.expenseMember/)
  assert.ok(del.indexOf('await assertOwnerRemains(tx,') < del.indexOf('await tx.expenseMember.update'))
})

test('POST はメールの登録の有無で応答を変えない（404 を返さない・成功の形は 1 つ）', () => {
  const handler = post.slice(post.indexOf('export async function POST'))
  assert.doesNotMatch(handler, /ExpenseHttpError\(404/)
  assert.doesNotMatch(handler, /見つかりません/)
  const successes = handler.match(/return NextResponse\.json\(/g) ?? []
  assert.equal(successes.length, 1)
  assert.match(handler, /return NextResponse\.json\(\{ ok: true \}\)/)
})

test('招待は本人のログイン時に、DB のメールで照合して ACTIVE にする', () => {
  const access = readFileSync(join(process.cwd(), 'src/lib/expense/access.ts'), 'utf8')
  assert.match(access, /export async function claimPendingMemberships\(userId: string, orgSlug\?: string\): Promise<number>/)
  assert.match(access, /prisma\.user\.findUnique\(\{ where: \{ id: userId \}, select: \{ email: true \} \}\)/)
  const usage = readFileSync(join(process.cwd(), 'src/app/api/expense/usage/route.ts'), 'utf8')
  assert.match(usage, /await claimPendingMemberships\(userId, slug\)/)
  const claim = access.slice(access.indexOf('export async function claimPendingMemberships'), access.indexOf('export async function listMemberships'))
  assert.ok(claim.includes('...(orgSlug ? { organization: { slug: orgSlug } } : {})'))
  assert.match(claim, /await withLifecycleOrganizationWrite\(prisma,/)
  assert.match(claim, /pendingClaimUserId: userId/)
  assert.match(claim, /async tx => \{\s*const current = await tx\.expenseMember\.findFirst/)
  assert.match(claim, /const recipient = await tx\.user\.findUnique\(\{ where: \{ id: userId \}, select: \{ email: true \} \}\)/)
  assert.ok(claim.includes("recipient?.email?.toLowerCase() !== email"))
  assert.match(claim, /await tx\.expenseMember\.updateMany\(\{ where: \{ id: p\.id, organizationId: p\.organizationId, invitedEmail: email, status: 'PENDING', userId: null \}, data: \{ userId, status: 'ACTIVE' \} \}\)/)
  assert.match(claim, /if \(result\.count !== 1\) throw new LifecycleError/)
  assert.doesNotMatch(claim, /await prisma\.expenseMember\.(update|updateMany|create)/)
  const memberWrite = readFileSync(join(process.cwd(), 'src/lib/expense/member-write.ts'), 'utf8')
  assert.match(memberWrite, /const actor = scope\.memberRows\.find\(member => member\.userId === ctx\.userId\)/)
  assert.ok(memberWrite.includes("actor.status !== 'ACTIVE'"))
  assert.match(memberWrite, /return work\(tx, \{ \.\.\.ctx, role: actor\.role as ExpenseRole \}, scope\.lockedUserIds\)/)
})
