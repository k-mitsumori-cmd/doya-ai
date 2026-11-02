// 実行: npx tsx --test src/lib/products.test.ts
// 製品の表（src/lib/products.ts）と旗（src/lib/products/flag.ts）の決まり。
// - 経営ホーム以外のツールは、少なくとも1つの製品に入る。2つに入るのは見積もりとプロマネだけ
// - パスから製品を決める決まり・最初に開く製品の決まり
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_SHELL_TOOLS } from '@/components/shell/tools'
import {
  PRODUCTS, departmentOfProduct, parseProductId, primaryProductOfTool, productForPath, productFullName, productOfDepartment, productsOfTool, resolveStartProduct,
} from './products'
import { decideProductHubs, productHubsRollout } from './products/flag'

test('メニューに出るツールは、少なくとも1つの製品に入る', () => {
  for (const t of ALL_SHELL_TOOLS) {
    if (t.id === 'home') continue
    assert.ok(productsOfTool(t.id).length >= 1, `${t.id} はどの製品にも入っていない`)
  }
})

test('2つの製品に入るのは、見積もりとプロマネだけ（2026-11-01 の決定）', () => {
  const multi = ALL_SHELL_TOOLS.map((t) => t.id).filter((id) => productsOfTool(id).length > 1).sort()
  assert.deepEqual(multi, ['promane', 'quote'])
  assert.deepEqual(productsOfTool('quote'), ['sales', 'budget'])
  assert.deepEqual(productsOfTool('promane'), ['management', 'budget'])
})

test('製品の名前と並び', () => {
  assert.deepEqual(PRODUCTS.map((p) => p.id), ['management', 'sales', 'marketing', 'hr', 'budget'])
  assert.deepEqual(PRODUCTS.map((p) => p.name), ['経営管理', 'セールス', 'マーケティング', '人事', '予実管理'])
  assert.equal(productFullName('ドヤバディ', 'sales'), 'ドヤバディ セールス')
})

test('ベータで隠しているカンニングは、どの製品にも入れない', () => {
  assert.deepEqual(productsOfTool('cunning'), [])
})

test('製品のホームは /hub/<id>。経営管理だけ /home', () => {
  for (const p of PRODUCTS) assert.equal(p.home, p.id === 'management' ? '/home' : `/hub/${p.id}`)
})

test('パスから製品を決める', () => {
  assert.equal(productForPath('/home', 'sales'), 'management')
  assert.equal(productForPath('/home/work', 'sales'), 'management')
  assert.equal(productForPath('/hub/hr', 'sales'), 'hr')
  assert.equal(productForPath('/hub/unknown', 'sales'), 'sales')
  // 今の製品に入っているツールなら、今の製品のまま
  assert.equal(productForPath('/quote/abc', 'budget'), 'budget')
  assert.equal(productForPath('/quote', 'sales'), 'sales')
  // 入っていなければ、主な製品へ
  assert.equal(productForPath('/quote', 'marketing'), 'sales')
  assert.equal(productForPath('/promane', 'hr'), 'budget')
  assert.equal(productForPath('/banner/dashboard', 'sales'), 'marketing')
  // どれにも当たらないパスは今のまま
  assert.equal(productForPath('/pricing', 'hr'), 'hr')
  assert.equal(productForPath('/', 'hr'), 'hr')
})

test('主な製品', () => {
  assert.equal(primaryProductOfTool('quote'), 'sales')
  assert.equal(primaryProductOfTool('promane'), 'budget')
  assert.equal(primaryProductOfTool('kintai'), 'hr')
  assert.equal(primaryProductOfTool('nothing'), null)
})

test('最初に開く製品の順', () => {
  assert.equal(resolveStartProduct({ selfDefault: 'hr', adminDefault: 'sales', last: 'budget' }), 'hr')
  assert.equal(resolveStartProduct({ adminDefault: 'sales', last: 'budget' }), 'sales')
  assert.equal(resolveStartProduct({ last: 'budget', isAdmin: true }), 'budget')
  assert.equal(resolveStartProduct({ isAdmin: true, assigned: ['sales'] }), 'management')
  assert.equal(resolveStartProduct({ assigned: ['marketing', 'sales'] }), 'marketing')
  assert.equal(resolveStartProduct({}), 'management')
})

test('cookie・URL の値の読み方', () => {
  assert.equal(parseProductId('sales'), 'sales')
  assert.equal(parseProductId(' budget '), 'budget')
  assert.equal(parseProductId(['hr', 'sales']), 'hr')
  assert.equal(parseProductId('admin'), null)
  assert.equal(parseProductId(''), null)
  assert.equal(parseProductId(undefined), null)
})

test('部署との読み替え（admin は予実管理）', () => {
  assert.equal(productOfDepartment('admin'), 'budget')
  assert.equal(productOfDepartment('sales'), 'sales')
  assert.equal(departmentOfProduct('budget'), 'admin')
  assert.equal(departmentOfProduct('management'), null)
})

test('旗: 既定は off。preview と all だけを受け付ける', () => {
  // ⚠️ Vercel の本番の環境変数のままビルドの中で流れるので、引数で渡して環境変数を読まない
  assert.equal(productHubsRollout(''), 'off')
  assert.equal(productHubsRollout('on'), 'off')
  assert.equal(productHubsRollout(' Preview '), 'preview')
  assert.equal(productHubsRollout('all'), 'all')
  assert.equal(decideProductHubs({ rollout: 'off', email: 'a@example.com', allow: ['a@example.com'] }), false)
  assert.equal(decideProductHubs({ rollout: 'all', email: null, allow: [] }), true)
})
