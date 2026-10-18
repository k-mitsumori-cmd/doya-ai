// 実行: npm run test:popup
// 読み取りの正本（popup-read.ts）・エージェントの道具（agent-tools.ts）・ナビ（nav.ts）の単体テスト。
// 統合仕様 D-5: read の道具（popup.stats）が *-read.ts の関数として呼べること。
// ⚠️ DB は偽物を渡す（本物の DB に触れない）。where に userId が入っているかもここで確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPopupDaily, getPopupSummary, getSiteDetail, listSites, totalsByPopup, type PopupDb } from './popup-read'
import { POPUP_AGENT_TOOLS, popupProposeDraftsTool, popupPublishTool, popupStatsTool } from './agent-tools'
import { POPUP_NAV, isPopupNavActive } from './nav'
import { jstDay } from './schema'

const NOW = new Date('2026-10-18T03:00:00Z') // JST 2026-10-18 12:00

const SITE_PROFILE = { name: 'サンプル', summary: '', strengths: [], target: '', contactUrl: 'https://example.com/contact', downloadUrl: null, pricingUrl: null, pages: [], colors: ['#0a58ca'] }

function creative(extra: Record<string, unknown> = {}) {
  return { layout: 'modal', eyebrow: '', headline: '見出し', sub: '', bubbles: [], buttonLabel: '押す', buttonUrl: 'https://example.com/contact', note: '', question: '', links: [], colors: { bg: '#ffffff', accent: '#0066ff', text: '#1f2430' }, imagePath: null, imageWidth: null, imageHeight: null, imageAlt: '', ...extra }
}

function popupRow(id: string, siteId: string, userId: string, status: string, sortOrder: number) {
  return {
    id, siteId, userId, name: `案${id}`, kind: 'cta', status, sortOrder, creative: creative(), trigger: { type: 'delay', delaySec: 5, scrollPct: 50 },
    targeting: { device: 'all', pathMode: 'all', paths: [] }, frequency: { hideDays: 7, oncePerSession: true }, reason: null,
    createdAt: new Date('2026-10-17T00:00:00Z'), updatedAt: new Date('2026-10-17T00:00:00Z'),
  }
}

function siteRow(id: string, userId: string, deletedAt: Date | null = null) {
  return {
    id, userId, name: `サイト${id}`, sourceUrl: 'https://example.com/', domain: 'example.com', siteKey: 'K'.repeat(24), site: SITE_PROFILE,
    allowedUrls: ['https://example.com/', 'https://example.com/contact'], audience: 'b2b', source: 'site', companyProfileId: null,
    lastSeenAt: null, deletedAt, createdAt: new Date('2026-10-17T00:00:00Z'), updatedAt: new Date('2026-10-17T00:00:00Z'),
  }
}

/** 偽のDB。userId・deletedAt・期間の条件を本物と同じ意味で解釈し、where を記録する */
function fakeDb() {
  const sites = [siteRow('s1', 'u1'), siteRow('s2', 'u2'), siteRow('s3', 'u1', new Date())]
  const popups = [popupRow('p1', 's1', 'u1', 'live', 0), popupRow('p2', 's1', 'u1', 'draft', 1), popupRow('p3', 's2', 'u2', 'live', 0), popupRow('p4', 's3', 'u1', 'paused', 0)]
  const day = (d: string) => new Date(d + 'T00:00:00Z')
  const stats = [
    { popupId: 'p1', day: day('2026-10-18'), target: 'main', impressions: 100, clicks: 7, closes: 20 },
    { popupId: 'p1', day: day('2026-10-15'), target: 'main', impressions: 50, clicks: 3, closes: 5 },
    { popupId: 'p1', day: day('2026-09-01'), target: 'main', impressions: 999, clicks: 99, closes: 9 }, // 期間外
    { popupId: 'p2', day: day('2026-10-17'), target: 'link:1', impressions: 0, clicks: 2, closes: 0 },
    { popupId: 'p3', day: day('2026-10-18'), target: 'main', impressions: 500, clicks: 50, closes: 0 }, // 他人
  ]
  const wheres: { model: string; where: any }[] = []
  const siteOk = (s: any, w: any) => (w.id === undefined || s.id === w.id) && (w.userId === undefined || s.userId === w.userId) && (w.deletedAt === undefined || s.deletedAt === w.deletedAt)
  const popupOk = (p: any, w: any) => {
    const s = sites.find((x) => x.id === p.siteId)!
    return (w.id === undefined || p.id === w.id) && (w.userId === undefined || p.userId === w.userId) && (w.siteId === undefined || p.siteId === w.siteId) && (!w.site || siteOk(s, w.site))
  }
  const statOk = (r: any, w: any) => (!w.popupId || (typeof w.popupId === 'string' ? r.popupId === w.popupId : w.popupId.in.includes(r.popupId))) && (!w.day?.gte || r.day >= w.day.gte)
  const withPopups = (s: any, include: any) => (include?.popups ? { ...s, popups: popups.filter((p) => p.siteId === s.id).sort((a, b) => a.sortOrder - b.sortOrder) } : s)
  const db = {
    popupSite: {
      findMany: async ({ where, include }: any) => (wheres.push({ model: 'popupSite', where }), sites.filter((s) => siteOk(s, where)).map((s) => withPopups(s, include))),
      findFirst: async ({ where, include }: any) => (wheres.push({ model: 'popupSite', where }), sites.filter((s) => siteOk(s, where)).map((s) => withPopups(s, include))[0] ?? null),
      count: async ({ where }: any) => (wheres.push({ model: 'popupSite', where }), sites.filter((s) => siteOk(s, where)).length),
    },
    popup: {
      findMany: async ({ where }: any) => (wheres.push({ model: 'popup', where }), popups.filter((p) => popupOk(p, where)).map((p) => ({ ...p, site: sites.find((s) => s.id === p.siteId) }))),
      findFirst: async ({ where, include }: any) => {
        wheres.push({ model: 'popup', where })
        const p = popups.find((x) => popupOk(x, where))
        return p ? { ...p, ...(include?.site ? { site: sites.find((s) => s.id === p.siteId) } : {}) } : null
      },
    },
    popupStat: {
      groupBy: async ({ where }: any) => {
        const out = new Map<string, any>()
        for (const r of stats.filter((x) => statOk(x, where))) {
          const g = out.get(r.popupId) || { popupId: r.popupId, _sum: { impressions: 0, clicks: 0, closes: 0 } }
          g._sum.impressions += r.impressions
          g._sum.clicks += r.clicks
          g._sum.closes += r.closes
          out.set(r.popupId, g)
        }
        return [...out.values()]
      },
      findMany: async ({ where }: any) => stats.filter((x) => statOk(x, where)),
    },
  }
  return { db: db as unknown as PopupDb, wheres }
}

test('listSites: 自分の、削除していないサイトだけ。30日の集計つき', async () => {
  const { db, wheres } = fakeDb()
  const list = await listSites(db, 'u1')
  assert.deepEqual(list.map((s) => s.id), ['s1'])
  assert.equal(list[0].liveCount, 1)
  assert.equal(list[0].totals.impressions, 150)
  assert.equal(list[0].totals.clicks, 12)
  assert.ok(wheres.every((w) => w.where.userId === 'u1'))
})

test('getSiteDetail: 他人のサイト・削除したサイトは null', async () => {
  const { db } = fakeDb()
  assert.equal(await getSiteDetail(db, 'u1', 's2', 30), null)
  assert.equal(await getSiteDetail(db, 'u1', 's3', 30), null)
  const d = await getSiteDetail(db, 'u1', 's1', 30)
  assert.ok(d)
  assert.deepEqual(d!.popups.map((p) => p.id), ['p1', 'p2'])
  assert.equal(d!.site.totals.ctr, 8) // (7+3+2)/150
})

test('totalsByPopup: 期間外の数字を含めない', async () => {
  const { db } = fakeDb()
  const t = await totalsByPopup(db, ['p1'], 7)
  assert.equal(t.get('p1')!.impressions, 150)
})

test('getPopupDaily: 日別を0で埋め、他人の案は null', async () => {
  const { db } = fakeDb()
  assert.equal(await getPopupDaily(db, 'u1', 'p3', 7, NOW), null)
  const d = await getPopupDaily(db, 'u1', 'p1', 7, NOW)
  assert.ok(d)
  assert.equal(d!.series.length, 7)
  assert.equal(d!.series[6].day, jstDay(NOW).toISOString().slice(0, 10))
  assert.equal(d!.totals.impressions, 150)
  assert.equal(d!.totals.ctr, 6.7)
})

test('getPopupSummary（ホームの集客の数字・popup.stats の正本）', async () => {
  const { db, wheres } = fakeDb()
  const s = await getPopupSummary(db, 'u1', 7)
  assert.equal(s.days, 7)
  assert.equal(s.siteCount, 1)
  assert.equal(s.liveCount, 1) // 削除したサイトの案は数えない
  assert.equal(s.totals.impressions, 150)
  assert.equal(s.totals.clicks, 12)
  assert.equal(s.totals.ctr, 8)
  assert.deepEqual(s.top.map((t) => t.popupId), ['p1'])
  assert.ok(wheres.every((w) => w.where.userId === 'u1'), '他人の数字を読んでいる')
  const empty = await getPopupSummary(db, 'nobody', 7)
  assert.equal(empty.siteCount, 0)
  assert.equal(empty.totals.ctr, null)
})

test('エージェントの道具: §5 の区分と承認', () => {
  assert.deepEqual(POPUP_AGENT_TOOLS.map((t) => t.key), ['popup.stats', 'popup.proposeDrafts', 'popup.publish'])
  assert.equal(popupStatsTool.reversibility, 'read')
  assert.equal(popupStatsTool.requiresApproval, false)
  assert.equal(popupProposeDraftsTool.reversibility, 'reversible')
  assert.equal(popupProposeDraftsTool.costClass, 'low')
  assert.equal(popupPublishTool.reversibility, 'irreversible')
  assert.equal(popupPublishTool.requiresApproval, true)
  for (const t of POPUP_AGENT_TOOLS) {
    assert.match(t.providerName, /^[a-zA-Z0-9_-]{1,64}$/)
    assert.equal(t.providerName, t.key.replace('.', '__'))
  }
})

test('エージェントの道具: 入力を厳格に検査する', () => {
  assert.ok(popupStatsTool.input.safeParse({ days: 7 }).success)
  assert.ok(!popupStatsTool.input.safeParse({ days: 14 }).success)
  assert.ok(!popupStatsTool.input.safeParse({ days: 7, userId: 'x' }).success, '他人の userId を受け取れてしまう')
  assert.ok(!popupPublishTool.input.safeParse({ popupId: 'x', status: 'live' }).success)
  assert.ok(!popupPublishTool.input.safeParse({ popupId: 'a'.repeat(25), status: 'draft' }).success)
  assert.ok(popupPublishTool.input.safeParse({ popupId: 'a'.repeat(25), status: 'paused' }).success)
})

test('エージェントの道具は API と同じ lib 関数を呼ぶ（処理を書き直さない）', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/popup/agent-tools.ts'), 'utf8')
  assert.ok(/getPopupSummary\(/.test(src))
  assert.ok(/proposeForUser\(/.test(src))
  assert.ok(/setPopupStatus\(/.test(src))
  assert.ok(!/prisma\.(popup|popupSite|popupStat)\./.test(src), 'agent-tools.ts で直接 DB を触っている')
})

test('nav.ts: サイドバーの項目はデータで、選択中の判定', () => {
  assert.deepEqual(POPUP_NAV.map((n) => n.href), ['/popup', '/popup/pricing'])
  // アイコンは名前の文字列（関数だとサーバの layout から渡せず 500 になる）。対応表にある名前だけ
  const { SHELL_ICONS } = require('../../components/shell/icons') as typeof import('../../components/shell/icons')
  for (const n of POPUP_NAV) {
    assert.equal(typeof n.icon, 'string', n.label)
    assert.ok(n.icon! in SHELL_ICONS, `対応表に無いアイコン: ${n.icon}`)
  }
  const home = POPUP_NAV[0]
  assert.ok(isPopupNavActive(home, '/popup'))
  assert.ok(isPopupNavActive(home, '/popup/sites/abc'))
  assert.ok(isPopupNavActive(home, '/popup/edit/abc'))
  assert.ok(!isPopupNavActive(home, '/popup/pricing'))
  assert.ok(isPopupNavActive(POPUP_NAV[1], '/popup/pricing'))
  const sidebar = readFileSync(join(process.cwd(), 'src/components/popup/PopupSidebar.tsx'), 'utf8')
  assert.ok(/POPUP_NAV\.map/.test(sidebar), 'サイドバーが nav.ts を描いていない')
  assert.ok(!/label: '/.test(sidebar), 'サイドバーに nav.ts 以外の項目がある（D-1）')
})

test('D-2: src/app/(shell)/popup に色の直書きが無い', () => {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(n) ? [p] : []
    })
  const hits = walk(join(process.cwd(), 'src/app/(shell)/popup')).flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => (/#[0-9a-fA-F]{3,6}/.test(line) ? `${f}:${i + 1}: ${line.trim()}` : null))
      .filter((x): x is string => !!x)
  )
  assert.deepEqual(hits, [])
})

test('D-3: 共通シェルにはフラグ ui.shell.popup が ON のときだけ載せる', () => {
  const layout = readFileSync(join(process.cwd(), 'src/app/(shell)/popup/layout.tsx'), 'utf8')
  assert.ok(/isShellEnabled\('popup'\)/.test(layout), 'layout.tsx がフラグを見ていない')
  assert.ok(/<PopupShellFrame[^>]*nav=\{POPUP_NAV\}/.test(layout), 'layout.tsx から nav.ts を渡していない')
  assert.ok(/<PopupAppLayout>/.test(layout), 'フラグ OFF の従来の枠が無い')
  // SHL-098: サーバの layout から 'use client' の ds/index.tsx 経由でトークンを読まない
  assert.ok(!/from '@\/components\/ds'/.test(layout), "layout.tsx が '@/components/ds' を読んでいる")
  assert.ok(/from '@\/components\/ds\/tokens\.module\.css'/.test(layout))
  const frame = readFileSync(join(process.cwd(), 'src/components/popup/PopupShellFrame.tsx'), 'utf8')
  // 枠（AppShell）は src/app/(shell)/layout.tsx が1つだけ出す。ツールの側で包むと二重になる（SHELL-MIGRATION.md）
  assert.ok(!/<AppShell/.test(frame), 'PopupShellFrame が AppShell で包んでいる（枠が二重になる）')
  assert.ok(/<ToolFrame[^>]*serviceId="popup"[^>]*nav=\{nav\}/.test(frame), 'ToolFrame に nav を渡していない')
})
