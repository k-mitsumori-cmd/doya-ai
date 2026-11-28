import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * 止め漏れの検査。料金・アップグレードの導線の語を含む src/ のファイルのうち、
 * アプリ表示モードの共通部品（@/lib/app-mode、@/components/app-mode、共通の画面部品 @/components/ds）を import していないものを集め、
 * 下の許可リスト（理由つき）に無ければ失敗させる。新しい導線を足したときに、アプリ表示モードの対応を忘れないための検査。
 * 許可リストに残るものは、docs/architecture/2026-11-18-app/app-mode-web.md の「残りの導線」の表に書く。
 */
const WORDS = /アップグレード|プロプラン|料金プラン|['"`]\/(?:[\w-]+\/)*(?:pricing|billing)(?![\w-])|初月無料|追加購入|api\/stripe\/checkout/
const SAFE = /@\/lib\/app-mode|@\/components\/app-mode|@\/components\/ds['"/]/

/** 理由つきの許可（パターン）。公開の LP・止めた画面・文言だけの定数などは、アプリの画面の導線ではない */
const ALLOW_PATTERNS: Array<[RegExp, string]> = [
  [/\/Lp\.tsx$|\/lp-data\.ts$|\/Landing\.tsx$|\/landing\/|^src\/app\/lp\/|^src\/components\/lp\/|PromaneLp\.tsx$|^src\/app\/all-in-one\/|^src\/app\/campaign\//, '公開の LP・紹介ページ（アプリはツール画面だけを開く前提）'],
  [/\/pricing\/(page|layout)\.tsx$|^src\/app\/tokushoho\/|\/dashboard\/plan\/page\.tsx$|^src\/app\/billing\//, '止める経路（middleware が /app-unavailable へ rewrite する）'],
  [/dev\/states\/|notice-preview\//, '開発用の見本の画面（本番の導線ではない）'],
  [/^src\/app\/llms|^src\/app\/sitemap\.ts$|^src\/app\/robots/, '検索・AI 向けのテキストの経路（アプリの画面ではない）'],
  [/^src\/components\/mitsuboshi\//, '別サービス（三ツ星アプリ）の自前のヘッダー・フッター'],
  [/^src\/components\/AdminSidebar\.tsx$/, '管理画面'],
  [/^src\/components\/pricing\//, '契約の部品そのもの（API が止まり、呼び出し側が出さない。ドヤパワーの案内は LowPowerNotice が止める）'],
]

/** 理由つきの許可（個別）。残りの導線の表と対応 */
const ALLOW_FILES: Record<string, string> = {
  'src/components/CheckoutButton.tsx': '押した先の API（/api/stripe/checkout）を止める。ボタンの文言は呼び出し側（HideInAppMode などで処理）',
  'src/components/UpgradeSuccessModal.tsx': '決済のあとのお礼。アプリでは決済が起きない',
  'src/components/asklink/errors.ts': '文言の定数（表示は ErrorNotice が中立の文に差し替える）',
  'src/components/doyalist/errorCopy.ts': '同上',
  'src/components/quote/error-copy.ts': '同上',
  'src/components/shell/nav.ts': 'コメントだけ',
  'src/components/shell/registry.ts': '料金リンクの行き先の台帳（表示側 SidebarUsagePanel が出さない）',
  'src/components/shell/ShellEntryFrame.tsx': '内部の判定だけ（文言なし）',
  'src/components/shell/ShellUsage.tsx': '台帳の読み取りだけ（リンクは SidebarUsagePanel が出さない）',
  'src/components/shell/low-power.tsx': 'LowPowerNotice 側（DoyaPower.tsx）が追加・プランの案内を出さない',
  'src/components/voice/VoiceLayout.tsx': '止めた画面の題だけ',
  'src/app/kantan/dashboard/page.tsx': '未使用のナビ定数（実際のナビは text/ 配下で navForMode を通す）',
  'src/app/kantan/dashboard/chat/page.tsx': '同上',
  'src/app/kantan/dashboard/history/page.tsx': '同上',
  'src/app/kantan/dashboard/plan/page.tsx': '止める経路',
  // ↓ まだ直していない（残りの導線の表に載せる）
  'src/app/(shell)/banner/dashboard/chat/page.tsx': '未対応: テキストの上限の導線の状態（setTextLimitAction）',
  'src/app/(shell)/home/agent.ts': '未対応: ホームの案内の文言',
  'src/app/(shell)/interview/settings/page.tsx': '未対応: プラン管理の画面',
  'src/app/(shell)/promane/[workspaceSlug]/help/page.tsx': '未対応: ヘルプの FAQ の文',
  'src/app/(shell)/seo/settings/page.tsx': '未対応: 設定の画面の「料金プランを確認・変更する」',
  'src/app/movie/templates/page.tsx': '未対応: PRO のテンプレートのカードのリンク先',
  'src/app/opening/guide/page.tsx': '未対応: ガイドの文中の「プロプラン」',
  'src/components/banner/BannerTemplateGallery.tsx': '未対応: プランの札の名前',
  'src/components/opening/AnimationCard.tsx': '未対応: 「プロプランでアンロック」の文',
}

function scan(dir: string, out: Array<{ file: string; safe: boolean }>) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (p === path.join('src', 'lib') || p === path.join('src', 'app', 'api') || p === path.join('src', 'app', 'admin') || e.name === 'node_modules') continue
      scan(p, out)
    } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
      const s = readFileSync(p, 'utf8')
      if (WORDS.test(s)) out.push({ file: p.split(path.sep).join('/'), safe: SAFE.test(s) })
    }
  }
}

test('導線の語を含むファイルは、アプリ表示モードの共通部品を使うか、理由つきの許可リストにある', () => {
  const found: Array<{ file: string; safe: boolean }> = []
  scan('src', found)
  assert.ok(found.length > 100, '走査が働いていない: ' + found.length)
  const unhandled = found.filter((f) => !f.safe && !ALLOW_PATTERNS.some(([re]) => re.test(f.file)) && !(f.file in ALLOW_FILES)).map((f) => f.file)
  assert.deepEqual(unhandled, [], '導線の語を含むが、アプリ表示モードの対応も許可リストも無いファイル。useAppMode・HideInAppMode・ds の Button/ErrorNotice を使うか、理由つきで許可リストに足す')
})

test('許可リストの個別の項目は、いまも該当するファイルだけ（直したら外す）', () => {
  const found: Array<{ file: string; safe: boolean }> = []
  scan('src', found)
  const stale = Object.keys(ALLOW_FILES).filter((f) => !found.some((x) => x.file === f && !x.safe))
  assert.deepEqual(stale, [])
})
