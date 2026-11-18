# アプリ表示モード（Web 側）

作成日: 2026-11-18。枝: `feat/app-mode-web-20261118`（アプリ認証の枝 `feat/app-auth-foundation-20261118` の先頭から作成）。状態: 実装と試験まで。画面は見ていない。本番には入れていない。

## 1. 目的

ドヤバディのアプリ（Expo の殻）は、ツール画面を WebView で表示する。Apple の審査では、アプリの中に、アプリの外での購入への案内（価格・料金・プラン・無料トライアル・契約・購入・アップグレードの呼びかけ。リンクの有無を問わない）があると、却下される恐れが高い（`store-prep/01-apple-rules-japan.md`）。また、WebView の中で Web の計測（GTM・GA4・HubSpot）が動くと、App Store の「トラッキング」の申告が要る（`store-prep/02-app-privacy-labels.md`）。

そこで Web 側に「アプリ表示モード」を作り、アプリの WebView のときだけ、課金の導線と計測を出さない。Web のブラウザで見る人の動きは変えない。

## 2. 仕組み

### 2.1 判定（単一ソース: `src/lib/app-mode/`）

| ファイル | 中身 |
|---|---|
| `detect.ts` | 判定の純粋関数。`isAppModeEnabled(env)`、`isAppRequest(headers, env)`（サーバー側）、`decideAppModeClient({enabled, userAgent, cookie})`（ブラウザ側）、`hasAppUserAgent`、`hasAppCookie`。Edge の middleware からも呼ぶため、node 専用の部品を使わない |
| `client.ts` | `isAppModeClient()`（同期）と React のフック `useAppMode()`。`useSyncExternalStore` で判定する |
| `blocked-routes.ts` | 止める経路の一覧と、`classifyBlockedPath(path)`（`'page' / 'api' / 'none'`）。パスの正規化を含む |

アプリ表示モードと判定する条件は、次のどちらかである。

- User-Agent に `DoyaBuddyApp` が 1 語として含まれる（アプリ側 `app/tool/[id].tsx` の `applicationNameForUserAgent`）。大文字小文字は区別しない。`DoyaBuddyApps`、`NotDoyaBuddyApp` のような似た名前は対象にしない。
- Cookie `doya_app=1` がある（値は `1` だけ）。

### 2.2 旗

環境変数 `APP_MODE_ENABLED === '1'` のときだけ、この機能の全体がオンになる。既定はオフ。アプリ認証の旗 `APP_AUTH_ENABLED` とは別に動く。

- オフのときは、判定が常に「アプリではない」を返す。User-Agent や Cookie があっても、middleware は何も変えず、部品は今までと同じに描画される（`detect.test.ts` と `middleware.test.ts` で確かめている）。
- ブラウザ側の判定は、環境変数を直接読めない。そのため `next.config.js` の `env` で、`APP_MODE_ENABLED` を `NEXT_PUBLIC_APP_MODE_ENABLED` に写している（ビルド時に埋まる）。このため、旗を変えたあとは再デプロイが要る。

### 2.3 Cookie `doya_app`

`GET /api/app/auth/web-handoff/consume` が成功したとき、アプリ用セッションの Cookie と一緒に、次の Cookie をセットする。

| 項目 | 値 |
|---|---|
| 名前・値 | `doya_app` = `1` |
| HttpOnly | なし（ブラウザ側の判定が `document.cookie` で読むため） |
| SameSite・Path | Lax・`/` |
| Secure | https のときだけ（セッション Cookie と同じ規則） |
| 期限 | セッション Cookie と同じ（24 時間） |

ログアウトでは消さない。WebView 専用の領域に置くものなので、残っても害はない。

### 2.4 描画の挙動（ちらつきの扱い）

- 旗オフ: サーバーの描画も、ブラウザの描画も、導入前と同じ。
- 旗オン: サーバーの描画と、ブラウザの最初の描画では「アプリかもしれない」側（`true`）に倒す。ブラウザでは最初の描画のあとに、同期の読み取り（User-Agent と `document.cookie`）の値に切り替わる。課金の導線は、判定が終わるまで出ない。Web のブラウザの人では、判定の直後に導線が出る。
- GTM・GA4 は、判定が `true` の間は読み込まない。ブラウザの人では、最初の描画のあとに読み込みが始まる（旗オンのときだけ、読み込みの開始がわずかに遅れる）。

## 3. 止める経路の一覧

旗オンで、アプリ表示モードの要求のときだけ、`src/middleware.ts` が止める。許可する経路の一覧ではなく、止める経路の一覧である。一覧は `blocked-routes.ts` にあり、`blocked-routes.test.ts` で固定している。

| 種類 | 経路 | 止め方 |
|---|---|---|
| 画面 | `/pricing`（`/pricing/join` を含む）、`/tokushoho`、`/billing`（`/billing/portal-unavailable`） | `/app-unavailable` へ rewrite |
| 画面 | `/banner/dashboard/plan`、`/seo/dashboard/plan`、`/kantan/dashboard/plan`（名前に `pricing`・`billing` を含まない、プランの管理の画面） | `/app-unavailable` へ rewrite |
| 画面 | パスのどこかの区切りが `pricing` または `billing` のもの（各ツールの `/xxx/pricing`、`/hr/settings/billing`、`/kantan/dashboard/pricing`、`/admin/billing` など） | `/app-unavailable` へ rewrite |
| API | `/api/stripe/checkout`、`/api/stripe/portal`、`/api/stripe/sync`（配下を含む）、`/api/stripe/trial-eligibility` | 404（`{"code":"NOT_FOUND"}`） |
| API | `/api/pricing/billing`、`/api/pricing/checkout-recovery`、`/api/pricing/power-pack`（`confirm` を含む）、`/api/pricing/seats`、`/api/pricing/upsell`、`/api/pricing/status` | 404 |
| API | `/api/hr/billing`（checkout・portal）、`/api/organization-billing`、`/api/admin/doya-power/purchase` | 404 |

止めないもの: `/api/stripe/webhook`（Stripe のサーバーが呼ぶ）、`/api/pricing/members`（チームのメンバーの管理。購入ではない）、`/api/cron/billing-audit`、`/seo` などの通常のツールの経路、`/app-unavailable` 自身。

パスの正規化（アプリ側 `webPolicy.ts` の `normalizePath` と同じ規則）: パーセント表記を変化がなくなるまで decode する（上限 5 回。収まらなければ止める側）、`//`・`/./`・`/../`・末尾の `/` を畳む、`;` 以降を落とす、小文字にする、クエリは見ない。正規化できないパスは、止める側（`/api/` なら API、それ以外は画面）に倒す。`%70ricing`、`//pricing`、`/./pricing`、`/pricing/` などで迂回できないことは、試験で確かめている。

middleware での位置: Bearer の置き換えより前に置いた。置き換えを先にすると、Bearer 付きの `/api/stripe/checkout` が通り抜けるため。

## 4. 隠した部品の一覧（旗オン・アプリ表示モードのとき）

| 部品 | 挙動 |
|---|---|
| `TrialCallout.tsx`（`TrialBadge`・`TrialNote`・`TrialInlineSuffix`・`TrialCallout`） | `useTrialEligible()` が、判定中も含めて false を返し、`/api/stripe/trial-eligibility` も呼ばない。4 つの部品はすべて null を返す。`useTrialEligible()` を使う CTA 文言の出し分けは、対象外の文言になる |
| `UnifiedPricingPlans.tsx` | 何も描画しない（各ツールの `/xxx/pricing` を埋める料金表） |
| `UnifiedPlanPromo.tsx` | 何も描画しない |
| `UsageLimitBanner.tsx`（`UsageLimitBanner`・`UsageLimitModal`） | 何も描画しない |
| `PlanUpgradeAlert.tsx` | リンクを出さず、「この機能はアプリではご利用になれません。」の文だけ |
| `limits/ServiceLimitProvider.tsx` | 全ツール共通の上限到達のモーダルを、「上限に達しました。」と「閉じる」だけの中立のお知らせ（`app-mode/AppLimitNotice.tsx`）に置き換える |
| `banner/BannerLimitModal.tsx` | 同上 |
| `sidebar/SidebarUsagePanel.tsx` | 「組織のプランと利用枠を確認」「プランと料金を見る」のリンクを出さない（残りの数のバーは出す） |
| `shell/AppShell.tsx` | 左下の「料金プラン」（`/pricing`）への入口を出さない |
| `doya-power/DoyaPower.tsx`（`LowPowerNotice`） | 「追加する」「チームにする」、増やし方へのリンク、行動の欄（`UpsellActions`）を出さない。「回復するのを待つ」の案内だけ残す |
| `GoogleTagManager.tsx` | GTM を読み込まない（GA4・HubSpot は GTM 経由のため、これで止まる） |
| `GoogleAnalytics.tsx` | GA4 の読み込み、計測イベントの送信、アトリビューション Cookie の書き込みをしない |
| `UserStateSignal.tsx` | `dataLayer` への書き込みをしない |
| `/app-unavailable`（新規） | 中立の静かなページ。「このページはアプリではご利用になれません。」だけ。`noindex` |

### 4.1 共通のレイアウト（アプリの「戻る＋題」の帯と重ならないようにする）

アプリ側に「戻る＋題」の帯があるため、アプリ表示モードでは Web の帯を出さない。`AppShell` が、アプリ表示モードのときだけ `data-app-mode="true"` を付け、CSS はすべてこの属性の下に書いた（付かないときの見た目は、導入前と同じ）。

| 対象 | 挙動 | 場所 |
|---|---|---|
| 上の帯（三本線・ロゴ・虫めがね） | 出さない | `AppShell.module.css`（`.topbar`） |
| サイドバー（三本線で開くもの）、暗幕 | どの幅でも出さない | 同（`.sidebar`・`.scrim`） |
| 下のタブ（ホーム・すべて・アカウント） | 出さない | 同（`.tabbar`） |
| 余白の補正 | 下のタブ分の余白（`--shell-mobile-bottom-inset`）を 0 にし、本文の下は `safe-area-inset-bottom` だけにする。サイドバーの列も外し、本文を 1 列にする。上の帯は固定位置（`sticky`）の分の余白を使っていないため、上の補正は無い | 同 |
| パンくず（経営ホーム > ツール名） | 出さない。組織の切り替え・会社の表示は残す | `ToolFrame.module.css`（`.crumbs`） |
| ページの題（h1） | 見えなくして、読み上げには残す（`display: none` にしない） | 同（`.title`） |
| ツール内のタブ（タイプ記事作成など） | 残す | — |
| 「このツールの残りとプラン」 | 「このツールの残り」に変える。開くと、残りの量のバーだけを出し、プラン名の文（「プロプランのため」）と料金・プランへのリンクは出さない。ドヤパワーの残りの表示（ツールの中の使える量）は残す | `ToolFrame.tsx`、`SidebarUsagePanel.tsx` |

### 4.2 見出しの折り返し

375px で、ツール画面の見出し「キーワードから、検索で読まれる記事を」が「検／索」で切れた。原因: 見出し（`ToolHero` の `heroTitle`）に折り返しの指定が無く、`<wbr>` があっても、ブラウザは行に入るだけの文字（9 文字）で切るため。`text-wrap: balance` は、9 文字と 9 文字に均等に割って、同じ位置で切れるので、直らない。`text-wrap` の一括指定は `white-space: nowrap` を上書きするため（renewal.css の件）、使わなかった。

直し方（アプリ表示モードの下だけ。Web のブラウザの見た目は変えない）: `ds.module.css` に、`word-break: keep-all; overflow-wrap: anywhere` を足した。`<wbr>` のある見出しは、`<wbr>` の位置でだけ折り返す。`<wbr>` の無い見出しは、行に収まらないときだけ、従来どおりどこでも折り返す。`word-break: auto-phrase` に対応するブラウザでは、見出しと説明文にそちらを使う（Safari・WKWebView の対応は未確認）。

注意: `<wbr>` を入れていない見出しは、この直しの効果が無い（従来どおり）。`<wbr>` を入れるのは、各ツールの見出しごとの作業である。

### 4.3 帯を隠したあとに、画面に「ドヤAI」が出る所（直すかは三森さんの判断。今回は直していない）

| ファイル（行） | 内容 | 出る条件 | 直し方の案 |
|---|---|---|---|
| `shell/AppShell.tsx`（474, 493） | `brandName()`（上の帯のロゴ、サイドバーの先頭）。どちらも、アプリ表示モードでは隠れる | 旗 `NEXT_PUBLIC_BRAND_RENAME_ROLLOUT` が `all` なら「ドヤバディ」 | 隠れているので対応は不要 |
| `shell/ProductSwitcher.tsx`（46, 87, 91） | 製品の切り替え（`ブランド名 製品名`）。上の帯の中なので、隠れる | 同 | 同上 |
| `notice/ShellNotices.tsx`（71, 80） | 初回の知らせ「ドヤAI へようこそ」「ドヤAI の使い方」 | 初回のログイン後など | アプリ表示モードでは出さないか、`brandName()` を通す |
| `support-chat/SupportChat.tsx`（268） | サポートの表題「ドヤAI サポート」 | ツール名が無いとき | `brandName()` を通す |
| `home-agent/HomeAgent.tsx`（418, 607, 665, 747） | ホームの依頼の画面の「ドヤAIに頼む」「ドヤAIが、依頼を読んでいます…」 | ホーム画面 | 同上 |
| `shell-next/DeptShellSample.tsx`（60, 196, 209, 422-423） | 見本の画面の「ドヤAI」 | 見本の画面だけ | 対応は不要（本番の導線ではない） |
| `(shell)/banner/layout.tsx`（14） | コメントのみ。ブラウザのタブの題の末尾に「ドヤAI」が付く（ルートの template）。アプリの WebView では画面に出ない | — | 対応は不要 |
| 各ツールの Lp・`lp-data` | LP の文中の「ドヤAI」 | LP を開いたとき | アプリは LP を開かない前提 |

そのほか: 新しい料金の行動の欄（`pricing/UpsellActions`）と、ドヤパワーの知らせのシート（`notice/PowerOutNotices`）は、`/api/pricing/upsell` を読めたときだけ動く。アプリ表示モードではこの API が 404 になるため、旗オフのときと同じく動かない。

確認だけして、手を入れていないもの: フィードバックのカード（`FeedbackMount`）は自社の `/api/feedback` にだけ送る。`package.json` に posthog・Sentry・mixpanel などの外部の計測は無い。`kintai/layout.tsx` と `AppShell` にある HubSpot の非表示の CSS は、GTM を読み込まなければ働かないだけで、無害である。

## 5. 残りの導線（要対応）

調べ方: `src/app`・`src/components` で、`アップグレード`・`プロプラン`・`/pricing`・`初月無料`・`プランを見る`・`料金プラン`・`追加購入` を grep した。上の共通の部品と、止めた画面（`/xxx/pricing` ページ）を除いて、約 154 ファイルが残る（別に、公開の LP・`lp-data` が約 60 ファイル。アプリの WebView でツール画面だけを開く前提では対象外だが、ツールの外へ出るリンクが残るかは確かめていない）。全部を直すと範囲が広がりすぎるため、共通の部品を先に直し、残りは次の表に分けた。行番号は 2026-11-18 時点の概算。

直し方の共通の案: 各ファイルで `useAppMode()` を読み、true のとき (a) 料金・アップグレードのリンクと文を出さない、または (b) 中立の文（「上限に達しました。」）に変える。リンク先の `/xxx/pricing` は、middleware が止めるため、リンクを残しても `/app-unavailable` の中立のページに着く。ただし、リンクの文字（「プロにアップグレード」など）が画面に残ること自体が審査の対象なので、(a) か (b) が要る。

| 区分 | ファイル（行） | 内容 | 直し方の案 |
|---|---|---|---|
| 各ツールの左のサイドバー（約 11 本） | `DashboardSidebar.tsx`（203, 327-350）、`CopySidebar.tsx`（33, 101-111）、`AdSimSidebar.tsx`（38, 127-138）、`doyaslide/DoyaSlideSidebar.tsx`（30, 159-167）、`movie/MovieSidebar.tsx`（34, 129-135）、`voice/VoiceSidebar.tsx`（41, 183-186）、`interviewx/InterviewXSidebar.tsx`（38, 92, 149）、`ShindanSidebar.tsx`（107-116）、`LpSidebar.tsx`（33, 135-142）、`tenkai/TenkaiSidebar.tsx`（141）、`adbanner/AdBannerSidebar.tsx`（22, 66） | 「料金プラン」のナビ項目、「プロにアップグレード」、「プロプラン：¥9,980/月」、`TrialInlineSuffix` | 共通のカード（「プロにアップグレード」の枠）を 1 つの部品にまとめ、その部品で `useAppMode()` を見る。ナビ項目は `useAppMode()` で除く |
| ツール本体の上限の文と「料金プランを見る」ボタン | `(shell)/quote/Tool.tsx`（462, 658, 707, 955-961）、`(shell)/mensetsu/Tool.tsx`（133, 349-401, 558-559, 874）、`(shell)/doyalist/Tool.tsx`（374-431, 741-749）、`(shell)/interview/Tool.tsx`（272-280）、`persona/PersonaBannerGenerator.tsx`（54-98）、`(shell)/persona/Tool.tsx`、`(shell)/cunning/Tool.tsx`、`(shell)/shodan/Entry.tsx`、`doyaslide/NewDoyaSlideWizard.tsx`（209, 419, 920）、`shanai/ui.tsx`（255-284）、`(shell)/aio/[orgSlug]/page.tsx`（127, 217, 486）、`doyalist/ToolForm.tsx`、`doyalist/errorCopy.ts` | 上限に達したときの案内文と、料金ページへのボタン・リンク | 上限の案内を出す共通の部品（`ErrorNotice`・`LimitState` など）に `useAppMode()` を足し、リンクを出さず中立の文にする。各ツールが個別に持つ文は、文だけ差し替える |
| banner | `(shell)/banner/url/page.tsx`（593-605, 797-803）、`(shell)/banner/dashboard/page.tsx`（1920, 2568-2594）、`dashboard/create`・`chat`・`stats`・`history`・`gallery`・`guide`・`landing`、`banner/BannerQuotaNotice.tsx`、`banner/BannerTemplateGallery.tsx`、`(shell)/banner/dashboard/plan/page.tsx`・`settings/page.tsx` | 「PROにアップグレードすると…」「プロプランは月n枚まで」「料金プラン」、プランの管理の画面（`/banner/dashboard/plan` は `/pricing` を含まないため middleware で止まらない） | 利用の多いツール。`dashboard/plan` は、止める経路に足した（3 章）。残りは上の方針 |
| seo | `(shell)/seo/articles/[id]/page.tsx`（223-227, 331, 660, 1922）、`seo/images/[id]`、`seo/swipe`、`seo/create`、`seo/settings`、`seo/template`、`seo/dashboard/plan/page.tsx`（画面ごと止めた。ほかの画面からのリンクの文字は残る）、`seo/articles/[id]/components/OutlineEditor.tsx`・`ScorePanel.tsx` | 「アップグレードでダウンロードできます」「料金プランを見る」 | 上の方針。`dashboard/plan` は banner と同じ |
| interview | `(shell)/interview/projects/*`（materials・generate・edit・transcribe）、`skills`、`recipes`、`settings`、`interview/InterviewUpsellModal.tsx`（283-291）、`interview/InterviewUpgradeCelebration.tsx` | アップセルのモーダル、「プロにアップグレード」 | モーダルの部品で `useAppMode()` を見て null にする |
| kantan | `kantan/dashboard/*`（history・chat・text・`plan`） | 上限・プランの案内（`/kantan/dashboard/plan` 自体は止めた） | 上の方針 |
| voice・tenkai・movie・opening・adsim | `voice/speakers`・`record`・`new`・`settings`・`[projectId]/edit`、`tenkai/settings`、`tenkai/PricingTable.tsx`（143, 170, 274）、`movie/templates`、`opening/guide`・`opening/AnimationCard.tsx`、`adsim/[projectId]` | 上限・プランの案内。`tenkai/PricingTable.tsx` は `/api/stripe/checkout` を呼ぶ（API は止まる） | 上の方針 |
| hr | `hr/UpgradeBanner.tsx`（62, 92）、`hr/HrLoadError.tsx`、`hr/CsvImportModal.tsx`、`hr/HrShellFrame.tsx`、`(shell)/hr/employees/new`・`evaluations/[id]` | 「アップグレードで上限を拡張できます」 | `UpgradeBanner` で `useAppMode()` を見て null にする |
| その他の部品 | `shell/low-power.tsx`（104-105）、`notice/PowerOutNotices.tsx`、`notice/HandoffSuggest.tsx`（35）、`notice/ShellNotices.tsx`、`FreeHourPopup.tsx`、`shell/ShellGate.tsx`、`shell/ShellEntryFrame.tsx`、`shell/ShellUsage.tsx`、`CheckoutButton.tsx`、`StripeSuccessSync.tsx`、`UpgradeSuccessModal.tsx`、`pricing/UpsellActions.tsx`、`(shell)/home/HomeDashboard.tsx`、`(shell)/home/agent.ts`、`(shell)/settings/*`、`shell/registry.ts`（料金のリンクの行き先） | `low-power.tsx` の `moreLabel="プランを見る"` は、`LowPowerNotice` の側でリンクを止めているため、画面には出ない。`HandoffSuggest`（スライドの上限のトースト「プランを見る」）、`FreeHourPopup`（フリーアワー）、ホームの案内は出る | `HandoffSuggest` と `FreeHourPopup` と `HomeDashboard` は、利用が多いため先に直す |
| 文面（lib） | `lib/service-limit-ui.ts`、`lib/plan-limit.ts`、`lib/usage-summary.ts`、`lib/*/limits.ts`、`lib/*/access.ts`、API が返すエラーの文（「プロプラン契約が必要」など） | API が返す文言そのものに、料金・プランの語が入る | API の応答の文は、アプリ表示モードで変えにくい。画面側が文を出すとき、`useAppMode()` が true なら中立の文に差し替える方針が現実的 |
| 公開の LP（約 60 ファイル） | `(shell)/*/Lp.tsx`、`*/lp-data.ts`、`kantan/lp-data.ts`、`copy/lp-data.ts`、`(shell)/banner/landing/*` | 料金の見出し・価格・CTA | アプリは LP を開かない前提。アプリのトップから LP へ出るリンクが無いことの確認が先 |

件数の目安: 上の表の「ツール本体」から「その他」までが、利用の多い順に約 100 ファイル。画面ごとの確認はまだしていない。

## 6. 試験

`npm run test:app-mode`（`tsx --test`。25 件）。`npm run test:app-auth`（160 件）とは別に両方通す。

| ファイル | 件数 | 確かめること |
|---|---|---|
| `src/lib/app-mode/detect.test.ts` | 6 | 旗、User-Agent（大文字小文字・似た名前）、Cookie、サーバーとブラウザの判定、旗オフで常に「アプリではない」 |
| `src/lib/app-mode/blocked-routes.test.ts` | 6 | 止める経路の一覧の固定、通常の経路が止まらないこと、パスの正規化での迂回の防止、正規化できないパスの扱い |
| `src/lib/app-mode/middleware.test.ts` | 5 | 旗オフと非アプリでは何も変わらない、旗オンで画面は rewrite・API は 404、Bearer の置き換えより前に止まること、アプリ認証だけオンの従来の動き |
| `src/lib/app-mode/source-guards.test.ts` | 8 | TrialCallout の 4 部品、GTM・GA の条件、共通の部品の条件、`/app-unavailable` の中身、middleware での順番、AppShell、共通レイアウト（帯・サイドバー・下のタブ・パンくず・題を隠す条件）、見出しの折り返しの CSS |
| `src/lib/auth-link/web-handoff.test.ts`（既存を更新） | — | consume が `doya_app` Cookie（HttpOnly なし、https で Secure、期限が同じ）をセットする |

あわせて、部品の読み込みを模擬する既存の検証スクリプト 16 本（`verify-banner-*`・`verify-google-analytics-*`・`verify-service-limit-provider-mounted`・`verify-sidebar-usage-mounted` など）に、`@/lib/app-mode/client` の模擬（`useAppMode: () => false`）を足した。足さないと、新しい import が「模擬されていない」と失敗するため。

## 7. 本番に入れる前に承認が要る点

1. 環境変数 `APP_MODE_ENABLED=1` の設定（本番の環境変数。三森さんの承認のあと、メインが実行）。この旗は、`APP_AUTH_ENABLED` とは別である。旗を入れる前は、この機能は何も変えない。
2. 旗を入れたあとの再デプロイ。ブラウザ側の判定はビルド時に値が埋まるため、環境変数だけ変えても反映されない。
3. この枝の main への反映。アプリ認証の枝（`feat/app-auth-foundation-20261118`）の先頭から切っているため、アプリ認証の枝が先に main に入る必要がある。
4. 旗オンにする前に、実機の WebView で次を確かめる: ブラウザ（Safari）の人の表示が変わらないこと。アプリの WebView で `/pricing` が中立のページになること。`doya_app` Cookie が読めること。

## 8. まだ良くない点

- 画面は見ていない。375px と 1280px のスクリーンショット、見本との比較、ちらつきの確認は、まだ行っていない。
- 残りの導線（5 章）が、約 100 ファイル残っている。サイドバーとツール本体の上限の案内は、利用が多いにもかかわらず、まだ直していない。審査に出す前に、少なくとも 5 章の上位 4 区分を直す必要がある。
- 旗オンのとき、サーバーの描画は「アプリかもしれない」側で出る。ブラウザの人では、最初の描画のあとに導線が出る。実機でのちらつきは測っていない。
- 旗オンのとき、ブラウザの人では GTM・GA4 の読み込みが、最初の描画のあとに始まる（旗オフでは変わらない）。計測の初回のずれは、測っていない。
- 画面の文は、サイドバーやツール本体で個別に持つものが多い。共通の部品に集めないと、新しいツールを足したときに止め漏れる。止め漏れを機械で見つける試験（導線の文言を含むファイルが、`useAppMode` を import しているか）は、まだ無い。
- `TeamTrialNote` は、この枝のコードには存在しない（依頼の文に名前があったが、別の枝の部品の可能性がある）。見つけたら、`useTrialEligible()` を使う限り、同じ条件で止まる。
- `/api/pricing/members`（チームのメンバーの管理）は止めていない。契約の購入ではないと判断したが、招待のリンクが料金に触れる文を含むかは確かめていない。
- 本番では、`next build` と `npm run build`（security-regression を含む）を通していない。この枝では、`npm run test:app-mode`、`npm run test:app-auth`、触ったファイルの `tsc`、既存の検証スクリプトの一部だけを通した。
- `npm run build` の連鎖に `test:app-mode` と `test:app-auth` を入れていない（`test:app-auth` も入っていないため、同じ扱いにした）。入れるかどうかは、メインの判断が要る。

## 9. 次の改善の提案

1. サイドバー 11 本の「プロにアップグレード」の枠を 1 つの共通の部品にまとめ、`useAppMode()` を 1 か所で見る。
2. ツール本体の上限の案内（`ErrorNotice`・`LimitState`・各ツールの個別の文）を共通の部品に寄せる。
3. 導線の語を含むファイルが `useAppMode` を使っているかを見る、止め漏れの検査（ソースの grep）を、`test:app-mode` に足す。
4. 実機の WebView（iOS シミュレータ）で、旗オンの手元の開発サーバーを開き、主要なツール 5 本の画面を、導線の有無でスクリーンショットに撮る。

## 10. 追加分（帯・折り返し）で確かめていないこと

- 4.1 と 4.2 は、CSS とソースの条件の試験だけで確かめた。実機の WebView で、帯を隠したあとの空白・位置ずれ、見出しの折り返しの結果は、見ていない。
- `word-break: keep-all` は、日本語の読点の直後での折り返しを許すかが、ブラウザで違う。「キーワードから、」のあとで折り返すかは、実機で確かめる必要がある。
- 上の帯のドヤパワーの残り（`ShellPowerMeter` の `topbar`）も、帯ごと隠れる。残りの表示は「このツールの残り」の中だけになる。
