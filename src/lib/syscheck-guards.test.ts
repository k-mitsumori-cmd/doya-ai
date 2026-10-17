// 実行: npm run test:syscheck
// 2026-10-18 のシステム点検で直した権限まわりの判定が、あとの変更で消えていないかをソースから確かめる。
// 詳細は docs/system-check/FINDINGS-2026-10-18.md を参照。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

test('SEC-104: 勤怠でシステム管理者のメール変更と招待の再発行は、システム管理者だけができる', () => {
  const patch = read('src/app/api/kintai/employees/[id]/route.ts')
  assert.match(patch, /existingEmp\.member\?\.role === 'system_admin' && actorRole !== 'system_admin'/)
  const invite = read('src/app/api/kintai/employees/[id]/invite/route.ts')
  assert.match(invite, /employee\.member\?\.role === 'system_admin' && actorRole !== 'system_admin'\) return \{ kind: 'forbidden'/)
})

test('SEC-103: 勤怠で hr_admin は同格以上の人を変更できず、同格以上の権限も付与できない', () => {
  const patch = read('src/app/api/kintai/employees/[id]/route.ts')
  assert.match(patch, /targetIsPeerOrHigher && sensitiveChange/)
  assert.match(patch, /roleChanged && isSelf/)
  assert.match(patch, /roleChanged && hasMinRole\(role, actorRole\)/)
  const create = read('src/app/api/kintai/employees/route.ts')
  assert.match(create, /actorRole !== 'system_admin' && hasMinRole\(assignRole, actorRole\)/)
})

test('SEC-103: 見積・面接・AI商談のメンバー権限は、自分と同じロールを付与できない（>= で比べる）', () => {
  for (const svc of ['quote', 'mensetsu', 'aishodan']) {
    for (const file of [`src/app/api/${svc}/members/route.ts`, `src/app/api/${svc}/members/[id]/route.ts`]) {
      const src = read(file)
      assert.doesNotMatch(src, /ROLE_HIERARCHY\[role\] > ROLE_HIERARCHY\[/, `${file} に > の比較が残っている`)
      assert.match(src, /ROLE_HIERARCHY\[role\] >= ROLE_HIERARCHY\[/, `${file} に >= の比較が無い`)
    }
  }
})

test('SEC-065: 商談準備のロゴのパスは、自組織の配下だけを受け付ける', () => {
  const src = read('src/app/api/shodan/company-profile/route.ts')
  assert.match(src, /rawLogo\.startsWith\(`shodan\/logos\/\$\{ctx\.organizationId\}\/`\)/)
})

test('SEC-021: 有料の画像生成を呼べる検証用 API は、本番では 404 を返す', () => {
  const src = read('src/app/api/test/openai-image/route.ts')
  assert.equal((src.match(/if \(isProductionDeployment\(\)\) return NextResponse\.json\(\{ error: 'Not Found' \}, \{ status: 404 \}\)/g) || []).length, 2)
})

test('CRON-002: 運用通知の Cron はクエリ文字列の無いパスで登録し、各パスにルートがある', () => {
  const vercel = JSON.parse(read('vercel.json')) as { crons: Array<{ path: string }> }
  for (const cron of vercel.crons) assert.ok(!cron.path.includes('?'), `${cron.path} にクエリ文字列がある（Vercel Cron が定時に発火しない）`)
  for (const mode of ['daily', 'watch', 'reviews', 'cost', 'weekly', 'travel']) {
    assert.ok(vercel.crons.some((c) => c.path === `/api/cron/service-operations-${mode}`), `service-operations-${mode} が vercel.json に無い`)
    const route = read(`src/app/api/cron/service-operations-${mode}/route.ts`)
    assert.match(route, new RegExp(`searchParams\\.set\\('mode', '${mode}'\\)`))
  }
})

test('SEC-106: 勤怠でシステム管理者以外は、自分の申請を承認・却下できない', () => {
  const src = read('src/app/api/kintai/requests/[id]/route.ts')
  assert.match(src, /existing\.employeeId === kctx\.employeeId && actorRole !== 'system_admin'/)
})

test('SEC-109: 面接から HR への引き渡しは、従業員上限を通し、紐付けが空のときだけ書く', () => {
  const src = read('src/app/api/mensetsu/sessions/[id]/hr-handoff/route.ts')
  assert.match(src, /createWithinEmployeeLimit\(hrOrganizationId/)
  assert.match(src, /hrEmployeeId: null \}/)
  assert.match(src, /logAudit\(/)
  assert.doesNotMatch(src, /prisma\.hrEmployee\.create\(/)
})

test('BILL-051: 日次サマリの Cron は、プランを直接書き換えず正規の同期処理を通す', () => {
  const src = read('src/app/api/cron/daily-summary/route.ts')
  assert.match(src, /syncUnifiedBilling\(\{/)
  assert.match(src, /findActiveLikeSubscriptions\(/)
  assert.doesNotMatch(src, /plan: 'FREE',\s*\n\s*stripeSubscriptionId: null,\s*\n\s*stripePriceId: null/)
  assert.doesNotMatch(src, /userServiceSubscription\.update\(/)
})

test('SEC-069: インタビュー素材は確定時に中身を検査し、署名付き URL を DB に保存しない', () => {
  const confirm = read('src/app/api/interview/materials/confirm/route.ts')
  assert.match(confirm, /matchesInterviewFileSignature\(/)
  assert.match(confirm, /const fileUrl = `storage:\$\{storagePath\}`/)
  assert.doesNotMatch(confirm, /getSignedFileUrl\(storagePath, 7 \* 24 \* 3600\)/)
  const detail = read('src/app/api/interview/materials/[id]/route.ts')
  assert.doesNotMatch(detail, /let fileUrl = material\.fileUrl/)
})
