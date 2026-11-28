import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ソースの確認。React の描画は試さず、「アプリ表示モードのとき出さない条件」が入っていることを固定する。
const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8')

test('TrialCallout: アプリ表示モードのとき、判定中も含めて取りに行かず、4つの部品がすべて null を返す', () => {
  const s = read('src/components/TrialCallout.tsx')
  assert.match(s, /from '@\/lib\/app-mode\/client'/)
  assert.match(s, /const appMode = useAppMode\(\)/)
  assert.match(s, /const key = appMode \? ''/)
  // 部品はどれも useTrialEligible() が false なら null
  for (const name of ['TrialBadge', 'TrialNote', 'TrialInlineSuffix', 'TrialCallout']) {
    const i = s.indexOf(`export function ${name}(`)
    assert.ok(i > 0, name)
    const body = s.slice(i, i + 400)
    assert.match(body, /const eligible = useTrialEligible\(\)\s+if \(!eligible\) return null/, name)
  }
})

test('計測: アプリ表示モードのとき GTM と GA4 を読み込まない（読み込みの前の同期の判定）', () => {
  const gtm = read('src/components/GoogleTagManager.tsx')
  assert.match(gtm, /const appMode = useAppMode\(\)\s+if \(!GTM_ID \|\| appMode\) \{\s+return null/)
  const ga = read('src/components/GoogleAnalytics.tsx')
  assert.match(ga, /const appMode = useAppMode\(\)\s+if \(!GA_ID \|\| appMode\) return null/)
  const us = read('src/components/UserStateSignal.tsx')
  assert.match(us, /if \(appMode\) return/)
})

test('旗のクライアント側: process.env.NEXT_PUBLIC_APP_MODE_ENABLED のリテラルで読み、next.config.js が APP_MODE_ENABLED から写す', () => {
  assert.match(read('src/lib/app-mode/client.ts'), /process\.env\.NEXT_PUBLIC_APP_MODE_ENABLED === '1'/)
  assert.match(read('next.config.js'), /NEXT_PUBLIC_APP_MODE_ENABLED: process\.env\.APP_MODE_ENABLED === '1' \? '1' : ''/)
})

test('共通の部品: アプリ表示モードのとき、料金・アップグレードの導線を出さない', () => {
  const cases: Array<[string, RegExp]> = [
    ['src/components/UnifiedPricingPlans.tsx', /if \(appMode\) return null/],
    ['src/components/UnifiedPlanPromo.tsx', /if \(appMode\) return null/],
    ['src/components/UsageLimitBanner.tsx', /const disableLimitUi = appMode \|\|/],
    ['src/components/UsageLimitBanner.tsx', /if \(!isOpen \|\| appMode\) return null/],
    ['src/components/PlanUpgradeAlert.tsx', /if \(appMode\) \{/],
    ['src/components/sidebar/SidebarUsagePanel.tsx', /\{pricingHref && !appMode && \(/],
    ['src/components/limits/ServiceLimitProvider.tsx', /if \(appMode\) return <AppLimitNotice/],
    ['src/components/banner/BannerLimitModal.tsx', /if \(appMode\) return <AppLimitNotice/],
    ['src/components/doya-power/DoyaPower.tsx', /const actions = appMode \? undefined : actionsProp/],
    ['src/components/doya-power/DoyaPower.tsx', /\{!appMode && !actions && moreHref/],
  ]
  for (const [file, re] of cases) assert.match(read(file), re, file)
  assert.match(read('src/components/app-mode/AppLimitNotice.tsx'), /APP_LIMIT_NOTICE_TEXT = '上限に達しました。'/)
})

test('中立のページ /app-unavailable: noindex、1文だけ、料金・契約・購入の語を含まない', () => {
  const s = read('src/app/app-unavailable/page.tsx')
  assert.match(s, /robots: \{ index: false, follow: false \}/)
  assert.match(s, /このページはアプリではご利用になれません。/)
  const jsx = s.slice(s.indexOf('export default function'))
  assert.doesNotMatch(jsx, /料金|契約|購入|プラン|アップグレード|無料|href=/)
})

test('middleware: アプリ表示モードの判定は、Bearer の置き換えより前にある', () => {
  const s = read('src/middleware.ts')
  const a = s.indexOf('isAppRequest(req.headers)')
  const b = s.indexOf('isAppAuthEnabled() &&')
  assert.ok(a > 0 && b > 0 && a < b)
})

test('枠（AppShell）: アプリ表示モードのとき、左下の「料金プラン」への入口を出さない', () => {
  const s = read('src/components/shell/AppShell.tsx')
  assert.match(s, /const appMode = useAppMode\(\)/)
  assert.match(s, /\{!appMode && \(\s+<Link href="\/pricing"/)
})

test('共通レイアウト: アプリ表示モードのときだけ、上の帯・サイドバー・下のタブ・パンくず・題を隠す（それ以外は属性が付かず、何も変わらない）', () => {
  const shell = read('src/components/shell/AppShell.tsx')
  assert.match(shell, /data-app-mode=\{appMode \? 'true' : undefined\}/)
  const css = read('src/components/shell/AppShell.module.css')
  for (const part of ['topbar', 'sidebar', 'scrim', 'tabbar']) assert.match(css, new RegExp(`\\.shell\\[data-app-mode='true'\\] \\.${part}`))
  assert.match(css, /\.shell\[data-app-mode='true'\] \{ grid-template-columns: minmax\(0, 1fr\); --shell-mobile-bottom-inset: 0px; \}/)
  assert.match(css, /\.shell\[data-app-mode='true'\] \.main \{ padding-bottom: env\(safe-area-inset-bottom/)
  // 隠す規則は、すべて data-app-mode の下にある（この追記より前の規則は変えていない）
  const appPart = css.slice(css.indexOf('アプリ表示モード'))
  assert.doesNotMatch(appPart.replace(/\.shell\[data-app-mode='true'\][^{]*[{][^}]*[}]/g, ''), /\{[^}]*display: none/)
  const frame = read('src/components/shell/ToolFrame.tsx')
  assert.match(frame, /data-app-mode=\{appMode \? 'true' : undefined\}/)
  assert.match(frame, /appMode \? 'このツールの残り' : 'このツールの残りとプラン'/)
  const fcss = read('src/components/shell/ToolFrame.module.css')
  assert.match(fcss, /\.frame\[data-app-mode='true'\] \.crumbs \{ display: none; \}/)
  assert.match(fcss, /\.frame\[data-app-mode='true'\] \.title \{[^}]*clip: rect\(0 0 0 0\)/) // 見えなくして読み上げには残す（display: none にしない）
  // 見出しの折り返し: アプリ表示モードの下だけ。text-wrap の一括指定は使わない
  const ds = read('src/components/ds/ds.module.css')
  assert.match(ds, /:global\(\[data-app-mode='true'\]\) \.heroTitle,\n:global\(\[data-app-mode='true'\]\) \.heroLead,\n:global\(\[data-app-mode='true'\]\) \.emptyTitle,\n:global\(\[data-app-mode='true'\]\) \.emptyText \{ word-break: keep-all; overflow-wrap: anywhere; \}/)
  assert.doesNotMatch(ds.slice(ds.indexOf('アプリ表示モード')), /text-wrap\s*:/)
  assert.match(read('src/components/sidebar/SidebarUsagePanel.tsx'), /appMode \? null : <>\{summary\.planLabel\}プランのため<\/>/)
})

test('共通の画面部品: アプリ表示モードのとき、ds の Button は止める経路へのリンクを出さず、ErrorNotice は料金の語を含む文を差し替える', () => {
  const idx = read('src/components/ds/index.tsx')
  assert.match(idx, /if \(appMode && props\.href !== undefined && classifyBlockedPath\(props\.href\) !== 'none'\) return null/)
  const fb = read('src/components/ds/feedback.tsx')
  assert.match(fb, /what = mapLimitMessage\(what, appMode\)/)
  assert.match(fb, /how = how === undefined \? undefined : mapLimitMessage\(how, appMode, ''\)/)
})

test('旧サイドバー11本: アプリ表示モードのとき、料金のナビとプラン・アップグレードの枠を出さない', () => {
  const guards: Array<[string, RegExp]> = [
    ['src/components/CopySidebar.tsx', /\{!appMode && sessionReady/],
    ['src/components/AdSimSidebar.tsx', /\{!appMode && \(isMobile/],
    ['src/components/LpSidebar.tsx', /\{!appMode && sessionReady/],
    ['src/components/ShindanSidebar.tsx', /\{!appMode && sessionReady/],
    ['src/components/doyaslide/DoyaSlideSidebar.tsx', /\{!appMode && sessionReady/],
    ['src/components/movie/MovieSidebar.tsx', /\{!appMode && showLabel/],
    ['src/components/voice/VoiceSidebar.tsx', /\{!appMode && showLabel/],
    ['src/components/interviewx/InterviewXSidebar.tsx', /if \(appMode \|\| !showLabel/],
    ['src/components/adbanner/AdBannerSidebar.tsx', /\{!appMode && sessionReady/],
    ['src/components/DashboardSidebar.tsx', /if \(appMode \|\| !showLabel\) return null/],
    ['src/components/tenkai/TenkaiSidebar.tsx', /<HideInAppMode>/],
  ]
  for (const [file, re] of guards) assert.match(read(file), re, file)
  for (const f of ['CopySidebar', 'AdSimSidebar', 'LpSidebar', 'movie/MovieSidebar', 'voice/VoiceSidebar', 'interviewx/InterviewXSidebar', 'adbanner/AdBannerSidebar', 'doyaslide/DoyaSlideSidebar']) {
    assert.match(read(`src/components/${f}.tsx`), /navForMode\(/, f)
  }
})

test('折り返し: 説明文・空状態の文は PhraseText を通し、CSS は data-app-mode の下だけ（Web のブラウザでは DOM も CSS も変わらない）', () => {
  const idx = read('src/components/ds/index.tsx')
  for (const re of [/<p className=\{styles\.heroLead\}><PhraseText>/, /<h2 className=\{styles\.heroTitle\}><PhraseText>/, /<p className=\{styles\.emptyText\}><PhraseText>/]) assert.match(idx, re)
  assert.match(read('src/components/shell/ToolFrame.tsx'), /<p className=\{styles\.description\}><PhraseText>/)
  const pt = read('src/components/app-mode/PhraseText.tsx')
  assert.match(pt, /if \(!appMode \|\| typeof children !== 'string'\) return <>\{children\}<\/>/)
  const ds = read('src/components/ds/ds.module.css')
  assert.match(ds, /:global\(\[data-app-mode='true'\]\) \.emptyText \{ word-break: keep-all; overflow-wrap: anywhere; \}/)
  assert.match(read('src/components/shell/ToolFrame.module.css'), /\.frame\[data-app-mode='true'\] \.description \{ word-break: keep-all; overflow-wrap: anywhere; \}/)
})
