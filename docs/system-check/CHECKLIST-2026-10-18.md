# ドヤAI システム管理チェックリスト（2026-10-18）

ドヤAI でシステムエラーを起こさないための点検項目と、今回の点検結果をまとめた一覧です。
不具合の一覧と担当の案は FINDINGS-2026-10-18.md にあります。

## 使い方

- 各項目には「確認方法」と「合格条件」があります。次回の点検でも同じ手順で確かめられます。
- 結果は「合格」「不合格」「未確認」「該当なし」の4つです。
- 未確認は、本番の設定や DB、課金 API に触れないと確かめられなかった項目です。推測で合格にはしていません。
- 根拠の列には、ファイルと行番号か、本番の応答コードを書いています。
- 新しいサービスや API を足したときは、1章（認証）、3章（セキュリティ）、5章（API）を見直してください。

## 対象

- 現行システム: origin/main の 318841cb（2026-10-18 時点）
- リニューアル: feat/ui-renewal-sample の 03cf977f（7章）
- 本番: https://doya-ai.surisuta.jp（ログインせずに読み取りだけで確認）

## 集計

| 章 | 分野 | 項目数 | S | A | B | C |
|---|---|---|---|---|---|---|
| 1 | 認証・ログイン | 91 | 0 | 0 | 3 | 7 |
| 2 | 課金・プラン判定・利用上限 | 92 | 0 | 1 | 4 | 8 |
| 3 | セキュリティ（認可・公開ルート・SSRF・Cron） | 118 | 1 | 7 | 15 | 10 |
| 4 | DB・環境変数・ビルド・PDF・Cron | 119 | 0 | 1 | 11 | 9 |
| 5 | API 堅牢性・外部 AI | 108 | 0 | 2 | 7 | 7 |
| 6 | フロント・公開ページ・監視通知 | 150 | 0 | 0 | 13 | 9 |
| 7 | リニューアル差分 | 62 | 0 | 1 | 2 | 2 |
| 合計 | | 740 | 1 | 12 | 55 | 52 |

- 4章の A は CRON-002 です。ほかに、未確認のまま A に相当するものが 5 件あります（DB-017〜DB-020、CRON-017）。
- 重大度ごとの件数は、各章の「不合格・要対応」にある件数を数えたものです。
- 表の結果の欄は、点検した時点の状態です。このブランチで直した項目は、FINDINGS の 4 章に一覧があります。

## 2章の補足（上限チェックの全数調査）

課金担当が、現役サービスの生成 API を全数で調べました。上限チェックの有無を確かめた結果です。

- 競合に強い方法で上限を数えている API が大半でした（banner、seo、interview、persona、doyalist、doyaslide、cunning、shodan、aio、adimage、mensetsu、quote、aishodan、asklink、popup）。
- 有料プランで無制限のままの AI 経路が 2 つあります。HR の AI（lib/hr/billing.ts:23,26）と SFA の AI（lib/sfa/ai-limit.ts:32）です。
- サーバー側の回数上限が無い AI 生成 API が 6 本あります。doyalist/expand-keywords、mensetsu/company/analyze、quote/documents/suggest、quote/documents/estimate-item、quote/products/analyze、aio/quick-start です。
- 提供終了サービスの API は、対象の全ハンドラで 410 を返します。
- mitsuboshi/nagusame/chat は、ログインも上限も無しで Claude を呼んでいます。
- 無料枠を「累計」で数えているのは quote、mensetsu、aishodan、asklink、popup の 5 つだけでした。ほかは日次・週次・月次で数えています。

---

## 1. 認証・ログイン

点検日: 2026-10-18 / 対象: `~/Code/doya-syscheck-20261018`（origin/main worktree、`src/` と `seo/`）/ 本番: https://doya-ai.surisuta.jp（未ログイン GET/HEAD のみ、計 32 リクエスト）
構成の確認結果: next-auth 4.24.15 + @next-auth/prisma-adapter 1.0.7 + Next.js 15.5.25 + React 18.3.1（package-lock.json:1657, 8867, 8920, 10127）。アダプタ有りのためセッション戦略は **database**（JWT ではない）。`src/middleware.ts` は Host 振り分け専用で認証を見ない。ユーザー向け保護はクライアント側（`useSession`）＋各 API の `getServerSession(authOptions)`、管理画面は別系統（`admin_session_token` Cookie + JWT + AdminSession テーブル）。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| AUTH-001 | NextAuth ハンドラが標準形式（authOptions を静的に渡す） | コード読解 | `NextAuth(authOptions)` を 1 回生成し GET/POST を export | 合格 | src/app/api/auth/[...nextauth]/route.ts:6-12 |
| AUTH-002 | ハンドラの runtime が nodejs（Prisma 利用のため Edge 不可） | コード読解 | `runtime = 'nodejs'` | 合格 | src/app/api/auth/[...nextauth]/route.ts:10 |
| AUTH-003 | ハンドラが `force-dynamic` | コード読解 | 静的化されない | 合格 | src/app/api/auth/[...nextauth]/route.ts:9 |
| AUTH-004 | プロバイダは Google のみで、環境変数名が正しい | コード読解 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を参照 | 合格 | src/lib/auth.ts:15-20 |
| AUTH-005 | `allowDangerousEmailAccountLinking` が無効（既定） | grep | 設定されていない | 合格 | src/lib/auth.ts 全体に該当記述なし（grep 0 件） |
| AUTH-006 | `secret` が `NEXTAUTH_SECRET` から読まれる | コード読解 | 直書きなし | 合格 | src/lib/auth.ts:191 |
| AUTH-007 | `debug` が本番で有効になっていない | grep | `debug:` 記述なし | 合格 | src/lib/auth.ts（grep 0 件） |
| AUTH-008 | `pages.signIn` / `pages.error` がカスタム画面に向く | コード読解 | `/auth/signin` が存在する | 合格 | src/lib/auth.ts:182-185、src/app/auth/signin/page.tsx |
| AUTH-009 | セッション戦略（database）と `session` コールバックの引数整合 | コード読解 | adapter 有り＋`session({ session, user })` で `user` は DB ユーザー | 合格 | src/lib/auth.ts:14, 73 |
| AUTH-010 | `session.maxAge` / `updateAge` | コード読解 | 24h / 60s、意図（プラン即反映）と一致 | 合格 | src/lib/auth.ts:186-190、reference/05-auth-payments.md |
| AUTH-011 | `signIn` コールバック内の DB 例外でログインが落ちない | コード読解 | try/catch で握り、必ず `return true` | 合格 | src/lib/auth.ts:27-71 |
| AUTH-012 | `signIn` コールバックで新規ユーザー（DB 未作成）を扱わず `events.createUser` に委譲 | コード読解 | `existing === null` 分岐で何もしない | 合格 | src/lib/auth.ts:33-34, 139-180 |
| AUTH-013 | `events.createUser` の例外がログインに波及しない | コード読解 | try/catch で握る | 合格 | src/lib/auth.ts:143-179 |
| AUTH-014 | firstLoginAt 記録が二重発火しない（べき等） | コード読解 | `updateMany({ where: { firstLoginAt: null } })` で claim し count=1 のみ後処理 | 合格 | src/lib/auth.ts:39-45, 155-162 |
| AUTH-015 | 通知・ドリップ等の副作用が await されずログインをブロックしない | コード読解 | `.catch(() => {})` で非同期化 | 合格 | src/lib/auth.ts:46-56, 165-176 |
| AUTH-016 | `session` コールバックで DB 失敗時に全滅せずフォールバック | コード読解 | catch で `user` の値を使い、有料プランを FREE に落とさない | 合格 | src/lib/auth.ts:123-134 |
| AUTH-017 | `session` コールバックで User.plan とサービス別プランの上位を採用 | コード読解 | `higherPlan()` 経由 | 合格 | src/lib/auth.ts:104-118、src/lib/plan-utils.ts:68-72 |
| AUTH-018 | `session` コールバックが毎回 DB を 1 回追加で引く（アダプタの getSessionAndUser に加えて） | コード読解 | 失敗耐性はあるが負荷は高い | 合格（注意） | src/lib/auth.ts:77-89、updateAge 60 で毎分 Session 更新も発生 |
| AUTH-019 | `redirect` コールバック未定義 → NextAuth 既定（同一オリジン or 相対のみ） | コード読解＋本番 | 外部 URL に飛ばない | 合格 | src/lib/auth.ts に redirect なし。本番 `/api/auth/signin?callbackUrl=https://evil.example/` → 302 `…/auth/signin?callbackUrl=https%3A%2F%2Fdoya-ai.surisuta.jp` |
| AUTH-020 | ログイン画面側の callbackUrl サニタイズ | コード読解 | 先頭 `/`、`\` 含まず、オリジン一致、`//evil` を拒否 | 合格 | src/lib/safe-signin-callback.ts:4-13、src/app/auth/signin/page.tsx:25 |
| AUTH-021 | `startGoogleSignIn` / `switchGoogleAccount` も同じサニタイズを通す | コード読解 | `safeSignInCallbackUrl` 経由 | 合格 | src/lib/use-navigation-submission.ts:12, 22 |
| AUTH-022 | callbackUrl サニタイズの回帰テスト存在 | ls | test:security に含まれる | 合格 | scripts/security-regression/verify-signin-callback.cjs、package.json:11,16 |
| AUTH-023 | ログイン画面のエラー表示（`?error=`） | コード読解＋本番 | 主要コード（OAuthAccountNotLinked 等）に日本語文言、未知は Default | 合格 | src/app/auth/signin/page.tsx:12-21, 49, 185-190。本番 `/auth/signin?error=OAuthAccountNotLinked` 200 |
| AUTH-024 | ログイン画面の `useSearchParams` が Suspense 境界内 | コード読解 | ビルド時 CSR bailout エラーを避ける | 合格 | src/app/auth/signin/page.tsx:232-247 |
| AUTH-025 | ログインボタンの二重送信防止・bfcache 復帰時の解除 | コード読解 | ref ロック＋pageshow で解除 | 合格 | src/app/auth/signin/page.tsx:31-66 |
| AUTH-026 | 招待リンクからのログインで `prompt=select_account` | コード読解 | invite パスのみアカウント選択を強制 | 合格 | src/lib/safe-signin-callback.ts:32-35 |
| AUTH-027 | `SessionProvider` がルートレイアウトで全ページを包む | コード読解 | `Providers` が `<body>` 直下 | 合格 | src/components/Providers.tsx:8、src/app/layout.tsx:177-204 |
| AUTH-028 | (mitsuboshi) レイアウトも SessionProvider を継承 | コード読解 | ルート配下にネスト | 合格 | src/app/(mitsuboshi)/layout.tsx:1-8 |
| AUTH-029 | `useSession` の loading / unauthenticated 分岐 | grep | 利用 166 ファイル中、loading 判定 60 箇所、unauthenticated 判定 38 箇所。共通層（ServiceLimitProvider、HrLayout、KintaiLayout、AdminAuthWrapper）は両方処理 | 合格（注意） | src/components/limits/ServiceLimitProvider.tsx:68-69、src/components/hr/HrLayout.tsx:28-30 |
| AUTH-030 | `getServerSession` が常に `authOptions` 付きで呼ばれる | grep | 引数なし呼び出し 0 件 | 合格 | src/ 全体 523 箇所、`getServerSession(` で authOptions を含まない行 0 件 |
| AUTH-031 | `@/lib/auth` import の一貫性 | grep | `{ authOptions }` のみ | 合格 | 237 ファイル全て同一 |
| AUTH-032 | seo/ モジュールに独自の認証実装がない | grep | getServerSession 0 件 | 該当なし | seo/ で 0 件 |
| AUTH-033 | 型拡張（Session.user.id/role/plan） | コード読解 | `src/types/next-auth.d.ts` が存在 | 合格（注意） | src/types/next-auth.d.ts。bannerPlan 等一部プロパティは `as any` で付与（実害なし） |
| AUTH-034 | Prisma に NextAuth 必須モデル（Account/Session/User/VerificationToken） | schema 読解 | 4 モデル存在、Session.sessionToken @unique、onDelete Cascade | 合格 | prisma/schema.prisma:18, 37, 45, 57 |
| AUTH-035 | Cookie サイズ（4KB 超え） | 設計確認 | database 戦略のため Cookie はセッション ID のみ | 該当なし | src/lib/auth.ts:14（JWT 不使用） |
| AUTH-036 | 本番 `/api/auth/providers` | curl | 200、signinUrl/callbackUrl が本番ドメイン | 合格 | 200、`https://doya-ai.surisuta.jp/api/auth/callback/google` |
| AUTH-037 | 本番 `/api/auth/csrf` | curl | 200、トークン返却 | 合格 | 200 |
| AUTH-038 | 本番 `/api/auth/session`（未ログイン） | curl | `{}` が 200 | 合格 | 200 `{}` |
| AUTH-039 | `/api/auth/session` のキャッシュ制御 | curl -D | `private, no-store`、CDN HIT しない | 合格 | `cache-control: private, no-cache, no-store`、`x-vercel-cache: MISS` |
| AUTH-040 | NextAuth Cookie の属性 | curl -D | `__Host-` / `__Secure-` プレフィックス、HttpOnly、Secure、SameSite=Lax | 合格 | `/api/auth/csrf` の Set-Cookie 2 本 |
| AUTH-041 | `NEXTAUTH_URL` が本番ドメイン・末尾スラッシュなし（間接確認） | curl | providers の URL に `//` 二重なし | 合格 | AUTH-036 の出力 |
| AUTH-042 | 本番 `/auth/signin` | curl | 200 | 合格 | 200 |
| AUTH-043 | 本番 `/api/auth/signout`（GET） | curl | 200（確認画面） | 合格 | 200 |
| AUTH-044 | 本番 `/api/auth/error` パラメータなし | curl | ログイン画面へ戻る | 合格（注意） | 302 `…/auth/signin?error=undefined`（文字列 "undefined" は Default 文言にフォールバック。AUTH-F08） |
| AUTH-045 | 本番 `/api/auth/callback/google` を素で叩く | curl | エラー経由でログイン画面へ | 合格 | 302 `/api/auth/error?error=OAuthCallback` |
| AUTH-046 | 本番 `/api/auth/signin/google` GET | curl | POST 必須のため error=google でログイン画面へ | 合格 | 302 `…?error=google`、文言あり src/app/auth/signin/page.tsx:14 |
| AUTH-047 | `/auth/signin?callbackUrl=//evil.example/` | curl＋コード | 画面は 200、クライアント側で `/seo` に丸める | 合格 | 200、src/lib/safe-signin-callback.ts:5-8 |
| AUTH-048 | 保護ページ（/banner/dashboard 等）の未ログイン挙動 | curl＋コード | 設計はクライアント側ガード（200 を返しデータ API が 401） | 合格（注意） | 200。src/app/banner/dashboard/page.tsx:1187, 2415-2417。サーバー側 `redirect('/auth/signin…')` は 0 件 |
| AUTH-049 | `/seo/articles` `/dashboard` 直アクセス | curl | /seo へリダイレクト | 合格 | 307 → /seo（src/app/seo/articles/page.tsx:5、next.config.js redirects） |
| AUTH-050 | ユーザー系保護 API の未ログイン応答 | curl | 401 | 合格 | `/api/hr/organization` 401 |
| AUTH-051 | 招待 API の無効トークン応答 | curl | 404 | 合格 | `/api/hr/organization/invite/abc` 404、`/api/kintai/invite/abc` 404 |
| AUTH-052 | middleware が Edge 非対応 import を含まない | コード読解 | `next/server` のみ | 合格 | src/middleware.ts:1-2 |
| AUTH-053 | middleware の matcher が静的アセットを除外 | コード読解 | `_next/static|_next/image|favicon.ico` 除外 | 合格 | src/middleware.ts:137 |
| AUTH-054 | middleware が `/api`（NextAuth 含む）を素通し | コード読解 | SHARED_SKIP_PREFIXES に `/api` | 合格 | src/middleware.ts:28-41, 77, 116 |
| AUTH-055 | middleware にリダイレクトループがない | コード読解 | mitsuboshi ホスト: `/nagusame*` は next、他は 308 → `/nagusame`（1 回で収束）。SLIDE_HOSTS: rewrite のみ | 合格 | src/middleware.ts:76-126 |
| AUTH-056 | middleware が `src/` 配下にある（直下だと無効） | ls | ルート直下に middleware.ts なし | 合格 | `ls middleware.ts` → なし、src/middleware.ts あり |
| AUTH-057 | `VERCEL_URL` の誤用（外部向けリンク生成） | grep 全件 | リンク生成に使用なし | 合格（注意） | 実使用は src/lib/runtime-alert.ts:16（デプロイ識別のみ）と src/app/api/admin/drip/test-unsubscribe/route.ts:20（NEXTAUTH_URL の後ろのフォールバック、AUTH-F09）。他 6 件は「使うな」のコメント |
| AUTH-058 | メール内リンクの基点が `NEXTAUTH_URL` | grep | 招待・ドリップ・通知の全箇所で `NEXTAUTH_URL \|\| 本番URL` | 合格 | src/app/api/hr/organization/invite/route.ts:89、src/app/api/cron/drip-sender/route.ts:209、src/app/api/kintai/employees/[id]/invite/route.ts:73、src/app/api/{aio,sfa,shodan,mensetsu,quote,aishodan}/members/route.ts、src/lib/mensetsu/interview-url.ts:11 |
| AUTH-059 | プレビュー/複数ドメインでの OAuth コールバック | 設計確認 | NEXTAUTH_URL 固定のためプレビューではログイン不可（本番は影響なし） | 該当なし | reference/05-auth-payments.md「承認済みリダイレクト URI は本番のみ」 |
| AUTH-060 | ログアウトの callbackUrl が全て相対パス | grep | 20 箇所すべて相対 | 合格 | `signOut(` 20 件（src/components/DashboardSidebar.tsx:83-95 ほか） |
| AUTH-061 | 「別アカウントでログイン」が先に signOut して誤リンクを防ぐ | コード読解 | signOut → /auth/signin | 合格 | src/lib/use-navigation-submission.ts:19-27 |
| AUTH-062 | auth-logger が access_denied を握りつつ他エラーは出す | コード読解 | 想定外エラーは console.error、秘密情報を出さない | 合格 | src/lib/auth-logger.ts:4-25 |
| AUTH-063 | `readAttributionFromCookies` が例外安全 | コード読解 | try/catch | 合格 | src/lib/attribution.ts:22-43 |
| AUTH-064 | Prisma 接続断時のリトライとクライアント再生成 | コード読解 | `withRetry` が接続エラーのみリトライ | 合格 | src/lib/prisma.ts:146-167 |
| AUTH-065 | HR 招待トークンの生成強度・期限・メール一致・ワンタイム | コード読解 | randomBytes(32)、7 日、email 一致必須、トランザクション内 claim | 合格 | src/app/api/hr/organization/invite/route.ts:57-83、accept/route.ts:47-112 |
| AUTH-066 | HR 招待情報 GET（未認証）で露出する情報 | コード読解 | 招待先 email・組織名のみ、トークンは URL を知る者だけ | 合格（注意） | src/app/api/hr/organization/invite/[token]/route.ts:43-57 |
| AUTH-067 | kintai 招待トークン生成・48h 期限・メール一致 | コード読解 | `v2.<ts36>.<uuid>`、`isKintaiInviteExpired`、email 一致 | 合格 | src/lib/kintai/invite-token.ts、src/app/api/kintai/invite/[token]/route.ts:29-31, 83-84 |
| AUTH-068 | aio/sfa/shodan/mensetsu/quote/aishodan 招待の email 一致チェック | grep | 各 accept で mismatch 判定あり | 合格 | src/app/api/{aio,aishodan,mensetsu,quote,shodan}/invite/[token]/route.ts:70-79、sfa:70 |
| AUTH-069 | promane 招待の受諾ロジック | コード読解 | `acceptPromaneInvitation` にメールを渡し、回帰テスト存在 | 合格 | src/app/api/promane/invite/[token]/route.ts:69-81、scripts/security-regression/verify-promane-invite-admission.cjs |
| AUTH-070 | 招待トークン生成に `Math.random` を使っていない | grep | randomBytes / randomUUID のみ | 合格 | src/app/api/*/members/route.ts、kintai/employees/route.ts:123 |
| AUTH-071 | 未認証で叩ける商談ルーム `/m/{token}` のトークン検証 | コード読解 | 24 バイト乱数、8 文字未満拒否、isActive/期限/回数上限を検証 | 合格 | src/app/api/aishodan/rooms/route.ts:64、src/lib/aishodan/public.ts:15-43 |
| AUTH-072 | 管理者ログイン API のパスワードハッシュ | コード読解 | bcrypt 12 ラウンド | 合格 | src/lib/admin-auth.ts:25-33 |
| AUTH-073 | 管理者ログインのレート制限 | コード読解 | IP または username で 15 分 5 回 | 合格（注意） | src/lib/admin-auth.ts:59-104。username 軸のため第三者が管理者をロックアウト可能（AUTH-F05） |
| AUTH-074 | 管理者 Cookie 属性 | コード読解 | HttpOnly、Secure（production）、SameSite=strict、24h | 合格 | src/app/api/admin/auth/login/route.ts:262-268 |
| AUTH-075 | 管理者セッションが DB で失効管理される（verifyAdminSession） | コード読解 | JWT 検証後に AdminSession 存在・期限・isActive を確認 | 合格 | src/lib/admin-auth.ts:128-173 |
| AUTH-076 | 管理者ログアウトで DB セッション削除＋Cookie 削除 | コード読解 | deleteAdminSession → cookie delete | 合格 | src/app/api/admin/auth/logout/route.ts:9-22 |
| AUTH-077 | 管理者 JWT 秘密鍵のフォールバック | コード読解 | 既知の固定文字列にフォールバックしない | 不合格 | src/lib/admin-auth.ts:6 `'fallback-secret-change-in-production'`（AUTH-F01） |
| AUTH-078 | `/api/admin/**` 全ルートが requireAdmin 等で保護 | スクリプト grep | 41 ルート中 40 が保護、残り 1 は 410 固定応答の廃止 API | 合格 | src/app/api/admin/migrate/route.ts:7-13（本番 GET 405） |
| AUTH-079 | 2FA 関連 API の保護 | コード読解 | setup/disable/verify/status すべて verifyAdminSession | 合格 | src/app/api/admin/2fa/*/route.ts:13-18 |
| AUTH-080 | `requireAdmin` が `valid` フラグで判定（オブジェクト真偽の取り違えなし） | コード読解 | `const { valid } = …; if (!valid)` | 合格 | src/lib/admin-guard.ts:18-25 |
| AUTH-081 | バナー保守 API のガードがセッション失効を見ているか | コード読解 | DB の AdminSession を確認すべき | 不合格 | src/lib/banner-admin-guard.ts:42 は `verifyToken` のみ（AUTH-F02） |
| AUTH-082 | CRON_SECRET / break-glass の比較が timing-safe か | コード読解 | `timingSafeEqual` 使用 | 不合格 | src/lib/banner-admin-guard.ts:32、src/app/api/admin/auth/login/route.ts:104（AUTH-F03） |
| AUTH-083 | 管理者ログインのタイミング攻撃対策（ユーザー不存在時） | コード読解 | 不存在時も bcrypt を 1 回走らせる | 不合格 | src/app/api/admin/auth/login/route.ts:176-193（存在しない場合は compare をスキップ。AUTH-F04） |
| AUTH-084 | 管理画面ページの保護方式 | コード読解＋curl | クライアント側 AdminAuthWrapper で /admin/login へ誘導。本番 `/admin` `/admin/users` は 200 で殻のみ、データ API は 401 | 合格（注意） | src/app/admin/layout.tsx:16、src/components/AdminAuthWrapper.tsx:26-60。`/api/admin/auth/session` 401、`/api/admin/users` 401 |
| AUTH-085 | 管理画面の Google @surisuta.jp ドメイン制限がサーバー側で強制されているか | コード読解 | API 側でも検証 | 不合格 | src/components/AdminAuthWrapper.tsx:9, 79-83 のみ（クライアント限定。AUTH-F06） |
| AUTH-086 | 管理者ログインの失敗記録・AdminSession の肥大化対策 | grep | 古い AdminLoginAttempt の削除処理 | 不合格 | `adminLoginAttempt.deleteMany` 0 件（AUTH-F07）。AdminSession は 5 件上限あり src/lib/admin-auth.ts:195-208 |
| AUTH-087 | `/api/admin/**` のキャッシュ制御 | curl -D | `private, no-store` | 合格（注意） | `/api/admin/auth/session`: `cache-control: private, no-store`、ただし next.config.js:155-160 の `Vary: Cookie` は応答に現れず Next 既定の Vary に置換 |
| AUTH-088 | 本番 `/api/health` が秘密を漏らさない | curl＋コード | production では env 一覧を出さない | 合格 | src/app/api/health/route.ts:33-43、本番 200 |
| AUTH-089 | 管理者ログインの IP 取得（`x-forwarded-for` 先頭） | コード読解 | Vercel が付与する値を信頼 | 未確認 | src/lib/admin-auth.ts:13-17。Vercel 側でクライアント指定値が上書きされるかは本点検では未検証 |
| AUTH-090 | Supabase への DB セッション期限切れ行の掃除 | grep | 期限切れ Session の定期削除 | 未確認 | NextAuth はアクセス時に期限切れ行を削除するが、未アクセス行の cron 削除は見当たらない（運用影響は容量のみ） |
| AUTH-091 | 秘密鍵系の別フォールバック（ドリップ解除トークン） | grep | 固定文字列へのフォールバックなし | 不合格 | src/lib/drip-tokens.ts:3 `'drip-unsubscribe-fallback-secret'`（AUTH-F10、認証外だが同種） |

### 不合格・要対応

S 級: 0 件 / A 級: 0 件 / B 級: 3 件 / C 級: 7 件

#### AUTH-F01（AUTH-077）重大度 B — 管理者 JWT 秘密鍵が固定文字列にフォールバックする
- 現象・再現条件: `ADMIN_JWT_SECRET` と `NEXTAUTH_SECRET` の両方が未設定の環境では、管理者トークンが公開リポジトリ上の既知文字列で署名・検証される。第三者がトークンを偽造できる（ただし `verifyAdminSession` は DB の AdminSession 行も要求するため、偽造だけでは `requireAdmin` を通過できない。`requireBannerAdmin` は JWT のみなので通過する）。本番では NEXTAUTH_SECRET が設定されている（NextAuth が稼働している）ため現状は発火していない。
- 該当箇所: src/lib/admin-auth.ts:6
- 修正案: フォールバック文字列を削除し、未設定なら起動時に `throw new Error('ADMIN_JWT_SECRET or NEXTAUTH_SECRET is required')`。または `generateToken`/`verifyToken` 内で未設定時に必ず失敗させる。
- worktree で安全に直せるか: はい（単一行・環境変数が設定済みの本番には挙動変化なし。`npx tsc --noEmit` で確認可）。

#### AUTH-F02（AUTH-081）重大度 B — バナー保守 API のガードがログアウト・無効化を反映しない
- 現象・再現条件: `/api/banner/test/templates/*`（テンプレート削除を含む）は `requireBannerAdmin` で JWT 署名と期限だけを確認する。管理者がログアウトしても、AdminUser を `isActive=false` にしても、JWT 期限（24h）内はその Cookie 値で保守 API を叩ける。
- 該当箇所: src/lib/banner-admin-guard.ts:28-47（特に :42）
- 修正案: `verifyToken` の代わりに `await verifyAdminSession(decodeURIComponent(token))` を呼び `valid` で判定する（関数を async にし、呼び出し側 4 ルートの `const denied = requireBannerAdmin(request)` を `await` に変更）。
- worktree で安全に直せるか: はい（呼び出し元は `grep -rn requireBannerAdmin src/app/api/banner` で特定可能。DB 1 クエリ追加のみ）。

#### AUTH-F03（AUTH-082）重大度 C — 秘密値の比較が timing-safe でない
- 現象・再現条件: `CRON_SECRET` の Bearer 比較（`===`）と break-glass パスワード比較（`===`）が文字列比較。実用上の悪用は困難だがポリシー違反。
- 該当箇所: src/lib/banner-admin-guard.ts:32、src/app/api/admin/auth/login/route.ts:104
- 修正案: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`（長さ不一致は先に false）を共通ヘルパーにして置換。
- worktree で安全に直せるか: はい（ロジック同値）。

#### AUTH-F04（AUTH-083）重大度 C — 管理者ログインの「ユーザー不存在」が応答時間で判別できる
- 現象・再現条件: identifier が存在しない場合 bcrypt.compare を実行しないため、存在する場合より応答が明確に速い。reference/05 の「ユーザー不存在時も同じ処理時間」という記述と実装が食い違う。
- 該当箇所: src/app/api/admin/auth/login/route.ts:176-193
- 修正案: 不存在時はダミーハッシュ（事前計算した bcrypt ハッシュ定数）に対して `verifyPassword` を 1 回実行してから失敗を返す。
- worktree で安全に直せるか: はい。

#### AUTH-F05（AUTH-073）重大度 C — username 軸のレート制限で第三者が管理者をロックアウトできる
- 現象・再現条件: 管理者のメールアドレスを知る第三者が 5 回失敗を送ると、その username は 15 分間どの IP からもログイン不可（`OR: [{ipAddress}, {username}]`）。Turnstile 必須化（`REQUIRE_TURNSTILE=true`）で緩和できるが、設定されているかは未確認。
- 該当箇所: src/lib/admin-auth.ts:67-74
- 修正案: username 軸は閾値を上げる（例 20 回/15 分）か、username 軸のロックは「同一 IP からの連続失敗」に限定する。あわせて `REQUIRE_TURNSTILE=true` を本番で確認。
- worktree で安全に直せるか: はい（判定ロジックのみ）。

#### AUTH-F06（AUTH-085）重大度 C — 管理画面の Google ドメイン制限がクライアント側のみ
- 現象・再現条件: `@surisuta.jp` チェックは AdminAuthWrapper（クライアント）のみで、`/api/admin/**` は `admin_session_token` だけで通る。管理者パスワードを持つ者は Google 側の制限を迂回できる。二要素としての意味が薄い。
- 該当箇所: src/components/AdminAuthWrapper.tsx:9, 79-83、src/lib/admin-guard.ts:18-25
- 修正案: `requireAdmin()` 内で `getServerSession(authOptions)` を併用し、`session.user.email` が許可ドメインでない場合も 401 にする（env `ADMIN_ALLOWED_GOOGLE_DOMAIN` で制御、未設定時は従来挙動）。
- worktree で安全に直せるか: はい。ただし運用上、管理者全員が @surisuta.jp の Google ログイン状態で管理画面を使っていることを事前確認してから有効化する。

#### AUTH-F07（AUTH-086）重大度 C — AdminLoginAttempt が無限に蓄積する
- 現象・再現条件: 全ログイン試行を記録するが削除処理がない。ブルートフォースを受けると行数が急増し `checkRateLimit` の count クエリが遅くなる。
- 該当箇所: src/lib/admin-auth.ts:107-125（記録）、削除処理なし
- 修正案: 既存の日次 cron（例 `/api/cron/daily-summary`）で `adminLoginAttempt.deleteMany({ where: { createdAt: { lt: 90日前 } } })` を実行。
- worktree で安全に直せるか: はい（既存 cron への 1 クエリ追加）。

#### AUTH-F08（AUTH-044）重大度 C — `/api/auth/error` をパラメータなしで開くと `?error=undefined`
- 現象・再現条件: NextAuth 既定挙動で `pages.error` に `error=undefined` が付く。画面は Default 文言を出すため実害なしだが、URL が不自然。
- 該当箇所: src/lib/auth.ts:184、src/app/auth/signin/page.tsx:49
- 修正案: signin ページで `error === 'undefined'` を null 扱いにする 1 行の追加。
- worktree で安全に直せるか: はい。

#### AUTH-F09（AUTH-057）重大度 C — テスト用解除 API の `VERCEL_URL` フォールバックが到達不能コード
- 現象・再現条件: `process.env.NEXTAUTH_URL || \`https://${process.env.VERCEL_URL}\` || '本番URL'` はテンプレート文字列が常に truthy のため、NEXTAUTH_URL 未設定時に `https://undefined` になる。本番では NEXTAUTH_URL があるため発火しない。管理者専用のテスト API。
- 該当箇所: src/app/api/admin/drip/test-unsubscribe/route.ts:20
- 修正案: 他箇所と同じ `process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'` に統一。
- worktree で安全に直せるか: はい。

#### AUTH-F10（AUTH-091）重大度 C — ドリップ解除トークンの HMAC 鍵が固定文字列にフォールバック
- 現象・再現条件: `DRIP_UNSUBSCRIBE_SECRET` と `NEXTAUTH_SECRET` が両方未設定の場合のみ。F01 と同種。
- 該当箇所: src/lib/drip-tokens.ts:3
- 修正案: F01 と同様に未設定時は例外。
- worktree で安全に直せるか: はい。

### 補足（不合格ではないが運用上の注意）
- AUTH-018: database 戦略＋`updateAge: 60` のため、ログイン中ユーザーの `/api/auth/session` 呼び出しごとに Session 読取＋User 読取、毎分 Session 更新が発生する。Supabase の接続上限（connection_limit=3）に対して負荷要因になり得る。障害時は AUTH-016 のフォールバックで「ログイン不能」には至らない。
- AUTH-048 / AUTH-084: ユーザー画面・管理画面ともサーバー側リダイレクトを持たない設計（殻の HTML は 200）。データは API が 401 で守る。認可の防御線が「各 API ルート」に集約されているため、ルート追加時のガード漏れが最大のリスク（admin-guard.ts:13-15 の注意書き通り）。
- AUTH-059: プレビューデプロイでは Google ログインが機能しない（NEXTAUTH_URL が本番固定）。検証は本番または `localhost` で行う前提。


---

## 2. 課金・プラン判定・利用上限

点検日: 2026-10-18 ／ 対象: chore/system-check-20261018 の worktree（origin/main worktree、`src/` のみ）／ 正本: `reference/11-billing-spec.md`、`~/Code/DEV-STATUS.md` 2-5。
制約: 読み取り専用、Stripe API・本番DB未接続、本番は未ログイン GET/HEAD のみ（curl は Vercel Security Checkpoint で全パス 403 のため、組み込みブラウザで再確認）。file:line は上記 worktree 基準。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|----|------|---------|---------|------|------|
| BILL-001 | Webhook が raw body を読んで署名検証している | コード読解 | `request.text()` の生文字列を `constructEvent` に渡す | 合格 | `src/app/api/stripe/webhook/route.ts:30,53`、`src/lib/stripe.ts:819-825` |
| BILL-002 | `stripe-signature` ヘッダ欠落時に 400 | コード読解 | 400 で終了し処理しない | 合格 | `webhook/route.ts:34-39` |
| BILL-003 | `STRIPE_WEBHOOK_SECRET` 未設定時の挙動 | コード読解 | 500 を返し console.error（無音で 200 にしない） | 合格 | `webhook/route.ts:41-48` |
| BILL-004 | 署名検証失敗時 400（Stripe に再送させない） | コード読解 | 400 固定 | 合格 | `webhook/route.ts:52-60` |
| BILL-005 | 冪等性: `event.id` の重複処理防止 | コード読解 | 処理済みIDは再処理しない、処理中は 503、リース失効/失敗は再取得 | 合格 | `src/lib/stripe-webhook-receipts.ts:12-60`、`webhook/route.ts:64-71`、`prisma/schema.prisma:327-340` |
| BILL-006 | 処理失敗時に 500 を返して Stripe に再送させる | コード読解 | catch で receipt を failed にし 500 | 合格 | `webhook/route.ts:147-160` |
| BILL-007 | 処理対象イベント一覧 | コード読解 | checkout.session.completed / customer.subscription.created・updated・deleted / invoice.payment_succeeded・payment_failed | 合格 | `webhook/route.ts:73-130`（未知イベントは 200 で無視 :128-129） |
| BILL-008 | Webhook でのユーザー特定が3段フォールバック（INV-6/R-1） | コード読解 | metadata.userId → User.stripeCustomerId → Stripe 顧客メール | 合格 | `webhook/route.ts:205-240` |
| BILL-009 | ドヤ契約でユーザー特定失敗時は 500（R-14） | コード読解 | throw → 500 → 再送 | 合格 | `webhook/route.ts:303-305,320-322,369-371` |
| BILL-010 | created/updated イベントで Stripe の現在状態を再取得（R-17 配送順逆転対策） | コード読解 | `subscriptions.retrieve` 後に判定 | 合格 | `webhook/route.ts:300,316` |
| BILL-011 | 状態遷移: canceled/unpaid→FREE、active/trialing/past_due→有料、incomplete→変更なし | コード読解 | §5 の表どおり | 合格 | `webhook/route.ts:306-310,328-333,473-478`、`src/lib/stripe.ts:214` |
| BILL-012 | 解約イベントで残存契約を確認してから FREE に落とす（R-2） | コード読解 | `findActiveLikeSubscriptions` で他契約があれば再反映 | 合格 | `webhook/route.ts:380-397` |
| BILL-013 | 解約反映が User と全サービス行を同一TXで更新 | コード読解 | `syncUnifiedBilling({plan:'FREE'})` | 合格 | `webhook/route.ts:403-406`、`src/lib/billing-sync.ts:54-69` |
| BILL-014 | 階層判定が `planTierFromPlanId()` 一箇所（INV-4）、planId 接頭辞で絞らない（INV-5） | grep | 反映4経路・監査で同関数 import、`startsWith('banner-')` 等なし | 合格 | `webhook/route.ts:12`、`sync/route.ts:5`、`sync/latest/route.ts:12`、`src/lib/billing-audit.ts:19`；grep で接頭辞絞り込みなし |
| BILL-015 | 複数生存契約時は最上位階層を採用し本人性を再確認 | コード読解 | TIER_RANK ソート + `isDoyaSubscriptionOwnedByUser` | 合格 | `webhook/route.ts:340-362`、`sync/route.ts:92-110`、`sync/latest/route.ts:57-66` |
| BILL-016 | 手動付与の保護（R-13）: Stripe 起点の同期で DB が上位なら降格しない | コード読解 | `preserveManualGrant` 既定 true、同一TXで `billing_manual_grants` を読む | 合格 | `src/lib/billing-sync.ts:38-47`、`src/lib/billing-manual-grants.ts` |
| BILL-017 | Webhook 運営通知の再送キュー（R-16） | コード読解 + vercel.json | `StripeWebhookNotification` に保存、5分 cron で再試行 | 合格 | `webhook/route.ts:132-144`、`src/lib/stripe-webhook-notifications.ts:46-123`、`vercel.json`（`/api/cron/stripe-notifications` `*/5 * * * *`） |
| BILL-018 | 入金通知の誤報防止（0円トライアル請求・他アプリ請求を除外、R-15） | コード読解 | `amount_paid<=0` 除外、`isDoyaInvoice` | 合格 | `webhook/route.ts:185-195,421-423,455` |
| BILL-019 | `invoice.payment_failed` でダウングレードしない（past_due 猶予） | コード読解 | 通知のみ | 合格 | `webhook/route.ts:454-467` |
| BILL-020 | `paused` ステータスの契約の扱い | コード読解 | 有料権利が残らない | 不合格 | `webhook/route.ts:328-334,473-475`: updated で canceled/unpaid 以外かつ非 ACTIVE_LIKE は no-op → paused でも PRO が残る（詳細は後述 B） |
| BILL-021 | 入金/失敗通知のユーザー引当方法 | コード読解 | 仕様「`findFirst({stripeCustomerId})` を個別に書かない」 | 不合格 | `webhook/route.ts:427-428,458-459`（通知文面のみ。権利には影響しない。C） |
| BILL-022 | live/test モード混在耐性 | コード読解 | 署名シークレットがモード別のため他モードイベントは 400 | 合格 | `webhook/route.ts:53`（追加の `event.livemode` 照合は無い。改善余地のみ） |
| BILL-023 | Stripe API version 固定（`current_period_end` 依存、R-12） | コード読解 + package | `apiVersion: '2023-10-16'`、stripe@14 系 | 合格 | `src/lib/stripe.ts:9-12`、`package.json:69`（`^14.10.0`、実体 14.25.0） |
| BILL-024 | `ACTIVE_LIKE` の定義が単一 | grep | `stripe.ts` の `ACTIVE_LIKE_STATUSES` のみ | 不合格 | `src/app/api/stripe/subscription/status/route.ts:16` に `unpaid` を含む別定義（読み取り専用。C） |
| BILL-025 | `TIER_RANK`/`PLAN_RANK` の重複定義 | grep | 一箇所 | 不合格 | webhook/route.ts:337、sync/route.ts:20、sync/latest/route.ts:30、billing-sync.ts:7、billing-audit.ts:72、admin/stripe/route.ts:10、plan-utils.ts:49 の7箇所（値は一致。C） |
| BILL-026 | Checkout API の認証 | コード読解 | 未ログイン 401 | 合格 | `src/app/api/stripe/checkout/route.ts:61-67` |
| BILL-027 | 提供終了サービスの planId を Checkout で遮断（R-5） | コード読解 | 410 | 合格 | `checkout/route.ts:112-118` |
| BILL-028 | 二重契約ガード（INV-9） | コード読解 | 生存契約があれば 409 `ALREADY_SUBSCRIBED` / `PLAN_CHANGE_REQUIRED` | 合格 | `checkout/route.ts:136-156`、`src/lib/stripe.ts:306-367` |
| BILL-029 | 契約照会失敗時は決済を作らない | コード読解 | 503 `SUBSCRIPTION_CHECK_UNAVAILABLE` | 合格 | `checkout/route.ts:157-164` |
| BILL-030 | Checkout 予約（同時/再送で複数 Checkout を作らない） | コード読解 | SystemSetting の CAS、Stripe idempotencyKey 永続、完了済みなら再発行しない | 合格 | `src/lib/checkout-reservation.ts:53-131` |
| BILL-031 | トライアル付与条件（月額のみ・新規のみ・判定失敗 fail-closed） | コード読解 | `isTrialEligible` メール横断、例外時 503 | 合格 | `checkout/route.ts:206-218`、`src/lib/trial.ts:24-67` |
| BILL-032 | トライアル終了時に支払方法なしなら自動解約 | コード読解 | `missing_payment_method: 'cancel'` | 合格 | `src/lib/stripe.ts:557-560` |
| BILL-033 | Checkout の metadata に userId/app/planId（Webhook 引当の正本） | コード読解 | session と subscription_data 双方 | 合格 | `src/lib/stripe.ts:541-556` |
| BILL-034 | 戻り先のオープンリダイレクト防止 | コード読解 | 同一オリジンのパスのみ | 合格 | `checkout/route.ts:12-19`、`portal/route.ts:14-22` |
| BILL-035 | success_url に `session_id={CHECKOUT_SESSION_ID}` | コード読解 | 決済直後同期の起点 | 合格 | `checkout/route.ts:200`、`hr/billing/checkout/route.ts:154` |
| BILL-036 | test/live キー不一致を利用者が復旧できる形で案内 | コード読解 | `STRIPE_MODE_MISMATCH` | 合格 | `checkout/route.ts:43-50,253-267` |
| BILL-037 | 顧客分裂（`customer_email` 利用）の前提 | コード読解 | 検索は常にメール横断（INV-6） | 合格 | `src/lib/stripe.ts:540`（分裂は既知の設計前提）、`findActiveLikeSubscriptions` で吸収 |
| BILL-038 | Checkout が統一プラン以外（light/enterprise/bundle）の planId を受け付ける | コード読解 | 無料/プロの2プランのみ | 不合格 | `checkout/route.ts:277-322` priceMap に `*-light`/`*-enterprise`/`bundle` が残存（UI 導線は `UNIFIED_PRO_PLAN_ID` のみ、直POSTのみ到達。C） |
| BILL-039 | `banner.basic` 価格の env フォールバック | コード読解 | 価格ID→階層が一意 | 不合格 | `src/lib/stripe.ts:56-65`: `STRIPE_PRICE_BANNER_BASIC_*` 未設定時に `STARTER` env へフォールバック → 同一 priceId が `banner-basic`(PRO) に先一致（:461-462）。env 実値は未確認（B・条件付き） |
| BILL-040 | 旧HR入口 `/api/hr/billing/checkout` | コード読解 | 二重契約ガード・顧客メール照合・interval 検証・予約共有・session_id | 合格 | `src/app/api/hr/billing/checkout/route.ts:54-56,79-126,154,171-178` |
| BILL-041 | 鍵・価格IDのハードコード | grep | `sk_/pk_/whsec_/price_1...` が src/seo/scripts に無い | 合格 | grep 結果なし |
| BILL-042 | 価格IDの環境変数名が実装と一致 | env.example.txt vs stripe.ts | 実装が読む変数が例に載っている | 不合格 | `env.example.txt:147-176` は `KANTAN_*`/`SEO_BUSINESS_*` 等の未使用名を含み、実装の `STRIPE_PRICE_BANNER_LIGHT_*`/`HR_*` が無い（C） |
| BILL-043 | `/api/stripe/sync` の本人性チェック | コード読解 | client_reference_id / customer_email / 顧客メールの照合、他人は 403 | 合格 | `sync/route.ts:52-70,81-84` |
| BILL-044 | `/api/stripe/sync` が未完了・非 ACTIVE_LIKE・FREE 解決を反映しない | コード読解 | 409 | 合格 | `sync/route.ts:71-87` |
| BILL-045 | 決済直後同期の FREE→有料 通知が権利反映と同一TXで保存 | コード読解 | `notificationOnUpgrade` | 合格 | `sync/route.ts:115-128`、`billing-sync.ts:77-86` |
| BILL-046 | `/api/stripe/sync/latest` が接頭辞で絞らず最上位採用（障害#4 再発防止） | コード読解 | 階層のみで判定 | 合格 | `sync/latest/route.ts:44-69` |
| BILL-047 | `<StripeSuccessSync />` がルートレイアウトに設置（INV-8） | grep | layout.tsx に存在 | 合格 | `src/app/layout.tsx:12,190` |
| BILL-048 | `syncUnifiedBilling` の原子性と網羅性（INV-2） | コード読解 | Serializable TX、`ALL_SERVICE_IDS` 全件 upsert、旧行も updateMany、HrOrganization 同期、P2034 再試行 | 合格 | `src/lib/billing-sync.ts:28-93` |
| BILL-049 | `UserServiceSubscription.stripeSubscriptionId` に一意制約なし（INV-11） | schema | `@unique` なし | 合格 | `prisma/schema.prisma:174-178` |
| BILL-050 | `ALL_SERVICE_IDS` が現役19サービスを全て含む | 照合 | getActiveServices の id が全て含まれる | 合格 | `src/lib/stripe.ts:221-230` vs `src/lib/services.ts` RETIRED 除外後（banner, seo, interview, persona, hr, kintai, doyalist, doyaslide, cunning, promane, sfa, shodan, aio, adimage, mensetsu, quote, aishodan, asklink, popup） |
| BILL-051 | `User.plan` 書き込み経路の全件洗い出し | grep（`plan:` 書き込み、`user.update*`） | 仕様の4経路（+管理者操作）以外に無い | 不合格 | syncUnifiedBilling 経由: webhook、sync、sync/latest、`admin/users/route.ts:166`、`admin/stripe/route.ts:165-170`。**直書き**: `src/app/api/cron/daily-summary/route.ts:76-102`（詳細は後述 B） |
| BILL-052 | 管理者のプラン変更は手動付与保護を明示的に外す | コード読解 | `preserveManualGrant:false` は admin/users のみ | 合格 | `admin/users/route.ts:166`（他に呼び出しなし） |
| BILL-053 | 管理系課金 API の認証 | コード読解 | `verifyAdminSession` | 合格 | `admin/users/route.ts:27`、`admin/stripe/route.ts:17` |
| BILL-054 | サービス側で `UserServiceSubscription` 行を作る箇所の plan 値 | grep | `User.plan` のミラーであること | 合格 | `banner/monthly-quota.ts:54`、`persona/project-ledger.ts:82`、`copy/generate:84`、`lp/projects:85,137` は user.plan ミラー。`shindan/generate:1430` は 'FREE' 固定だが同ルートは 410 ガード済み（:1388） |
| BILL-055 | scripts の plan 書き込み | grep | 不足行の補完のみ、User.plan は書かない | 合格 | `scripts/backfill-new-service-subscriptions.ts:22-35`（verify-* は読み取りのみ） |
| BILL-056 | 日次監査が Stripe を直読み（INV-12）し、反映漏れ/階層ズレ/プラン不明/サービス行ズレ/過剰付与/重複/Webhook 登録を検出 | コード読解 | §8.2 の項目を全て実装 | 合格 | `src/lib/billing-audit.ts:151-343` |
| BILL-057 | 監査の critical 通知と失敗時アラート | コード読解 | notifyAlert（dedup 12h）、cron 失敗で critical | 合格 | `src/app/api/cron/billing-audit/route.ts:85-148,163-171` |
| BILL-058 | 監査は検知のみで自動修復しない | コード読解 | DB 書き込みなし | 合格 | `billing-audit.ts` に prisma 書き込みなし |
| BILL-059 | cron の認証（`CRON_SECRET` 未設定なら拒否） | コード読解 | `!process.env.CRON_SECRET` で 401 | 合格 | `cron/billing-audit/route.ts:35`、`cron/stripe-notifications/route.ts:9`、`cron/daily-summary/route.ts:119` |
| BILL-060 | cron 登録 | vercel.json | billing-audit `0 23 * * *`（JST 8:00）、stripe-notifications `*/5` | 合格 | `vercel.json` crons |
| BILL-061 | 日次レポートの重複配信防止 | コード読解 | 日付×種別の配信記録とリース | 合格 | `src/lib/billing-report-delivery.ts:31-81`、`cron/billing-audit/route.ts:73-82` |
| BILL-062 | 監査が期待する Webhook 購読イベント | コード読解 | 必須4種（§8.2） | 合格 | `billing-audit.ts:131-141`（`invoice.*` は必須に含めない仕様どおり） |
| BILL-063 | カスタマーポータルの顧客選択（R-10） | コード読解 | 生存契約の顧客、メール一致、他アプリ/他人契約・単発請求が混在する顧客は開かない、照会失敗は開かない | 合格 | `src/lib/stripe.ts:380-440`、`portal/route.ts:56-67`、`portal/redirect/route.ts:51-62` |
| BILL-064 | ポータル設定でトライアル中のプラン変更が試用を終了させない | コード読解 | `trial_update_behavior: 'continue_trial'` を検証 | 合格 | `src/lib/stripe.ts:610-618,686,698-700` |
| BILL-065 | 解約 API が生存契約を全部止め、部分失敗を通知（R-9） | コード読解 | メール横断、失敗時 502 + 運営通知 | 合格 | `subscription/cancel/route.ts:61-172,195-230` |
| BILL-066 | 再開 API の安全側（複数契約 409、所有者確認） | コード読解 | 409 / 所有者照合 | 合格 | `subscription/resume/route.ts:42-65` |
| BILL-067 | 状態 API が複数契約を単一表示しない、所有者確認 | コード読解 | 409 `MULTIPLE_SUBSCRIPTIONS` | 合格 | `subscription/status/route.ts:46-75` |
| BILL-068 | Stripe 照会失敗を「契約なし」と解釈しない | コード読解 | checkout 503 / sync 500 / portal error / cancel throw | 合格 | `checkout:157-164`、`sync:148-151`、`portal:80-82`、`cancel:91` |
| BILL-069 | `isPaidPlan` が既知コードのみを有料と判定 | コード読解 | ホワイトリスト | 合格 | `src/lib/unified-plan.ts:15-19` |
| BILL-070 | セッションのサービス別プランが `User.plan` との上位採用（R-7） | コード読解 | `higherPlan` | 合格 | `src/lib/auth.ts:99-111`、`src/lib/plan-utils.ts:68-72` |
| BILL-071 | `plan-limit.ts`: 無料は累計・プロは月次、月次カウンタ未渡しで失敗 | コード読解 | `countSince` 必須 throw、JST 月初 | 合格 | `src/lib/plan-limit.ts:119-123,159-194` |
| BILL-072 | プロ/エンタープライズに数値上限（無制限にしない） | コード読解 | mensetsu 30 / aishodan 30 / quote 100 / asklink 30 / popup 30、ENTERPRISE 200/200/500/100/100 | 合格 | `src/lib/plan-limit.ts:53-82` |
| BILL-073 | 組織枠の判定基準がオーナーの `User.plan` | コード読解 | `planTierOf(ownerUserId)` | 合格 | `plan-limit.ts:145-152`、`src/lib/organization-billing.ts` |
| BILL-074 | 削除で枠が戻らない台帳（max(現存, 台帳)） | コード読解 | `getOrganizationQuotaUsage` | 合格 | `src/lib/organization-quota-ledger.ts:14-50` |
| BILL-075 | 上限チェックと消費の競合（quote/mensetsu/aishodan） | コード読解 | 事前チェック後、Serializable TX 内で台帳を再計数・記録 | 合格 | `quote/documents/route.ts:179-220`、`mensetsu/sessions/route.ts:158-179`、`aishodan/room/[token]/start/route.ts:97-` |
| BILL-076 | 上限チェックと消費の競合（asklink/popup） | コード読解 | TX 内 `assertLimitForTier` | 合格 | `src/lib/asklink/access.ts:49`、`src/lib/popup/access.ts:55-62` |
| BILL-077 | `services.ts` 表示文言と `plan-limit.ts` の一致（quote/mensetsu/aishodan/asklink/popup） | 照合 | 数値一致 | 合格 | services.ts:1475-1476（面接3/月30）、1522-1523（商材1・見積書3/月100）、aishodan 商材1・商談5/月30、asklink 3/月30、popup 提案3・1サイト/月30 ＝ plan-limit.ts:26-69 |
| BILL-078 | SEO の文言と実装（記事3本/月、月30回） | 照合 | 一致 | 合格 | `services.ts:247-250`、`src/lib/seoAccess.ts:72-79`、`src/lib/pricing.ts:142` |
| BILL-079 | AIO の文言と実装（週1回 / 月30回） | 照合 | 一致 | 合格 | `services.ts:1387-1388`、`src/lib/aio/types.ts:115-116`、`src/lib/aio/quota.ts:5-16` |
| BILL-080 | 商談準備の文言と実装（月5 / 月50） | 照合 | 一致 | 合格 | `services.ts:1344-1345`、`src/lib/shodan/types.ts:134`、`api/shodan/preparations/route.ts:105-107` |
| BILL-081 | HR の AI 利用枠がプロで無制限になっていないか | コード読解 | 数値上限がある | 不合格 | `src/lib/hr/billing.ts:20-34`: PRO/BUNDLE `maxAiUsage: -1`、`maxMembers: -1`、ENTERPRISE 全て -1（B） |
| BILL-082 | 「初月無料」の直書きが `TrialCallout.tsx` 外に無い | grep | 直書きなし | 不合格 | `UsageLimitBanner.tsx:116,211`、`UnifiedPricingPlans.tsx:206,209`、`PlanUpgradeAlert.tsx:20`、`interview/InterviewUpsellModal.tsx:288`（いずれも `trialEligible` でゲート済み。C） |
| BILL-083 | 日次 cron による期限切れ降格処理（`daily-summary`） | コード読解 | 仕様4経路に含まれる／syncUnifiedBilling 経由 | 不合格 | `src/app/api/cron/daily-summary/route.ts:15-112`（後述 B） |
| BILL-084 | 本番 `/pricing` が 200 | 組み込みブラウザ GET | 200 で描画 | 合格 | 200（タイトル「料金プラン｜ドヤAI」、¥9,980・初月無料表示）。curl は Vercel Security Checkpoint で 403 |
| BILL-085 | 本番 `/api/stripe/webhook` への GET | 組み込みブラウザ GET | 405（500 でない） | 合格 | 405（ブラウザ）。curl（Stripe UA 含む）は 403 challenge |
| BILL-086 | 本番 `/api/stripe/trial-eligibility` 未ログイン | 組み込みブラウザ GET | 200 `{"eligible":true}` | 合格 | 200 `{"eligible":true}` |
| BILL-087 | 本番の Vercel Attack Challenge Mode が Webhook 経路を遮断していないか | curl（通常UA・Chrome UA・`Stripe/1.0` UA） | `/api/stripe/webhook` が challenge 対象外 | 不合格 | 全 UA で `403` + `x-vercel-mitigated: challenge` + `x-vercel-challenge-token`（後述 A）。POST は本点検の制約で未実施 |
| BILL-088 | 本番 Webhook への署名付き POST 往復 | 未実施 | — | 未確認 | 本番 POST・Stripe API 不可の制約。Stripe ダッシュボードの配信ログで確認が必要 |
| BILL-089 | `StripeWebhookEvent`/`StripeWebhookNotification` の本番レコード確認 | 未実施 | 直近イベントが processed | 未確認 | 本番DB 不可 |
| BILL-090 | Vercel 環境変数（`STRIPE_*` 同一モード、`STRIPE_PRICE_BANNER_PRO_MONTHLY` 等）の設定値 | 未実施 | 揃っている | 未確認 | 秘密値のため未参照（変数名のみ確認） |
| BILL-091 | 現役19サービスの全生成APIで上限チェックが呼ばれているか（banner/seo/interview/persona/hr/kintai/doyalist/doyaslide/cunning/promane/sfa/shodan/aio/adimage の個別ルート網羅） | grep + 読解（部分） | 未チェックの課金発生ルートが無い | 未確認 | 本点検で読解できたのは quote/mensetsu/aishodan/asklink/popup/seo/aio/shodan/banner(monthly-quota)/persona(project-ledger)/hr。残りのサービス別ルートの網羅は時間内に完了せず（委譲した探索の結果未着）。次回点検で継続 |
| BILL-092 | 提供終了サービスの全 API ルートの 410 ガード網羅 | grep（部分） | 全ルートに `SERVICE_RETIRED` ガード | 未確認 | shindan/copy/lp の主要ルートは `retiredServiceResponse` 確認済み（`src/lib/retired-service.ts`）。tenkai/voice/movie/adsim/interviewx/adbanner/kantan/opening/logo の各ルートは未網羅 |

### 不合格・要対応

#### BILL-087 ｜ 重大度 A ｜ Vercel の Security Checkpoint（Attack Challenge Mode）が `/api/stripe/webhook` にも適用されている可能性
- 現象: 本番の全パス（`/pricing`、`/api/health`、`/api/stripe/webhook` など）への curl GET/HEAD が、通常 UA・Chrome UA・`Stripe/1.0` UA いずれでも `403` + `x-vercel-mitigated: challenge` を返す。JS を実行できる組み込みブラウザでは 200/405 になるため、Vercel 側の JS チャレンジが有効。Stripe の Webhook 配送は JS チャレンジを解けないため、`/api/stripe/webhook` に bypass ルールが無ければ **経路1（Webhook）が全件 403 で失敗**し、契約・解約の反映が決済直後同期（経路2）と手動再同期（経路3）だけに依存する。解約・支払い失敗（Stripe 側起点）は経路2/3 では拾えないため、解約反映漏れ＝過剰付与、`unpaid` 後の PRO 残存が起き得る。
- 再現: `curl -I -A "Stripe/1.0 (+https://stripe.com/docs/webhooks)" https://doya-ai.surisuta.jp/api/stripe/webhook` → 403。
- 該当箇所: Vercel プロジェクトの Firewall 設定（コードではない）。監査 `checkWebhookEndpoint()`（`src/lib/billing-audit.ts:105-146`）はエンドポイントの登録と購読のみ確認し、配送成功率は見ない。
- 修正案: (1) Stripe ダッシュボード → Webhook `we_...` の直近配送ログの応答コードを確認。(2) Vercel Firewall で Attack Challenge Mode の状態を確認し、`/api/stripe/webhook`（および `/api/cron/*` を Vercel Cron が叩く経路）に Bypass のカスタムルールを追加、または Challenge を解除。(3) 監査に「直近24hの `StripeWebhookEvent` 受信件数が 0 かつ Stripe 側に配送がある」検知を追加する（設計判断要）。
- worktree で安全に直せるか: いいえ（Vercel 設定の問題。コード側の検知追加は可能だが課金監視ロジックの変更は設計判断要）。

#### BILL-051 / BILL-083 ｜ 重大度 B ｜ 仕様外の第5の書き込み経路（`daily-summary` cron の期限切れ降格）
- 現象: `src/app/api/cron/daily-summary/route.ts:15-112` が `stripeCurrentPeriodEnd < now` の有料ユーザーを拾い、DB の `stripeSubscriptionId` 1本だけを Stripe で照会して `prisma.user.update({plan:'FREE'})` と各サービス行の `update` を直書きする。`syncUnifiedBilling` を通らないため、(a) 手動付与保護（R-13）が効かず `billing_manual_grants` 登録者も降格し得る、(b) 顧客分裂・二重契約で DB のIDが解約済み側を指していると、残存する有効契約を確認せず FREE に落とす（R-2 と同種）、(c) `HrOrganization.plan` が同期されない、(d) 各行の更新がTXでなく途中失敗で INV-2 違反になる、(e) FREE→有料ではないので通知は不要だが、降格の運営通知も無い。`reference/11-billing-spec.md §4` の「書き込み経路は4つだけ」に反する。
- 再現条件: 月次更新の Webhook が不達（BILL-087 の状況）で `stripeCurrentPeriodEnd` が更新されず、かつ DB の subscriptionId が canceled/resource_missing の場合。手動付与ユーザー（例: キャンペーン6ヶ月無料で `stripeSubscriptionId` が古い解約済みID）が該当すると翌朝 FREE になる。
- 該当箇所: `cron/daily-summary/route.ts:46-70`（判定）、`:76-102`（直書き）。
- 修正案: 判定は残して、書き込みを `syncUnifiedBilling({ plan:'FREE', ... })`（手動付与保護・全行・HR同期）へ置き換え、降格前に `findActiveLikeSubscriptions` で残存契約を確認する。もしくはこの処理を廃止し、日次監査の `overGranted` 報告＋手動対応に寄せる（§8 の「監査は自動修復しない」方針との整合）。仕様書 §4/§9 への追記も必要。
- worktree で安全に直せるか: いいえ（課金の降格ロジックで設計判断要。置き換え自体は `syncUnifiedBilling` 呼び出しで小さい）。

#### BILL-081 ｜ 重大度 B ｜ HR の AI 利用枠・メンバー数がプロで無制限
- 現象: `src/lib/hr/billing.ts:20-34` で PRO/BUNDLE は `maxAiUsage: -1`（無制限）、`maxMembers: -1`、ENTERPRISE は全項目 -1。DEV-STATUS 2-5「有料を無制限にしない（実費が青天井）」と矛盾。HR 評価AI コメント生成は外部 LLM を呼ぶため、プロ契約者1人あたりの実費上限が無い。
- 該当箇所: `src/lib/hr/billing.ts:26-27`；利用側 `reserveAiUsageInTransaction`（`src/lib/hr/*`）は -1 を無制限として通す。
- 修正案: PRO に月次の数値上限（他サービス同等の 30〜100 程度）を置き、`services.ts` の HR 表示文言（`従業員100名まで`）に AI 回数も併記する。11-billing-spec.md「HR評価AIの利用枠」節の「上限値は変更しない」記述も改訂対象。
- worktree で安全に直せるか: いいえ（上限値の決定は料金設計判断。コード変更自体は1行）。

#### BILL-020 ｜ 重大度 B ｜ `paused` 契約で有料権利が残る
- 現象: `customer.subscription.updated` で `status === 'paused'` になった場合、`handleSubscriptionUpdated`（`webhook/route.ts:328-334`）は canceled/unpaid でも ACTIVE_LIKE でもないため何もせず、DB は PRO のまま。`updateUserSubscription` も早期 return（:475）。日次監査は `paused` を live と見ないため `overGranted`（warning のみ・critical でない）としてしか出ない。
- 再現条件: Stripe ダッシュボードやポータルで契約を一時停止（pause collection ではなく subscription pause）。現行の `trial_settings.end_behavior` は `cancel` なので自動発生は限定的。
- 修正案: `paused` を canceled/unpaid と同じく `handleSubscriptionDeleted` 経由で FREE に落とす（残存契約チェックは既存ロジックが行う）。仕様 §5 の表に `paused` 行を追加。
- worktree で安全に直せるか: いいえ（状態遷移表の変更＝設計判断要。変更は1条件）。

#### BILL-039 ｜ 重大度 B（条件付き） ｜ `banner.basic` の価格フォールバックで LIGHT 価格が PRO 階層に解決し得る
- 現象: `src/lib/stripe.ts:56-65` で `STRIPE_PRICE_BANNER_BASIC_*` 未設定時に `STRIPE_PRICE_BANNER_STARTER_*` を流用。`getPlanIdFromStripePriceId` は `banner-basic` を `banner-starter` より先に照合（:461-462）するため、STARTER 価格の契約が `banner-basic` → `planTierFromPlanId` で PRO と判定される。
- 再現条件: Vercel に `STRIPE_PRICE_BANNER_STARTER_MONTHLY` が設定され、`STRIPE_PRICE_BANNER_BASIC_MONTHLY` が未設定で、旧 starter 価格の契約が生きている場合のみ。env 実値は未確認。
- 修正案: env を確認し、該当しないなら basic→starter フォールバックを削除。該当するなら entries の順序で `banner-starter` を先に置くか、basic の互換フォールバックを外す。
- worktree で安全に直せるか: いいえ（env 実値の確認が先。コード変更は小）。

#### BILL-038 ｜ 重大度 C ｜ Checkout が LIGHT/ENTERPRISE/BUNDLE の planId を解決する
- 現象: `checkout/route.ts:277-322` の priceMap に統一プラン以外が残る。UI は `UNIFIED_PRO_PLAN_ID`（'banner-pro'）のみ使うが、直POSTで `seo-light` 等を送ると env が設定されていれば ¥2,980 契約が成立し、未設定なら placeholder 価格で Stripe エラー（500）。
- 修正案: 受理する planId を `UNIFIED_PRO_PLAN_ID` と必要な互換のみに絞る（または retiredPlanPrefixes と同様に 410/400）。
- worktree で安全に直せるか: いいえ（LIGHT を残すかの方針確認が必要）。

#### BILL-082 ｜ 重大度 C ｜ 「初月無料」文言の直書き
- 現象: `UsageLimitBanner.tsx:116,211`、`UnifiedPricingPlans.tsx:206,209`、`PlanUpgradeAlert.tsx:20`、`interview/InterviewUpsellModal.tsx:288` が文言を直書き。いずれも `trialEligible` で出し分けており景表法上の誤表示には現状なっていないが、仕様 §6「必ず TrialCallout.tsx 経由」に反し、将来の出し分け漏れの温床。
- 修正案: `TrialInlineSuffix`/`TrialBadge` 等の部品へ置き換え。
- worktree で安全に直せるか: はい（表示部品の差し替えのみ、課金ロジック無関係）。

#### BILL-021 / BILL-024 / BILL-025 ｜ 重大度 C ｜ 重複定義・個別実装
- BILL-021: `webhook/route.ts:427-428,458-459` が通知文面のために `findFirst({stripeCustomerId})` を個別実装（顧客分裂時はメール欄が Stripe の `customer_email` にフォールバックするため実害は小）。
- BILL-024: `subscription/status/route.ts:16` の `ACTIVE_LIKE` が `unpaid` を含む別定義（読み取り専用で意図的だが仕様 §5 の「必ず同じ内容」に反する）。
- BILL-025: `TIER_RANK`/`PLAN_RANK` が7箇所に重複（値は一致）。
- 修正案: `stripe.ts` に `PLAN_TIER_RANK` を export し集約。status の `unpaid` 包含はコメントを仕様へ転記。
- worktree で安全に直せるか: はい（リファクタのみ。ただし課金ファイルを触るため `npx tsc --noEmit` 必須）。

#### BILL-042 ｜ 重大度 C ｜ `env.example.txt` の価格ID変数名が実装と不一致
- 現象: 例示に `STRIPE_PRICE_KANTAN_*`/`SEO_BUSINESS_*` など実装が読まない名前があり、実装が読む `STRIPE_PRICE_BANNER_LIGHT_*`/`HR_*`/`STRIPE_WEBHOOK_EXPECTED_URL`/`BILLING_MANUAL_GRANT_EMAILS` が無い。
- 修正案: `reference/11-billing-spec.md §14` の一覧に合わせて整理。
- worktree で安全に直せるか: はい（ドキュメントのみ）。


---

## 3. セキュリティ（認可・公開ルート・SSRF・Cron）

対象: chore/system-check-20261018 の worktree（origin/main worktree、`src/` と `seo/`）。全 API route.ts 586 本を機械走査し、認証マーカー（getServerSession / requireAdmin / CRON_SECRET / 署名検証 / 各 lib の access ヘルパ）の無いルートを抽出して 1 本ずつ判定した。IDOR は 11 のユーザー所有サービス 105 ルート、9 の組織スコープサービス約 130 ルートを静的に確認した。本番確認は未ログインの GET のみ 36 回（間隔 1.2 秒）。既存の設計レビュー（`09_Cursol-ui-renewal/.../REVIEW-2026-10-17-sec.md` SEC-29〜34）と重複する指摘は「既知」と記し、本票では現行システム向けに補う。
判定凡例: 合格 / 不合格 / 未確認 / 該当なし。ファイルパスは `src/app/api/` または `src/lib/` 相対。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| SEC-001 | Cron 40 ルート全件の CRON_SECRET 検証 | `src/app/api/cron/*/route.ts` 40 本を grep で全件確認 | 全件 `Authorization: Bearer ${CRON_SECRET}` を検証し、未設定時は 401 | 合格 | 40/40 が `if (!secret \|\| header !== \`Bearer ${secret}\`)` 形。`if (secret && ...)` 型は 0 件 |
| SEC-002 | Cron の CRON_SECRET 未設定時の素通り | 同上 | `!secret` で先に拒否 | 合格 | 例 `cron/aio-scan/route.ts:29`、`cron/drip-sender/route.ts:22-27`（コメントで「設定時のみ検証」を禁止） |
| SEC-003 | 本番 `/api/cron/daily-summary` 未認証 GET | curl 1 回 | 401 | 合格 | 実測 401 `{"error":"Unauthorized"}`。他 cron は叩いていない（同一実装） |
| SEC-004 | 管理 API `/api/admin/**` 全メソッドの管理者ガード | 各 route のエクスポートメソッド数と `requireAdmin/verifyAdminSession` 呼び出し数を比較 | ガード数 >= メソッド数 | 合格 | 例外は `admin/auth/login`・`logout`（認証入口）と `admin/migrate`（410 固定応答のみ） |
| SEC-005 | `admin/migrate` 本番到達 | curl GET + コード | DB 変更不可 | 合格 | POST は 410 `MIGRATION_ENDPOINT_RETIRED`、GET は 405（実測） |
| SEC-006 | 本番 `/api/admin/{users,stats,feedback,auth/session}` 未認証 GET | curl 4 回 | 401 | 合格 | 全件 401（実測） |
| SEC-007 | 管理者 cookie の属性 | `admin/auth/login/route.ts:262-268` | httpOnly / secure / sameSite | 合格 | httpOnly:true, secure(production), sameSite:'strict', 24h |
| SEC-008 | 管理者 JWT の秘密鍵フォールバック | `lib/admin-auth.ts:6` | 未設定時はハードコード秘密を使わない | 不合格 | `ADMIN_JWT_SECRET \|\| NEXTAUTH_SECRET \|\| 'fallback-secret-change-in-production'`。`verifyAdminSession` は DB の AdminSession 行も照合するため単独では突破不能だが、`requireBannerAdmin` は JWT 署名のみ（既知 SEC-30） |
| SEC-009 | 管理者ログインの `jwt.verify` algorithms 未指定 | `lib/admin-auth.ts:51` | algorithms 指定 | 不合格 | 既知 SEC-28。HS256 既定で実害は小 |
| SEC-010 | 管理者ログインのロックアウト DoS | `lib/admin-auth.ts:59-104`、`login/route.ts` | username 単独でのロックが無い | 不合格 | 既知 SEC-29（username 5 回失敗で 15 分ロック） |
| SEC-011 | 管理者ログインのユーザー列挙（タイミング） | `login/route.ts:176-196` | ユーザー不在時もダミー bcrypt 比較 | 不合格 | コメントは「同じ処理時間」だがダミー比較が無い |
| SEC-012 | 管理者 breakglass | `login/route.ts:99-130` | 本番で無効 | 未確認 | 環境変数 `ADMIN_BREAKGLASS_ENABLED` の実値はリポジトリ外。平文 env との `===` 比較 |
| SEC-013 | NextAuth cookie 設定 | `lib/auth.ts` に cookies/sameSite 指定なし | 既定（httpOnly, SameSite=Lax, Secure on https） | 合格 | `auth.ts:186-191`（maxAge 24h、secret）。Google のみ、`allowDangerousEmailAccountLinking` なし |
| SEC-014 | Stripe webhook 署名検証 | `stripe/webhook/route.ts:29-58`、`lib/stripe.ts:819-825` | `stripe.webhooks.constructEvent`、secret 未設定時は停止 | 合格 | 署名ヘッダ必須、`STRIPE_WEBHOOK_SECRET` 未設定で 500、イベント ID 冪等 |
| SEC-015 | `hr/billing/webhook`（署名なし） | コード | 書き込みなし | 合格 | 固定 JSON を返すのみ（既知 D-2） |
| SEC-016 | `inbound-email` POST の認証 | `inbound-email/route.ts:53-60` | 共有秘密必須、未設定時は閉じる | 合格 | `INBOUND_EMAIL_SECRET` 未設定で 500。Slack 投稿のみ、DB 書込なし。比較は `!==`（非定数時間）、`link` の URL 書式未検証（要注意） |
| SEC-017 | `inbound-email` GET | curl | 秘密を返さない | 合格 | `{"ok":true,"configured":true}`（設定有無のみ露出。軽微） |
| SEC-018 | `operations/{configure,receipt,status,daily-section}` | コード + curl(status) | `SLACK_OPS_SECRET` Bearer、未設定で 401 | 合格 | 全 4 本が `!secret \|\| header !== Bearer` 形。status 実測 401。本文は種別ごとに厳格検証、リンクは許可ホスト 5 件 |
| SEC-019 | `service-activity` POST | `service-activity/route.ts:7-20` | トークン必須 | 合格 | `HEISHA_CLIENT_ERROR_TOKEN` 必須、512B 上限。レート制限なし・トークンがクライアント配布値なら Slack スパム可（要注意） |
| SEC-020 | `operational-error` POST | `operational-error/route.ts:10-25` | 偽装で正規通知を潰せない | 不合格 | Origin ヘッダ同一オリジンのみで通過（curl で偽装可）。DB 固定 9 キー 10 分 1 回の枠を消費し正規アラートを抑止できる |
| SEC-021 | `test/openai-image` の本番到達 | curl GET + コード | 本番で無効化 | 不合格 | GET が 200 で使い方 JSON を返す（実測）。POST は `OPENAI_TEST_TOKEN` 必須（未設定 500）で課金は防げているが、テスト用ルートが本番に残る |
| SEC-022 | `/api/health` の情報露出 | curl | 本番は最小情報 | 合格 | `status/timestamp/database` のみ（実測）。非 production では env 有無と error.message を返す |
| SEC-023 | `mitsuboshi/nagusame/healthcheck` | curl | 内部情報を出さない | 不合格 | 認証なしでモデル ID・ANTHROPIC キー設定有無・DB 到達を返す（軽微） |
| SEC-024 | `mitsuboshi/nagusame/chat` の認証・制限 | `nagusame/chat/route.ts:39-117` | 未認証なら制限あり | 不合格 | 認証・Cookie・IP・日次上限が一切なく有料 Claude を呼ぶ（入力 12 件×1000 字、maxTokens 240） |
| SEC-025 | `mitsuboshi/nagusame/generate` のゲスト上限 | `generate/route.ts:44-55`、`lib/mitsuboshi/nagusame/limits.ts:27-59` | 回避不能な上限 | 不合格 | guestId Cookie をクライアント任意値で採用、削除で枠が再生。count→生成が非アトミック |
| SEC-026 | `t/click/[trackingId]/[linkId]` | `t/click/.../route.ts:13-47` | リダイレクト先が署名または DB 突合済み | 不合格 | linkId を base64 復号し http(s) なら 302。署名・DB 突合なし（オープンリダイレクト）。trackingId 不在でも遷移 |
| SEC-027 | `t/open/[trackingId]` | コード | 冪等な開封記録のみ | 合格 | `dripEmailLog.updateMany`、1x1 GIF 返却 |
| SEC-028 | `drip/unsubscribe` GET/POST | `drip/unsubscribe/route.ts`、`lib/drip-tokens.ts` | HMAC トークン、GET は読み取りのみ | 合格 | HMAC + timingSafeEqual + 90 日期限、GET は確認 HTML、実行は POST。HTML はエスケープ済み。秘密未設定時に固定フォールバック秘密（要注意、SEC-079） |
| SEC-029 | `popup/public/config` CORS | `lib/popup/public.ts` | `*` にしない、登録ドメイン照合 | 合格 | Origin/Referer を登録ドメインと照合し一致 Origin のみ返す、Vary: Origin |
| SEC-030 | `popup/public/track` の水増し耐性 | `track/route.ts:20-35,61-62` | 共有ストアでの制限 | 不合格 | インスタンス内 Map の 60 回/分、IP は x-forwarded-for 先頭。サーバーレスでは実質無効。統計水増しのみで漏えいなし |
| SEC-031 | `popup/public/image/[id]` | `image/[id]/route.ts:19-32` | live のみ公開、下書きは持ち主のみ | 合格 | isId 形式検証、status!=='live' は userId 一致必須。Storage は非公開で中継 |
| SEC-032 | popup 埋め込みと X-Frame-Options DENY の両立 | grep iframe（0 件）、`next.config.js` | iframe を使わない | 合格 | 埋め込みは script タグ + JSON(CORS)。DENY と両立 |
| SEC-033 | `banner/gallery` `banner/image` `banner/thumb` 公開配信 | コード | `metadata.shared===true` のみ | 合格 | 3 本とも shared 判定。gallery は take<=60・cursor 形式検証 |
| SEC-034 | `banner/test/templates` GET 公開 | curl + コード | 公開テンプレ一覧のみ、POST は管理者 | 合格 | GET 200（137KB テンプレ一覧、意図的）。POST/DELETE 系 8 本は `requireBannerAdmin` |
| SEC-035 | `banner/test/image/[templateId]` `seo/template/image/{category,template}` | コード | 共有カタログのみ、パストラバーサル無し | 合格 | fs 読み出しは固定マップ経由。DB 値の URL へ redirect のみ |
| SEC-036 | `banner/test/generate` 認証 | コード | 認証あり | 合格 | getServerSession + 月次クォータ予約 |
| SEC-037 | `swipe/celebration-images` `question-images` | curl + コード | 帯域・負荷が妥当 | 不合格 | 未認証 GET が 5.7MB の base64 画像配列を返す（実測）。DB から 100 件を毎回全取得、キャッシュヘッダなし（DoS/転送費） |
| SEC-038 | `seo/articles` GET 未認証 | curl | ゲスト Cookie 無しは空 | 合格 | 200 `articles:[]`（owner 条件 `userId null AND guestId` のため他人分は出ない） |
| SEC-039 | `interview/projects` GET 未認証 | curl | 同上 | 合格 | 200 `projects:[]` |
| SEC-040 | `stripe/trial-eligibility` GET 未認証 | curl | 個人情報なし | 合格 | `{"eligible":true}` のみ |
| SEC-041 | `doyaslide/usage` GET 未認証 | curl | 他人データなし | 合格 | `{"plan":"GUEST","tier":"GUEST"}` |
| SEC-042 | 本番 未認証 GET が 401/403 になる私的 API 21 本 | curl | 200 でデータが出ない | 合格 | banner/history, interview/usage, hr/employees, hr/organization, kintai/employees(403), kintai/dashboard, doyaslide/projects, sfa/deals, quote/documents, mensetsu/sessions, aishodan/rooms, asklink/runs, popup/sites, cunning/sessions, adimage/operations, aio/scans, operations/status, admin 4 本: 全件 401/403 |
| SEC-043 | 退役サービス API のガード | curl `tenkai/projects` + grep SERVICE_RETIRED | 410 | 合格 | 410 `提供を終了しました`（実測）。lp/copy/adsim/opening/interviewx/tenkai/movie/voice/shindan/adbanner は `SERVICE_RETIRED` で先に return |
| SEC-044 | 退役コード内の素の fetch（復活リスク） | `lib/tenkai/scraper.ts:24-36,68`、`lp/analyze-url:50,75`、`adsim/scrape:16`、`copy/analyze-url:24`、`lib/opening/site-analyzer.ts:100` | 復活時も safe-fetch | 不合格 | 文字列プレフィクス判定のみ・自動リダイレクト・サイズ無制限。`SERVICE_RETIRED=false` で即 SSRF（既知 SEC-31 を lp/adsim/copy/opening に拡張） |
| SEC-045 | `src/app/api/{seo/knowledge,seo/predict,seo/preview,seo/articles/[id]/meta,seo/knowledge/[id]}` | cat | ハンドラ無し | 合格 | `export {}` のみ（公開面なし） |
| SEC-046 | safe-fetch の防御内容 | `lib/net/safe-fetch.ts` | private/metadata IP 拒否、IP ピン留め、手動リダイレクト、サイズ上限 | 合格 | loopback/10/172.16/192.168/169.254/CGNAT/0.0.0.0/マルチキャスト/mapped v6 を拒否、undici lookup 差し替えでピン留め、redirect manual 3 ホップ、2MiB 既定/16MiB 上限。残課題: ポート無制限（既知 SEC-23） |
| SEC-047 | `banner/from-url`（HTML・画像・Chromium） | `from-url/route.ts:610-617,934-941,1297,1321,1501`、`lib/net/safe-browser.ts` | safe-fetch 経由 | 合格 | Chromium は `--host-resolver-rules=MAP * ~NOTFOUND`、JS 無効、全リクエストを Node 側 safeFetch で代行（80 件/20 秒/20MiB） |
| SEC-048 | `banner/history/thumb` | `thumb/route.ts:40` | 同上 | 合格 | safeFetchResource |
| SEC-049 | `adimage/analyze` + `lib/adimage/brand.ts` | `brand.ts:97,125`、`ref-palette.ts:30` | 同上 | 合格 | safeFetchText。ロゴ/og:image は URL 抽出のみ |
| SEC-050 | quote の URL 解析 | `lib/quote/analyze.ts:40,67` | 同上 | 合格 | safeFetchText、getQuoteContext 必須 |
| SEC-051 | aio ブランド取得 | `lib/aio/suggest.ts:15` | 同上 | 合格 | safeFetchText（24 秒、2MiB、3 リダイレクト） |
| SEC-052 | shodan 企業リサーチ | `lib/shodan/research.ts:176,230` | 同上 | 合格 | safeFetchText、manager 権限 |
| SEC-053 | seo 参照 URL・競合分析・extract | `seo/reference/{meta,parse}`、`competitor-analysis:61`、`seo/lib/extract.ts:21` | 同上 | 合格 | safeFetchText、session 必須 |
| SEC-054 | `seo/articles/[id]/link-check` | `link-check/route.ts:19,21` | 同上 | 合格 | safeFetchResource（HEAD→GET フォールバック）、所有者条件付き |
| SEC-055 | doyaslide scrape / logo | `lib/doyaslide/scrape.ts:16`、`logo.ts:91-110` | 同上 | 合格 | ロゴ取得は Supabase ホスト固定、`maxRedirects:0` |
| SEC-056 | cunning 会社分析 scraper | `lib/cunning/scraper.ts:85,144-170` | 同等の防御 | 合格 | assertUrlSafe + ピン留め + 手動 5 ホップ + 有界読み出し。safe-fetch と別実装（二重管理、要注意） |
| SEC-057 | persona 参照 URL | `persona/generate/route.ts:194` | 同上 | 合格 | safeFetchText、ログイン必須 |
| SEC-058 | asklink/popup サイト解析、mensetsu company、aishodan knowledge、doyalist scraper、doyamarke-body-check | 各 lib | 同上 | 合格 | 全て safeFetch 系（`asklink/site.ts:141`、`mensetsu/company.ts:49,73`、`aishodan/knowledge.ts:52,84`、`doyalist/collect/web-scraper.ts:27`、`doyamarke-body-check.ts:36`） |
| SEC-059 | PDF 生成 puppeteer（quote/mensetsu） | `lib/quote/pdf.ts:50,260`、`lib/mensetsu/pdf.ts:36,206` | URL を開かない、値はエスケープ | 合格 | setContent のみ、全項目 esc()。退役 adsim の `pdf-generator.ts:143` は ogImage を CSS に未エスケープ（到達不能） |
| SEC-060 | 固定ホスト以外の外部 fetch | grep axios/got/node-fetch/http.get | 無し | 合格 | Gemini/OpenAI/Stripe/Slack/Resend のみ。`next/image` remotePatterns 3 ホスト |
| SEC-061 | Supabase 非公開バケット検証ヘルパ | `lib/private-storage-bucket.ts` | 毎回 `public===false` を確認 | 合格 | getBucket で検証、無ければ `public:false` で作成。利用: movie/tenkai/interview/hr/shodan/adbanner/mensetsu/popup/voice/adimage |
| SEC-062 | doyaslide バケットの公開性 | `lib/doyaslide/storage.ts:23-38,126` | 非公開 + 署名 URL | 不合格 | `createBucket('doyaslide',{public:true})`、getPublicUrl、既存バケットの公開性未検証。ロゴは sharp 検証後も再エンコードなしで保存 |
| SEC-063 | `doyaslide/assets/logo` 検証 | `assets/logo/route.ts:11-20,57-72` | サイズ・実フォーマット | 合格 | 5MB、sharp でフォーマット一致・8192px・全画素デコード |
| SEC-064 | `shodan/company-profile/logo` 検証 | `logo/route.ts:9-31`、`lib/shodan/storage.ts` | マジックバイト or 再エンコード | 不合格 | 申告 `file.type` のみで保存（既知 SEC-32）。private バケット、署名 URL 2 時間 |
| SEC-065 | `shodan/company-profile` PUT の logoPath 組織拘束 | `company-profile/route.ts:68-69` | 自組織パスのみ | 不合格 | 正規表現 `^shodan/logos/[a-z0-9-]+/<uuid>.(png\|jpg\|webp)$` で組織セグメントが任意。他組織パスを指定すると GET/slides で署名 URL が発行される（UUID 推測困難） |
| SEC-066 | `adimage/brands/[id]/logo` | `lib/adimage/logo-input.ts:6-12,36-48`、`storage.ts:28-50` | 再エンコード、非公開 | 合格 | 3MB、1600 万画素以下、sharp で PNG 再エンコード、署名 URL 1 時間 |
| SEC-067 | `popup/popups/[id]/image` | `lib/popup/storage.ts:16-68` | マジックバイト | 合格 | PNG/JPEG/GIF/WebP マジックバイト + sharp metadata、2MB、50〜4000px、コンテンツハッシュ入りパス |
| SEC-068 | `hr/upload`（従業員写真） | `hr/upload/route.ts:19-72`、`lib/hr/storage.ts:41-52` | 再エンコード、非公開 | 合格 | 5MB、sharp 再エンコード、`hr-photos-private`、パス `orgId/uuid.ext`、ADMIN+ |
| SEC-069 | interview 素材アップロード（署名 URL 直接 PUT） | `upload-url/route.ts:57-110`、`confirm/route.ts:78-111`、`lib/interview/storage.ts` | サイズ再検証、パス所有、中身検証 | 不合格 | パスはサーバー生成・confirm は DB パス使用（合格）。ただし中身は拡張子と申告 MIME のみ、7 日有効の署名 URL を `fileUrl` として DB 保存、ゲスト可（枠は Cookie 依存） |
| SEC-070 | `mensetsu/live/[token]/recording` | `recording/route.ts:17-62`、`lib/mensetsu/storage.ts` | パス固定、同意・期限 | 合格 | パス `sessions/<id>/interview.webm` 固定、100MB、再生 URL 900 秒 |
| SEC-071 | 管理者テンプレ画像バケット（公開） | `lib/banner-admin-image-storage.ts:5-40` | 意図的公開、MIME 制限 | 合格 | 公開素材。バケット側 allowedMimeTypes + fileSizeLimit、requireAdmin |
| SEC-072 | persona / seo 生成画像の配信 | `persona/images/[id]/route.ts:16-30`、`seo/images/[id]/route.ts:24-37` | 所有者照合 | 合格 | private 検証 + 所有者/ゲスト照合 |
| SEC-073 | CSV 取込（hr/employees/import、sfa/leads/import） | 各 route | 行数・長さ上限、権限 | 合格 | 500 行、ADMIN+/SFA 権限 |
| SEC-074 | NEXT_PUBLIC_ に秘密が無いか | grep 36 名を全列挙 | service_role/secret/private key 無し | 合格 | SUPABASE_URL、GTM/GA、TURNSTILE_SITE_KEY、STRIPE_PUBLISHABLE_KEY、価格 ID、URL 類のみ。`next.config.js env` はコミット SHA のみ |
| SEC-075 | クライアントバンドルへの秘密モジュール混入 | 'use client' 614 ファイルから秘密参照 132 モジュールへの import グラフ解析 | 到達なし or 'use server' | 合格 | 到達 16 件は全て `'use server'` アクション（RPC スタブのみ）か、`lib/aio/types.ts:43-46` の env 有無判定（値なし） |
| SEC-076 | ハードコード秘密 | grep sk_live_/whsec_/AIza/xox/hooks.slack.com/PRIVATE KEY | 0 件 | 合格 | src/seo/env.example で 0 件。`.env*` はリポジトリ直下に無し |
| SEC-077 | エラー応答に stack/内部メッセージ | API 全域の `NextResponse.json` 内 `e.message/stack/String(e)` 26 件を目視 | 生の DB/外部 API エラーを返さない | 合格 | 26 件全て型付きドメインエラーのガード内。例外: `interview/materials/[id]/transcribe/route.ts:244,258-266` が環境変数名入りの設定ヒントを返す（値なし、要注意） |
| SEC-078 | console.log への秘密出力 | grep token/secret/password/authorization/cookie | 値を出さない | 合格 | 文言・ステータスのみ。admin login の hash 先頭ログは development 限定 |
| SEC-079 | 共有秘密のフォールバックと比較 | `lib/drip-tokens.ts:3`、inbound-email/service-activity/operations の `!==` | 未設定時は停止、定数時間比較 | 不合格 | drip-tokens は両 env 未設定で `'drip-unsubscribe-fallback-secret'` を使用（配信停止トークン偽造）。4 系統が非定数時間比較、失敗回数制限なし |
| SEC-080 | Gemini API キーの URL クエリ付与 | `lib/gemini-text.ts:95,191` | ヘッダで送る | 不合格 | `?key=` でクエリに載せる。ログには出していないがエラー文に URL が混ざると露出し得る（軽微） |
| SEC-081 | GET での状態変更（CSRF 面） | 全 GET ハンドラ本体から prisma 書込みを抽出 | 意図的な追跡・冪等更新のみ | 不合格 | `interview/materials/[id]/transcribe-stream` GET が有料文字起こしを起動し DB 更新（SSE 都合）。他（t/open、hr invite 期限更新、popup lastSeenAt、banner thumb LQIP、shodan preparations の failed 遷移、stripe/portal）は意図的 |
| SEC-082 | 状態変更 POST の Origin 検証 | grep origin/sec-fetch-site | SameSite=Lax か明示検証 | 合格 | 明示検証は interview/claim-guest、interview/articles/generate、operational-error、popup public のみ。他は NextAuth 既定の SameSite=Lax に依存（他サイトからの POST には Cookie が付かない） |
| SEC-083 | 管理者・ゲスト cookie の SameSite | コード | Lax 以上 | 合格 | admin strict、seo/interview/aishodan/nagusame/adbanner のゲスト Cookie は httpOnly + Lax |
| SEC-084 | `stripe/portal` の returnTo | `portal/route.ts:14-22` | 同一オリジンのパスのみ | 合格 | `/` 始まり限定、`//`・`\`・制御文字拒否 |
| SEC-085 | 生 SQL のユーザー入力 | grep queryRawUnsafe/executeRawUnsafe | 0 件 | 合格 | タグ付きテンプレート `$queryRaw` のみ |
| SEC-086 | セキュリティヘッダ（本番実測） | curl `/` ヘッダ | HSTS/nosniff/X-Frame-Options/Referrer-Policy | 合格 | HSTS preload、nosniff、X-Frame-Options DENY、Referrer origin-when-cross-origin、X-XSS（全パス） |
| SEC-087 | CSP | `next.config.js:186,193` | グローバル CSP | 不合格 | `frame-ancestors 'self'` が `/banner/landing` と `/renewal-preview/*` のみ。script-src 等のグローバル CSP なし（既知 SEC-27 の現行版） |
| SEC-088 | `dangerouslySetInnerHTML` 使用箇所 | grep 18 ファイル | 信頼できる入力のみ | 合格 | 固定 CSS / GTM / JSON-LD / 自前 Markdown レンダラ（seo `MarkdownPreview`、interview `markdownToHtml`）。レンダラのサニタイズ強度は未精査（要注意）。退役 lp/logo/interviewx は到達不能 |
| SEC-089 | メール本文のエスケープ | `lib/html-escape.ts`、inbound-email | 利用者入力は escapeHtml | 合格 | escapeHtml 実装あり。inbound-email は from/subject/body を通す。招待メールの組織名は過去修正済み（コメント） |
| SEC-090 | 認可ヘルパ（ユーザー所有 11 サービス） | `seoArticleOwner.ts`、`seo-image-access.ts`、`interview/access.ts:93-121`、`doyaslide/access.ts`、`generation-http.ts`、`adimage/access.ts`、`image-operation-http.ts`、`cunning/access.ts`、`asklink/access.ts`、`popup/access.ts` | 実際に所有者照合している | 合格 | 全ヘルパを実装まで読んで確認（interview guestId は `^[A-Za-z0-9_-]{1,128}$`、adimage は 32 桁 hex 検証） |
| SEC-091 | IDOR: seo `[id]` 41 ルート | 各ルートの where 句 | `{id, ...owner}` または `article: owner` | 合格 | 全件二重条件。`if (!owner)` 欠落 0 件。例 `seo/articles/[id]/route.ts:19-20`、`seo/jobs/[id]/advance:20-22` + `pipeline.ts:3978` |
| SEC-092 | IDOR: interview `[id]` 13 ルート | checkOwnership 呼び出し + tx 内再照合 | 所有者照合 | 合格 | 全件 checkOwnership、更新系は tx 内再取得（TOCTOU 対策） |
| SEC-093 | IDOR: doyaslide `[id]` 5 ルート | where `{id, userId}` / `project:{userId}` | 二重条件 | 合格 | `projects/[id]:20,40,72,87`、`slides/[id]/revert:18-19,43-44` |
| SEC-094 | IDOR: adimage / asklink / popup / cunning / persona `[id]` 23 ルート | ownRun/ownPopup/ownerWhere/userId 比較 | 二重条件 | 合格 | 例 `cunning/knowledge/[id]:16-25`、`popup/sites/[id]:23,43`、`persona/projects/[id]:19-20` |
| SEC-095 | IDOR: kintai `[id]` 7 ルート | `{id, organizationId}` + ロール | 組織二重条件 | 合格 | 2026-05-27 監査の状態を維持。`requests/[id]:26-55` は本人/同部署 manager/hr_admin |
| SEC-096 | IDOR: hr `[id]` 14 ルート | 組織二重条件 + 評価/1on1 アクセス関数 | 組織二重条件 | 合格 | `evaluations/[id]` は findFirst({id}) 後に period.organizationId 比較（403 と 404 の差で存在確認可、軽微）。MANAGER は組織内全従業員詳細を閲覧可（設計確認事項） |
| SEC-097 | 組織コンテキスト解決（sfa/quote/mensetsu/aishodan/aio/shodan/hr/kintai/promane） | 各 `lib/{svc}/access.ts` | userId + ACTIVE でスコープ、他組織 slug は null | 合格 | `sfa/access.ts:43-70`、`hr/access.ts:12-33`（ヘッダはヒントのみ）、`promane/auth.ts:62-93` |
| SEC-098 | IDOR: sfa `[id]` 系（accounts/contacts/deals/leads/tasks/members） | lockCrmRecord/lockDeal/lockLead/lockSfaRelation | id + organizationId で FOR UPDATE、body の関連 id も同組織検証 | 合格 | `crm-record-http.ts:48-70`、`deal-mutation.ts:40-80`、`tasks/[id]:37-39` |
| SEC-099 | IDOR: quote / mensetsu / aishodan / aio / shodan `[id]` 系 | 各 route | 二重条件 | 合格 | 例 `quote/documents/[id]:58-63`、`mensetsu/sessions/[id]:19-20`、`aishodan/scenarios/[id]:16-18`、`aio/scans/[id]:17,32`、`shodan/preparations/[id]:25-26` |
| SEC-100 | IDOR: promane（workspace スコープ） | `workspace-mutations.ts:28-31,65-80`、clients/expenses/invitations | workspaceId 条件 | 合格 | 時間記録アクションは memberId を自分に限定せず、member ロールで組織内の任意エントリ削除可（要注意） |
| SEC-101 | ネストした relation 書込み（connect/set）の他組織 id | sfa deal/task/activity の accountId/dealId/contactId、quote productId、aishodan scenarioId、hr departmentId/managerId | 同組織検証 | 合格 | 全て lock 系または findFirst({id, organizationId}) で検証。sfa の contactId は null 解除のみ |
| SEC-102 | ロール: 同格以上への操作禁止（sfa/aio/shodan/hr） | members/[id] 系 | `>=` で拒否 | 合格 | `sfa/members/[id]:14-45`、`hr/organization/members/[id]:24-75` |
| SEC-103 | ロール: 同格付与の抑止（quote/mensetsu/aishodan/promane/kintai） | `quote/members/route.ts:65,82`、`members/[id]:36`（mensetsu/aishodan 同形）、`promane/invite-admission.ts:34-39`、`kintai/employees/[id]:113-116` | admin が admin を作れない | 不合格 | `>` 比較のため admin が admin を招待/昇格でき、昇格先は元の admin から変更不可。kintai は hr_admin 同士の昇降格・無効化可、自己ロール変更の禁止なし |
| SEC-104 | kintai: hr_admin による system_admin 席の乗っ取り | `kintai/employees/[id]/route.ts:60-77,113-124`、`employees/[id]/invite/route.ts:29-65`、`invite/[token]/route.ts:66-103` | system_admin の email/招待は保護 | 不合格 | PATCH は email を無検証で更新可（保護はロール変更と無効化のみ）。invite は対象ロールを見ずに PENDING/INACTIVE 席へ新トークン発行し inviteEmail=現在 email。受諾はメール一致のみで userId を上書き |
| SEC-105 | kintai: 招待受諾が他組織 membership を INACTIVE 化 | `kintai/invite/[token]/route.ts:93-97` | 本人確認・警告 | 不合格 | 無警告で全他組織を INACTIVE。SEC-104 の前提（INACTIVE な system_admin）を自然に生む |
| SEC-106 | kintai: 自己承認 | `kintai/requests/[id]/route.ts:105-127` | 申請者=承認者を拒否 | 不合格 | 部署一致のみ確認、自己承認の禁止なし |
| SEC-107 | 招待トークン強度・期限・ロール whitelist | 各 invite/[token] | 128bit 以上、期限、owner/system_admin 付与不可 | 合格 | sfa/kintai randomUUID、quote/mensetsu/aishodan randomBytes(24)、hr/promane randomBytes(32)。期限 48h〜30 日。受諾側で role whitelist、メール一致、単回 claim |
| SEC-108 | 招待 GET（無認証）の返却内容 | `hr/organization/invite/[token]:43-58`、`kintai/invite/[token]:36-43`、`sfa`/`promane`/`aio`/`shodan` | 招待先メールを返さない | 不合格 | quote/mensetsu/aishodan は返さないが、hr/kintai/sfa/aio/shodan/promane はメールを返す。sfa/aio/shodan の members GET は inviteEmail を全メンバーに返す（軽微） |
| SEC-109 | mensetsu → HR 引き渡し | `mensetsu/sessions/[id]/hr-handoff/route.ts:31-40,76-127` | 越境なし、上限・監査 | 不合格 | 書込先は呼出者が HR ADMIN+ の組織に限定（越境なし）。ただし `createWithinEmployeeLimit` を通さず従業員上限を迂回、hrEmployeeId 確認と更新が別 tx で二重登録余地、HR 監査ログなし |
| SEC-110 | 同一組織内のロール要件が無い書込/出力 | `sfa/export:105-148`、`aishodan/scenarios/[id] PUT`、`products/[id]/sources POST`、`rooms POST`、`aio/scans POST`、shodan generate 系 | 実行・出力系は manager+ | 不合格 | member ロールで全取引先 CSV 出力、商品プロファイル書換、有料 AI 実行が可能（組織内。設計確認事項、C 級） |
| SEC-111 | `organization-billing/[service]` | `route.ts:19-29` | 自組織のみ、owner 本人のみ管理 | 合格 | `?org=` のみ参照（x-*-org ヘッダ無視で既定組織に取り違え得る、要注意） |
| SEC-112 | hr `getOrgPlan` と owner 移譲 | `lib/hr/billing.ts:41-55`、`transfer-owner/route.ts` | OWNER のみ、自己不可 | 合格 | 組織行ロック、現 owner 1 名確認。プランは owner の User.plan に従属（運用論点） |
| SEC-113 | `DOYA_DISABLE_LIMITS` の本番値 | grep（約 40 箇所） | 本番未設定 | 未確認 | 単一 env で全サービス上限を無効化。実値はリポジトリ外 |
| SEC-114 | レート制限の全体像 | `middleware.ts`（/api をスキップ）、IP 参照 7 ファイル | 公開・生成系に IP/全体上限 | 不合格 | グローバル IP 制限なし。IP 単位は popup/track、admin login、kintai/clock、mensetsu consent、banner/generate のみ。interview ゲスト枠は Cookie を捨てれば再生 |
| SEC-115 | x-forwarded-for 先頭の信用 | grep 7 ファイル | Vercel 提供ヘッダを使う | 不合格 | 既知 SEC-34（Vercel 上では上書きされる想定、推測） |
| SEC-116 | aishodan / mensetsu の token ルーム | `lib/aishodan/public.ts`、`lib/mensetsu/public.ts`、`room/[token]/*`、`live/[token]/*` | token 長・期限・状態遷移・ゲスト拘束 | 合格 | token randomBytes(24)/UUID、`loadGuestSession` が token+sessionId+guestId を拘束、realtime token は tokenIssueCount 上限、turn は 50 件/呼び出し |
| SEC-117 | `/api/seo` ゲスト Cookie の形式検証 | `lib/seoAccess.ts:17-20` | 形式検証 | 不合格 | 既知 SEC-33（trim のみ。発行は randomUUID） |
| SEC-118 | 既存回帰テスト（`scripts/security-regression/run.cjs`）の守備範囲 | README と run.cjs を読む | 本票の不合格項目を検知するか | 合格（参考） | safe-fetch（private 拒否・DNS ピン留め・リダイレクト・応答上限）、OAuth、adimage 認証、通知プライバシー、hr/kintai/sfa/promane/quote 等の原子性・権限は網羅。t/click、nagusame/chat、kintai system_admin 保護、shodan logoPath、doyaslide 公開バケットは未カバー |

### 認証なしで到達できる API ルート一覧

認証マーカーなしで到達可能なルートのうち、ヘルパ内で認証しているもの（adimage/doyaslide/cunning/asklink/popup/interview/seo の各 access ヘルパ経由）を除いた実質的な公開面。

| パス | 判定 | 理由 |
|---|---|---|
| `/api/health` | 意図的公開 | 死活監視。本番は最小情報 |
| `/api/auth/[...nextauth]` | 意図的公開 | NextAuth 入口 |
| `/api/admin/auth/login`, `/logout` | 意図的公開 | 認証入口。login はレート制限・Turnstile 任意・TOTP |
| `/api/admin/migrate` | 意図的公開（無害） | 410 固定応答のみ |
| `/api/cron/*`（40 本） | 意図的公開（Bearer 必須） | CRON_SECRET 検証、未設定で 401 |
| `/api/operations/{configure,receipt,status,daily-section}` | 意図的公開（Bearer 必須） | SLACK_OPS_SECRET 検証 |
| `/api/service-activity` | 意図的公開（トークン必須） | HEISHA_CLIENT_ERROR_TOKEN。要対応（レート制限追加、SEC-019） |
| `/api/operational-error` | 要対応 | Origin 偽装で通過し正規アラート枠を消費（SEC-020） |
| `/api/inbound-email` | 意図的公開（秘密ヘッダ必須） | INBOUND_EMAIL_SECRET。GET は設定有無のみ |
| `/api/stripe/webhook` | 意図的公開 | Stripe 署名検証 |
| `/api/hr/billing/webhook` | 意図的公開（無害） | 廃止済み固定応答 |
| `/api/test/openai-image` | 要対応 | テスト用。POST はトークン必須だが本番に残置、GET は使い方を 200 で返す（SEC-021） |
| `/api/mitsuboshi/nagusame/chat` | 要対応 | 未認証・無制限で有料 Claude（SEC-024） |
| `/api/mitsuboshi/nagusame/generate` | 要対応 | ゲスト上限が Cookie 任意値で回避可（SEC-025） |
| `/api/mitsuboshi/nagusame/healthcheck` | 意図的公開 | 監視用。モデル名・キー設定有無を出す（軽微、SEC-023） |
| `/api/t/open/[trackingId]` | 意図的公開 | 開封ピクセル |
| `/api/t/click/[trackingId]/[linkId]` | 要対応 | オープンリダイレクト（SEC-026） |
| `/api/drip/unsubscribe` | 意図的公開 | HMAC トークン必須 |
| `/api/popup/public/{config,track,image/[id]}` | 意図的公開 | 埋め込み配信。登録ドメイン照合、live のみ公開。track は水増し可（SEC-030） |
| `/api/banner/{gallery,image,thumb}` | 意図的公開 | shared=true の作品のみ |
| `/api/banner/test/templates`（GET）, `/api/banner/test/image/[templateId]` | 意図的公開 | 公開テンプレカタログ。書込系は requireBannerAdmin |
| `/api/seo/template/image/{category,template}/*` | 意図的公開 | 共有テンプレ画像 |
| `/api/swipe/{celebration-images,question-images}` | 要対応（負荷） | 認証なしで数 MB の base64 を返す（SEC-037） |
| `/api/aishodan/room/[token]/*`, `/api/aishodan/invite/[token]` | 意図的公開（token） | 商談相手向け。token+guestId 拘束、開始は上限あり |
| `/api/mensetsu/live/[token]/*`, `/api/mensetsu/invite/[token]` | 意図的公開（token） | 候補者向け。同意・期限・tokenIssueCount |
| `/api/{hr/organization,kintai,sfa,aio,shodan,quote,promane}/invite/[token]`（GET） | 意図的公開（token） | 招待表示。hr/kintai/sfa/aio/shodan/promane は招待先メールを返す（SEC-108） |
| `/api/seo/articles`, `/api/interview/projects`（GET） | 意図的公開（ゲストモード） | Cookie なしは空配列 |
| `/api/stripe/trial-eligibility`, `/api/doyaslide/usage` | 意図的公開 | ゲスト向け表示値のみ |
| `/api/{tenkai,lp,copy,adsim,opening,interviewx,movie,voice,shindan,adbanner}/*` | 意図的閉鎖 | SERVICE_RETIRED で 410。復活時は SEC-044 を先に修正 |
| `/api/seo/{knowledge,predict,preview}`, `/api/seo/articles/[id]/meta`, `/api/seo/knowledge/[id]` | 該当なし | `export {}` のみ |

### 不合格・要対応

| ID | 重大度 | 現象と再現条件 | 該当箇所 | 修正案 | worktree で安全に直せるか |
|---|---|---|---|---|---|
| SEC-104 | S | kintai の hr_admin が system_admin 席を乗っ取れる。前提: 組織内に status が PENDING/INACTIVE の system_admin member（未受諾招待、または SEC-105 で INACTIVE 化された管理者）。手順: (1) hr_admin が対象従業員の email を自分の受信可能アドレスに PATCH（email はロール保護外）、(2) `employees/[id]/invite` POST で新トークン発行（対象ロール未確認、inviteEmail=現在 email）、(3) そのメールでログインし受諾 → member.userId が攻撃者に置換され system_admin 権限（静的解析による推論、未実行） | `kintai/employees/[id]/route.ts:60-77,113-124`、`kintai/employees/[id]/invite/route.ts:29-65`、`kintai/invite/[token]/route.ts:66-103` | 対象が system_admin なら actor も system_admin でない限り email/name/isActive の変更と invite を拒否。email 変更時に pending inviteToken を失効。email の形式・一意性検証 | はい（3 ファイルの条件追加のみ。`verify-kintai-employee-*`/`verify-kintai-invite-*` 回帰に system_admin ケースを追加して tsc で検証） |
| SEC-026 | A | `/api/t/click/<任意>/<base64url(https://evil.example/)>` に GET すると自社ドメインから任意 URL へ 302（フィッシング踏み台）。trackingId 不在でも遷移 | `t/click/[trackingId]/[linkId]/route.ts:13-47` | 送信時に HMAC 署名を付与し検証失敗は 400、または DripEmailLog/リンク表に URL を保存して ID 参照。許可ドメイン制限を併用 | はい（route と `lib/drip-tokens.ts`/送信側のリンク生成の対で修正。既存メール内リンクの互換期間を設ける） |
| SEC-024 | A | `/api/mitsuboshi/nagusame/chat` へ `personaId` と `messages` を連続 POST するだけで、認証・Cookie・IP・日次上限なしに Claude を呼ばせられる（コスト無制限） | `mitsuboshi/nagusame/chat/route.ts:39-117` | generate と同じ `checkNagusameLimit` を適用、サーバー署名付きゲスト Cookie、DB ベースの IP/全体日次上限、Turnstile | はい（route 1 本と limits.ts） |
| SEC-025 | A | nagusame/generate のゲスト上限は guestId Cookie をクライアント任意値で採用するため、Cookie 削除/書換で 1 日 3 回枠が無限に再生。count→生成が非アトミック | `nagusame/generate/route.ts:44-55`、`lib/mitsuboshi/nagusame/limits.ts:27-59` | HMAC 署名付きゲスト ID、IP/全体上限の併用、予約（claim）型のアトミック計上 | はい |
| SEC-065 | A | shodan `company-profile` PUT の logoPath 正規表現が組織セグメントを自組織と照合しない。他組織のロゴパス（UUID 必須、漏えい時のみ）を保存すると GET/slides で他組織ロゴの署名 URL が発行される | `shodan/company-profile/route.ts:68-69` | `startsWith(\`shodan/logos/${ctx.organizationId}/\`)` を必須に。signedUrl 側でも同条件 | はい（1 行の条件追加） |
| SEC-062 | A | doyaslide バケットが `public:true`（既存バケットの公開性も未検証）。スライド画像・ロゴが URL を知る誰でも閲覧可（UUID パス） | `lib/doyaslide/storage.ts:23-38,126` | private バケット + 署名 URL または認証付き中継へ移行。ロゴは sharp 再エンコード | いいえ（Supabase 側バケット設定変更と既存 URL の移行が伴う。コード変更自体は可能だが単独では完了しない） |
| SEC-020 | A | `operational-error` は Origin ヘッダ同一オリジンのみで通過。curl で偽装し DB 固定枠（10 分 1 回）を消費して正規のブラウザエラー通知を抑止できる | `operational-error/route.ts:10-25`、`lib/operational-error-limit.ts:10-27` | Origin に加え署名/Turnstile、送信元別の枠分離、トークン用途分離 | はい |
| SEC-103 | A | quote/mensetsu/aishodan で admin が admin を招待・昇格でき（`>` 比較）、昇格先は元 admin から変更不可。kintai は hr_admin 同士の昇降格・無効化と自己ロール変更が可能。promane も admin→admin 招待可 | `quote/members/route.ts:65,82`、`quote/members/[id]:36`（mensetsu/aishodan 同形）、`promane/invite-admission.ts:34-39`、`kintai/employees/[id]:113-116`、`kintai/employees/route.ts:99-106` | sfa/aio/shodan/hr と同じ `>=` 比較へ統一（owner のみ admin 付与）。kintai は `actorRole > targetRole` を要求し自己変更禁止 | はい（比較演算子と条件追加。`verify-membership-*` 回帰に同格ケース追加） |
| SEC-105 | B | kintai 招待受諾が本人の他組織 membership を無警告で全て INACTIVE 化（本人操作だが別組織の最後の system_admin が消え得る） | `kintai/invite/[token]/route.ts:93-97` | 受諾前の確認、最後の system_admin になる場合は拒否 | はい（UI 確認は別途） |
| SEC-109 | B | mensetsu→HR 引き渡しが `createWithinEmployeeLimit` を通さず従業員上限を迂回、hrEmployeeId 確認と更新が別 tx で二重登録、HR 監査ログなし | `mensetsu/sessions/[id]/hr-handoff/route.ts:76-127` | 1 tx で `updateMany where hrEmployeeId is null` による claim、createWithinEmployeeLimit と logAudit を使用 | はい |
| SEC-069 | B | interview 素材は拡張子・申告 MIME のみで中身未検証。7 日有効の署名 URL を `fileUrl` として DB 保存（長期の読取権）。ゲスト可で枠は Cookie 依存 | `interview/materials/upload-url/route.ts:57-110`、`confirm/route.ts:78-111`、`lib/interview/storage.ts:200-214` | confirm 後に先頭バイト検査、署名 URL は都度発行し DB にはパスのみ、ゲスト枠に IP/全体上限 | はい（DB の fileUrl 利用箇所の追従が必要） |
| SEC-081 | B | `interview/materials/[id]/transcribe-stream` GET が有料文字起こしを起動し DB 更新。SameSite=Lax のためトップレベル遷移 GET に Cookie が付く（素材 ID が必要で実害小） | `transcribe-stream/route.ts:45,219,274,385-393` | POST で開始し GET は読み取り専用に、または GET に Origin/Sec-Fetch-Site 検証 | はい |
| SEC-044 | B | 退役ルートの素の fetch（文字列プレフィクス判定のみ・自動リダイレクト・サイズ無制限）。`SERVICE_RETIRED=false` で即 SSRF | `lib/tenkai/scraper.ts:24-36,68`、`lp/analyze-url/route.ts:50,75`、`adsim/scrape/route.ts:16`、`copy/analyze-url/route.ts:24`、`lib/opening/site-analyzer.ts:100` | safeFetchResource へ置換、または復活予定なしなら削除。CI で「素の fetch + ユーザー URL」を grep 検出 | はい（退役中のため副作用なし） |
| SEC-064 | B | shodan ロゴが申告 `file.type` のみで再エンコードなし（既知 SEC-32） | `shodan/company-profile/logo/route.ts:9-31` | adimage 方式（sharp 再エンコード）へ統一 | はい |
| SEC-037 | B | `/api/swipe/celebration-images` が未認証で 5.7MB の base64 を返し、毎回 DB から 100 件全取得（実測）。帯域・DB 負荷の DoS 面 | `swipe/celebration-images/route.ts:9-50`、`question-images` | 認証またはゲスト Cookie 必須、count 件のみランダム取得、Cache-Control、画像は Storage URL 参照に | はい |
| SEC-030 | B | popup/track の制限がインスタンス内メモリで、サーバーレスでは実質無効。Origin/Referer は非ブラウザで偽装可。統計水増し | `popup/public/track/route.ts:20-35,61-62` | 共有ストア（DB）での制限、サイト単位日次上限 | はい |
| SEC-114 | B | グローバル IP レート制限なし（middleware は /api をスキップ）。interview ゲスト枠は Cookie を捨てれば再生 | `src/middleware.ts`、`lib/interview/access.ts:43-65` | 公開・ゲスト経路に DB ベースの IP/全体上限、署名付きゲスト Cookie | はい（段階導入） |
| SEC-079 | B | `drip-tokens.ts` が両 env 未設定で固定フォールバック秘密で HMAC（配信停止トークン偽造）。inbound-email/service-activity/operations/operational-error の秘密比較が `!==`、失敗回数制限なし | `lib/drip-tokens.ts:3`、各 route | 未設定時は 500 で停止、`crypto.timingSafeEqual`（長さ検査込み）へ統一、失敗回数制限 | はい |
| SEC-008 | B | 管理者 JWT 秘密の `'fallback-secret-change-in-production'` フォールバック。`requireBannerAdmin` は JWT 署名のみ（既知 SEC-30）で DB セッション未照合 | `lib/admin-auth.ts:6`、`lib/banner-admin-guard.ts:40` | 起動時に秘密未設定なら失敗、`requireBannerAdmin` を `verifyAdminSession` に統一 | はい |
| SEC-010 / SEC-011 / SEC-009 | B | admin login: username 単独ロック DoS（既知 SEC-29）、ユーザー不在時のダミー bcrypt なし（タイミング列挙）、`jwt.verify` algorithms 未指定（既知 SEC-28） | `lib/admin-auth.ts:51,59-104`、`admin/auth/login/route.ts:80-99,176-196` | IP+username 組でロック、正しいパスワードはロック中も通す、ダミー比較追加、`algorithms:['HS256']` | はい |
| SEC-106 | B | kintai manager/hr_admin が自分の申請を承認できる | `kintai/requests/[id]/route.ts:105-127` | `existing.employeeId === kctx.employeeId` の approve/reject を拒否 | はい |
| SEC-021 | C | `/api/test/openai-image` が本番に残置（GET 200 で使い方 JSON、POST はトークン必須） | `test/openai-image/route.ts` | `VERCEL_ENV==='production'` で 404、または削除 | はい |
| SEC-108 | C | 招待 GET（無認証）が hr/kintai/sfa/aio/shodan/promane で招待先メールを返す。sfa/aio/shodan members GET は inviteEmail を全メンバーに返す | `hr/organization/invite/[token]:43-58` ほか | quote/mensetsu/aishodan と同様にメールを返さない（またはマスク） | はい |
| SEC-110 | C | sfa/export（全取引先 CSV）、aishodan scenarios PUT・sources POST・rooms POST、aio/scans POST、shodan generate が member ロールで実行可（組織内） | 各 route | 実行・出力系は manager+ に統一（設計判断） | はい（要件確認後） |
| SEC-100 | C | promane 時間記録アクションが memberId を自分に限定せず、member ロールで組織内任意エントリを削除可 | `lib/promane/actions-time-entries.ts:98-135,142-155` | 本人または admin+ に限定 | はい |
| SEC-087 | C | グローバル CSP なし | `next.config.js` | report-only から段階導入（既知 SEC-27。inline script の整理が前提） | はい（report-only なら） |
| SEC-023 | C | nagusame healthcheck がモデル ID・キー設定有無を公開 | `healthcheck/route.ts` | `{ok}` のみ返す、または Bearer 必須 | はい |
| SEC-080 | C | Gemini API キーを URL クエリで送信 | `lib/gemini-text.ts:95,191` | `x-goog-api-key` ヘッダへ | はい |
| SEC-117 | C | seo ゲスト Cookie の形式検証なし（既知 SEC-33） | `lib/seoAccess.ts:17-20` | UUID 形式検証 | はい |
| SEC-115 | C | x-forwarded-for 先頭を信用（既知 SEC-34） | 7 ファイル | `x-vercel-forwarded-for` / `request.ip` | はい |
| SEC-012 / SEC-113 | 未確認 | breakglass と `DOYA_DISABLE_LIMITS` の本番値 | 環境変数 | `vercel env ls` で未設定/false を確認（本票では実施していない） | 該当なし（運用確認） |

補足（確認方法の限界）: 本番は未ログイン GET のみ 36 回で、POST・書込み・ログインは実施していない。IDOR・権限の判定は静的解析であり、SEC-104 の前提条件（PENDING/INACTIVE な system_admin 席）の実在は未確認。Vercel/Supabase 側の設定（バケット公開状態・環境変数・WAF）はリポジトリ外のため未確認。`doya-ai/` は対象外。


---

## 4. DB・環境変数・ビルド・PDF・Cron

対象: chore/system-check-20261018 の worktree（origin/main = 318841cb、2026-10-18 00:23 JST）。読み取りのみで点検した。本番DBには接続していない。
本番URLは未ログイン GET を試みたが、全パスが Vercel Security Checkpoint（HTTP 403、`x-vercel-mitigated: challenge`）で止まった。ボット判定の突破は禁止のため、本番の応答確認は全て「未確認」とした。
凡例: 結果は 合格 / 不合格 / 未確認 / 該当なし。根拠のパスは worktree 相対。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| DB-001 | Prisma モデル数の把握 | `grep -c "^model " prisma/schema.prisma` | 数が把握でき、スキーマが単一ファイル | 合格 | 195 モデル、enum 0、`@@map` 160。`package.json` の `prisma.schema` が `prisma/schema.prisma` を指す |
| DB-002 | datasource の env 名 | `prisma/schema.prisma` 8-12 行 | url と directUrl が env 参照 | 合格 | `url=env("DATABASE_URL")`、`directUrl=env("DIRECT_URL")`（9e320094 で追加） |
| DB-003 | 本番 `DIRECT_URL` の有効性 | スキル doya-db-push 記述と 9e320094 のコミット | 本番/ローカルで有効値 | 未確認 | スキルには「DIRECT_URL は接続情報が不正で使えない」とあり、9e320094 で「session pooler 経由」に変更済み。実値は env のため確認不可 |
| DB-004 | pgbouncer / connection_limit の扱い | `src/lib/prisma.ts` `getDatabaseUrl()` | 未指定時に自動付与、既存値は上書きしない | 合格 | pgbouncer=true、connection_limit=3、sslmode=require、connect_timeout=30、pool_timeout=30 を未指定時のみ付与 |
| DB-005 | PrismaClient のシングルトン化 | `src/lib/prisma.ts`、`grep "new PrismaClient"` | globalThis に保持。生成箇所が1つ | 合格 | 本番でも `globalForPrisma.prisma` に格納（`NODE_ENV` 条件なし）。`new PrismaClient` は prisma.ts のみ。scripts を除く |
| DB-006 | 接続断リトライ | `withRetry` / `resetPrismaClient` | 接続系エラーだけ最大2回再試行 | 合格 | `isConnectionError` で初期化エラーと ECONNREFUSED 等のみ対象。Proxy 経由で全モジュールが新クライアントを参照 |
| DB-007 | ビルドに `prisma generate` | `package.json` scripts | build と postinstall の両方 | 合格 | `build` 先頭と `postinstall` に `prisma generate` |
| DB-008 | ビルドで `db push` しない設計 | `package.json` build、`scripts/db-push-if-db-url.mjs` | build に DDL が無い | 合格 | build は generate、各テスト、`tsc --noEmit`、`next build` のみ。`db-push-if-db-url.mjs` は常に `exitCode=1` の退役スクリプト |
| DB-009 | `SKIP_DB_PUSH` 前提の記述との整合 | `grep SKIP_DB_PUSH` | コードと文書が一致 | 不合格 | コード内に参照が無い。スキル/DEV-STATUS の「SKIP_DB_PUSH で exit 0」は現物と不一致（現物は無条件 exit 1）。文書が古い |
| DB-010 | `db:push` npm script の残存 | `package.json` scripts | 本番DBを指した環境で誤実行できない | 不合格 | `"db:push": "prisma db push"` が残る。`.env` が本番を指す端末で実行すると本番に DDL が走る |
| DB-011 | migrations フォルダ | `ls prisma` | 手動運用なら `prisma/migrations` が無く、手動SQLが管理されている | 合格 | `prisma/migrations` は無し。`prisma/manual-migrations/` に SQL 3本（promane 時給 / aio アーカイブ / aishodan アーカイブ） |
| DB-012 | 直近の変更が手動SQLまたは記録でカバーされるか | `git log -p --since=2026-09-01 -- prisma/schema.prisma` と SQL/docs の突合 | 全変更に SQL か適用記録 | 不合格 | asklink 2テーブル（c02410c5, 10-09）に SQL も適用記録も無い。popup は SQL ファイル無しだが popup.md に記録あり |
| DB-013 | Stripe webhook 2テーブルの本番反映記録 | `docs/audits/2026-10-01-stripe-webhook-{receipts,notifications}/report.md` | 本番適用の記録 | 合格 | 両 report に「追加DDLのみ適用」「9列 / 11列・索引・0行を確認」とあり、`migration.sql` も同梱 |
| DB-014 | popup 3テーブルの本番反映記録 | `reference/services/popup.md` 288 行 | 適用日と範囲の記録 | 合格 | 2026-10-17 に `IF NOT EXISTS` の手動DDLで `popup_site` / `popup` / `popup_stat` を作成と記載 |
| DB-015 | Cunning 録音台帳 / Persona 追加テーブルの本番反映記録 | `reference/services/cunning.md` 369 行、`persona.md` 207 行 | 適用日の記録 | 合格 | 2026-09-23 に migration 253/285/287/291 と 263 を適用済みと記載 |
| DB-016 | 上記の証跡ファイルの存在 | `ls docs/audits/2026-09-23-history-order` | 参照先が存在 | 不合格 | cunning.md / persona.md が参照する `production-app-schema-report.json` が worktree に無い。記録の裏取り不能 |
| DB-017 | `AioPrompt.archivedAt` の本番反映 | schema 3519 行、`manual-migrations/2026-10-05-aio-prompt-archive.sql`（d806058b） | 適用記録あり | 未確認 | SQL はあるが適用記録が docs / コミットに無い。未適用なら `aio_prompts` の全クエリが P2022 |
| DB-018 | `AishodanProduct.archivedAt` の本番反映 | schema 4050 行、`2026-10-05-aishodan-product-archive.sql`（4b6150dc） | 適用記録あり | 未確認 | 同上。記録なし |
| DB-019 | `PromaneTimeEntry.hourlyRateSnapshot` の本番反映 | schema、`2026-10-04-promane-hourly-rate-snapshot.sql`（0d3c3fa0） | 適用記録あり | 未確認 | SQL に「コード展開前に実行、展開後に再実行」とあるが適用記録なし。未適用なら `promane_time_entries` 全クエリが P2022 |
| DB-020 | `asklink_run` / `asklink_banner` の本番反映 | schema 58 行追加（c02410c5）、`reference/services/asklink.md` | 適用記録あり | 未確認 | asklink.md の「本番 db push → main push の順」の指示のみで適用記録なし。SQL も無い |
| DB-021 | `$queryRawUnsafe` / `$executeRawUnsafe` の使用 | `grep -rE "queryRawUnsafe\|executeRawUnsafe" src seo` | 本番コードに 0 件 | 合格 | src/seo は 0 件。scripts 4 本（`migrate-banner-templates-to-storage.ts` ほか）のみで本番経路外 |
| DB-022 | `$queryRaw` の SQL 組み立て | `src/lib/seo-article-list.ts`、`aio/scans/route.ts`、`cunning/history-read.ts` | タグ付きテンプレート / `Prisma.sql` で値がバインドされる | 合格 | 全て `Prisma.sql\`...${値}\``。文字列連結は無し |
| DB-023 | 対話トランザクションのタイムアウト指定 | `$transaction(async` を含む 184 ファイルのうち `timeout:` 指定の有無 | 長い処理に timeout/maxWait | 不合格 | 97 ファイルが指定なし（既定 5 秒）。例: `api/quote/members/route.ts`、`api/kintai/requests/route.ts`、`api/popup/sites/route.ts`。Serializable 指定側は 30 秒指定あり |
| DB-024 | P2022 / P2021 を検知する仕組み | `grep -rE "P2022\|P2021" src` | 検知コードか health が列欠落を検知 | 不合格 | 0 件。`/api/health` は `SELECT 1` のみ。`slack-readable-error.ts` が「does not exist」を整形するだけで能動検知ではない |
| DB-025 | `/api/health` の DB チェック | `src/app/api/health/route.ts` | DB 疎通を見て 503 を返す | 合格 | DB 失敗で `degraded` + 503。本番では詳細を伏せる。ただし DATABASE_URL 未設定なら `skipped` で 200 |
| DB-026 | 直近スキーマ変更の列挙（参考） | git log | 一覧化 | 合格 | 9/2 以降 13 コミット。新規モデル: StripeWebhookEvent / Notification、Cunning 3、Persona 5、AskLink 2、Popup 3。新規列: archivedAt 2、hourlyRateSnapshot、recordingVersion ほか |
| DB-027 | スキーマ文書の鮮度 | `reference/04-database.md` | 現物と一致 | 不合格 | 「モデル数: 38」。現物 195。`07-dev-guide.md` 58 行は `npx prisma db push` を案内し、本番手動運用と矛盾 |
| ENV-001 | 参照される env の全件抽出 | `grep -rhoE "process\.env\.[A-Z0-9_]+" src seo next.config.js` | 件数把握 | 合格 | 273 種（`NEXT_PUBLIC_*` 含む） |
| ENV-002 | `env.example.txt` / `08-environment.md` の網羅 | 上記 273 種と両文書の突合 | 全件記載 | 不合格 | 198 種が両方に無い。例: `ANTHROPIC_API_KEY`、`SLACK_WEBHOOK_URL`、`SLACK_ALERT_WEBHOOK_URL`、`YOUTUBE_API_KEY`、`*_STORAGE_BUCKET` 各種、`DOYA_DISABLE_LIMITS` 系 |
| ENV-003 | 本番必須変数の文書化 | `08-environment.md` | DB、認証、Cron、接続 URL が記載 | 不合格 | `DATABASE_URL` / `NEXTAUTH_*` / `CRON_SECRET` はあるが、`DIRECT_URL` と `POSTGRES_PRISMA_URL`（db push 手順で必須）は env.example にも08にも無い |
| ENV-004 | 08 の旧記述 | `08-environment.md` の価格 ID 群 | 現行サービスと一致 | 不合格 | 提供終了サービス（movie / voice / copy / adsim 等）の価格 ID が現役のように列挙 |
| ENV-005 | `NEXTAUTH_SECRET` 未設定時の挙動 | `src/lib/auth.ts` 191 行 | 未設定を検知する | 不合格 | `secret: process.env.NEXTAUTH_SECRET` をそのまま渡すのみ。未設定時の明示エラー無し（NextAuth 側の挙動に依存） |
| ENV-006 | 署名鍵のハードコード fallback | `src/lib/admin-auth.ts` 6 行、`src/lib/drip-tokens.ts` 3 行 | 未設定時に落ちる、または fallback なし | 不合格 | `'fallback-secret-change-in-production'` と `'drip-unsubscribe-fallback-secret'` が使われ得る。env 欠落時に管理者 JWT が推測可能になる |
| ENV-007 | Stripe 初期化の未設定耐性 | `src/lib/stripe.ts` 9 行 | 未設定を明示エラーにする | 不合格 | `new Stripe(process.env.STRIPE_SECRET_KEY!)` をモジュール読込時に実行。未設定時の挙動は SDK 依存。`admin/users/route.ts` は `\|\| ''` で別実装 |
| ENV-008 | Supabase クライアントの non-null 断言 | `lib/{movie,hr,doyaslide}/storage.ts` | 未設定時に分かるエラー | 不合格 | `NEXT_PUBLIC_SUPABASE_URL!` / `SUPABASE_SERVICE_ROLE_KEY!` の断言。未設定だと実行時に不明瞭に失敗（movie は提供終了） |
| ENV-009 | 未設定で明示的に失敗する Cron 系 env | `grep "is not set"` | エラー文が出る | 合格 | `GOOGLE_APPLICATION_CREDENTIALS`、`YOUTUBE_API_KEY`、各 Slack webhook 未設定は throw し原因が分かる |
| ENV-010 | `NEXT_PUBLIC_*` に秘密が無いか | 全 `NEXT_PUBLIC_*` 12 種 + Price ID | 公開前提の値のみ | 合格 | SUPABASE_URL / APP_URL / BASE_URL / TURNSTILE_SITE_KEY / GTM_ID / STRIPE_PUBLISHABLE_KEY / GA_ID / 価格 ID。秘密名は無し |
| ENV-011 | `NEXT_PUBLIC_DOYA_DISABLE_LIMITS` | `UsageLimitBanner.tsx` 22 行 | 本番で効かない | 合格 | 表示の非表示のみ。課金判定には影響しない |
| ENV-012 | `DOYA_DISABLE_LIMITS` 系の本番ガード | `pricing.ts` 351/443 行、`api/generate` ほか 10 箇所 | NODE_ENV 等で本番では無効 | 不合格 | `=== '1'` のみで判定。本番 env に誤設定すると利用上限が全停止し実費が青天井になる（DEV-STATUS 2-5 の「無制限にしない」方針に反し得る） |
| ENV-013 | `VERCEL_URL` の使用箇所 | `grep VERCEL_URL src seo` | メールリンク等に使わない | 不合格 | `api/admin/drip/test-unsubscribe/route.ts` 20 行が `NEXTAUTH_URL \|\| \`https://${VERCEL_URL}\` \|\| ...` で、テンプレート文字列が常に真のため最後の fallback に到達しない。他は注意コメントのみ。`runtime-alert.ts` は診断表示で `*.vercel.app` 検証済み |
| ENV-014 | メールリンクが `NEXTAUTH_URL` ベース | `cron/drip-sender`、`mensetsu/members`、`quote/members`、`aishodan/members` | 外部向けリンクに VERCEL_URL 不使用 | 合格 | コメントで明示し NEXTAUTH_URL 系を使用 |
| ENV-015 | ソースへの秘密の混入 | `grep sk_live_ / whsec_ / AIza / xox / hooks.slack.com` | 実値なし | 合格 | 一致は `startsWith('sk_live_')` の判定コードのみ。実値なし。`.env*` は `.gitignore` 済みで追跡ファイルに無し |
| ENV-016 | ローカル専用 env の本番混入 | `OPENAI_TEST_TOKEN`、`ASKLINK_IMAGE_MOCK`、`DOYA_BUILD_NO_WEBPACK_CACHE` | 本番で無害 | 合格 | `api/test/openai-image` はトークン未設定なら 500、不一致なら 401 |
| ENV-017 | Vercel 本番 env の実設定 | Vercel ダッシュボード | 必須変数が設定済み | 未確認 | 値は参照不可。キー名の突合ができていない |
| BLD-001 | `ignoreBuildErrors` | `next.config.js` | `false` | 合格 | `typescript.ignoreBuildErrors: false`。DEV-STATUS 2-6 の「true」は古い |
| BLD-002 | build に型検査 | `package.json` | `tsc --noEmit` を含む | 合格 | `... && tsc --noEmit && next build`。続けて tests も実行 |
| BLD-003 | eslint | `next.config.js` | build で lint または CI で lint | 不合格 | `eslint.ignoreDuringBuilds: true`、CI（ci.yml）にも lint 工程が見当たらない。実害は低い |
| BLD-004 | tsconfig strict | `tsconfig.json` | `strict: true` | 合格 | `strict:true`、`@/*` と `@seo/*` の paths、`seo/**` を include |
| BLD-005 | tsconfig の include と実ディレクトリ | include 配列 | `src` と `seo` を含む | 合格 | `src/**`、`seo/**`、`.next/types/**` |
| BLD-006 | `serverExternalPackages` | `next.config.js` | chromium / puppeteer-core を外部化 | 合格 | `@sparticuz/chromium`、`puppeteer-core`、`mediainfo.js`。`@resvg/resvg-js`・`sharp` は Next の既定外部化に依存 |
| BLD-007 | `outputFileTracingIncludes` の構文 | `next.config.js` | ルートキーが `[id]` 形式で一致 | 合格 | 6 キー（transcribe 2、quote、mensetsu、adsim export、banner from-url）。パスは実ルートと一致 |
| BLD-008 | リダイレクトの恒久性 | `grep -c "permanent"` | 廃止分は 308 | 合格 | `permanent: true` 30 件、`false` は `/dashboard`→`/seo` の 1 件のみ |
| BLD-009 | セキュリティヘッダ | `next.config.js` headers | HSTS、nosniff、XFO、Referrer-Policy | 合格 | 全パスに付与。管理 / Stripe / Cron API は `no-store` |
| BLD-010 | アプリ画面の noindex | APP_ONLY_PREFIXES | ログイン後画面に X-Robots-Tag | 合格 | 約 70 パスに `noindex, follow`。LP / 料金 / ガイドは対象外 |
| BLD-011 | `images.remotePatterns` | `next.config.js` | 実利用ホストを網羅 | 未確認 | 3 ホストのみ（googleusercontent / oaidalleapiprodscus / via.placeholder）。Supabase Storage 画像を `next/image` で出す箇所の有無は未精査（24 ファイルが next/image を使用） |
| BLD-012 | `experimental` 設定 | `next.config.js` | 不要な実験設定が無い | 合格 | `experimental` ブロック無し |
| BLD-013 | 依存バージョン整合 | `package.json` と lock | next / eslint-config-next / next-auth / prisma / @prisma/client が整合 | 合格 | next 15.5.25 = eslint-config-next 15.5.25、next-auth 4.24.15、prisma と @prisma/client はともに 5.22.0（lock 解決値） |
| BLD-014 | lockfile | `git ls-files` | lock がコミット済み | 合格 | `package-lock.json`（lockfileVersion 3）のみ。他形式の lock 無し |
| BLD-015 | Node バージョン固定 | `package.json` engines、`.nvmrc` | 固定または CI と一致 | 不合格 | `engines` も `.nvmrc` も無し。CI は Node 24。Vercel 側設定次第で食い違う |
| BLD-016 | `@sparticuz/chromium` と `puppeteer-core` の組合せ | `package.json` | 互換が確認済み | 未確認 | 152.0.0 固定と 25.10.0 固定。互換は本番 PDF 実機でしか確認できない |
| BLD-017 | ビルド中のテスト | build script | 失敗でデプロイ停止 | 合格 | `test:security`、`test:asklink`、`test:popup` が build に入っている |
| BLD-018 | ビルドテストの docs 依存 | `scripts/security-regression/*.cjs` | `.vercelignore` で除外された docs/ を読み書きしない | 不合格 | `.vercelignore` は `/docs/` と `/reference/` を除外する一方、多数のテストが `docs/audits/...` に `writeFileSync` する（一部は `mkdirSync` 無し）。Vercel CLI デプロイ時はビルドが落ちる。GitHub 連携では `.vercelignore` が効かないため現状は顕在化していない |
| BLD-019 | ビルドが追跡ファイルを書き換える | 上記テスト | ビルドで git 差分が出ない | 不合格 | テストが `docs/audits/...-results.json` を再生成する。ローカルビルドのたびに差分が出る |
| BLD-020 | `vercel.json` の framework / buildCommand | `vercel.json` | `npm run build` | 合格 | `framework: nextjs`、`buildCommand: npm run build` |
| BLD-021 | `vercel.json` の `functions` パス実在 | 4 パスを `ls` | 実ファイルあり | 合格 | adsim 4 ルートとも実在 |
| BLD-022 | `vercel.json` の `regions` | `grep regions` | DB と同一リージョン | 未確認 | 指定なし。プロジェクト設定側のリージョンは確認できない |
| BLD-023 | `.vercelignore` | ファイル確認 | 実行時に必要なファイルを除外しない | 合格 | `/reference/`、`/docs/`、`/doya-ai/`、`.env*`、ログのみ。実行時に docs/reference を読む src は無い |
| BLD-024 | public 配下をサーバーで読む箇所 | `api/seo/template/image/category/[category]/route.ts` 41-44 行 | Vercel の関数に同梱される | 未確認 | `process.cwd()/public/...` を `readFile`。Vercel では public が関数に入らない場合がある。tracing include 無し |
| BLD-025 | 起動時の middleware | `src/middleware.ts` | 静的資産を除外、env 未設定で落ちない | 合格 | matcher で `_next/static` 等を除外。`MITSUBOSHI_HOSTS` / `SLIDE_HOSTS` は未設定でも動作 |
| PDF-001 | Chromium/puppeteer を使うルートの全列挙 | `grep -rniE "chromium\|puppeteer\|headless" src seo` | ルートを漏れなく特定 | 合格 | 直接: `api/banner/from-url`。間接: quote/mensetsu/adsim の各 pdf lib 経由で 3 ルート。計 4 ルート |
| PDF-002 | quote PDF の tracing | `next.config.js` | `/api/quote/documents/[id]/pdf` に chromium bin と ttf | 合格 | `chromium/bin/**` と `assets/fonts/*.ttf` を同梱 |
| PDF-003 | mensetsu PDF の tracing | 同上 | `/api/mensetsu/sessions/[id]/pdf` | 合格 | 同上 |
| PDF-004 | adsim export の tracing | 同上 | `/api/adsim/projects/[projectId]/export` | 合格 | 同上。ただし提供終了サービス（PDF-012 参照） |
| PDF-005 | banner from-url の tracing | 同上 | chromium bin（描画しないため font 不要） | 合格 | `chromium/bin/**` のみ |
| PDF-006 | tracing 抜けルートの有無 | PDF-001 の 4 ルートと tracing キーの突合 | 全ルートがキーに存在 | 合格 | 抜けなし |
| PDF-007 | 日本語フォント同梱 | `ls assets/fonts`、`git ls-files` | ttf がコミット済み | 合格 | NotoSansJP-Regular / Bold（各約 5.7MB）が追跡済み。OFL 1.1 |
| PDF-008 | フォント登録の呼出し順 | `src/lib/pdf/japanese-font.ts` | `executablePath()` の後に `/tmp/fonts` へコピー | 合格 | `registerJapaneseFonts` は /tmp/fonts へ copy。失敗時は console.error（日本語が消えると分かる） |
| PDF-009 | `maxDuration` | 4 ルート | 十分な秒数 | 合格 | 4 ルートとも 300 秒 |
| PDF-010 | メモリ設定 | `vercel.json` functions | Chromium 起動に十分 | 未確認 | adsim export のみ 3008MB 指定。quote / mensetsu / banner-from-url は未指定（プラン既定値に依存） |
| PDF-011 | 本番での PDF 実生成 | ログイン要 | 日本語が出る | 未確認 | CLAUDE.md の「PDFは必ず本番で実際に出す」に従う項目。未ログインのため実施不可 |
| PDF-012 | 提供終了サービスの Chromium 残置 | `vercel.json` / `next.config.js` | 使わない関数に重い設定を残さない | 不合格 | `/api/adsim/projects/[projectId]/export`（410 ガード済み）に 3008MB 設定と chromium/フォント同梱が残る。adsim の他 3 関数も `functions` に残置 |
| CRON-001 | Cron 件数 | `vercel.json` | 件数把握 | 合格 | 35 件（DEV-STATUS の「health-alert 等」より多い） |
| CRON-002 | パスにクエリ文字列が無い | `grep "?" vercel.json` | 0 件 | 不合格 | `/api/cron/service-operations?mode=daily|watch|reviews|cost|weekly|travel` の 6 件。DEV-STATUS 2-6 / CLAUDE.md 232 行は「クエリ付きは定時発火しない」。発火しない場合 daily / reviews / cost / weekly / travel が全停止し、`mode` 省略時は `watch` 扱い |
| CRON-003 | 全 Cron の route.ts 実在 | vercel.json パスと `src/app/api/cron/*/route.ts` | 全件実在 | 合格 | 欠落 0 |
| CRON-004 | GET の export | 全 route.ts | GET あり | 合格 | 全 38 ルートが GET を export。POST は無し |
| CRON-005 | CRON_SECRET 検証が fail-closed | 全 route.ts | 未設定なら拒否 | 合格 | 全ルートが `!secret \|\| auth !== Bearer`。`drip-sender` / `hubspot-sync` / `drip-report` のモジュール定数版も未設定拒否 |
| CRON-006 | `force-dynamic` | 全 route.ts | 指定あり | 合格 | 38 ルート全て指定 |
| CRON-007 | `maxDuration` の指定 | スケジュール済み 31 ルート | 全て指定 | 不合格 | `daily-summary`、`weekly-summary`、`monthly-summary`、`drip-sender` が無指定。drip-sender は毎時のメール配信で件数が増えると既定時間で打ち切られる |
| CRON-008 | 同一パスの重複登録 | vercel.json | 重複なし | 合格 | パス単位の重複なし |
| CRON-009 | 同時刻スケジュールの衝突 | schedule 突合 | 衝突しても独立処理 | 合格 | `*/5` に 4 本、`*/15` に 5 本、`0 23`・`0 0`・`30 22` に各 2 本。いずれも別処理で共有ロック無し |
| CRON-010 | ルートはあるが vercel.json に無い Cron | ルート一覧と突合 | 意図的であること | 合格 | 7 ルート: `appstore-{report,country-report,marketing-report,source-report}`、`gcp-usage`、`noroi-engagement-report`、`yurusen-appstore-report`、`drip-report`。git log で朝刊統合（8/24）と GCP 通知停止（9/3）による意図的な外しと確認。`drip-report` は手動テスト用 |
| CRON-011 | 外れた Cron のスケジューラ | リポジトリ内検索 | 呼び出し元が無いなら削除/明記 | 不合格 | 7 ルートはどこからも呼ばれない（notifications.ts の名称参照のみ）。認証付きで残るため実害は小さいが、不要コードが残存 |
| CRON-012 | アラート多重送信抑止がメモリ依存 | `src/lib/alert.ts` `shouldSend` | DB / 時刻ベースで抑止 | 不合格 | `lastSent` は `Map`（インスタンス内メモリ）。`health-alert`（5 分毎、cooldown 10〜15 分）は新規インスタンスで抑止が効かず、障害中に Slack 連投し得る（DEV-STATUS 2-6） |
| CRON-013 | 日次系の cooldown | `billing-audit`（12h）、`feedback-report`（7d） | 日次/週次頻度なら無害 | 合格 | cron 頻度自体が日次/週次のため cooldown が効かなくても重複しない。ただし手動再実行では重複する |
| CRON-014 | `service-operations` の二重実行防止 | `route.ts` | DB 台帳で枠を確保 | 合格 | `claimOps` / `readOps` / `writeOps` による DB 台帳。メモリ依存ではない |
| CRON-015 | `service-operations` の mode 検証 | `route.ts` | 不正値は 400 | 合格 | `invalid_mode` / `invalid_dry` を返す。vercel.json の 6 モードは全て許可リスト内 |
| CRON-016 | health-alert の監視対象 | `health-alert/route.ts` | 自サービスの health を含む | 合格 | 自己 + 呪い日記 + ゆるせん ほか 8 対象。`SELF_HEALTH_URL` で上書き可 |
| CRON-017 | health-alert が自ドメインの Checkpoint に阻まれないか | 本番応答 | 200 を受け取れる | 未確認 | 外部の curl は全て Checkpoint の 403。Vercel 内部からの自己 fetch も同様ならば、5 分毎に「ヘルスチェック異常」が出続ける。Attack Challenge Mode の有効/無効を要確認 |
| CRON-018 | Cron の本番実行履歴 | Vercel ダッシュボード | 全 Cron が定刻に成功 | 未確認 | ダッシュボード参照不可 |
| CRON-019 | Cron ルートの `Cache-Control` | `next.config.js` | `/api/cron/:path*` が no-store | 合格 | `private, no-store` を付与 |
| RET-001 | RETIRED_SERVICE_IDS の件数 | `src/lib/services.ts` 1746 行 | 一覧と各層が対応 | 合格 | 14 件: video、presentation、kantan、shindan、logo、opening、tenkai、copy、interviewx、lp、adsim、movie、voice、adbanner |
| RET-002 | video / presentation | ルート有無 | ルート未実装なら 308/410 不要 | 該当なし | ページ・API とも未実装（コメントで明記） |
| RET-003 | kantan の 3 点セット | next.config.js、API | 308 と 410 | 合格 | `/kantan`・`/kantan/:path*` → `/seo`（308）。`api/generate/route.ts` に `SERVICE_RETIRED` ガード |
| RET-004 | shindan | 同上 | 308 + 410 | 合格 | 308 あり。`api/shindan` 1 ルートがガード済み |
| RET-005 | logo | 同上 | 308 + 410 | 合格 | 308 あり。`api/logo` 1 ルートがガード済み |
| RET-006 | opening | 同上 | 308 + 410 | 合格 | 308 あり。`api/opening` 6/6 ガード済み |
| RET-007 | tenkai | 同上 | 308 + 410 | 合格 | 308 あり。`api/tenkai` 22/22 ガード済み |
| RET-008 | copy | 同上 | 308 + 410 | 合格 | 308 あり。`api/copy` 11/11 ガード済み |
| RET-009 | interviewx | 同上 | 308 + 410（`/interview` を巻き込まない） | 合格 | 308 あり。`api/interviewx` 20/20 ガード済み |
| RET-010 | lp | 同上 | 308 + 410 | 合格 | 308 あり。`api/lp` 9/9 ガード済み |
| RET-011 | adsim | 同上 | 308 + 410 | 合格 | 308 あり。`api/adsim` 9/9 ガード済み |
| RET-012 | movie | 同上 | 308 + 410 | 合格 | 308 あり。`api/movie` 11/11 ガード済み |
| RET-013 | voice | 同上 | 308 + 410 | 合格 | 308 あり。`api/voice` 9/9 ガード済み |
| RET-014 | adbanner | 同上 | 308 + 410 | 合格 | `/adbanner` → `/adimage`（308）。`api/adbanner` 7 ルート全メソッドに `ADBANNER_RETIRED` ガード（別実装の同等機能） |
| RET-015 | メソッド単位のガード網羅 | 各 route.ts の export 数とガード数 | 全メソッドにガード | 合格 | slide / slashslide を含む 13 ディレクトリで不一致 0 件 |
| RET-016 | slide / slashslide（RETIRED ではない統合） | next.config.js、API | 308 と 410 | 合格 | 308 あり。`api/slide` 2、`api/slashslide` 2 とも 410 |
| RET-017 | HIDDEN への反映 | `services.ts` 1781 行 | RETIRED が HIDDEN に含まれる | 合格 | `HIDDEN_SERVICE_IDS` に RETIRED 全件 + UNLISTED（popup）を含む |
| RET-018 | 本番での 308 応答 | 未ログイン GET | 308 | 未確認 | 全パスが Checkpoint の 403 でリダイレクトに到達できない |
| RET-019 | `/api/health`・`robots.txt`・`sitemap.xml`・トップの本番応答 | 未ログイン GET | 200 | 未確認 | 同上。コード側は `src/app/robots.ts`・`sitemap.ts`・`api/health/route.ts` が存在 |

### 不合格・要対応

S 級（全体停止・ログイン不能・データ消失）の確定事項は無し。ただし A 相当の「未確認」3 件は下表の末尾に併記する。

| ID | 重大度 | 現象 | 該当箇所 | 修正案 | worktree で安全に直せるか |
|---|---|---|---|---|---|
| CRON-002 | A | `service-operations?mode=...` の 6 件がクエリ付きで登録されている。プロジェクトの既知ルールでは定時発火しない。発火しないと日次/レビュー/コスト/週次/旅行の通知が止まり、`mode` 省略時は `watch` として動く | `vercel.json`、`src/app/api/cron/service-operations/route.ts` | モードごとに独立したプレーンパスのルート（例 `/api/cron/service-operations-daily`）を作り、共通処理を lib に切り出す。まず本番の Cron 実行履歴で 6 件が実際に発火しているかを確認する | はい（コード変更のみ。デプロイ後に Cron 履歴で確認） |
| DB-017 | A（確認要・未確認） | `aio_prompts.archivedAt` の本番反映記録が無い。未適用なら AIO プロンプトの全クエリが P2022 で 500 | `prisma/manual-migrations/2026-10-05-aio-prompt-archive.sql`、schema 3519 行 | 本番で列の存在を読み取り確認し、無ければ SQL を適用。適用後に docs へ記録 | いいえ（本番DBの確認・反映にユーザー承認要） |
| DB-018 | A（確認要・未確認） | `aishodan_*.archivedAt` の反映記録が無い。同様に全クエリ500の恐れ | `2026-10-05-aishodan-product-archive.sql`、schema 4050 行 | DB-017 と同じ | いいえ（ユーザー承認要） |
| DB-019 | A（確認要・未確認） | `promane_time_entries.hourlyRateSnapshot` の反映記録が無い。SQL は展開後の再実行も要求 | `2026-10-04-promane-hourly-rate-snapshot.sql` | 列の存在と NULL 行数を読み取り確認。無ければ適用し、記録を残す | いいえ（ユーザー承認要） |
| DB-020 | A（確認要・未確認） | `asklink_run` / `asklink_banner` の反映記録も SQL も無い。10-09 に公開済みの扱い | `prisma/schema.prisma`、`reference/services/asklink.md` | テーブルの存在を確認し、手動SQLを `manual-migrations/` に追加して記録 | SQL ファイルの追加と記録ははい。本番確認・反映はいいえ（ユーザー承認要） |
| CRON-017 | A（確認要・未確認） | 本番が全パスで Vercel Security Checkpoint の 403。自己 fetch の `health-alert` や外部監視、非認証ボットが阻まれていると、健全性監視が機能しない | Vercel の Firewall / Attack Challenge Mode 設定、`src/app/api/cron/health-alert/route.ts` | ダッシュボードで Attack Challenge Mode の状態を確認。有効なら検証済みボット・自己 fetch を除外する設定にする | いいえ（Vercel 設定。ユーザー確認要） |
| DB-024 | B | P2022 / P2021（列・テーブル欠落）を検知する仕組みが無い。`/api/health` は `SELECT 1` のみで、反映漏れが利用者の 500 で初めて分かる | `src/app/api/health/route.ts`、`src/lib/slack-readable-error.ts` | health に主要テーブルの `SELECT ... LIMIT 0`（新規列を含む）を足すか、Prisma エラーコード P2021/P2022 を Slack 通知へ分類する | はい（本番DBに接続しなければ検証のみ。テストはモックで可） |
| DB-023 | B | 対話トランザクション 97 ファイルが timeout 未指定（既定 5 秒）。プーラー越しの負荷時にタイムアウトし得る | 例: `api/quote/members/route.ts`、`api/kintai/requests/route.ts`、`api/popup/sites/route.ts` | 共通ヘルパーで `maxWait` / `timeout` の既定値を与える、または高コストなものから個別指定 | はい（ただし範囲が広いので段階的に） |
| CRON-007 | B | `drip-sender`（毎時のメール配信）と daily / weekly / monthly summary に `maxDuration` が無い | 4 つの `route.ts` | `export const maxDuration = 300` を追加（他の Cron と揃える） | はい |
| CRON-012 | B | アラート抑止がインスタンス内メモリ。`health-alert` は障害中に連投し得る | `src/lib/alert.ts` `shouldSend`、`cron/health-alert` | DB（既存の `service-operations-state` 台帳）か時刻バケットで抑止する | はい（ローカル検証可。反映は通常デプロイ） |
| ENV-006 | B | 署名鍵のハードコード fallback。`ADMIN_JWT_SECRET` と `NEXTAUTH_SECRET` が共に欠けると管理者 JWT・配信停止トークンが推測可能 | `src/lib/admin-auth.ts` 6 行、`src/lib/drip-tokens.ts` 3 行 | 本番では未設定時に throw（または起動時検証）。fallback 文字列を削除 | はい |
| ENV-012 | B | `DOYA_DISABLE_LIMITS` 等が本番でも有効。誤設定で全サービスの上限が外れ、実費が青天井になる | `src/lib/pricing.ts` 351/443 行ほか 10 箇所 | `process.env.NODE_ENV !== 'production'` を条件に加える、または共通関数に集約 | はい |
| ENV-013 | B | メール・リンク用の fallback で `VERCEL_URL` を使用。テンプレート文字列が常に真のため最後の fallback も到達不能 | `src/app/api/admin/drip/test-unsubscribe/route.ts` 20 行 | `NEXTAUTH_URL \|\| 'https://doya-ai.surisuta.jp'` に直す | はい |
| ENV-005 / ENV-007 / ENV-008 | B | 必須 env 未設定時の失敗が不明瞭（Stripe、Supabase の non-null 断言、NextAuth secret） | `src/lib/stripe.ts` 9 行、`lib/{hr,doyaslide,movie}/storage.ts`、`src/lib/auth.ts` | 起動時（またはモジュール読込時）に必須 env を検証して明示エラーにする | はい |
| BLD-018 | B | `.vercelignore` が docs/ を除外するのに、ビルド内のテストが `docs/audits/...` へ書き込む。Vercel CLI デプロイや `.vercelignore` が効く構成ではビルドが落ちる | `.vercelignore`、`scripts/security-regression/*.cjs` | テストの出力先を `os.tmpdir()` に変える、または `.vercelignore` から `/docs/` を外す | はい |
| BLD-024 | B | `public/` 配下を `readFile` する API が関数に同梱されない恐れ | `api/seo/template/image/category/[category]/route.ts` 41-44 行 | `outputFileTracingIncludes` に `./public/...` を追加するか、URL 取得に変更 | はい（本番での実機確認はいいえ。ログイン要） |
| DB-009 / DB-027 | B | 文書が現物と食い違う（SKIP_DB_PUSH 前提の記述、モデル数 38、`npx prisma db push` 案内、`ignoreBuildErrors: true`） | `reference/04-database.md`、`07-dev-guide.md` 58・233 行、DEV-STATUS 2-6、スキル doya-db-push | 「build は db push しない（スクリプト退役）」「手動SQL適用」「ignoreBuildErrors:false」へ更新 | はい（文書のみ）。スキルと DEV-STATUS は worktree 外 |
| DB-010 | C | `npm run db:push` が残り、本番を指す env で誤実行できる | `package.json` | script 削除、または確認ガード付きに変更 | はい |
| DB-012 | C | asklink に手動SQLが無く、popup も SQL ファイルが無い（記録は文書のみ） | `prisma/manual-migrations/` | 反映済みのDDLをファイルとして保存し、docs に紐付ける | はい（ファイル追加のみ。本番反映は不要） |
| DB-016 | C | Cunning / Persona の本番反映の証跡ファイルが worktree に無い | `docs/audits/2026-09-23-history-order/` | 証跡 JSON を docs/audits に戻す | はい |
| ENV-002 / ENV-003 / ENV-004 | C | `env.example.txt` と `08-environment.md` が現状と乖離（198 種が未記載、`DIRECT_URL` / `POSTGRES_PRISMA_URL` 無し、提供終了サービスの価格 ID が現役扱い） | `env.example.txt`、`reference/08-environment.md` | 抽出リストから更新。必須/任意/廃止の区分を付ける | はい |
| BLD-003 | C | build と CI の両方で lint が実行されない | `next.config.js`、`.github/workflows/ci.yml` | CI に `next lint` を追加（段階導入） | はい |
| BLD-015 | C | Node のバージョン固定が無い（CI は 24） | `package.json` | `engines.node` または `.nvmrc` を追加 | はい |
| BLD-019 | C | ビルドで追跡ファイルが書き換わる | `scripts/security-regression/*.cjs` | BLD-018 と同じ修正で解消 | はい |
| PDF-012 | C | 提供終了の adsim に 3008MB と Chromium 同梱が残る | `vercel.json`、`next.config.js` | adsim 関連の `functions` 4 件と tracing 設定を削除（ロールバック方針の確認後） | はい（ただし「ルート実体は残置」方針との整合をユーザーに確認） |
| CRON-011 | C | vercel.json に無い Cron ルート 7 本に呼び出し元が無い | `src/app/api/cron/{appstore-*,gcp-usage,noroi-engagement-report,yurusen-appstore-report,drip-report}` | 手動用なら冒頭にコメントで明記、不要なら退役 | はい |

### 補足（確認できなかったこと）

- 本番の応答（/api/health、robots.txt、sitemap.xml、トップ、308）は Vercel Security Checkpoint により確認不可。ブラウザ経由でのボット判定突破は行っていない。
- Vercel の環境変数の実設定、リージョン、Cron 実行履歴、本番DBのスキーマ状態は参照しておらず、DB-017〜020 と CRON-017/018 は未確認のまま。
- DEV-STATUS 2-6 の古い記述: 「型エラーがあってもビルドが通る（ignoreBuildErrors: true）」は現在 false。「SKIP_DB_PUSH でスキップ」は現在スクリプト退役（常に失敗）に変わっている。


---

## 5. API 堅牢性・外部AI

点検対象: origin/main の worktree（src/ と seo/。doya-ai/ は対象外）。route 589ファイル（有効478、提供終了で入口閉鎖111）。点検日 2026-10-18。外部AIへの通信・ビルド・リポジトリ編集は一切行っていない。本番は未ログイン GET のみ約30回。
項目数 108（合格 52 / 不合格 43 / 未確認 11 / 該当なし 2）。S級（全体停止級）は検出なし。A級は2件（AI-003, AI-028。詳細は末尾「不合格・要対応」）。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| AI-001 | 廃止済みモデルIDの残存（gemini-2.0*/1.5*/2.5-pro/3-pro-preview/gpt-4-turbo-preview/dall-e-3） | src と seo 全体を grep（gemini-/gpt-/dall-e/imagen を全件、185ヒット） | 実行コード内に0件 | 合格 | dall-e-3 は src/lib/openai.ts:49-50 のコメントのみ。gemini-2.0/1.5/2.5-pro/3-pro-preview/gpt-4-turbo-preview は0件 |
| AI-002 | 旧世代モデル名の表示・文言の残存 | "Gemini 2.0" 等の表示文字列を grep | 利用者向け文言・推定値表記が現行モデルと一致 | 不合格 | src/lib/gemini-text.ts:229（getGeminiModelName が "Gemini 2.0 Flash" 固定）、src/lib/notifications.ts:1091（"Gemini 2.0 Flash基準の推定値"）、src/app/kantan/pricing/page.tsx:52、src/app/kantan/dashboard/text/[templateId]/page.tsx:97,242 |
| AI-003 | gemini-2.5-flash を単独で直書きし、エイリアス退避が無い箇所 | grep "gemini-2.5-flash" と周辺のフォールバック鎖を確認 | 現行サービスの全呼び出しでエイリアスへ退避できる | 不合格 | interview 系8ルート（articles/[id]/fact-check,proofread,sns-posts,suggest-titles,translate, recipes/generate, revise, articles/generate: env未設定時 gemini-2.5-flash 単独）、src/lib/doyaslide/vision.ts:10、src/lib/doyalist/collect/web-scraper.ts:48、swipe/test/start:19・question:17。404 になれば該当機能が全停止する構造 |
| AI-004 | gemini-2.5-flash の生存 | 実APIでの確認が必要（今回は外部API禁止） | 200 が返る | 未確認 | CLAUDE.md の廃止リストには無いが、実API未確認。モデルID変更は承認要 |
| AI-005 | フォールバック鎖の末尾がエイリアス: banner/chat | src/app/api/banner/chat/route.ts:23 | 末尾が gemini-*-latest | 合格 | defaults = ['gemini-2.5-flash','gemini-flash-latest','gemini-pro-latest'] |
| AI-006 | フォールバック鎖の末尾がエイリアス: persona/generate | src/app/api/persona/generate/route.ts:74 | 末尾が gemini-*-latest | 合格 | ['gemini-2.5-flash','gemini-flash-latest'] |
| AI-007 | フォールバック鎖の末尾がエイリアス: src/lib/gemini-text.ts | gemini-text.ts:89,GEMINI_FALLBACK_MODEL | 末尾が gemini-*-latest | 合格 | [primary(pro-latest), gemini-3-flash-preview, gemini-2.5-flash, gemini-flash-latest]。ただし呼び出し元は adsim と generate（SERVICE_RETIRED で入口閉鎖） |
| AI-008 | フォールバック鎖の末尾がエイリアス: banner/copy | src/app/api/banner/copy/route.ts:22,107 | 末尾が gemini-*-latest | 不合格 | GEMINI_FALLBACK_MODEL = 'gemini-3-flash-preview'（プレビュー版）。鎖は [primary, pro-latest, 3-flash-preview, 3-flash-preview] で末尾が重複したプレビューID |
| AI-009 | フォールバック鎖の末尾がエイリアス: banner/from-url | src/app/api/banner/from-url/route.ts:199 | 末尾が gemini-*-latest | 不合格 | models = ['gemini-pro-latest','gemini-3-flash-preview']。末尾がプレビューID |
| AI-010 | フォールバック鎖の末尾がエイリアス: src/lib/nanobanner.ts（テキスト系） | nanobanner.ts:146,151,996 | 末尾が gemini-*-latest | 不合格 | DEFAULT_TEXT_FALLBACKS = ['gemini-pro-latest','gemini-3-flash-preview']。末尾がプレビューID |
| AI-011 | フォールバック鎖の末尾がエイリアス: seo/lib/gemini.ts | seo/lib/gemini.ts:434-439 | 末尾が gemini-*-latest | 不合格 | FALLBACK_MODELS = ['gemini-2.5-flash','gemini-pro-latest','gemini-2.5-flash']。req.model と重複排除すると末尾が gemini-2.5-flash になる経路がある（req.model が別IDの場合）。重複要素も無意味 |
| AI-012 | 画像モデル gemini-3-pro-image にエイリアス退避があるか | image-generator.ts:21, resolve-image-model.ts, refine/route.ts:93-107 | 単一IDなら404で全面失敗しない設計 | 不合格 | フォールバックは gemini-3-pro-image 単独（refine は resolveImageModel が1要素 or [preview, 正式] の2要素）。画像系は -latest エイリアスが無いが、メインが gpt-image-2 のため影響はフォールバック時のみ（B） |
| AI-013 | gemini-3-pro-image / gemini-3-pro-image-preview の生存 | 実API確認が必要 | 200 が返る | 未確認 | 今回は外部API禁止のため未実施 |
| AI-014 | ハードコードされたプレビュー/日付付きID（-preview, -exp, 日付）の列挙 | grep（コード行のみ） | プレビューID依存が無い、または全て列挙・把握済み | 不合格 | gemini-3-flash-preview: banner/copy:18,22,107, banner/from-url:199, nanobanner.ts:146,151, gemini-text.ts:89。gemini-3-pro-image-preview: resolve-image-model.ts:12, nanobanner.ts:117,988, seo/lib/gemini.ts:270,288。nano-banana-pro-preview: seo/lib/gemini.ts:217,265,285, admin/settings/page.tsx:124。日付付き: claude-haiku-4-5-20251001（seo/lib/gemini.ts:13, mitsuboshi/_shared/constants.ts:28, tenkai/generation-pipeline.ts:10）。gpt-4o-2024-11-20 はコメントのみ |
| AI-015 | モデルID定義の一元化 | モデル定数・env の定義箇所を grep | 1箇所（または少数のモジュール）に集約 | 不合格 | モデル系 env 名が32種（DOYA_BANNER_TEXT_MODEL / DOYA_TEXT_MODEL / GEMINI_PRO3_MODEL / GEMINI_PRO_3_MODEL / GEMINI_TEXT_MODEL / INTERVIEW_GEMINI_MODEL / SEO_GEMINI_TEXT_MODEL / SEO_GEMINI_CHAT_MODEL / GEMINI_FLASH_MODEL 等）。実行コード内の gemini-2.5-flash 直書きは25箇所。seo/lib/gemini.ts の GEMINI_TEXT_MODEL_DEFAULT を使う側（aio, cunning）と使わない側が混在 |
| AI-016 | Gemini APIキーの env 名の統一 | process.env の参照を全件集計 | 参照する名前が1〜2種に統一 | 不合格 | GOOGLE_GENAI_API_KEY / GOOGLE_AI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / NANOBANNER_API_KEY の6種が32ファイルに6通りの組合せで分散（例: interview/revise は GEMINI_API_KEY と GOOGLE_GENAI_API_KEY のみ、seo/lib/gemini.ts は4種）。Vercel にどの名前が設定済みかは未確認（キー更新漏れの温床） |
| AI-017 | Gemini キーの形式（AQ. 形式・制限付き）に関するドキュメント整合 | reference/08-environment.md と CLAUDE.md を比較 | 記述が一致 | 不合格 | reference/08-environment.md:12 は "AIza..." と記載、CLAUDE.md は "AQ." 形式が必要と記載。env.example 側の記述は未精査 |
| AI-018 | キー未設定時のエラーメッセージ（利用者向け） | キー未設定時の各 route の応答を確認 | env 名や内部情報を利用者に返さない | 不合格 | interview/materials/[id]/transcribe/route.ts:244,258-267 が hint として "ASSEMBLYAI_API_KEY を環境変数に設定してください" 等をレスポンスに含める。transcribe-stream/route.ts:111 も SSE で "ASSEMBLYAI_API_KEY が設定されていません" を送出。banner/generate は "管理者にお問い合わせください"（503）で良好 |
| AI-019 | キー未設定時のメッセージ（内部例外） | image-generator.ts:145, seo/lib/gemini.ts:240-248 ほか | 例外文言が対処法を示す（運用者向けログ） | 合格 | seo/lib/gemini.ts は設定すべき変数名を明示。利用者には route 側で定型文に置換されることを interview/banner/persona で確認 |
| AI-020 | Gemini キーをURLクエリで送る箇所 | grep "key="  | x-goog-api-key ヘッダで送る | 不合格 | 現行サービス: banner/text-answer.ts:9、banner/from-url/route.ts:232,858,1348（Vision含む）。閉鎖済み: gemini-text.ts, copy/gemini.ts, opening/gemini.ts, interviewx/chat-utils.ts, shindan/generate。URL はプロキシ/ログに残りうる。他の大半はヘッダ方式 |
| AI-021 | 外部AI呼び出しのタイムアウト: 画像生成 | openai-image.ts:57, image-generator.ts:172 | fetch+本文読取まで withTimeout で覆う | 合格 | withTimeout（fetch-timeout.ts）で本文読取まで覆う。primary 既定170秒、fallback 45秒、応答サイズ上限(32MB)も有り |
| AI-022 | 外部AI呼び出しのタイムアウト: interview / persona / banner / cunning / doyaslide vision / adimage vision / aio の fetch 系 | 各ファイルの signal 使用を確認 | 全 fetch にタイムアウト | 合格 | interview/gemini-request.ts:44 AbortSignal.timeout、nanobanner のテキスト呼び出し30秒、banner/refine は全体 deadline 方式、cunning 20-25秒、doyaslide/vision.ts 45秒、aio/engines.ts 60秒、AssemblyAI は SUBMIT/POLL にタイムアウト |
| AI-023 | 外部AI呼び出しのタイムアウト: seo/lib/gemini.ts（Claude / Gemini / ChatGPT） | seo/lib/gemini.ts の fetch 4箇所 | タイムアウトあり | 不合格 | fetch 4箇所すべて signal 無し。ハングすると maxDuration(300秒) まで占有し、SEO記事生成ジョブの1ステップが失敗扱い。fetchWithRetry は例外時のみ再試行 |
| AI-024 | 外部AI呼び出しのタイムアウト: mitsuboshi/_shared/anthropic.ts | anthropic.ts:36,86 | タイムアウトあり | 不合格 | fetch 2箇所とも signal 無し。nagusame/chat は maxDuration=30、generate は 60。ハング時は Vercel 側の打ち切り(504)になる |
| AI-025 | 外部AI呼び出しのタイムアウト: OpenAI SDK クライアント | new OpenAI( の生成箇所 | リクエスト単位の timeout 指定 | 不合格 | aio/engines.ts:93 の openai()、openai.ts:11、openai-image.ts:148(editImageGpt)。SDK 既定は10分・自動リトライ2回。gpt-image-2 の edit は 3 モデル連鎖(gpt-image-2 -> gpt-image-1 -> Gemini)でも上限が無い |
| AI-026 | 429/503 の扱い（リトライ・バックオフ） | seo/lib/gemini.ts:446-474, banner/text-answer.ts | 429/5xx で指数バックオフ、または次モデルへ移行 | 合格 | seo は Claude 3回、Gemini fetchWithRetry で 429/5xx を指数バックオフ(jitter付き)、404/429 は次モデルへ。banner は課金二重を避けるため再送せず404のみ次モデル（意図的） |
| AI-027 | 429/503 の扱い: 画像生成 | image-generator.ts:76-94 | primary の失敗で fallback。無駄な二重課金を避ける | 合格 | primary(gpt-image-2) 失敗はすべて Nano Banana Pro へ。再試行はしない。ただし原因（400/404/429/5xx）を区別せず通知もしない（下記） |
| AI-028 | モデル廃止（404）を検知して通知する仕組み | grep 404/NOT_FOUND と通知呼び出し、health-alert cron を確認 | 404 を検知して Slack 等へ通知、またはAI疎通の定期プローブがある | 不合格 | 仕組み無し。404 は banner/text-answer.ts, banner/refine/route.ts:107, seo/lib/gemini.ts で「次のモデルへ」と黙って進むだけ（console.log のみ）。cron/health-alert は各サービスの /api/health(DB接続のみ) を監視し、AI疎通は見ない。/api/health も AI を確認しない。2026-08 の「静かに全滅」と同じ形で再発しうる |
| AI-029 | 画像生成 primary 失敗の通知 | image-generator.ts catch 節 | フォールバック発動を運用者が知れる | 不合格 | catch {} で原因を捨てて console.warn のみ。2026-09-18 に 'gpt-image-2 が毎回400で全件フォールバック' が調査で初めて発覚した経緯と同型。発動率の集計・通知が無い |
| AI-030 | Claude クレジット切れの通知 | seo/lib/gemini.ts:33-68 | クレジット切れ検知->通知 | 合格 | isClaudeCreditError と notifySlackClaudeCreditExhausted が有り（Claude のみ。Gemini/OpenAI の課金枯渇・404 は対象外） |
| AI-031 | 外部AIのエラー本文を利用者へ返していないか（全 route 走査） | NextResponse.json 内の e.message / String(e) を機械抽出（78件）し目視 | プロバイダ本文・スタックを返さない | 合格 | 現行サービス分の抽出は全て自前のエラークラス（InterviewGeminiError 等）か定型文。プロバイダ本文を返す経路は見つからず。seo/lib/job-response.ts は PUBLIC_JOB_ERRORS で許可リスト化。例外: 上記の env 名 hint（別項目） |
| AI-032 | エラー本文のログ/例外への混入 | seo/lib/gemini.ts:~520, aio/engines.ts:131,155, mitsuboshi/anthropic.ts:47 | プロバイダ本文を例外メッセージに入れない | 不合格 | Gemini 本文 500文字(seo/lib/gemini.ts)、Claude/Perplexity 本文 300文字(aio/engines.ts)、Claude 本文全量(mitsuboshi/_shared/anthropic.ts:47)を Error.message に格納。現状は route で握りつぶされ利用者には出ないが、Slack 通知経路に載ると漏れる可能性（C） |
| AI-033 | 画像生成の quality 未指定（auto 任せ） | openai-image.ts:49-52, image-generator.ts, 全呼び出し元 | 全経路で明示 quality/size（auto を medium に正規化） | 合格 | generateImageGpt/editImageGpt は auto・未指定を 'medium' に寄せる。全ディスパッチャ呼び出しは quality:'medium' 等を明示（grep で auto/high 直書きは 0 件）。size 未指定は 1024x1024 |
| AI-034 | 画像生成の課金増幅（1リクエストで複数の有料呼び出し） | openai-image.ts:161-181 | 最悪時の有料呼び出し回数が明確で小さい | 不合格 | 参照画像あり編集は gpt-image-2 -> gpt-image-1 -> gemini-3-pro-image の最大3回（OpenAI SDK の自動リトライ2回を含めると更に増える）。上限は設計上許容でも把握・通知されていない（C） |
| AI-035 | 画像生成を叩く検証用エンドポイント | src/app/api/test/openai-image/route.ts | 本番で非公開、または秘密トークン+定数時間比較 | 不合格 | 本番 GET が 200 でエンドポイント仕様を公開（実測）。POST は x-test-token の !== 比較（定数時間でない）。OPENAI_TEST_TOKEN が本番に設定されているかは未確認。quality は呼び出し側指定可（最大 high） |
| AI-036 | 管理画面のモデル選択肢の直書き | src/app/admin/settings/page.tsx:111-124 | 選択肢が実在・現行IDと一致 | 未確認 | gemini-2.5-flash / gemini-pro-latest / gpt-4o / gpt-image-2 / nano-banana-pro-preview を option 直書き。保存値が実行時に使われるかは追跡未了 |
| AI-037 | dead code に残る古いモデル候補 | seo/lib/gemini.ts:222-293 | 未使用コードに旧ID候補が残らない | 不合格 | isNanoBananaFamily / nanoBananaModelCandidates は参照0件、geminiGenerateImagePng は args.model を無視（generateImageWithFallback へ委譲）。GEMINI_IMAGE_MODEL_DEFAULT=nano-banana-pro-preview は swipe/question-images で渡されるが効かない。紛らわしいだけで実害は無い（C） |
| AI-038 | 開発ガイドのモデル記載 | reference/07-dev-guide.md:130 | ガイドが現行規約（エイリアス末尾・単一ID直書き禁止）に沿う | 不合格 | サンプルが const model = 'gemini-2.5-flash' の直書き（新規実装がコピーする）。エイリアス末尾の指針が無い |
| AI-039 | gpt-4o の生存（cunning, aio, openai.ts, seo ChatGPT フォールバック, adimage vision） | 実API確認が必要 | 200 が返る | 未確認 | src/lib/cunning/answer.ts:113-157, aio/engines.ts:94, openai.ts:28, adimage/vision.ts:19, seo/lib/gemini.ts:175。外部API禁止のため未実施 |
| AI-040 | gpt-image-2 / gpt-image-1 の生存 | 実API確認が必要 | 200 が返る | 未確認 | コメントに 2026-08-06 実測の記載あり。現時点の生存は未確認 |
| AI-041 | gpt-realtime / gpt-4o-transcribe / AssemblyAI universal-2 の生存 | 実API確認が必要 | 200 が返る | 未確認 | aishodan・mensetsu の token route（gpt-realtime）、cunning/transcribe.ts（gpt-4o-transcribe に fallback 有）、interview/transcription.ts:163（universal-2） |
| AI-042 | Claude モデルID（claude-sonnet-4-6 / claude-haiku-4-5-20251001）の生存 | 実API確認が必要 | 200 が返る | 未確認 | aio/engines.ts:85（sonnet-4-6）、seo/lib/gemini.ts:13 他（haiku-4-5 日付固定）。seo のコメントは "Claude Sonnet 4.6" だが実デフォルトは Haiku 4.5（記述不一致） |
| AI-043 | Perplexity モデル（sonar） | aio/engines.ts:142 | 実在・現行 | 未確認 | 実API未確認 |
| AI-044 | SEO の3層フォールバック（Claude -> Gemini -> ChatGPT） | seo/lib/gemini.ts:476-571 | プライマリ失敗で他社へ退避 | 合格 | Claude 失敗->Gemini 複数モデル->OpenAI の順に退避する実装を確認。ただし各 fetch にタイムアウトが無い（別項目） |
| AI-045 | AIOエンジンのエラー永続化 | aio/run.ts | プロバイダ本文をDB・応答に保存しない | 合格 | run.ts 内に e.message の保存が無く、スキャン失敗は定型文で返却（aio/scans/route.ts:92-95） |
| AI-046 | 外部AIレスポンスのサイズ上限 | openai-image.ts, image-generator.ts, interview/gemini-request.ts, aio/engines.ts | 巨大応答で OOM しない | 合格 | 32MB(画像)/4MB(interview)/512KB(banner text)等の上限付き読み取りを確認 |
| AI-047 | AI 呼び出しの Vercel 実行時間（maxDuration）と処理上限の整合 | 画像生成 primary170秒+fallback45秒 と maxDuration | 合計が maxDuration 未満 | 合格 | openai-image.ts のコメントどおり primary を170秒に抑え、banner 系は maxDuration=300。mitsuboshi の 30/60 秒のみ Claude にタイムアウトが無く未保証（別項目） |
| API-001 | route ファイルの走査網羅性 | src/app 配下の route.ts(x) を全件パース（seo/ に route は無い） | 全件を解析 | 合格 | 589ファイル（route.ts 588 + route.tsx 1）。ハンドラ未検出5件は seo/articles/[id]/meta, seo/knowledge/[id], seo/knowledge, seo/predict, seo/preview（いずれも "export {}" の空ファイル=実質削除済み。Next は 405 を返す） |
| API-002 | 提供終了サービスの入口閉鎖 | SERVICE_RETIRED / ADBANNER_RETIRED の有無 | 閉鎖済み route が本体を実行しない | 合格 | 111ファイルが入口を閉鎖（movie/copy/lp/tenkai/interviewx/slide/slashslide/adsim/opening/voice/logo/shindan/generate/adbanner）。以降の統計は閉鎖分を別掲。有効 478ファイル |
| API-003 | (a) try/catch 無しのハンドラ総数 | ハンドラ本体の try { を機械判定 | 0件 | 不合格 | 全体123ファイル171ハンドラ。うち閉鎖分4。有効119ファイル165ハンドラ（GET90 / DELETE32 / POST23 / PATCH17 / OPTIONS2 / PUT1） |
| API-004 | (a) try 無しのうち実処理（await あり、405/410 スタブでない） | 手動分類 | 0件 | 不合格 | 111ハンドラ/87ファイル（doyaslide の委譲2件は除外）。mensetsu 26, aishodan 20, popup 12, cunning 10, aio 9, quote 8, sfa 6, shodan 5, seo 4, asklink 3, admin 2, cron 2, operations 2, adimage 1, feedback 1。残り約50は 405/410 スタブ・委譲。DB 例外時は Next 既定の空 500（JSON でない） |
| API-005 | (a) 重要サービス: banner | banner/** の try 無し実処理ハンドラ | 0件 | 合格 | try 無し7件は全て GET/DELETE の 405 スタブ（chat, copy, generate, refine） |
| API-006 | (a) 重要サービス: seo | seo/** と src/lib/seo* | 0件 | 不合格 | articles/[id]/export/{html,json,markdown,txt} の GET 4件が try 無し（DB 読取あり）。他は try 有り。ジョブは executionToken/executionExpiresAt による貸出方式 |
| API-007 | (a) 重要サービス: interview | interview/** | 0件 | 合格 | try 無しは articles/generate の GET/DELETE(405) 等のスタブのみ |
| API-008 | (a) 重要サービス: persona | persona/** | 0件 | 合格 | try 無し1件は banner の GET スタブ |
| API-009 | (a) 重要サービス: doyaslide | doyaslide/** | 0件 | 合格 | slides/[id]/chat と regenerate の POST は postDoyaSlideOperation（generation-http.ts, try 4箇所）へ委譲。残りは 405/operations スタブ |
| API-010 | (a) 重要サービス: hr | hr/** | 0件 | 合格 | try 無し3件は webhook/department-operation 等のスタブ |
| API-011 | (a) 重要サービス: kintai | kintai/** | 0件 | 合格 | try 無し 0 ファイル |
| API-012 | (a) 重要サービス: sfa | sfa/** | 0件 | 不合格 | 実処理6件: leads DELETE, members GET, members/[id] PATCH/DELETE, usage GET, invite/[token] GET。accounts/contacts 系は 405/委譲スタブ |
| API-013 | (a) 重要サービス: promane | promane/** | 0件 | 合格 | try 無し 0 ファイル |
| API-014 | (a) 重要サービス: shodan | shodan/** | 0件 | 不合格 | invite/[token] GET, me GET, members GET, members/[id] PATCH/DELETE の5件が try 無し（prisma 直呼び） |
| API-015 | (a) 重要サービス: aio | aio/** | 0件 | 不合格 | 実処理9件: brand-profile GET, invite/[token] GET, me GET, members GET, members/[id] PATCH/DELETE, scans/[id] GET/DELETE, scans POST（scans GET も try 無し）。POST /api/aio/scans は maxDuration=300 の長時間処理で、事前の prisma 例外が素通りする |
| API-016 | (a) 重要サービス: cunning | cunning/** | 0件 | 不合格 | company GET, knowledge GET/POST/[id], profiles GET/POST, sessions/[id] GET/PATCH/DELETE の10件 |
| API-017 | (a) 重要サービス: doyalist | doyalist/** | 0件 | 合格 | try 無し 0 ファイル（operations は const 形式ハンドラ） |
| API-018 | (a) 重要サービス: asklink | asklink/** | 0件 | 不合格 | runs/[id] GET/PATCH, runs GET の3件 |
| API-019 | (a) 重要サービス: popup | popup/** | 0件 | 不合格 | 9ファイル全て try 無し（実処理12ハンドラ）。特に popup/public/config GET は第三者サイトの埋め込みタグから呼ばれ、DB 例外で CORS ヘッダ無しの空 500 になる（ポップアップが無言で出なくなる） |
| API-020 | (a) const 形式ハンドラ（export const GET = ...）の try | 6ファイル（aio/quick-start, doyalist/operations, hr/*/operations/*, kintai/work-rules/operations/*） | ラッパー側で例外処理 | 未確認 | 今回の機械走査は関数宣言形式のみ判定。6ファイルは目視未了 |
| API-021 | (b) maxDuration 未設定で外部AIを呼ぶ有効ルート | AI ライブラリ import/fetch を含む route で maxDuration 無しを抽出 | 0件 | 合格 | 有効分の抽出8件は全て AI を呼ばない一覧/取得系（banner/models は一覧取得15秒タイムアウト、interview/materials,projects,usage、persona/images,projects,usage）。閉鎖分の抽出22件は入口閉鎖済み。adsim/proposal は vercel.json に 300秒の定義有り。maxDuration 設定済みは348ファイル |
| API-022 | (b) 低い maxDuration で AI を呼ぶ route | maxDuration <= 30 の AI route | タイムアウトと整合 | 不合格 | mitsuboshi/nagusame/chat は maxDuration=30 かつ Claude fetch にタイムアウト無し（anthropic.ts）。platform 側 504 に依存 |
| API-023 | (c) req.json() の不正JSONで 500 になる箇所 | await req(uest).json() を .catch 無しで呼ぶ箇所を抽出し、囲む catch の status を判定 | 不正JSONは 400 | 不合格 | 131呼び出し/128ファイル（有効67/64）。全て try 内だが、うち96件は catch が 500 のみ返す（400 の分岐無し）。重要サービス: seo 16, hr 8, interview 7, kintai 6, banner 5, cunning 3, aio 1。例: banner/generate, hr/employees, kintai/employees, interview/recipes, seo/sections/[id]。.catch 付きは164、readOperationalJson は19ファイル |
| API-024 | (c) 不正JSON対策の良い実装 | readOperationalJson の使用 | 上限付き読取+400/413 | 合格 | 19ファイル（persona/generate, aishodan token など）で OperationalBodyError を 400/413 に変換 |
| API-025 | (d) 生成系 POST の入力検証（スキーマ） | AI を呼ぶ有効 POST 65本で zod/readOperationalJson/検証モジュールの有無 | スキーマ検証または同等の型・長さ検証 | 未確認 | 65本中 zod 16、readOperationalJson 5、検証モジュール 4 を import。残り44本は手書き検証（banner/generate は category/200文字制限を確認済み、interview 系は未精査）。長さ・型の網羅性は個別確認が必要 |
| API-026 | (d) 入力検証: 良い例の確認 | seo/articles/[id]/jobs, swipe/question-images/generate | zod で strict 検証 | 合格 | BodySchema.strict()、z.number().int().min(1).max(30) による枚数上限、requireAdmin を確認 |
| API-027 | (e) エラー時に HTTP 200 で { error } を返す箇所 | Response.json の引数を解析し status 無し+error キーを抽出、明示 200 も grep | 0件 | 不合格 | 実質2件: aishodan/room/[token]/record:35（{ok:false,message} を 200）、mitsuboshi/nagusame/chat:116（{type:"error"} を 200）。前者は Realtime 関数呼び出しの契約上 200 の可能性。機械抽出4件中2件は誤検出（件数集計と admin/templates/generate-batch の success/error カウント） |
| API-028 | (f) runtime=edge で Node 専用ライブラリ使用 | runtime="edge" を grep し import を確認 | 0件 | 合格 | route は src/app/og/[...slug]/route.tsx のみ（import は services.ts/ogp.ts/next/og で Node 依存なし）。他の edge は opengraph-image/icon のみ |
| API-029 | (f) Node 専用ライブラリを使う route が runtime="nodejs" を明示 | sharp/fs/pdf 系を import する route | nodejs 明示または既定 | 合格 | runtime="nodejs" 明示が500ファイル。sharp を import する route を含め edge 指定は無い |
| API-030 | (g) dynamic 未指定の GET の静的化リスク | Next 15.5.25 と GET の dynamic 設定を確認 | DB を読む GET が静的化されない | 合格 | Next 15 は GET Route Handler を既定で非キャッシュ。cookie/headers を使わず DB を読む GET は85件、うち dynamic 未指定は17件（health, seo/jobs/[id] ほか）。本番 /api/health の Cache-Control は max-age=0 を実測 |
| API-031 | (h) params が Promise であることの扱い | params: { ... } の型を走査 | 全て Promise 型で await | 合格 | 221ファイルが Promise<{...}> で await。同期型と判定した4件は関数引数名 params の誤検出（banner/chat, banner/test/generate, seo/template/*）で route の params ではない |
| API-032 | (h) reference/07-dev-guide.md の params 記述 | dev-guide:116-118 | Next 15 の規約に沿う | 不合格 | サンプルが ctx: { params: { id: string } } と 'then' in ctx.params の二刀流。Next 15 では Promise 前提で書くべき（C） |
| API-033 | ストリーミング(SSE) 中断時の後始末 | text/event-stream / ReadableStream を使う15ファイルで cancel / signal を確認 | 切断時に上流AIを中止 | 不合格 | 有効6本のうち interview/articles/generate（cancel+providerAbort+貸出）, transcribe-stream, doyalist/export-all, sfa/export は対応。doyalist/export と mitsuboshi/nagusame/generate は切断検知無しでAI/DB処理を継続（C）。閉鎖済み9本は未精査 |
| API-034 | SSE の失敗通知 | interview/articles/generate:420-440 | 失敗時に利用者へ通知し controller を必ず close | 合格 | catch で定型エラーを送り finally で interval/abort/reader を解放 |
| API-035 | 長時間ジョブが「処理中」のまま固まらない: SEO | seo/jobs/[id]/advance, seo/lib/job-execution.ts | 貸出期限で回復できる | 合格 | SeoJob に executionToken/executionExpiresAt。再生成時に queued/running/paused/error を cancelled に置換。advance は maxDuration=300。 |
| API-036 | 長時間ジョブ: SeoArticle.status=RUNNING のまま孤立した場合の回復 | seo/articles と seo/lib/pipeline.ts の status 更新 | 失敗・中断で ERROR/DRAFT に戻る、または再開導線がある | 未確認 | jobs/[id]/cancel は ERROR に更新するが、貸出失効後の自動復帰（cron 等）は確認できていない。seo-article-list は RUNNING を件数集計するのみ |
| API-037 | 長時間ジョブ: AIO | aio/run.ts:99-105, lib/aio/usage.ts | 古い processing を失効扱い | 合格 | updatedAt<cutoff の processing を再実行時に失効処理、一覧は effectiveScanStatus で表示、cron/aio-scan も staleBefore で判定 |
| API-038 | 長時間ジョブ: doyaslide | doyaslide/generation-operation.ts | 貸出(lease)で失効 | 合格 | DOYASLIDE_OPERATION_LEASE_MS=15分の貸出と receipt(pending/completed/failed/cancelled) |
| API-039 | 長時間ジョブ: shodan / asklink / interview 文字起こし | shodan/preparations/route.ts:124, asklink/banners/[kind]/route.ts:44, interview/transcribe | STALE 判定で再実行可 | 合格 | shodan は updatedAt 閾値で processing 再取得、asklink は STALE_MS 超過で generating 再取得、interview 文字起こしは submissionMarker で二重提出を防止 |
| API-040 | 長時間ジョブ: persona / banner の予約解放 | persona/generate:401-406, banner/generate:261-270 | 失敗時に枠予約を解放 | 合格 | settlePersonaProject と releaseBannerMonthlyImages を失敗経路で呼ぶ（枠だけ消費して固まらない） |
| API-041 | 長時間ジョブ: popup/hr/promane/kintai の「処理中」状態 | status 値の grep | processing 状態を持つなら回復 | 該当なし | processing/generating 系の状態遷移を持つ処理を検出できず（hr の ai-comment は operations リース有り） |
| API-042 | 長時間ジョブ: tenkai / opening / copy の処理中固着 | status:generating/analyzing 設定箇所 | 閉鎖済み | 該当なし | 入口閉鎖済み。DB に generating のまま残る旧データがあるかは未確認 |
| API-043 | 共通部: errorHandler.ts の利用 | grep notifyApiError | 主要 route から使われる | 不合格 | notifyApiError の呼び出し元は0件（定義のみ）。実際に使われているのは sendErrorNotification（25ファイル）。本関数は常に "Unexpected API error" 固定文言で情報量も無い（死蔵） |
| API-044 | 共通部: private-api-response.ts の利用 | grep privateApiJson | 個人情報を返す API が no-store | 不合格 | 19ファイルのみ。個別に Cache-Control: private, no-store を直書きする route も多く混在（aio, quote 等）。漏れ判定は別章（セキュリティ）で確認要 |
| API-045 | 共通部: operational-error-limit.ts の利用 | claimClientErrorReport | クライアントエラー受信の流量制御 | 合格 | /api/operational-error の1ファイルのみが利用。DB 固定9キー+メモリ短期キャッシュで 10分/キーに制限、DB 障害時は 30秒 unavailable |
| API-046 | 共通部: fetch-timeout.ts の利用範囲 | withTimeout/raceTimeout/AbortSignal.timeout の使用ファイル数 | 外部呼び出しで広く使用 | 合格 | withTimeout 9, raceTimeout 11, AbortSignal.timeout 39 ファイル。未使用は別項目に列挙（seo/lib/gemini.ts, mitsuboshi anthropic, tenkai 閉鎖分 等） |
| API-047 | (想定外) 空の route.ts の残存 | "export {}" のみのファイル | 削除またはレスポンス定義 | 不合格 | seo/articles/[id]/meta ほか5本。URL は 405 になる。意図的な撤去なら削除が望ましい（C） |
| API-048 | 本番(未ログイン GET): /api/health | curl GET | 200 JSON | 合格 | 200 application/json {"status":"ok","database":"connected"} |
| API-049 | 本番: banner/history | curl GET | 401 JSON | 合格 | 401 application/json {"error":"unauthorized"}（他と違い英語・文言不統一: C） |
| API-050 | 本番: persona/projects, doyaslide/projects | curl GET | 401 JSON | 合格 | 共に 401 application/json（日本語メッセージ） |
| API-051 | 本番: hr/employees | curl GET | 401 JSON | 合格 | 401 application/json {"error":"Unauthorized"} |
| API-052 | 本番: kintai/employees | curl GET | 401 JSON | 不合格 | 403 application/json {"error":"権限がありません"}。未認証は 401 が望ましい（C） |
| API-053 | 本番: sfa/leads, promane/clients, shodan/preparations, aio/scans | curl GET | 401 JSON | 合格 | 4本とも 401 application/json |
| API-054 | 本番: cunning/sessions, doyalist/projects, asklink/runs, popup/sites | curl GET | 401 JSON | 合格 | 4本とも 401 application/json |
| API-055 | 本番: quote/documents, mensetsu/sessions, aishodan/rooms | curl GET | 401 JSON | 合格 | 401 application/json（メッセージは「組織が見つかりません」で認証要否が曖昧: C） |
| API-056 | 本番: seo/articles, interview/projects（未ログイン） | curl GET | 401 または意図的なゲスト許可 | 合格 | 200 JSON で空配列（ゲスト利用を許す設計と整合。個人データは返らず） |
| API-057 | 本番: seo/jobs/x, admin/feedback | curl GET | 401 JSON | 合格 | 共に 401 application/json |
| API-058 | 本番: cron/health-alert（認証無し） | curl GET | 401 | 合格 | 401 text/plain "unauthorized"（cron 用なので許容） |
| API-059 | 本番: POST 専用 route への GET | banner/generate, stripe/webhook | 405 | 合格 | banner/generate は 405 JSON {"error":"Method not allowed"}、stripe/webhook は 405 |
| API-060 | 本番: 存在しない API パス | /api/nonexistent-route-xyz, /api/adimage/campaigns | 404 JSON | 不合格 | 404 text/html（Next の HTML ページ）。API クライアントが JSON 前提だとパースエラーになる（C） |
| API-061 | 本番: /api/test/openai-image の公開 | curl GET | 本番で非公開 | 不合格 | 200 JSON でエンドポイント仕様を返す。POST はトークン保護だが存在自体が公開 |

## 付録

### 付録A. 廃止済み・危険なモデルIDの残存一覧（file:line、コメント行は除く）

1. 廃止済みID（gemini-2.0* / 1.5* / 2.5-pro / 3-pro-preview / gpt-4-turbo-preview / dall-e-3）: 実行コードに残存なし。コメントのみ src/lib/openai.ts:49,50（dall-e-3）。
2. 旧世代の表示文言: src/lib/gemini-text.ts:229 / src/lib/notifications.ts:1091 / src/app/kantan/pricing/page.tsx:52 / src/app/kantan/dashboard/text/[templateId]/page.tsx:97,242。
3. gemini-2.5-flash の直書き（生存は未確認。現行サービス分と閉鎖分を区別）
   - 現行・単独（退避なし）: src/app/api/interview/articles/[id]/{fact-check:35, proofread:36, sns-posts:34, suggest-titles:34, translate:34}/route.ts、interview/articles/generate/route.ts:49、interview/recipes/generate/route.ts:29、interview/revise/route.ts:62、src/lib/doyaslide/vision.ts:10、src/lib/doyalist/collect/web-scraper.ts:48、src/app/api/swipe/test/start/route.ts:19、swipe/test/question/route.ts:17
   - 現行・鎖あり: src/app/api/banner/chat/route.ts:23（末尾 pro-latest）、src/app/api/persona/generate/route.ts:74（末尾 flash-latest）、seo/lib/gemini.ts:215（既定）,436,438（鎖。末尾が非エイリアスになる経路あり）
   - 閉鎖済み入口: shindan/generate:1105、tenkai/content/analyze:70、interviewx 4ルート(analyze-url-preview:45, analyze-url:66, generate-article:144, generate-questions:138)、src/lib/{copy/gemini.ts:14, opening/gemini.ts:14, gemini-text.ts:89, interviewx/chat-utils.ts:26}
   - UI: src/app/admin/settings/page.tsx:112
4. プレビュー版・日付付きID
   - gemini-3-flash-preview: src/app/api/banner/copy/route.ts:18,22,107 / banner/from-url/route.ts:199 / src/lib/nanobanner.ts:146,151 / src/lib/gemini-text.ts:89
   - gemini-3-pro-image-preview（許可リスト・候補）: src/lib/resolve-image-model.ts:12 / src/lib/nanobanner.ts:117,988 / seo/lib/gemini.ts:270,288
   - nano-banana-pro-preview: seo/lib/gemini.ts:217,265,285（実質 dead code）/ src/app/admin/settings/page.tsx:124 / src/app/api/swipe/question-images/generate/route.ts:122（コメント。値は無視される）
   - gemini-2.5-flash-image: seo/lib/gemini.ts:272,289（dead code）
   - 日付固定: claude-haiku-4-5-20251001 を seo/lib/gemini.ts:13、src/lib/mitsuboshi/_shared/constants.ts:28、src/lib/tenkai/generation-pipeline.ts:10（閉鎖）
5. 注意: 参照画像つき編集の gpt-image-1 退避: src/lib/openai-image.ts:7,8,112,162,167。実質 gpt-image-2 の失敗時に有料呼び出しが増える。
6. 末尾がエイリアスである箇所（参考）: banner/chat:23, persona/generate:74, gemini-text.ts:89（閉鎖サービスのみ使用）。

### 付録B. try/catch 無しの route

- 全体: 123ファイル/171ハンドラ。閉鎖サービス分を除く有効分: 119ファイル/165ハンドラ。うち 405/410 スタブ・委譲を除いた「実処理」は 87ファイル/111ハンドラ。
- 実処理の内訳（ハンドラ数）: mensetsu 26 / aishodan 20 / popup 12 / cunning 10 / aio 9 / quote 8 / sfa 6 / shodan 5 / seo 4 / asklink 3 / admin 2 / cron 2 / operations 2 / adimage 1 / feedback 1。banner / interview / persona / hr / kintai / promane / doyalist は0件。
- 判定の限界: 関数宣言形式のハンドラ本体に try { が無いことを機械判定し、await の有無と 405/410 応答で実処理/スタブを分類した。export const GET = ... 形式の6ファイルと、ラッパー関数内で try する委譲型（doyaslide の2件を確認済み）は別扱い。
- 上位30（prisma 呼び出し数と await 数の重みで並べ替え）

| # | route | try無し(実処理)メソッド | 行数 | prisma呼出 | await |
|---|---|---|---|---|---|
| 1 | `src/app/api/aishodan/products/route.ts` | GET | 212 | 10 | 24 |
| 2 | `src/app/api/mensetsu/templates/[id]/route.ts` | GET | 211 | 9 | 17 |
| 3 | `src/app/api/mensetsu/templates/route.ts` | GET | 229 | 8 | 19 |
| 4 | `src/app/api/quote/documents/route.ts` | GET | 253 | 8 | 17 |
| 5 | `src/app/api/mensetsu/sessions/route.ts` | GET | 215 | 8 | 16 |
| 6 | `src/app/api/popup/sites/[id]/route.ts` | GET, PATCH, DELETE | 75 | 7 | 13 |
| 7 | `src/app/api/cunning/sessions/[id]/route.ts` | GET, PATCH, DELETE | 131 | 2 | 25 |
| 8 | `src/app/api/popup/popups/[id]/route.ts` | GET, PATCH, DELETE | 129 | 5 | 12 |
| 9 | `src/app/api/mensetsu/sessions/[id]/hr-handoff/route.ts` | GET, POST | 134 | 5 | 12 |
| 10 | `src/app/api/quote/products/route.ts` | GET | 124 | 4 | 14 |
| 11 | `src/app/api/cunning/profiles/route.ts` | GET, POST | 67 | 6 | 8 |
| 12 | `src/app/api/aishodan/sessions/[id]/route.ts` | GET, PATCH | 142 | 4 | 14 |
| 13 | `src/app/api/shodan/invite/[token]/route.ts` | GET | 95 | 4 | 13 |
| 14 | `src/app/api/aio/invite/[token]/route.ts` | GET | 95 | 4 | 13 |
| 15 | `src/app/api/sfa/invite/[token]/route.ts` | GET | 102 | 4 | 12 |
| 16 | `src/app/api/aishodan/rooms/route.ts` | GET | 104 | 5 | 9 |
| 17 | `src/app/api/feedback/route.ts` | GET | 181 | 3 | 14 |
| 18 | `src/app/api/aishodan/products/[id]/sources/route.ts` | GET, POST | 65 | 4 | 11 |
| 19 | `src/app/api/sfa/members/route.ts` | GET | 119 | 3 | 13 |
| 20 | `src/app/api/popup/sites/route.ts` | GET | 118 | 3 | 13 |
| 21 | `src/app/api/aishodan/stats/route.ts` | GET | 111 | 6 | 4 |
| 22 | `src/app/api/shodan/members/route.ts` | GET | 108 | 3 | 12 |
| 23 | `src/app/api/mensetsu/sessions/[id]/route.ts` | GET, PATCH | 146 | 4 | 9 |
| 24 | `src/app/api/aio/members/route.ts` | GET | 108 | 3 | 12 |
| 25 | `src/app/api/mensetsu/sessions/[id]/close/route.ts` | POST, DELETE | 117 | 4 | 8 |
| 26 | `src/app/api/cunning/knowledge/[id]/route.ts` | GET, DELETE | 48 | 4 | 8 |
| 27 | `src/app/api/asklink/runs/route.ts` | GET | 106 | 3 | 11 |
| 28 | `src/app/api/asklink/runs/[id]/route.ts` | GET, PATCH | 56 | 3 | 11 |
| 29 | `src/app/api/aio/scans/route.ts` | POST | 112 | 4 | 8 |
| 30 | `src/app/api/popup/sites/[id]/popups/route.ts` | POST | 57 | 4 | 7 |

### 付録C. 主要な集計値

| 観点 | 件数 |
|---|---|
| route ファイル総数 | 589（有効478 / 入口閉鎖111） |
| maxDuration 設定済み | 348ファイル |
| dynamic 指定済み | 468ファイル |
| params を Promise で扱う | 221ファイル（同期型の実 route は0） |
| 生の req.json() 呼び出し（.catch 無し） | 131呼び出し/128ファイル（全て try 内。96件は catch が 500 のみ） |
| .catch 付きの req.json() | 164呼び出し |
| readOperationalJson 利用 | 19ファイル |
| zod を import する route | 31ファイル |
| SSE を返す route | 15ファイル（閉鎖9） |
| sendErrorNotification 利用 | 25ファイル |
| notifyApiError 利用 | 0ファイル（定義のみ） |
| privateApiJson 利用 | 19ファイル |
| モデル系 env 名 | 32種 |
| Gemini キー env 名 | 6種（32ファイルで6通りの組合せ） |
| 本番への未ログイン GET | 約30回（HEAD なし） |

### 不合格・要対応

S級（全体停止級）は検出されなかった。A級は2件、B級は7件、C級は7件（対応項目をまとめて記載）。

#### 1. [A] モデル廃止（404）を検知・通知する仕組みが無い
- 対応ID: AI-028, AI-029
- 現象: Google がモデルIDを廃止すると、フォールバックや空応答で黙って劣化・全滅する（2026-08 の事故と同型）。監視は /api/health の DB 接続のみで AI 疎通を見ない。画像は gpt-image-2 が毎回失敗しても Nano Banana Pro に落ちるだけで通知されない。
- 該当箇所: src/app/api/cron/health-alert/route.ts、src/app/api/health/route.ts、banner/text-answer.ts、banner/refine/route.ts:107、seo/lib/gemini.ts、src/lib/image-generator.ts:76-94
- 修正案: (1) Gemini/OpenAI 呼び出しの共通層で 404・NOT_FOUND を検知し notifyAlert（1日1回に dedup、時刻判定）を送る。(2) image-generator でフォールバック発動時にステータスと発動率を通知。(3) 週次の生存確認 cron（極小の generateContent を1モデル1回）を追加。
- worktree で安全に直せるか: いいえ（部分的にはい）。(1)(2) のコード追加は worktree で可。(3) のプローブ実行と、モデルIDの生存確認は実API呼び出しが必要なので承認要（従量課金に準ずる）。

#### 2. [A] gemini-2.5-flash を単独で直書きし、エイリアス退避が無い
- 対応ID: AI-003, AI-004
- 現象: gemini-2.5-flash が 404 になると、インタビュー系の記事生成・校正・翻訳・SNS文・タイトル提案・レシピ生成・修正の計8ルート、ドヤスライドの画像解析、ドヤリストの企業情報抽出、スワイプ診断が一斉に失敗する。現時点の生存は未確認。
- 該当箇所: 付録A-3 のとおり（interview 8ルート、doyaslide/vision.ts:10、doyalist/collect/web-scraper.ts:48、swipe/test 2ルート）
- 修正案: モデル解決を共通関数（例: src/lib/gemini-models.ts）に集約し、鎖 [env指定, 現行ID, gemini-flash-latest] を必ず返す。各 route は 404 時に次候補へ進む（banner/text-answer.ts の実装を流用できる）。
- worktree で安全に直せるか: いいえ。コード変更自体は可能だが、モデルIDの変更・追加は「実APIでの生存確認が必要なので承認要」。

#### 3. [B] 111個のハンドラに try/catch が無く、DB 例外で JSON でない 500 になる
- 対応ID: API-003, API-004, API-006, API-012, API-014, API-015, API-016, API-018, API-019
- 現象: Prisma 例外などがそのまま投げられ、Next 既定の空 500 になる。クライアントの res.json() が失敗し、画面は原因不明のエラーになる。popup/public/config は第三者サイトの埋め込みタグが呼ぶため、CORS ヘッダが付かず「ポップアップが出ない」だけで気づけない。aio/scans の POST は maxDuration=300 の長時間処理。
- 該当箇所: 付録B（mensetsu 26, aishodan 20, popup 12, cunning 10, aio 9, quote 8, sfa 6, shodan 5, seo export 4, asklink 3 ほか）
- 修正案: 共通ラッパー withApiErrors(handler) を作り、例外を JSON 500 に変換して sendErrorNotification を呼ぶ。popup/public/config は CORS ヘッダ付きの失敗応答（またはキャッシュ済み空設定）を返す。優先順は popup/public -> aio/scans -> mensetsu/live -> aishodan/room。
- worktree で安全に直せるか: はい。ただし87ファイルの機械的変更なので、段階的に適用し、デプロイ前に tsc とビルドで確認する。

#### 4. [B] 不正JSONが 500 になる（96件が catch で 500 のみ）
- 対応ID: API-023
- 現象: 不正な本文でも 500 を返し、エラー通知・監視を汚染し、クライアントが 400 と区別できない。
- 該当箇所: seo 16 / hr 8 / interview 7 / kintai 6 / banner 5 / cunning 3 / aio 1（例: banner/generate, hr/employees, kintai/employees, interview/recipes, seo/sections/[id]）
- 修正案: readOperationalJson へ置換するか、SyntaxError を 400 に変換する共通処理を追加する。
- worktree で安全に直せるか: はい。

#### 5. [B] 外部AI呼び出しにタイムアウトが無い箇所
- 対応ID: AI-023, AI-024, AI-025, API-022
- 現象: 上流がハングすると maxDuration まで関数を占有し、SEO記事生成ジョブの1ステップが失敗する。mitsuboshi は maxDuration=30/60 のため platform の 504 になる。OpenAI SDK は既定10分・自動リトライ2回で、AIO のスキャンや画像編集の最悪時間が読めない。
- 該当箇所: seo/lib/gemini.ts の fetch 4箇所、src/lib/mitsuboshi/_shared/anthropic.ts:36,86、src/lib/aio/engines.ts:76、src/lib/openai.ts:11、src/lib/openai-image.ts:148
- 修正案: AbortSignal.timeout（または withTimeout）を付与し、OpenAI SDK には timeout と maxRetries を明示する。
- worktree で安全に直せるか: はい。

#### 6. [B] フォールバック鎖の末尾がエイリアスでない／プレビュー版IDに依存
- 対応ID: AI-008, AI-009, AI-010, AI-011, AI-014, AI-012
- 現象: 末尾がプレビュー版（gemini-3-flash-preview）で、プレビューは予告なく終了する。seo の鎖は末尾が gemini-2.5-flash になる経路がある。画像のフォールバックは gemini-3-pro-image 単独で、404 になると画像生成の退避先が無い。
- 該当箇所: 付録A-4
- 修正案: 各鎖の末尾に gemini-flash-latest または gemini-pro-latest を追加し、重複要素を除く。
- worktree で安全に直せるか: いいえ。変更後の鎖は実APIでの生存確認が必要なので承認要。

#### 7. [B] モデルIDとAPIキー env 名の定義が分散している
- 対応ID: AI-015, AI-016
- 現象: モデル系 env が32種、キー env が6種で32ファイルに6通りの組合せ。キー更新やモデル差し替えで取りこぼしが出る（Vercel の実設定は未確認）。
- 該当箇所: 付録C、seo/lib/gemini.ts:240-248、src/lib/image-generator.ts:140-143、各 route の getApiKey
- 修正案: getGeminiApiKey() と getGeminiModels(kind) を1モジュールに集約し、他は全てそこを経由させる。env 名は GOOGLE_GENAI_API_KEY に統一（旧名は読み取りのみ許容）。
- worktree で安全に直せるか: はい（コード側）。Vercel 環境変数の実設定確認は権限が必要で、worktree では不可。

#### 8. [B] 参照画像編集で課金呼び出しが最大3回に増える
- 対応ID: AI-034
- 現象: gpt-image-2 -> gpt-image-1 -> gemini-3-pro-image と順に呼ぶ上、OpenAI SDK の自動リトライが加わるため、失敗時の課金が見積もりより増える。
- 該当箇所: src/lib/openai-image.ts:161-181
- 修正案: maxRetries: 0 を指定し、gpt-image-1 への退避は env で明示した場合のみとする（または回数を通知に含める）。
- worktree で安全に直せるか: いいえ。課金仕様の判断（退避の是非）が必要なので承認要。コード変更自体は可。

#### 9. [B] SEO記事が RUNNING のまま孤立した場合の回復が未確認
- 対応ID: API-036
- 現象: ジョブは貸出(executionExpiresAt)で回復できるが、記事側 status が RUNNING で残るケースの自動復帰は確認できていない（無限ローディングの原因になりうる）。
- 該当箇所: seo/lib/pipeline.ts:2525,3624、src/app/api/seo/jobs/[id]/cancel/route.ts:22
- 修正案: 最終更新が一定時間を超えた RUNNING 記事を一覧取得時に ERROR 扱いで表示（AIO の effectiveScanStatus と同方式）。
- worktree で安全に直せるか: はい（要設計確認）。

#### 10. [C] 利用者向け応答に環境変数名を含めている
- 対応ID: AI-018
- 現象: ASSEMBLYAI_API_KEY 等の環境変数名が文字起こし API のレスポンスと SSE に出る。
- 該当箇所: src/app/api/interview/materials/[id]/transcribe/route.ts:244,258-267、transcribe-stream/route.ts:111
- 修正案: 利用者向けは定型文にし、詳細はログのみにする。
- worktree で安全に直せるか: はい。

#### 11. [C] Gemini キーを URL クエリで送っている
- 対応ID: AI-020
- 現象: URL がログ・プロキシに残りうる。他の大半は x-goog-api-key ヘッダ。
- 該当箇所: src/lib/banner/text-answer.ts:9、src/app/api/banner/from-url/route.ts:232,858,1348
- 修正案: ヘッダ方式に統一する。
- worktree で安全に直せるか: はい（動作確認のため呼び出しを伴う検証は承認要）。

#### 12. [C] 本番に画像生成の検証用エンドポイントが公開されている
- 対応ID: AI-035, API-061
- 現象: GET が本番で 200 を返し仕様を公開。POST は x-test-token の !== 比較で、トークンが本番に設定されていれば有料画像生成が可能。
- 該当箇所: src/app/api/test/openai-image/route.ts
- 修正案: 本番では 404 を返す（NODE_ENV 判定）、またはルートを削除。比較は timingSafeEqual。
- worktree で安全に直せるか: はい。

#### 13. [C] 旧表記・ドキュメント・dead code の整理
- 対応ID: AI-002, AI-017, AI-037, AI-038, API-032, API-047
- 現象: "Gemini 2.0 Flash" の表示、AIza/AQ. の記述不一致、dev-guide のモデル直書きと params 記述が新規実装に伝播する。未使用の旧ID候補（seo/lib/gemini.ts）、export {} の空 route が5本残る。
- 該当箇所: 付録A-2、reference/07-dev-guide.md:116-131、reference/08-environment.md:12、seo/lib/gemini.ts:222-293、seo/articles/[id]/meta ほか5本
- 修正案: 表記・ガイドを更新し、dead code と空 route を削除する（ファイルの削除->再作成ではなく編集、削除はユーザー確認後）。
- worktree で安全に直せるか: はい。

#### 14. [C] エラー本文を Error.message に格納
- 対応ID: AI-032
- 現象: 現在は route で握りつぶされるが、通知経路に載ると漏れる。
- 該当箇所: seo/lib/gemini.ts、src/lib/aio/engines.ts:131,155、src/lib/mitsuboshi/_shared/anthropic.ts:47
- 修正案: ステータスと分類コードのみを保持する。
- worktree で安全に直せるか: はい。

#### 15. [C] 共通エラー基盤の死蔵・不統一
- 対応ID: API-043, API-044
- 現象: notifyApiError は呼び出し元0件、privateApiJson は19ファイルで他は Cache-Control 直書きと混在。
- 該当箇所: src/lib/errorHandler.ts、src/lib/private-api-response.ts
- 修正案: #3 の共通ラッパーに統合する。
- worktree で安全に直せるか: はい。

#### 16. [C] HTTP 200 でエラーを返す／SSE の切断検知が無い／本番応答の細かな不統一
- 対応ID: API-027, API-033, API-052, API-060
- 現象: aishodan/room/[token]/record と mitsuboshi/nagusame/chat が 200 でエラーを返す。doyalist/export と mitsuboshi/nagusame/generate は切断後も処理継続。kintai/employees は未認証で 403、存在しない /api/* は HTML の 404、banner/history の 401 は英語。
- 該当箇所: 各ファイル（根拠欄参照）
- 修正案: 契約上 200 が必要なもの（Realtime 関数応答）を除き 4xx/5xx に変更。SSE は request.signal を購読。API 配下の 404 は JSON を返す not-found 処理を追加。
- worktree で安全に直せるか: はい（クライアントの契約確認が必要）。

#### 未確認の主な項目（実API確認が必要なため承認後に実施）
- gemini-2.5-flash / gemini-3-pro-image(-preview) / gpt-4o / gpt-image-2 / gpt-image-1 / gpt-realtime / gpt-4o-transcribe / claude-sonnet-4-6 / claude-haiku-4-5-20251001 / sonar / AssemblyAI universal-2 の生存。
- Vercel 環境変数にどのキー名・モデル名 env が設定されているか（モデルID固定による廃止ID残存の有無）。
- const 形式ハンドラ6ファイルの try、AI 呼び出し44本の手書き検証の網羅性。


---

## 6. フロント・公開ページ・監視通知

対象: origin/main の worktree（HEAD 318841cb）。コード確認は読み取りのみ。本番確認は未ログインの GET/HEAD で合計約107回（上限120以内）。

前提と制約:
- 本番は Vercel のセキュリティチェックポイント（`x-vercel-mitigated: challenge`）を有効にしており、curl 既定UAは初回から全URLで 403 になった。以降の本番確認は、組み込みブラウザで1回通常遷移してチャレンジを通した後の同一オリジン fetch（GET）で行った。応答時間はブラウザ側計測。
- リダイレクトは fetch の `redirect:'manual'` で 3xx 発生のみ確認できる（`opaqueredirect`）。308 か 301 かの数値は読めないため、数値は next.config.js の `permanent: true`（=308）で補っている。
- 画面系は静的読解と集計（finally / res.ok / catch / 401 / 空状態の有無）で確認した。実機での失敗再現は行っていない。「合格」は静的確認の範囲。
- 結果欄の「合格」は条件を満たすことを確認できたもの。確認できなかったものは「未確認」とした。

### 点検表

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| FE-001 | ルート error.tsx の文言 | src/app/error.tsx を読む | 日本語・敬語・絵文字なし | 合格 | 「エラーが発生しました」「しばらくしてからもう一度お試しください」。アイコンは lucide-react。サポート導線あり |
| FE-002 | ルート error.tsx が運用者へ報告 | 同上 | 描画エラーが通知経路に乗る | 合格 | `reportBrowserError('render')` を呼ぶ（/api/operational-error へ POST） |
| FE-003 | global-error.tsx の有無 | find src -name global-error.tsx | ルートレイアウト自体の例外を日本語で受ける | 不合格 | ファイルなし。layout.tsx 内の例外は Next 既定の英語エラー画面になる |
| FE-004 | not-found.tsx の文言 | src/app/not-found.tsx を読む | 日本語・敬語・絵文字なし | 合格 | 「ページが見つかりません」。絵文字なし |
| FE-005 | not-found 内リンク先が現役サービスか | 同ファイルのリンクと RETIRED_SERVICE_IDS を突合 | リンク先が現役画面 | 不合格 | 「カンタンドヤAI」→ /kantan/dashboard は提供終了（308で /seo へ飛ぶ）。表示名と遷移先が不一致。DashboardLayout.tsx:133 の既定 callbackUrl も /kantan/dashboard |
| FE-006 | doyaslide/error.tsx | ファイルを読む | 絵文字なし | 不合格 | 先頭に絵文字（画像アイコンの絵文字）をUIとして使用 |
| FE-007 | doyaslide/not-found.tsx | ファイルを読む | 絵文字なし | 不合格 | 同様に絵文字使用 |
| FE-008 | kintai/error.tsx | ファイルを読む | 日本語・敬語・絵文字なし | 合格 | 画像アイコン＋「再試行する」「トップへ戻る」。絵文字なし |
| FE-009 | kintai/dashboard/error.tsx | ファイルを読む | 絵文字なし | 不合格 | 「エラーを報告する」ボタンの先頭に虫の絵文字が1箇所 |
| FE-010 | promane/error.tsx | ファイルを読む | 敬語・絵文字なし・内部メッセージを出さない | 不合格 | 「あれれ、エラーが発生したよ」（敬語でない）、絵文字3種、「詳細」欄に `error.message` を生表示 |
| FE-011 | サブ error.tsx が運用者へ報告するか | doyaslide / kintai / kintai/dashboard / promane の各 error.tsx を grep | reportBrowserError を呼ぶ | 不合格 | 4本とも未呼び出し。ルート境界を上書きするため、これらサービスの描画エラーは通知されない（promane は console.error のみでクライアント側は未パッチ） |
| FE-012 | 他サービスの error.tsx | find で各サービス配下を確認 | ルート境界が継承される | 合格 | banner/seo/interview/persona/hr/doyalist/cunning/sfa/shodan/aio/mensetsu/quote/aishodan/adimage/asklink/popup は専用ファイルなしでルート error.tsx を継承 |
| FE-013 | loading.tsx | find src/app -name loading.tsx | 任意（画面側で代替） | 合格 | banner/dashboard のみ。他は各画面が独自スピナーを持つ |
| FE-014 | loading が false に戻らない経路（finally 欠落）の集計 | fetch を含む tsx 234本で setXxxLoading(true) と finally の有無を機械集計 | finally または全分岐で false | 合格 | finally 欠落は admin/login/page.tsx のみ。同ファイルは全分岐（429/401/2FA/catch）で setIsLoading(false) を実行 |
| FE-015 | res.ok を見ない fetch（現役画面） | fetch を含む page/Tool を集計 | 非2xxを処理 | 不合格 | admin/services/page.tsx は `r.json()` をそのまま setData（401/500本文が data に入る）。admin/feedback も同傾向。他の22本中の多くは提供終了サービス（opening/interviewx/adbanner）で到達不能 |
| FE-016 | catch のない fetch | 同集計 | ネットワーク失敗を処理 | 不合格 | mensetsu/templates/[id]/page.tsx の load は try/finally のみで catch なし。通信失敗で未処理 reject になり、エラー表示なしで空フォームが出る |
| FE-017 | banner/dashboard（一覧・生成） | 静的集計と読解 | finally・res.ok・catch・エラー表示 | 合格 | finally 4 / ok 4 / catch 12 / エラー表示 9 |
| FE-018 | banner/dashboard/history | 同上 | 同上 | 合格 | finally 4 / ok 5 / catch 9 / エラー表示 20 |
| FE-019 | banner/dashboard/create | 同上 | 同上 | 合格 | finally 2 / ok 2 / catch 11 / エラー表示 15 |
| FE-020 | seo/Tool（記事作成入口） | 同上 | 同上 | 合格 | finally 3 / ok 3 / catch 4。401 の専用文言は無いが SeoAppLayout にログイン導線あり |
| FE-021 | seo/articles/[id] | 同上＋ポーリング読解 | 終端で停止 | 合格 | DONE/ERROR/EXPORTED と 404 で clearInterval。finally 8 |
| FE-022 | seo/jobs/[id] のポーリング停止条件 | page.tsx 375-405,610-640 を読む | 失敗・401・404 でも無限に叩かない | 不合格 | done/error/cancelled では止まるが、401/403/404 で `setJob(null)` 後も `j` が null のため4秒周期の load が永久に継続（上限回数・バックオフなし） |
| FE-023 | interview/Tool（一覧・アップロード） | 読解 | 失敗時に loading が戻る | 合格 | `.catch→setProjectListError` と `.finally→setLoading(false)`。署名URL・確認の各段で res.ok と success を検査 |
| FE-024 | interview/projects/[id]/generate | 静的集計 | 同上 | 合格 | finally 4 / ok 2 / catch 7 / エラー表示 12 |
| FE-025 | interview/projects/[id]/transcribe の再接続上限 | MAX_RECONNECT_ATTEMPTS を確認 | 上限あり | 合格 | 上限20回、超過で停止（175行付近）。sessionStatus==='loading' は文言表示で固まらない |
| FE-026 | persona/Tool | 静的集計 | 同上 | 合格 | finally 6 / ok 5 / catch 22。装飾用 setInterval は loading 変化で clear |
| FE-027 | hr/dashboard | 読解 | 失敗時に再試行UI | 合格 | AbortController、`!res.ok` で throw、catch で loadError、finally で loading 解除、role="alert" の再試行表示 |
| FE-028 | hr/employees | 静的集計 | 同上 | 合格 | finally 1 / ok 1 / catch 1 / エラー表示 3 |
| FE-029 | kintai/dashboard・attendance・settings・departments | 読解 | 同上 | 合格 | いずれも loadError 状態と finally を持ち、英語の throw メッセージは画面に出さず `catch { setLoadError(true) }` |
| FE-030 | kintai/clock | 静的集計 | 同上 | 合格 | finally 2 / ok 2 / catch 2 / エラー表示 3 |
| FE-031 | doyalist/history | 静的集計 | 同上 | 合格 | finally 4 / ok 6 / catch 11 / 空状態文言あり |
| FE-032 | doyaslide/[id]（生成ポーリング） | 読解 | 終端・失敗で停止し 401/403/404 を表示 | 合格 | `stopPoll` を finally で実行、401 は「ログインが必要です。再ログインしてから再読み込みしてください。」を表示、重複ポーリング回避あり |
| FE-033 | aio/[orgSlug] | 読解 | 同上 | 合格 | 連番ガード付き load、catch でエラー表示、finally で解除。空状態文言17件 |
| FE-034 | mensetsu/Tool | 静的集計 | 同上 | 合格 | finally 10 / ok 9 / catch 9 / エラー表示 23 |
| FE-035 | mensetsu/live/[token] の面接後フィードバック取得 | 読解 | 完了後はポーリング停止 | 不合格 | `ready` になった後も20秒周期の取得を unmount まで継続（219-232行） |
| FE-036 | quote/Tool | 静的集計 | 同上 | 合格 | finally 9 / ok 11 / catch 11 / エラー表示 22 |
| FE-037 | aishodan/Tool | 静的集計 | 同上 | 合格 | finally 6 / ok 7 / catch 10 / エラー表示 17 |
| FE-038 | adimage/Tool | 静的集計 | 同上 | 合格 | finally 6 / catch 10 / エラー表示 23。res.ok 参照は1箇所のみ（生成系は別ヘルパー経由の可能性。個別検証は未実施） |
| FE-039 | asklink/Tool | 静的集計 | 同上 | 合格 | finally 1 / ok 1 / catch 2 / エラー表示 4 |
| FE-040 | popup/Tool | 静的集計 | 同上 | 合格 | finally 1 / ok 1 / catch 3 / エラー表示 5。ステップ表示は clearInterval あり |
| FE-041 | cunning / sfa / shodan / promane の入口 page | 行数・fetch 数 | 該当なし | 該当なし | cunning/page.tsx 18行・sfa/page.tsx 20行はラッパーで fetch なし。操作画面は各 layout/コンポーネント側（個別に未精査） |
| FE-042 | useSession の status==='loading' で固まる画面 | 現役19サービス配下の useSession 利用49ファイルを集計 | unauthenticated 等の分岐あり | 合格 | loading 判定のみで分岐を欠く候補は2本（interview transcribe / kintai pricing）で、どちらも loading 文言表示後に解除される実装 |
| FE-043 | 未ログイン時のログイン誘導（HR・勤怠） | HrLayout / KintaiLayout を読む | 分かる表示＋元画面へ戻る | 不合格 | 表示はあるが callbackUrl が固定（`/hr/dashboard`、`/kintai/clock`）で、元の画面に戻れない |
| FE-044 | 未ログイン時のログイン誘導（SEO等の `/auth/signin` 直リンク） | `href="/auth/signin"` を grep | callbackUrl 付き | 不合格 | seo/create・seo/swipe・seo/dashboard/plan・SeoAppLayout・UsageLimitBanner など約18箇所が callbackUrl なし。ログイン後はトップ相当に戻る |
| FE-045 | サインイン画面のエラー文言とリダイレクト先検証 | auth/signin/page.tsx、safe-signin-callback.ts | 日本語、安全なコールバック | 合格 | エラーコード別に日本語文言。`safeSignInCallbackUrl` で検証して signIn に渡す |
| FE-046 | クライアントのエラー表示に英語の内部メッセージが出ないか | `toast.error(e.message)` 等を grep | 通信失敗でも日本語 | 不合格 | `toast.error(e.message)` / `setError(e.message)` 系が111箇所。fetch が TypeError（Failed to fetch / Load failed）を投げると英語がそのまま出る（hr/one-on-one、hr/settings、hr/employees など） |
| FE-047 | API が返す英語エラー（Unauthorized 等）が画面に出ないか | `error: 'Unauthorized'` 等 216箇所（hr 87）と表示側を突合 | 表示側で日本語化 | 未確認 | hr 画面は多くが独自の日本語文言を throw しているが、`json.error` を直接表示する経路（mensetsu の notifyError 等）は英語本文をそのまま出し得る。網羅できていない |
| FE-048 | 一覧が0件のときの表示 | 空状態文言の有無を集計 | 0件文言あり | 合格 | 主要一覧（doyalist/history、aio、mensetsu、quote、adimage 等）に「まだ〜ありません」系の文言あり。全画面の網羅は未実施 |
| FE-049 | 生成失敗時の利用者向け文言 | 主要生成画面の throw / setError を確認 | 日本語の定型文言 | 合格 | seo（「生成に失敗しました (status)」）、doyaslide、interview、persona は日本語文言。内部エラー本文は API 側で隠蔽済み（commit 547b7b9b） |
| FE-050 | UI の絵文字使用（全体件数） | src の tsx を走査（コメント除外、星・チェック・矢印などの記号は除外） | 0件 | 不合格 | 386文字／109ファイル。現役サービス・共通部で約259、提供終了サービス（到達不能）で約88。上位: promane 126（components 84＋app 42）、admin 30、banner 18、interview 14、kintai 13、seo 13 |
| FE-051 | 絵文字の代表例 | 同上 | — | 不合格 | `src/app/promane/page.tsx` の「ゲスト」「招待が届いています」ラベル先頭の絵文字、`src/components/QuickActions.tsx`（9）、`src/app/movie/page.tsx`（提供終了） |
| FE-052 | 画面の口調（敬語） | error.tsx 群 | 敬語統一 | 不合格 | promane/error.tsx のみ「〜したよ」「もう一度試してみてください」の混在（FE-010 と同根） |
| PUB-001 | 非ブラウザ（curl 既定UA）からの GET/HEAD | curl -I で30URL | 200 | 不合格 | 30/30 が 403、`x-vercel-mitigated: challenge`（Vercel Security Checkpoint）。外部死活監視・リンクプレビュー系クローラの取得可否は未検証 |
| PUB-002 | / （トップ） | ブラウザ遷移 | 200・index | 合格 | 200、title「ドヤAI \| AI SaaSサービス群」、robots `index, follow` |
| PUB-003 | /pricing | ブラウザ遷移 | 200 | 合格 | 200、title「料金プラン｜ドヤAI」 |
| PUB-004 | /auth/signin | fetch GET | 200・検索除外 | 未確認 | 200（620ms）。meta robots は `index, follow` だが next.config.js の APP_ONLY_PREFIXES に `/auth` があり X-Robots-Tag: noindex の設定。本番レスポンスヘッダは未計測 |
| PUB-005 | /terms | fetch GET | 200 | 合格 | 200（511ms）。title がトップと同一の既定（固有 title なし） |
| PUB-006 | /privacy | fetch GET | 200 | 合格 | 200（565ms）、title「プライバシーポリシー \| ドヤAI」 |
| PUB-007 | /tokushoho | fetch GET | 200 | 合格 | 200（714ms） |
| PUB-008 | /banner | fetch GET | 200 | 合格 | 200（833ms）、OGP /ogp/banner.jpg |
| PUB-009 | /seo | fetch GET | 200 | 合格 | 200（674ms）、OGP /seo/opengraph-image |
| PUB-010 | /interview | fetch GET | 200 | 合格 | 200（496ms） |
| PUB-011 | /persona | fetch GET | 200 | 合格 | 200（479ms）、OGP /persona/opengraph-image |
| PUB-012 | /hr | fetch GET | 200 | 合格 | 200（546ms） |
| PUB-013 | /kintai | fetch GET | 200 | 合格 | 200（581ms） |
| PUB-014 | /doyalist | fetch GET | 200 | 合格 | 200（548ms） |
| PUB-015 | /doyaslide | fetch GET | 200 | 合格 | 200（587ms） |
| PUB-016 | /cunning | fetch GET | 200 | 合格 | 200（623ms） |
| PUB-017 | /promane | fetch GET | 200 | 合格 | 200（535ms）、HTML 123KB |
| PUB-018 | /sfa | fetch GET | 200 | 合格 | 200（537ms） |
| PUB-019 | /shodan | fetch GET | 200 | 合格 | 200（325ms） |
| PUB-020 | /aio | fetch GET | 200 | 合格 | 200（888ms） |
| PUB-021 | /mensetsu | fetch GET | 200 | 合格 | 200（382ms） |
| PUB-022 | /quote | fetch GET | 200 | 合格 | 200（291ms） |
| PUB-023 | /aishodan | fetch GET | 200 | 合格 | 200（640ms） |
| PUB-024 | /adimage | fetch GET | 200 | 合格 | 200（856ms） |
| PUB-025 | /asklink | fetch GET | 200 | 合格 | 200（463ms） |
| PUB-026 | /popup（UNLISTED） | fetch GET | 200 かつ noindex | 合格 | 200（441ms）、meta robots `noindex, follow` |
| PUB-027 | 料金ページ（18本）: /banner /seo /interview /persona /hr /kintai /doyalist /promane /doyaslide /cunning /sfa /shodan /aio /mensetsu /quote /aishodan /adimage /asklink 各 /pricing | fetch GET（sitemap 記載分） | 全て200 | 合格 | 18/18 が 200、284〜693ms |
| PUB-028 | /banner/guide | fetch GET | 200 | 合格 | 200（660ms）。sitemap 上で独立ガイドを持つのは現役では banner のみ |
| PUB-029 | /popup/pricing の noindex | popup/pricing/layout.tsx の robots 設定を確認 | noindex | 未確認 | 設定ファイルは存在（コードに robots 記述あり）が、本番 GET は未実施（回数節約） |
| PUB-030 | sitemap.xml | fetch GET | 200・XML | 合格 | 200、application/xml、42URL |
| PUB-031 | sitemap に UNLISTED / 提供終了が混入しない | 42URLを走査 | 0件 | 合格 | popup・kantan・logo・lp・copy・voice・movie・adsim・tenkai・opening・interviewx・adbanner を含まない |
| PUB-032 | sitemap の全URLが到達可能 | 42URL（トップ・法務3・/pricing・LP19・各料金18・guide1） | 200 | 合格 | 42件すべてを取得し全て200（5xx/4xx なし） |
| PUB-033 | robots.txt | fetch GET | 200 | 合格 | 200（289ms）。/api/ /admin/ /_next/ を Disallow |
| PUB-034 | llms.txt | fetch GET | 200 | 合格 | 200（606ms） |
| PUB-035 | /api/health | fetch GET | 200・DB接続 | 合格 | 200、`{"status":"ok","database":"connected"}`（311ms） |
| PUB-036 | 存在しないURL（/zz-nonexistent-check） | fetch GET | 404 | 合格 | 404（161ms）。日本語の not-found 画面 |
| PUB-037 | /kantan（提供終了） | redirect:'manual' | 3xx | 合格 | opaqueredirect。next.config.js は `/seo` へ permanent（308） |
| PUB-038 | /adbanner（後継 adimage へ統合） | 同上 | 3xx | 合格 | opaqueredirect。設定は `/adimage` へ permanent |
| PUB-039 | /lp | 同上 | 3xx | 合格 | opaqueredirect。設定は `/` へ permanent |
| PUB-040 | /copy | 同上 | 3xx | 合格 | opaqueredirect |
| PUB-041 | /movie | 同上 | 3xx | 合格 | opaqueredirect |
| PUB-042 | /slide（旧パス） | 同上 | 3xx | 合格 | opaqueredirect。設定は `/doyaslide` へ permanent |
| PUB-043 | /shindan | 同上 | 3xx | 合格 | opaqueredirect |
| PUB-044 | 数値が 308 であること | 本番は status 非公開（opaqueredirect） | 308 | 未確認 | next.config.js の `permanent: true` から 308 になる想定。実測値は未取得 |
| PUB-045 | 提供終了サービス配下のサブパス・API（410）の本番挙動 | /copy/xxx、/api/copy 等 | 308 / 410 | 未確認 | 本番アクセス回数節約のため未実施。設定は next.config.js で確認 |
| PUB-046 | OGP /ogp/portal.jpg | fetch HEAD | 200・画像 | 合格 | 200 image/jpeg（481ms） |
| PUB-047 | OGP /ogp/banner.jpg | fetch HEAD | 200・画像 | 合格 | 200 image/jpeg（390ms） |
| PUB-048 | OGP /seo/opengraph-image（動的生成） | fetch HEAD | 200・画像 | 合格 | 200 image/png（559ms） |
| PUB-049 | OGP /og/popup | fetch HEAD | 200・画像 | 合格 | 200 image/png（1206ms） |
| PUB-050 | 応答時間 | 上記全GETの計測 | 5秒超なし | 合格 | 最大は /og/popup の1206ms、LP/料金は 284〜888ms。5秒超なし（コールドスタートの再測定はしていない） |
| PUB-051 | /terms /auth/signin の title | 取得HTMLの title | 固有title | 不合格 | トップと同一の「ドヤAI \| AI SaaSサービス群」（/terms）。検索結果・共有時に区別できない |
| MON-001 | 通知基盤 alert.ts の webhook 解決順 | alert.ts を読む | env → DB → 予備env | 合格 | SLACK_ALERT_WEBHOOK_URL → SystemSetting slack_webhook → SLACK_ANALYTICS_WEBHOOK_URL。DB障害でも env にフォールバック |
| MON-002 | notifyAlert は throw しない・失敗時にクールダウンを戻す | alert.ts を読む | 失敗しても再送可能 | 合格 | `!res.ok` と例外の両方で clearSendCooldown して false を返す。5秒タイムアウトあり |
| MON-003 | Slack webhook が失敗したときの運用者への伝達 | alert.ts / runtime-alert.ts / heisha-runtime-alert.ts | 代替経路がある | 不合格 | 失敗は console.error / originalError でログに残るだけ。通知経路は Slack 1系統のみで、メール等の代替なし。Slack 側が止まるとアラート全体が無音になる |
| MON-004 | notifyAlert の多重送信抑止 | alert.ts の shouldSend | インスタンス間で共有 | 不合格 | `lastSent` は各インスタンスのメモリのみ。health-alert（5分毎・notifyAlert 使用）は継続障害時にインスタンスが変わると10分クールダウンを超えて重複し得る。DEV-STATUS 2-6 も同種の地雷として明記 |
| MON-005 | runtime-alert の共有上限（DB） | runtime-alert-limit.ts | 原子的・失敗時は通知継続 | 合格 | SystemSetting への INSERT … ON CONFLICT WHERE で10分枠を原子取得。DB失敗時は 'unavailable' で通知続行。失敗時は自身の claim のみ release |
| MON-006 | 共有上限の鍵設計（未解析スタックの一括化） | runtime-alert.ts の safeRuntimeSource と budgetKey | 発生箇所ごとに分離 | 不合格 | スタックから位置が取れない場合、全て同一文字列「サーバー処理（詳細はログ）」になり、アプリ全体で1つの10分枠を共有する。原因未特定の常時通知が枠を消費すると、別原因の本物のエラー通知が最大10分抑止される |
| MON-007 | console.error 通知（runtime alert）のインストール | instrumentation.ts | 本番のみ有効 | 合格 | `VERCEL_ENV==='production'` のときのみ console.error をラップ。空呼び出しと DeprecationWarning は除外 |
| MON-008 | console.error に原因情報が残るか | `console.error('…:')` の引数を集計 | エラー本体がログ・通知に残る | 不合格 | src の console.error 871箇所のうち、固定文字列のみで error を渡さないものが765箇所（末尾コロンだけで本体を落としたものが316箇所）。commit 547b7b9b の秘匿対応で本体を削除した結果、通知は「照合ID」だけで原因が追えない |
| MON-009 | インシデント report.md の「原因未特定の console.error 通知」のその後 | git log と report.md の末尾を確認 | 原因特定または対策完了 | 不合格 | 最終コミット ae8c5a63（2026-09-24）時点でも未特定。診断項目の追加（stack 形状・長さ帯）と並行実行対策は入ったが、report は「解消済みと案内しない」と明記。以降 worktree 上の追記なし。判定は未解決のまま |
| MON-010 | 上記の未特定通知を生む仕組みの手がかり | MON-008 と report の「固定文字列1件・未分類・内部スタック」 | — | 不合格 | 固定文字列1個だけを渡す console.error が765あり、persona-purge の経路にも `Persona image settlement or cleanup failed` 等の単一文字列がある。報告書の「ソース内640件と指紋照合」は呼び出し元が未解析スタックの場合に source が共通化する点（MON-006）と相互作用するため、照合方法そのものを再検討する余地がある（推測。要検証） |
| MON-011 | ブラウザ側エラー報告の取り込み上限 | operational-error-limit.ts / route.ts | 悪用耐性・原因が分かる | 不合格 | 種別（javascript/render/promise）ごとに全利用者共通で10分1件。拡張機能由来など無害なエラーが枠を消費でき、通知にはURL・メッセージが含まれない。再現・特定は不可能 |
| MON-012 | operational-error API の認証 | route.ts を読む | 同一オリジンのみ・本文1KB・形式検証 | 合格 | Origin と sec-fetch-site 検査、トークン経路、`readOperationalJson(…,1024)`、kind 検証あり |
| MON-013 | 死活監視 health-alert cron | health-alert/route.ts と vercel.json | 5分毎・遅延/異常/到達不可を通知 | 合格 | `*/5 * * * *`。8ターゲット（ドヤAI、呪い日記、ゆるせん、推しにマイル 等）を15秒タイムアウトで確認。遅延は再測定してから通知 |
| MON-014 | 相互監視（ドヤAI 自身が落ちた場合） | noroi 側 cron/health/route.ts | 別プロジェクトが監視 | 合格 | noroi の health cron が `https://doya-ai.surisuta.jp/api/health` を確認（DOYAAI_HEALTH_URL）。ドヤAI停止時でも検知経路あり |
| MON-015 | 外部の第三者死活監視（UptimeRobot 等） | リポジトリとドキュメントを grep | あれば合格 | 不合格 | 該当なし。Vercel Cron と自社相互監視のみ。さらに本番は非ブラウザへ 403 チャレンジ（PUB-001）を返すため、一般的な外形監視は設定自体が通らない可能性 |
| MON-016 | /api/health の内容 | health/route.ts | DBを確認 | 不合格 | DB の `SELECT 1` のみ。Gemini / OpenAI / Stripe / Supabase Storage などの依存は確認しない。モデル廃止（404）や鍵失効はここでは検知できない |
| MON-017 | Gemini モデル廃止（404）の検知 | gemini-text.ts と scripts/ を確認 | 失敗が運用者に届く | 不合格 | 404 等は `console.warn` で次モデルへ継続するため通知対象外（通知は console.error のみ）。フォールバックが成功すれば無音で劣化、全滅時のみ上位で console.error 経由の汎用通知。定期的な生存確認スクリプト/cron は無し（CLAUDE.md の注意書きのみ） |
| MON-018 | ログイン失敗（NextAuth）の検知 | auth-logger.ts | 予期しない失敗は通知 | 合格 | `console.error('[next-auth][error][code]')` で runtime alert 対象。ユーザー拒否（access_denied）は warn に降格して通知しない。ただし上限・原因情報は MON-006/008 の制約を受ける |
| MON-019 | Stripe webhook 失敗の検知 | stripe/webhook/route.ts | 失敗時に通知 | 合格 | 署名失敗・ハンドラ例外・通知配送失敗が console.error（→汎用通知）。専用の再送・状態は stripe-notifications cron（5分毎）と billing-audit（日次）で補完 |
| MON-020 | cron 失敗の検知（暗黙経路） | cron の catch を確認 | 500/503 が通知される | 不合格 | seo-image-purge・interview-storage-purge は失敗を 503 で返すだけで console.error も通知も無し（catch 内が `return Response.json(…, 503)` のみ）。保持期限削除の失敗が Slack に届かない |
| MON-021 | 日次レポート不達の検知 | service-operations-monitor.ts | 期待時刻から30分超で通知 | 合格 | `monitorReportDelivery` が受領記録の欠落を検知し「送信完了が確認できない」を送る（service-operations?mode=watch、15分毎）。レポート系 cron の死活検知として機能 |
| MON-022 | cron 認証失敗の検知 | health-alert など | 設定漏れが分かる | 不合格 | CRON_SECRET 不一致は 401 を返すのみで通知なし。Vercel の cron 失敗は管理画面でしか見えない |
| MON-023 | persona-purge cron の通知多発 | vercel.json と report.md | 15分毎の無害通知が出ない | 不合格 | `*/15` で実行し、report.md では同一指紋の通知が少なくとも 2026-09-23〜24 に15分刻みで反復。HTTP 200 のまま。調査の最終状態は「原因未特定」 |
| MON-024 | 運用者が気づける経路の一覧 | コード調査の総括 | 主要4事象に経路がある | 不合格 | ログイン失敗＝経路あり（汎用）、webhook 失敗＝経路あり（汎用＋専用 cron）、cron 失敗＝一部のみ（MON-020/022）、Gemini 404＝ほぼ無し（MON-017）。いずれも原因情報は薄い（MON-008） |
| MON-025 | ヘイシャ向け通知の分離 | heisha-runtime-alert.ts | 環境変数不備で他へ誤送信しない | 合格 | 専用 HEISHA_SLACK_ERROR_WEBHOOK_URL が無い場合は送信せず `destination missing` をログに残す。10分重複抑止はインスタンス内メモリ |
| MON-026 | Slack ペイロードに個人情報・本文が混入しない | runtime-alert.ts / alert.ts | 固定語彙・エスケープ | 合格 | 診断は固定分類・長さ帯のみ。alert.ts は `slackEscape` と各項目の切り詰めあり。ただしそのため原因は追いにくい（MON-008 とトレードオフ） |

### 不合格・要対応

総括: S級（全体停止・ログイン不能級）は見つからなかった。A級（サービス停止・重要画面が使えない）も確認できていない。実害に近いのは「障害が起きても原因が追えない／気づけない」監視上の欠落（MON 系）。重大度は影響で判断した。

| ID | 重大度 | 現象 | 該当箇所 | 修正案 | worktree で安全に直せるか |
|---|---|---|---|---|---|
| MON-008 / MON-009 / MON-010 | B（運用上の最優先） | console.error 871箇所中765箇所が固定文字列のみで error を渡さない。通知は汎用文面と照合IDだけで、2026-09-23 から続く persona-purge 周辺の通知が原因未特定のまま | `src/**`（例 `src/app/error.tsx`、`src/lib/persona/image-generation.ts:87`）、`src/lib/runtime-alert.ts`、`docs/incidents/2026-09-23-200846/report.md` | 秘匿方針は維持しつつ `err.name` と固定語彙のエラー系統（Prisma コード、HTTP ステータス等）を第2引数で渡す共通ヘルパーを作り、呼び出し側を段階的に置換。persona-purge では通知を出す console.error を特定するため、一時的に呼び出し元ラベルを必ず付与（スタックに依存しない） | はい（コードのみの変更で、ビルドと既存の security-regression で検証可能）。ただし本番の原因確認にはデプロイ後のログ待ちが必要 |
| MON-006 | B | 未解析スタックの通知が全て同じ枠（「サーバー処理（詳細はログ）」）を共有し、無関係な本物のエラーを最大10分抑止し得る | `src/lib/runtime-alert.ts` の `safeRuntimeSource` / `budgetKey` | 未解析時は枠の鍵に family・firstArgKind・長さ帯を加える（鍵数は固定語彙の組合せで有限に保つ） | はい（ロジック変更のみ。既存のオフライン回帰テストに追加すること） |
| MON-017 / MON-016 | B | Gemini のモデル廃止（404）は warn のみで無音。/api/health は DB しか見ない。CLAUDE.md が最大の事故例として警告している事象に検知がない | `src/lib/gemini-text.ts:123,140`、`src/app/api/health/route.ts` | 404/403 を検知したら `notifyAlert`（level: critical、DB共有上限付き）を送る。あわせて日次 cron で使用中モデルIDに1トークン生成を試す | はい（実装のみ）。ただし生存確認 cron は課金API（Gemini）を呼ぶため、頻度と上限を決めたうえで承認を得て実装すること。実行は本番デプロイ後 |
| MON-020 / MON-022 | B | 保持期限削除 cron（seo-image-purge・interview-storage-purge）の失敗と CRON_SECRET 不一致が通知されない | `src/app/api/cron/seo-image-purge/route.ts`、`interview-storage-purge/route.ts`、`health-alert/route.ts` | catch 内で `notifyAlert`（DB共有上限付き）を呼ぶ。認証 401 は連続時のみ通知 | はい |
| MON-003 / MON-015 | B | 通知経路が Slack 1系統。第三者の外形監視がなく、本番は非ブラウザに 403 チャレンジを返す | `src/lib/alert.ts`、Vercel Firewall 設定（リポジトリ外） | Resend でのメール予備経路を追加。外形監視を導入する場合は監視元IPまたはヘッダーをチャレンジ除外する（`/api/health` のみ） | 一部（メール経路はコードで可）。Vercel Firewall 設定は worktree 外のため、運用者操作が必要 |
| PUB-001 | B | curl 既定UAの全30URLが 403 チャレンジ。Stripe webhook、リンクプレビュー、外形監視への影響は未検証 | Vercel の Attack Challenge Mode / Bot Protection 設定（リポジトリ外） | 設定を確認し、`/api/stripe/webhook`・`/api/health`・OGP画像・Googlebot 等の検証済みBotが除外されていることを確認 | いいえ（Vercel ダッシュボードの設定で、worktree では変更できない） |
| MON-004 | C | `notifyAlert` の重複抑止がインスタンス内メモリのため、health-alert の継続障害通知が重複し得る | `src/lib/alert.ts:36-44` | `claimRuntimeAlert` と同様に SystemSetting で共有枠を取得。DEV-STATUS 2-6 の方針（時刻で絞る）に合わせる | はい |
| MON-011 | C | ブラウザエラー報告が種別ごとに全利用者共通で10分1件、内容（URL・メッセージ）なし | `src/lib/operational-error-limit.ts`、`src/components/RuntimeErrorReporter.tsx` | 画面パス（クエリ除去）と固定語彙のエラー系統を送り、パス別に枠を分ける | はい |
| FE-011 | B | doyaslide・kintai・kintai/dashboard・promane の error.tsx が運用者へ報告せず、これらサービスの描画エラーは通知されない | 各 `error.tsx` | `useEffect` で `reportBrowserError('render')` を呼ぶ | はい |
| FE-003 | C | global-error.tsx がなく、ルートレイアウト例外時は英語の既定画面 | `src/app/` | 日本語の最小実装（html/body を含む）を追加。絵文字禁止・`reportBrowserError('render')` を呼ぶ | はい |
| FE-022 | B | seo/jobs/[id] で 401/403/404 のとき `job` が null のまま4秒周期の取得が永久に続く | `src/app/seo/jobs/[id]/page.tsx:402-405` | `job===null` かつ直前が 401/403/404 のとき停止、あるいは指数バックオフと上限回数を設ける | はい |
| FE-016 | B | mensetsu/templates/[id] が try/finally のみで、通信失敗時にエラー表示がなく空フォームが出る | `src/app/mensetsu/templates/[id]/page.tsx:66-94` | `catch` を追加して `notifyError` を呼び、保存ボタンを無効化 | はい |
| FE-046 | B | `toast.error(e.message)` 等が111箇所あり、通信失敗時に英語の「Failed to fetch」「Load failed」が表示される | hr/one-on-one、hr/settings、hr/employees ほか | 共通の `toUserMessage(e, fallback)` を作り、TypeError は「通信に失敗しました。接続を確認してもう一度お試しください。」へ変換 | はい |
| FE-010 / FE-052 | B | promane/error.tsx が敬語でなく、絵文字3種と `error.message` の生表示がある | `src/app/promane/error.tsx` | 敬語に直し、絵文字を lucide アイコンに置換、`詳細` は digest のみ表示 | はい |
| FE-006 / FE-007 / FE-009 / FE-050 / FE-051 | C | UI 絵文字が386文字（現役側約259、提供終了サービス側約88）。グローバル規約違反 | doyaslide/error.tsx、doyaslide/not-found.tsx、kintai/dashboard/error.tsx、promane（126）、admin（30）、banner（18）ほか | エラー画面から先に lucide / icons.tsx へ置換。提供終了サービス配下は到達不能のため対象外 | はい（機械置換はせず、画面ごとに差し替え） |
| FE-005 | C | not-found と DashboardLayout の既定が提供終了サービス（kantan）を指す | `src/app/not-found.tsx`、`src/components/DashboardLayout.tsx:133` | 現役サービス（/seo など）に差し替え | はい |
| FE-043 / FE-044 | C | HR・勤怠のログイン誘導が元の画面に戻らない。SEO 系の `/auth/signin` 直リンク約18箇所は callbackUrl なし | `HrLayout.tsx:221`、`KintaiLayout.tsx:159`、`SeoAppLayout.tsx:163` ほか | `callbackUrl=${encodeURIComponent(pathname)}` を付与（safeSignInCallbackUrl が検証済み） | はい |
| FE-015 | C | admin/services・admin/feedback が `res.ok` を見ずに JSON をそのまま state に入れる | `src/app/admin/services/page.tsx:33-37` | `r.ok` を検査し、失敗時はエラー表示 | はい |
| FE-035 | C | 面接後フィードバック取得が `ready` 後も20秒周期で継続 | `src/app/mensetsu/live/[token]/page.tsx:219-232` | `ready` で clearInterval、または最大回数を設定 | はい |
| PUB-051 | C | /terms の title が既定のトップ文言 | `src/app/terms/page.tsx` | `metadata.title` を追加（privacy・tokushoho と同様に「利用規約 \| ドヤAI」） | はい |
| MON-023 | B | persona-purge の通知が反復（原因未特定） | MON-008 と同じ | MON-008 の修正後に自然実行ログで確認。確認前に「解消済み」としないこと | はい（ただし本番ログの確認が必要） |

### 補足（未確認の事項）

- FE-047: API の英語エラー文言（216箇所）が画面へ露出する経路は全数確認できていない。
- PUB-004 / PUB-029 / PUB-044 / PUB-045: 本番レスポンスヘッダ（X-Robots-Tag）、popup/pricing の noindex、308 の実測値、提供終了サービス配下サブパスと API 410 は、アクセス回数と取得方法の制約で未確認。
- FE-041: cunning / sfa / shodan / promane の操作画面は、入口 page がラッパーのため個別画面の網羅確認をしていない。
- アプリ内で「現役」と判定した19サービスは services.ts の status と RETIRED / UNLISTED から導出した。`adbanner` は services.ts 上 active だが RETIRED に含まれ、本番では /adimage へ 308 リダイレクト（PUB-038）。


---

## 7. リニューアル差分（feat/ui-renewal-sample）

- 対象コミット: `03cf977f7ea92c778c429a9bede5bab0d6cc3f84`（feat/ui-renewal-sample 先頭。origin/main は `318841cb`）
- 比較: `git diff origin/main...feat/ui-renewal-sample` — 199 ファイル、30,701 行、**すべて追加（A）。既存ファイルの変更・削除は 0 件**
- 点検方法: git の読み取り（diff / show / ls-tree / cat-file）と main の正本（prisma/schema.prisma、src/lib/*、src/middleware.ts、next.config.js、vercel.json、package.json、node_modules/lucide-react の型定義）との突き合わせのみ。ビルド・tsc・本番アクセスは行っていない

### 差分の概要

| 区分 | 内容 |
|---|---|
| 新規ページ（認証あり） | `/home`（経営ホーム。`getServerSession` → 未ログインは `/auth/signin?callbackUrl=/home`）、`/home/preview`（本番では `notFound()`） |
| 新規ページ（公開・見本） | `/ui-renewal`（UI 見本。16 サービスの作業画面・エージェント見本・バナーギャラリー）、`/ui-renewal/lp`（LP 見本 4 案）。いずれも `robots: noindex` |
| 新規 API | `GET /api/home/summary`（セッション必須、読むだけ） |
| 新規ライブラリ | `src/lib/home/summary.ts`（SFA / 見積 / プロマネ / 勤怠 / HR / 契約を横断集計。読み取り専用、`Promise.allSettled`） |
| 新規共通部品 | `src/components/shell/AppShell.tsx`・`tools.ts`（サイドバー付きシェル。`getActiveServices()` から生成） |
| Prisma スキーマ | **変更なし**（`prisma/schema.prisma` は未変更。`docs/architecture/management-agent/schema-draft.prisma` は設計書内の草案で Prisma から参照されない） |
| middleware / auth / layout / next.config / vercel.json / package.json / 環境変数 | **変更なし**。新規必須環境変数なし（`process.env` 参照は `NODE_ENV` のみ） |
| 画像 | `public/ui-renewal/**`（バナーテンプレート 75 枚、マスコット 15 枚、他 2 枚） |
| ドキュメント | `docs/architecture/management-agent/**` 42 ファイル（設計書・監査・最終ゲート・日程） |

### 点検表

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| RNW-001 | 差分が追加のみで既存ファイルを触っていない | `git diff --name-status origin/main...feat/ui-renewal-sample` | M/D が 0 件 | 合格 | 199 件すべて `A` |
| RNW-002 | `/home` が未ログイン時に保護される | `src/app/home/page.tsx` を読む | `getServerSession(authOptions)` で id を確認し、無ければ redirect | 合格 | `if (!userId) redirect('/auth/signin?callbackUrl=/home')` |
| RNW-003 | `/home` の callbackUrl がサインイン画面の許可範囲に入る | `src/lib/safe-signin-callback.ts` | 同一オリジンのパスが通る | 合格 | `safeSignInCallbackUrl` は `/` 始まりの同一オリジンを許可。`signInPublicIntroUrl('/home')` は `/` を返す（お試し導線に誤誘導しない） |
| RNW-004 | リダイレクトループがない | `/auth/signin` → Google → `/home` の経路 | `/home` は signin に飛ばすだけで、signin 側は `/home` へ戻すだけ | 合格 | signin ページは callbackUrl をそのまま使う。`/home` 側に signin 済み判定の分岐はない |
| RNW-005 | `GET /api/home/summary` が認証必須 | `src/app/api/home/summary/route.ts` | 未ログインは 401 | 合格 | `session.user.id` 無しで 401、`Cache-Control: no-store` |
| RNW-006 | `/api/home/summary` が try/catch で握り、内部情報を返さない | 同上 | 500 時に汎用メッセージのみ | 合格 | `console.error` に記録し、応答は「集計に失敗しました」のみ |
| RNW-007 | `/api/home/summary` の入力検証 | 同上 | 入力を取らない or 検証する | 該当なし | GET、クエリ・body を読まない |
| RNW-008 | `/api/home/summary` と `/home` の maxDuration | `vercel.json`・route.ts | 既定（Vercel 既定）で収まる設計か | 未確認 | `maxDuration` 未指定。summary.ts はプロマネで全メンバーの `timeEntries` を無制限に読む（RNW-030）。実データ量次第で既定時間を超えうる |
| RNW-009 | IDOR: 集計が本人の所属組織に限定されている | `src/lib/home/summary.ts` 各 load 関数 | すべての組織 ID が `userId` の membership から導出される | 合格 | SFA / 見積 / プロマネ / 勤怠 / HR とも `findFirst({ where: { userId, ... } })` から `organizationId` / `workspaceId` を取り、クエリは必ずその ID で絞る。外部入力の ID を使う箇所がない |
| RNW-010 | 権限ロール判定が各ツールの正本と一致 | `ROLE_HIERARCHY`（sfa/types.ts, hr/constants.ts）、kintai/types.ts | 存在するロール名のみ | 合格 | SFA/HR は `Object.keys(ROLE_HIERARCHY)`、勤怠は `system_admin`/`hr_admin`（`KintaiMemberRole` に存在） |
| RNW-011 | 勤怠の全社集計が管理者だけに出る | `loadAttendance` | 一般社員は自分の分だけ | 合格 | `isAdmin` でなければ `employeeId: 自分` に限定し `scope: 'self'` |
| RNW-012 | 管理者専用機能の追加 | 差分全体を grep | 管理者 API/画面の追加があればガードあり | 該当なし | admin 系の追加なし |
| RNW-013 | DB への書き込みがない（組織の自動作成を含む） | summary.ts の prisma 呼び出しを列挙 | find/count/aggregate のみ | 合格 | `findUnique/findFirst/findMany/count/aggregate` のみ。`getOrCreateOrganization` 等を呼ばない |
| RNW-014 | schema.prisma の変更 | `git diff --name-only ... -- prisma/` | 変更なし、または本番 db push 手順が明記 | 合格 | 変更なし。本番 db push は不要 |
| RNW-015 | 参照する Prisma モデル・列が main のスキーマに存在する | スクリプトで 18 モデル・97 列を schema.prisma と照合 | 全列存在 | 合格 | `User.stripeCurrentPeriodEnd`、`SfaDeal.wonAt/probability/stageId`、`SfaStage.isWon/isLost/color`、`QuoteDocument.totalExclTax/expiryDate/confirmedAt`、`PromaneTimeEntry.hourlyRateSnapshot/projectId`、`KintaiAttendance.workMinutes/overtimeMinutes` 等すべて存在 |
| RNW-016 | BigInt 列（`SfaDeal.amount`）の JSON 化 | `toNum` の実装・HomeSummary の型 | number に変換してから返す | 合格 | `toNum` が bigint→Number。HomeSummary に bigint 無し |
| RNW-017 | 参照するライブラリ関数が main に存在し、引数型が合う | `jstStartOfMonthUtc`, `tierFrom`, `planLabel`, `isPaidTier`, `laborCostForEntry`, `timeEntryBelongsToProject` | 全て export され、select した列が型に足りる | 合格 | `CostEntry = { duration; hourlyRateSnapshot? }`、`timeEntryBelongsToProject({ projectId?, taskId }, ...)` に対し select は `duration, hourlyRateSnapshot, projectId, taskId` |
| RNW-018 | `services.ts` の export を正しく使っている | `getActiveServices`, `UNLISTED_SERVICE_IDS`, `getServiceById`, `Service.shortName/href` | すべて存在 | 合格 | services.ts 1683 / 1727 / 1742 行、`shortName?: string` |
| RNW-019 | ナビから提供終了サービスが外れている | `tools.ts`・`RETIRED_SERVICE_IDS` | lp/copy/movie 等が出ない | 合格 | `getActiveServices()` が RETIRED を除外。先頭コミット 03cf977f で手書き一覧を廃止 |
| RNW-020 | ナビが既存ルートの変更を伴わない | AppShell の利用箇所 | `/home` 配下だけで使われる | 合格 | AppShell の import は `src/app/home/page.tsx` と `home/preview/page.tsx` のみ。既存レイアウト・`src/app/layout.tsx` は未変更 |
| RNW-021 | リンク先ルートが main に存在する（ホーム・エージェント） | `git ls-tree origin/main` で page.tsx を確認 | 全リンク先が存在 | 合格 | `/sfa/[orgSlug]/{deals,tasks}`、`/quote/documents/[id]`、`/promane/[workspaceSlug]/{projects,projects/[projectId],reports}`、`/kintai/{dashboard,approvals}`、`/hr/dashboard`、`/mensetsu`、`/aio`、`/banner`、`/pricing`、`/api/stripe/portal` 存在 |
| RNW-022 | 提供終了サービスへの導線が残っていないか | `agent.ts` の actions | 提供終了 ID へのリンクなし | 不合格 | 「集客を強化したい」の回答に `{ label: 'LPを作る', href: '/lp' }`。`lp` は `RETIRED_SERVICE_IDS`、next.config.js で `/lp → /` に 308。文言「バナー・コピーで広告」も提供終了の copy を指す |
| RNW-023 | Stripe ポータルへの戻り先 | `/api/stripe/portal?returnTo=/home` と `safeReturnPath` | 同一オリジンのパスが通る | 合格 | GET ハンドラあり、`/home` は許可形式 |
| RNW-024 | 課金: 生成を `plan-limit.ts` / `User.plan` を経由せずに許していないか | 差分で生成 API・AI 呼び出しを grep | 生成を行う箇所がない、または上限チェックあり | 該当なし | 差分に AI 生成・外部 API 呼び出しは 0 件。`/ui-renewal` の「生成」は setTimeout による見本演出のみ（agentScenarios.ts 冒頭に明記） |
| RNW-025 | 契約表示が正本（`plan-utils`）と一致 | `loadContract` | `tierFrom(User.plan)` を使い、Subscription は表示のみ | 合格 | 変更系の呼び出しなし |
| RNW-026 | 外部 AI のモデル ID（廃止モデルの使用） | `gemini-|gpt-|claude-|imagen|dall-e` を grep | 0 件、または現行モデル | 該当なし | 0 件 |
| RNW-027 | 画像生成の quality/size 未指定 | 差分を grep | 画像生成なし | 該当なし | 画像生成の呼び出しなし |
| RNW-028 | 新規の必須環境変数 | `process.env` を grep | 追加なし、または `.env.example` に追記 | 合格 | `NODE_ENV` のみ |
| RNW-029 | 新規 npm 依存 | 差分の外部 import を列挙 | 全て package.json に存在 | 合格 | `framer-motion ^10.17.0`、`lucide-react ^0.303.0`、`next-auth`、`next`、`react` のみ |
| RNW-030 | summary.ts の取得量上限 | 各 findMany の `take` | 無制限読み込みがない | 不合格 | `prisma.promaneMember.findMany({ ... timeEntries: { select: ... } })` に `take` が無く、ワークスペース全員の全工数行をメモリに載せる。`promaneProject.findMany` も `expenses`/`tasks` を全件 include（take 500 は案件側のみ）。長期利用ワークスペースで `/home` 初回描画と `/api/home/summary` が遅延・タイムアウトしうる |
| RNW-031 | 1 ツールの失敗がホーム全体を落とさない | `getHomeSummary` | 個別に握る | 合格 | `Promise.allSettled` + `settle()` で `state: 'error'` に変換。契約取得失敗時も FREE 表示で続行 |
| RNW-032 | `/home` のサーバー描画で 500 になりうる経路 | page.tsx | 集計失敗時のフォールバック | 合格 | `getHomeSummary` 内部で全て握るため、Prisma 接続不能以外では throw しない（接続不能は既存ページも同条件） |
| RNW-033 | `/home/preview` が本番で露出しない | `home/preview/page.tsx` | 本番 404 | 合格 | `NODE_ENV === 'production'` で `notFound()`。サンプル数値のみで DB・認証は使わない |
| RNW-034 | `/ui-renewal`・`/ui-renewal/lp` が実データ・認証に触れない | `RenewalApp.tsx` 等の import | prisma / fetch / session を使わない | 合格 | `fetch(` は HomeDashboard の 1 箇所（`/api/home/summary`）のみ。ui-renewal 配下に fetch・prisma・useSession なし |
| RNW-035 | 公開見本ページの検索露出 | metadata | noindex | 合格 | `/ui-renewal`、`/ui-renewal/lp`、`/home` とも `robots: { index: false, follow: false }`。sitemap.ts に含めていない |
| RNW-036 | 公開見本ページが本番で公開されること自体の妥当性 | ルート構成 | 意図した公開か | 未確認 | `/ui-renewal` は認証なしで誰でも閲覧でき、`public/ui-renewal/banner-templates` 75 枚（本番テンプレート由来）も公開配信される。社外公開前の見本として意図通りか要判断（C） |
| RNW-037 | middleware への影響 | `src/middleware.ts` | 変更なし、`/home` `/ui-renewal` がホスト振り分けに巻き込まれない | 合格 | 未変更。`MITSUBOSHI_HOSTS`/`SLIDE_HOSTS` 設定時のみ別ホストで動作し、主ドメインには影響なし |
| RNW-038 | next.config.js の redirects と新ルートの衝突 | `redirects()` を grep | `/home` `/ui-renewal` への redirect なし | 合格 | 該当なし |
| RNW-039 | 既存の `SessionProvider` / Providers に変更 | `src/components/Providers.tsx`, `src/app/layout.tsx` | 未変更 | 合格 | 差分なし |
| RNW-040 | 絵文字の使用（UI） | 差分の追加行を Unicode 範囲で grep | UI 文字列に絵文字なし | 合格 | 検出 14 行はすべてコード内コメントの `⚠️`（既存コードの慣習と同じ）。JSX 文字列・placeholder に絵文字なし |
| RNW-041 | 日本語・敬語（ユーザー向け文言） | HomeDashboard / agent.ts / API メッセージ | 日本語で丁寧な表現 | 合格 | 「ログインが必要です」「最新の数字を取得できませんでした。時間をおいて再度お試しください。」等 |
| RNW-042 | 見本ページの英語 UI 文言 | JSX テキストを grep | 英語の UI 文言なし | 未確認 | `/ui-renewal` に装飾ラベル `WORKSPACE` `WORK MAP` `HOW IT CONNECTS` `AI WORKSPACE` `Doya AI Workflow`。見本（デザイン案）としての演出だが、ADDON-SERVICES §11「英語の UI 文言」禁止に抵触しうる（既存指摘あり: 設計書側の禁止事項、C） |
| RNW-043 | 読込・空・エラー表示（ホーム） | HomeDashboard | 3 状態がある | 合格 | 再読込中は `RefreshCw` 回転 + disabled、失敗時は `role="alert"` の文言、各カードは `EmptyCard` で空状態と導線を表示 |
| RNW-044 | 無限ローディングがない | HomeDashboard の `refresh` | finally で loading を戻す | 合格 | `finally { setLoading(false) }` |
| RNW-045 | エージェント演出のタイマー後始末 | AgentPanel | unmount で clearTimeout | 合格 | `useEffect(() => clear, [])` と各 effect の cleanup |
| RNW-046 | サーバー描画とクライアントの不一致（hydration） | HomeDashboard 343〜348 行 | タイムゾーン依存の文字列をサーバー描画しない | 不合格 | `new Date().getHours()` による挨拶、`toLocaleTimeString('ja-JP')` の「HH:MM 時点」、`toLocaleDateString('ja-JP')` の更新日を、サーバー（Vercel は UTC、TZ 未設定）とブラウザ（JST）で別の値に描く。React 18 は hydration エラーとして記録しクライアント側で再描画するため致命ではないが、本番 console にエラーが出続け、Sentry 等のノイズになる |
| RNW-047 | 型: Prisma の select と後続コードの参照の整合 | summary.ts を目視 | 選択していない列を参照しない | 合格 | `d.wonAt!` は `status: 'won'` の where で保証、`q.expiryDate` は非 null 列、`membership.employee` は null チェック後に使用 |
| RNW-048 | 型: `tools.ts` の `ShellTool.beta` の値 | `UNLISTED_SERVICE_IDS.has(s.id) \|\| undefined` | boolean \| undefined | 合格 | 型と一致 |
| RNW-049 | 型: lucide-react アイコン名がインストール版に存在 | 差分の 88 アイコン名を `node_modules/lucide-react/dist/lucide-react.d.ts` と照合 | 欠落 0 | 合格 | `CircleUser`、`MousePointerClick`、`StopCircle` 等すべて 0.303.0 に存在 |
| RNW-050 | 型: `HomeSummary` と `sample()`（preview）の形が一致 | preview/page.tsx | 必須プロパティを全て埋める | 合格 | sales/quotes/projects/attendance/people/trend/events/contract/user を網羅 |
| RNW-051 | クライアント部品が server-only モジュールを引き込まない | `'use client'` の AppShell/HomeDashboard → `tools.ts` → `services.ts` | services.ts が prisma 等を import しない | 合格 | services.ts の import は `./unified-plan` のみ |
| RNW-052 | AppShell の現在位置判定 | `isActive` | `/hr/dashboard` と `/hr/...` が同一扱い | 合格 | 先頭 2 セグメントで比較 |
| RNW-053 | スマホ引き出しの閉じ忘れ | AppShell | リンク遷移・Esc・scrim で閉じる | 合格 | `onNavigate={close}`、keydown Escape、scrim onClick |
| RNW-054 | 画像参照の実在 | 差分内の `/renewal/*` `/ui-renewal/*` 参照 15 件を `git cat-file -e` | 全て存在 | 合格 | `public/renewal/bear-hero.webp` は main に既存、残りは本ブランチで追加 |
| RNW-055 | 新規 API の `dynamic`/キャッシュ | route.ts, page.tsx | 個人データが CDN にキャッシュされない | 合格 | `force-dynamic` + `Cache-Control: private, no-store` |
| RNW-056 | SmartLink が `/api/` へ `<a>` で遷移する | HomeDashboard | Stripe ポータル等の API リダイレクトを Next Link でプリフェッチしない | 合格 | `/api/` 始まりは通常の `<a>` |
| RNW-057 | 見積の月次集計の対象ステータス | `loadQuotes` | 「確定」の定義がツール側と一致 | 未確認 | `status in ['confirmed','sent']` かつ `confirmedAt >= trendStart`。`sent` を確定額に含める扱いが見積ツールの定義と一致するかは業務判断（B 以下） |
| RNW-058 | 勤怠の残業警告の閾値 | agent.ts 149 行 | 固定値の妥当性 | 未確認 | 月 30 時間 × 人数で `warn`。表示上の目安のみで課金・権限に影響しない |
| RNW-059 | カレンダーの期日範囲 | `getHomeSummary` | 過去 7 日〜先 45 日・最大 40 件 | 合格 | 件数上限あり |
| RNW-060 | 本番 Vercel 関数設定の追加要否 | vercel.json | 新規 route に特別な memory/maxDuration が必要か | 未確認 | 現状は既定値。RNW-030 の改善後に判断 |
| RNW-061 | ドキュメントのみの差分（42 ファイル）がビルドに影響しない | パス | `docs/` 配下のみ | 合格 | `tsconfig` の include 対象外。`schema-draft.prisma` も `prisma/schema.prisma` 指定により無視 |
| RNW-062 | 設計書側の既存指摘との重複 | AUDIT / REVIEW-* / FINAL-GATE-8 を grep | 本差分の実装（summary.ts / AppShell / HomeDashboard）への言及 | 該当なし | 設計書側は将来の共通テナント・エージェント基盤の設計レビューで、現行差分の実装コードには言及なし。ADDON-SERVICES §11 の UI 基準（RNW-042）のみ関連 |

### 不合格・要対応

| ID | 重大度 | 現象 | 該当箇所 | 修正案 | main 統合前に必要か |
|---|---|---|---|---|---|
| RNW-030 | A | プロマネ集計がワークスペース全員の全 `timeEntries` と全案件の `expenses`/`tasks` を無制限に読み込む。長期・多人数のワークスペースで `/home` の初回描画と `/api/home/summary` が遅延し、Vercel 関数の既定時間を超えると `/home` がエラー画面になる（他ツールには影響しない） | `src/lib/home/summary.ts` `loadProjects`（276〜325 行） | (1) `timeEntries` に `where: { projectId: { in: activeProjectIds } }` か期間条件（直近 6 か月）を付ける。(2) 可能なら `groupBy`/`aggregate` で DB 側集計に置き換える。(3) 当面は `take` を付け、`route.ts` と `page.tsx` に `export const maxDuration = 30` を明示する | 必要（既存ユーザーの実データ量で `/home` が開けない可能性があるため、統合前に上限か集計方式を入れる） |
| RNW-046 | B | 挨拶（`getHours()`）、更新時刻（`toLocaleTimeString`）、更新日（`toLocaleDateString`）がサーバー（UTC）とブラウザ（JST）で異なる文字列になり、React の hydration エラーが本番で毎回発生する。表示は再描画で直るが console/監視にエラーが積まれる | `src/app/home/HomeDashboard.tsx` 343〜348 行、`src/app/home/agent.ts` 58・120・205 行（クリック後の描画なので影響は小） | 時刻依存の文字列は `useEffect` 後にクライアントで算出する（初期値は空か `suppressHydrationWarning`）、または `jstDateKey` と同様に JST 固定で整形する関数を使う。`generatedAt` の整形は `timeZone: 'Asia/Tokyo'` を明示 | 推奨（統合前が望ましい。機能は動く） |
| RNW-022 | B | エージェントの「集客を強化したい」回答に提供終了サービス `lp` へのリンク（`/lp` は `/` へ 308）と「コピー」への言及が残る。利用者がボタンを押すとトップページへ飛ぶ | `src/app/home/agent.ts` 173〜192 行 | `/lp` のアクションを削除し、受け皿は `seo`（記事作成）・`asklink`（質問リンク）等の現行サービスに置き換える。文言「バナー・コピーで広告」を「バナー・広告画像で広告」に修正 | 必要（提供終了導線を新画面に出さない） |
| RNW-036 | C | `/ui-renewal` と `/ui-renewal/lp`、および `public/ui-renewal/banner-templates` 75 枚が認証なしで本番公開される（noindex はあるが URL を知れば閲覧可能） | `src/app/ui-renewal/**`, `public/ui-renewal/**` | 統合時に見本ページを `NODE_ENV === 'production'` で `notFound()` にするか、`/home/preview` と同じ扱いにする。見本を社外に見せる意図があればそのまま | 要判断（公開方針が決まっていれば不要） |
| RNW-042 | C | 見本ページに英語の装飾ラベル（`WORKSPACE`、`WORK MAP`、`HOW IT CONNECTS`、`AI WORKSPACE`）。設計書 ADDON-SERVICES §11 の「英語の UI 文言」禁止に抵触しうる（既存指摘あり） | `src/app/ui-renewal/HomeScreen.tsx`, `MapScreen.tsx`, `RenewalApp.tsx`, `lp/LpSample.tsx` | 本実装に移す際に日本語ラベルへ置き換える。見本のままなら対応不要 | 不要（見本のため） |

補足（合格だが統合時に意識する点）
- `tools.ts` は `getActiveServices()` から生成するため、別ブランチの新ツール（popup / shanai / tenjikai / income / expense）が `services.ts` に入ると自動で「その他」またはマッピング済み区分に出る。`TOOL_META` には既にこれら 5 件の対応が書かれており、`services.ts` 側の id が一致すれば追加作業は不要。
- `/home` は `redirect('/auth/signin?callbackUrl=/home')` のみでログイン後の既定遷移先は変更していない。ログイン直後に `/home` を起点にするなら signin / NextAuth の `redirect` コールバックの変更が別途必要（本差分には含まれない）。


---

