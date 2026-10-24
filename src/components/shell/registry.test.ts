// 実行: npm run test:shell
// 共通の枠（AppShell）を出すパスの決まり（registry.ts の shouldShowShell）。
// 2026-10-23 ユーザーの指摘「収入管理・支出管理を押すと、上のヘッダーが消えて画面が変わる」への回帰テスト。
// - ログインしている人: 全ツールの入口・料金・組織を作る「はじめに」・ツールの中のタブで、枠が出る
// - 招待の受諾・応募者や社員が開く画面・見本・ログインしていない人の紹介ページでは、枠が出ない
// - どのツールのタブにも「料金プラン」を入れない（2026-10-24 ユーザーの決定 FRM-04）。料金のページは直リンクで開けるまま
// - 展示会は、いつも枠に入る（2026-10-24 ユーザーの決定 FRM-05）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { SHELL_SERVICES, shouldShowShell, toolPricingHref } from './registry'
import { isEntryPath } from './entry-path'
import { isNavActive } from './nav'
import { ADIMAGE_NAV } from '@/lib/adimage/nav'
import { buildAioNav } from '@/lib/aio/nav'
import { AISHODAN_NAV } from '@/lib/aishodan/nav'
import { ASKLINK_NAV } from '@/lib/asklink/nav'
import { BANNER_NAV_NEXT } from '@/lib/banner/nav'
import { CUNNING_NAV } from '@/lib/cunning/nav'
import { DOYALIST_NAV } from '@/lib/doyalist/nav'
import { DOYASLIDE_NAV } from '@/lib/doyaslide/nav'
import { expenseNav } from '@/lib/expense/nav'
import { hrShellNav } from '@/lib/hr/nav'
import { INCOME_NAV } from '@/lib/income/nav'
import { INTERVIEW_NAV } from '@/lib/interview/nav'
import { buildKintaiNav } from '@/lib/kintai/nav'
import { MENSETSU_NAV } from '@/lib/mensetsu/nav'
import { PERSONA_NAV } from '@/lib/persona/nav'
import { POPUP_NAV } from '@/lib/popup/nav'
import { promaneNav } from '@/lib/promane/nav'
import { QUOTE_NAV } from '@/lib/quote/nav'
import { SEO_NAV } from '@/lib/seo/nav'
import { sfaNav, sfaPricingHref } from '@/lib/sfa/nav'
import { SHANAI_NAV } from '@/lib/shanai/nav'
import { shodanNav } from '@/lib/shodan/nav'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'

const NEXT = { signedIn: true }
const pathOf = (href: string) => href.split(/[?#]/)[0]

/** 全ツールの入口と料金（ユーザーの指摘で枠が消えていたものを含む） */
const ENTRIES = SHELL_SERVICES.flatMap((s) => [s.basePath, `${s.basePath}/pricing`])

/** 各ツールのタブ（ToolFrame の nav）。いちばん多く出る形（管理者・組織あり）で並べる */
const NAV_ITEMS = [
  ADIMAGE_NAV, buildAioNav('acme'), AISHODAN_NAV, ASKLINK_NAV, BANNER_NAV_NEXT, CUNNING_NAV, DOYALIST_NAV, DOYASLIDE_NAV,
  expenseNav('acme', 'owner'), hrShellNav(true), INCOME_NAV, INTERVIEW_NAV, buildKintaiNav('admin', true), MENSETSU_NAV,
  PERSONA_NAV, POPUP_NAV, promaneNav('acme'), QUOTE_NAV, SEO_NAV, sfaNav('acme'), SHANAI_NAV, shodanNav('acme'), TENJIKAI_NAV,
].flat()
const TABS = NAV_ITEMS.map((item) => pathOf(item.href))

/** 収入管理の下の画面（ユーザーは収入管理でも枠が消えたと言っている） */
const INCOME = ['/income', '/income/pricing', '/income/settings', '/income/clients', '/income/clients/c1', '/income/contracts', '/income/contracts/new',
  '/income/contracts/k1', '/income/invoices', '/income/invoices/new', '/income/invoices/i1', '/income/payments', '/income/revenue']

/** 第三者・社外の人が開く画面と、見本。ログインしていても枠を出さない */
const OUTSIDE = [
  '/sfa/invite', '/sfa/invite/tok', '/aio/invite/tok', '/shodan/invite/tok', '/promane/invite/tok', '/hr/invite/tok', '/quote/invite/tok',
  '/kintai/invite', '/kintai/invite/tok', '/mensetsu/invite/tok', '/aishodan/invite/tok',
  '/mensetsu/live', '/mensetsu/live/tok', '/shanai/answer', '/shanai/answer/tok',
  '/home/preview', '/hr/dev/sample', '/sfa/dev', '/banner/landing', '/banner/test',
]

test('ログインしている人には、全ツールの入口と料金で枠が出る', () => {
  for (const p of ENTRIES) assert.equal(shouldShowShell(p, NEXT), true, p)
  // ユーザーと統括が本番で見つけた、枠が消えていた画面
  for (const p of ['/expense', '/doyaslide', '/aio/pricing', '/sfa/pricing', '/shodan/pricing', '/hr/pricing', '/kintai/pricing',
    '/expense/pricing', '/promane/pricing', '/sfa', '/shodan', '/aio', '/promane', '/hr', '/kintai', '/banner/pricing']) {
    assert.equal(shouldShowShell(p, NEXT), true, p)
  }
})

test('ログインしている人には、ツールの中のタブと収入管理の下の画面で枠が出る', () => {
  assert.ok(TABS.length > 50)
  for (const p of [...TABS, ...INCOME]) assert.equal(shouldShowShell(p, NEXT), true, p)
})

test('招待・応募者や社員が開く画面・見本には、ログインしていても枠を出さない', () => {
  for (const p of OUTSIDE) {
    assert.equal(shouldShowShell(p, NEXT), false, p)
  }
})

test('ログインしていない人の紹介ページ・料金ページには、枠を出さない', () => {
  for (const p of [...ENTRIES, ...INCOME, ...TABS]) {
    assert.equal(shouldShowShell(p, { ...NEXT, signedIn: false }), false, p)
  }
})

test('展示会は、ログインしていればいつも枠に入る（FRM-05）', () => {
  const tenjikai = ['/tenjikai', ...TENJIKAI_NAV.map((n) => pathOf(n.href))]
  assert.ok(tenjikai.length > 5)
  for (const p of tenjikai) {
    assert.equal(shouldShowShell(p, { signedIn: true }), true, p)
    // 未ログインは紹介ページ（LP）だけ。枠は出さない
    assert.equal(shouldShowShell(p, { signedIn: false }), false, `${p} 未ログイン`)
  }
})

test('どのツールのタブにも「料金プラン」を入れない（FRM-04）', () => {
  assert.ok(NAV_ITEMS.length > 50)
  for (const item of NAV_ITEMS) {
    const p = pathOf(item.href)
    assert.ok(!/(^|\/)pricing(\/|$)/.test(p), `料金のページへのタブがある: ${item.label} ${item.href}`)
    assert.ok(!/料金/.test(item.label), `料金のタブがある: ${item.label} ${item.href}`)
  }
  // 料金のページそのものは消さない。ログインしていれば直リンクでも枠の中で開く
  for (const s of SHELL_SERVICES.filter((x) => x.id !== 'home')) {
    assert.equal(shouldShowShell(`${s.basePath}/pricing`, NEXT), true, s.id)
  }
})

test('「このツールの残りとプラン」の料金へのリンクは、そのツールの料金のページを開く（FRM-04）', () => {
  const byId = (id: string) => SHELL_SERVICES.find((s) => s.id === id)!
  // 利用量を出すツールは、どれも料金のページへのリンクを持つ
  for (const s of SHELL_SERVICES.filter((x) => x.usage)) {
    const org = s.usage?.org === 'path' ? 'acme' : undefined
    assert.equal(pathOf(toolPricingHref(s, org)), `${s.basePath}/pricing`, s.id)
    // 行き先の料金のページが本当にある（タブから外しても、ページは残す）
    assert.ok(existsSync(join(process.cwd(), 'src/app/(shell)', s.basePath, 'pricing/page.tsx')), `${s.basePath}/pricing のページが無い`)
  }
  assert.equal(toolPricingHref(byId('popup')), '/popup/pricing')
  // 組織ごとのツールは、その組織の料金を開く
  assert.equal(toolPricingHref(byId('aio'), '日本語'), `/aio/pricing?org=${encodeURIComponent('日本語')}`)
  assert.equal(toolPricingHref(byId('shodan'), 'acme'), '/shodan/pricing?org=acme')
  // 台帳に書いた行き先が優先
  assert.equal(toolPricingHref(byId('quote'), 'acme'), '/quote/pricing')
})

test('組織を選ぶ前の画面（入口と料金）だけに、見出しの帯を足す', () => {
  for (const [svc, p] of [['sfa', '/sfa'], ['sfa', '/sfa/pricing'], ['aio', '/aio'], ['expense', '/expense/pricing'], ['promane', '/promane']]) {
    assert.equal(isEntryPath(svc, p), true, p)
  }
  for (const [svc, p] of [['sfa', '/sfa/acme'], ['sfa', '/sfa/invite/tok'], ['aio', '/aio/acme/scan'], ['promane', '/promane/ws'], ['sfa', '/sfaa']]) {
    assert.equal(isEntryPath(svc, p), false, p)
  }
})

test('href に ?org= がある項目も、パスだけで選ばれた形になる（料金の案内・今のサイドバー）', () => {
  // 料金のタブはナビから外した（FRM-04）が、今のサイドバーのプランの案内は ?org= 付きで料金のページを開く
  const pricing = { label: 'プラン', href: sfaPricingHref('acme') }
  assert.equal(isNavActive('/sfa/pricing', pricing), true)
  assert.equal(isNavActive('/sfa/acme', pricing), false)
  const aio = { label: 'プラン', href: `/aio/pricing?org=${encodeURIComponent('acme')}` }
  assert.equal(isNavActive('/aio/pricing', aio), true)
})
