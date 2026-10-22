// 実行: npm run test:shell
// 共通の枠（AppShell）を出すパスの決まり（registry.ts の shouldShowShell）。
// 2026-10-23 ユーザーの指摘「収入管理・支出管理を押すと、上のヘッダーが消えて画面が変わる」への回帰テスト。
// - 新しい見た目でログインしている人: 全ツールの入口・料金・組織を作る「はじめに」・ツールの中のタブで、枠が出る
// - 招待の受諾・応募者や社員が開く画面・見本・ログインしていない人の紹介ページでは、枠が出ない
// - 今の見た目では、今までどおり（台帳の inShell で決める）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHELL_SERVICES, shouldShowShell } from './registry'
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
import { sfaNav } from '@/lib/sfa/nav'
import { SHANAI_NAV } from '@/lib/shanai/nav'
import { shodanNav } from '@/lib/shodan/nav'
import { TENJIKAI_NAV } from '@/lib/tenjikai/nav'

const NEXT = { signedIn: true, enabledIds: ['all'], uiNext: true }
const pathOf = (href: string) => href.split(/[?#]/)[0]

/** 全ツールの入口と料金（ユーザーの指摘で枠が消えていたものを含む） */
const ENTRIES = SHELL_SERVICES.flatMap((s) => [s.basePath, `${s.basePath}/pricing`])

/** 組織を作る「はじめに」・料金・各ツールのタブ（ToolFrame の nav） */
const TABS = [
  ADIMAGE_NAV, buildAioNav('acme'), AISHODAN_NAV, ASKLINK_NAV, BANNER_NAV_NEXT, CUNNING_NAV, DOYALIST_NAV, DOYASLIDE_NAV,
  expenseNav('acme', 'owner'), hrShellNav(true), INCOME_NAV, INTERVIEW_NAV, buildKintaiNav('admin', true), MENSETSU_NAV,
  PERSONA_NAV, POPUP_NAV, promaneNav('acme'), QUOTE_NAV, SEO_NAV, sfaNav('acme'), SHANAI_NAV, shodanNav('acme'), TENJIKAI_NAV,
].flat().map((item) => pathOf(item.href))

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

test('新しい見た目でログインしている人には、全ツールの入口と料金で枠が出る', () => {
  for (const p of ENTRIES) assert.equal(shouldShowShell(p, NEXT), true, p)
  // ユーザーと統括が本番で見つけた、枠が消えていた画面
  for (const p of ['/expense', '/doyaslide', '/aio/pricing', '/sfa/pricing', '/shodan/pricing', '/hr/pricing', '/kintai/pricing',
    '/expense/pricing', '/promane/pricing', '/sfa', '/shodan', '/aio', '/promane', '/hr', '/kintai', '/banner/pricing']) {
    assert.equal(shouldShowShell(p, NEXT), true, p)
  }
})

test('新しい見た目でログインしている人には、ツールの中のタブと収入管理の下の画面で枠が出る', () => {
  assert.ok(TABS.length > 60)
  for (const p of [...TABS, ...INCOME]) assert.equal(shouldShowShell(p, NEXT), true, p)
})

test('招待・応募者や社員が開く画面・見本には、ログインしていても枠を出さない', () => {
  for (const p of OUTSIDE) {
    assert.equal(shouldShowShell(p, NEXT), false, p)
    assert.equal(shouldShowShell(p, { ...NEXT, uiNext: false }), false, p)
  }
})

test('ログインしていない人の紹介ページ・料金ページには、枠を出さない', () => {
  for (const p of [...ENTRIES, ...INCOME, ...TABS]) {
    assert.equal(shouldShowShell(p, { ...NEXT, signedIn: false }), false, p)
  }
})

test('今の見た目では、今までどおり台帳の inShell で決める（入口・料金は枠の外のまま）', () => {
  const legacy = { signedIn: true, enabledIds: ['all'] }
  for (const p of ['/expense', '/sfa', '/sfa/pricing', '/aio/pricing', '/hr', '/hr/pricing', '/kintai', '/doyaslide', '/banner/pricing']) {
    assert.equal(shouldShowShell(p, legacy), false, p)
  }
  for (const p of ['/income', '/sfa/acme', '/hr/dashboard', '/banner/dashboard']) assert.equal(shouldShowShell(p, legacy), true, p)
})

test('有効でないツールには、新しい見た目でも枠を出さない', () => {
  assert.equal(shouldShowShell('/sfa/pricing', { signedIn: true, enabledIds: [], uiNext: true }), false)
  // いつも枠を出すツール（収入管理・支出管理）は、一覧に無くても出す
  assert.equal(shouldShowShell('/expense', { signedIn: true, enabledIds: [], uiNext: true }), true)
})

test('組織を選ぶ前の画面（入口と料金）だけに、見出しの帯を足す', () => {
  for (const [svc, p] of [['sfa', '/sfa'], ['sfa', '/sfa/pricing'], ['aio', '/aio'], ['expense', '/expense/pricing'], ['promane', '/promane']]) {
    assert.equal(isEntryPath(svc, p), true, p)
  }
  for (const [svc, p] of [['sfa', '/sfa/acme'], ['sfa', '/sfa/invite/tok'], ['aio', '/aio/acme/scan'], ['promane', '/promane/ws'], ['sfa', '/sfaa']]) {
    assert.equal(isEntryPath(svc, p), false, p)
  }
})

test('料金のタブは、href に ?org= があっても、料金のページで選ばれた形になる', () => {
  const pricing = sfaNav('acme').find((n) => n.href.startsWith('/sfa/pricing'))!
  assert.equal(isNavActive('/sfa/pricing', pricing), true)
  assert.equal(isNavActive('/sfa/acme', pricing), false)
  const aio = buildAioNav('acme').find((n) => n.href.startsWith('/aio/pricing'))!
  assert.equal(isNavActive('/aio/pricing', aio), true)
})
