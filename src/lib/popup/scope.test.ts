// 実行: npm run test:popup
// 他人のサイト・案を見たり変えたりできないこと（IDOR）を、APIのソースから静的に確かめる。
// ⚠️ popupSite / popup を id だけで引くと、他人のIDを指定したときに中身が返ってしまう。
// ⚠️ public/ 配下（埋め込み用）はログイン不要の口。別の規則（公開中だけ・ドメイン照合）で確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const API_DIR = join(process.cwd(), 'src/app/api/popup')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? routeFiles(p) : name === 'route.ts' ? [p] : []
  })
}

const files = routeFiles(API_DIR)
const privateFiles = files.filter((f) => !f.includes('/public/'))
const publicFiles = files.filter((f) => f.includes('/public/'))

test('APIのルートが見つかる', () => {
  assert.ok(privateFiles.length >= 6, privateFiles.join(', '))
  assert.equal(publicFiles.length, 3, publicFiles.join(', '))
})

for (const file of privateFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = file.slice(process.cwd().length + 1)

  test(`${rel}: すべてのハンドラでログインを確認する`, () => {
    const handlers = src.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) || []
    const checks = src.match(/await getPopupUserId\(\)/g) || []
    assert.ok(handlers.length > 0)
    assert.equal(checks.length, handlers.length)
  })

  test(`${rel}: サイト・案は userId 付きでしか引かない`, () => {
    // findUnique は id だけで引けてしまうので使わない
    assert.ok(!/popupSite\.findUnique\(|popup\.findUnique\(/.test(src), 'findUnique を使っている')
    for (const m of src.matchAll(/(popupSite|popup)\.(findFirst|findMany|count)\(\{\s*where:\s*([^}]*)/g)) {
      assert.ok(/ownSite\(userId|ownPopup\(userId|userId/.test(m[3]), `userId の無い検索: ${m[0]}`)
    }
    // 更新・削除は、userId で確認済みの行の id か、userId を含む条件でのみ行う
    for (const m of src.matchAll(/(popupSite|popup)\.(update|updateMany|delete|deleteMany)\(\{\s*where:\s*([^}]*\}?)/g)) {
      assert.ok(/site\.id|popup\.id|siteId|userId|ownSite|ownPopup/.test(m[3]), `確認していないIDでの更新: ${m[0]}`)
    }
  })
}

for (const file of publicFiles) {
  const src = readFileSync(file, 'utf8')
  const rel = file.slice(process.cwd().length + 1)

  test(`${rel}: 公開の口は書き込みを popup_stat の加算と設置確認だけに限る`, () => {
    assert.ok(!/\.(create|createMany|upsert|delete|deleteMany)\(/.test(src), '公開の口で作成・削除をしている')
    for (const m of src.matchAll(/(\w+)\.(update|updateMany)\(/g)) {
      assert.equal(m[1], 'popupSite', `想定外の更新: ${m[0]}`)
    }
  })

  test(`${rel}: CORS を * にしない`, () => {
    assert.ok(!/Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*/.test(src))
  })
}

test('設定と計測は公開中の案・登録ドメインだけ', () => {
  const config = readFileSync(join(API_DIR, 'public/config/route.ts'), 'utf8')
  assert.ok(/status: 'live'/.test(config))
  assert.ok(/callerAllowed\(req, site\.domain\)/.test(config))
  assert.ok(/deletedAt/.test(config))
  const track = readFileSync(join(API_DIR, 'public/track/route.ts'), 'utf8')
  assert.ok(/status: 'live'/.test(track))
  assert.ok(/callerAllowed\(req, popup\.site\.domain\)/.test(track))
  assert.ok(/siteKey: body\.k, deletedAt: null/.test(track))
})

test('画像の配信は公開中か持ち主だけ', () => {
  const image = readFileSync(join(API_DIR, 'public/image/[id]/route.ts'), 'utf8')
  assert.ok(/popup\.status === 'live'/.test(image))
  assert.ok(/userId !== popup\.userId/.test(image))
})

// 統合仕様 R-4 で、API はデータの読み書きを lib（popup-read / popup-write / propose）に任せた。
// IDOR の守りは lib 側にあるので、lib の問い合わせも userId 付きか確かめる。
for (const rel of ['src/lib/popup/popup-read.ts', 'src/lib/popup/popup-write.ts', 'src/lib/popup/propose.ts']) {
  const src = readFileSync(join(process.cwd(), rel), 'utf8')
  test(`${rel}: サイト・案は userId 付きでしか引かない`, () => {
    assert.ok(!/(popupSite|popup)\.findUnique\(/.test(src), 'findUnique を使っている')
    for (const m of src.matchAll(/(popupSite|popup)\.(findFirst|findMany|count)\(\{\s*where:\s*([^}]*)/g)) {
      assert.ok(/userId/.test(m[3]), `userId の無い検索: ${m[0]}`)
    }
  })
}
