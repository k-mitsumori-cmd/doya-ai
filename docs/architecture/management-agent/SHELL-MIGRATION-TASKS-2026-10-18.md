# 既存ツールを新しい枠に載せ替える作業指示（クラウドのセッション用、2026-10-18）

- 作成: 統括セッション
- 前提のブランチ: `feat/shell-shared-layout`（共通の枠を `src/app/(shell)/layout.tsx` に1つだけ置いたもの。最新の main を取り込んだ先頭は、統括がメインに知らせる）
- 共通の手順: 前提のブランチの `docs/architecture/management-agent/SHELL-MIGRATION.md`。各セッションは、まずこれを読み、2章の手順（2.1〜2.6）に従う
- 調査の時点: origin/main 93e418f1（下の各節の行番号や部品名は、この時点のもの）

この文書は、クラウドのセッション 12 本に渡す作業指示の元。各セッションは、この会話も統括も見られない。指示だけで作業できるよう、1 セッション分を 1 節にまとめる。

---

## 0. 全セッション共通の決まり

- リポジトリは `k-mitsumori-cmd/doya-ai`。前提のブランチから、自分のブランチ `feat/shell-<名前>` を切る。終わったら、そのブランチを push して終わる。main には push しない（main への push は本番のデプロイになる）。PR は作らない。
- 手順は SHELL-MIGRATION.md の 2.1〜2.6 のとおり。担当のツールについて、次を行う。
  - `git mv src/app/<id> "src/app/(shell)/<id>"`（消して作り直さない）。`@/app/<id>/...` の import と、`scripts/`・単体テストの中の `src/app/<id>/` のパスの文字列を直す。テストの確認の中身と件数は変えない
  - `src/components/shell/registry.ts` の `SHELL_SERVICES` に、自分のツールの 1 行だけを足す（並べ替えや整形はしない）
  - `src/lib/<id>/nav.ts` を作る。`icon` は名前の文字列。今のサイドバーの項目・並び・リンク先・表示の条件をそのまま移し、今のサイドバーもこの配列を描くだけにする
  - layout は「未ログイン → 今のまま」「`isShellEnabled('<id>')` → `<Tool>ShellFrame`（ToolFrame だけ。AppShell で包まない）」「それ以外 → 今のレイアウト」の 3 通りにする
  - 組織の切り替えがあるツールは、今の切り替えの部品を `ToolFrame` の `switcher` にそのまま渡す。切り替えの中身（localStorage・`?org=`・slug・ヘッダー）は変えない
- ページ本体（`page.tsx` の中身と、そこから呼ぶ部品）・API・`prisma/schema.prisma`・`src/lib/services.ts` は変えない。
- アイコンが `src/components/shell/icons.tsx` の対応表に無いときは、対応表に 1 行足してよい（自分の使う名前だけ。並べ替えはしない）。
- 枠を出さない画面: ログインしていないときの紹介ページ（LP）、料金ページの未ログイン表示、招待・共有・ゲストの画面。第三者が開く画面は `src/lib/ui/guest-path.ts` に足し、ツール内の公開の画面は registry の `inShell` で外す。
- 今のサイドバーにある `ToolSwitcherMenu`（ツールの切り替え）は、枠が有効なときは出さない。枠の左のメニューが同じ役目をするため。
- UI の文言は日本語。絵文字をアイコンに使わない。文章は、主語と述語を対応させ、比喩を使わず、1 文 30〜45 文字を目安に書く。
- 完成の条件（全部満たす）:
  1. `npx tsc --noEmit` と `npm run build` が通る（セキュリティ回帰テストを含む）
  2. 下の各節に書いた verify スクリプトが通る
  3. `UI_SHELL_SERVICES=<id>` で `next start` し、SHELL-MIGRATION.md 2.6 の表をすべて確かめる（ログイン後の画面は、ログインできる手元の環境があれば見る。無ければ、確かめられなかったと書く。本番の DB と本番のアカウントは使わない）
  4. `UI_SHELL_SERVICES` を空にして、今と同じ画面であること
  5. 最後のコミットの本文に、確かめたことと、確かめられなかったことを書く
- 画像が要るとき（空状態のイラストなど）は、従量課金の画像 API を使わない。要る画像の一覧をコミットの本文に書くだけにする。

---

## 1. ユーザー単位のツール（3 セッション）

組織の切り替えが無いので、外枠とナビの差し替えだけ。

### 1-A. ブランチ `shell/user-1`: doyalist・doyaslide・adimage

| ツール | 今の外枠 | 今のナビ | 未ログインの扱い | 守る verify |
|---|---|---|---|---|
| doyalist | `src/components/doyalist/DoyalistLayout.tsx`（クライアント、ナビは中に直書き） | 7 項目。アイコンは Material Symbols の文字列（auto_awesome など）なので、lucide の名前に置き換える | サーバーの layout がセッションを見て、未ログインは children だけ | `verify-doyalist-layout-mounted.cjs`、`verify-doyalist-layout-plan.cjs` |
| doyaslide | `src/components/doyaslide/DoyaSlideLayout.tsx` ＋ `DoyaSlideSidebar.tsx` | 新規作成・プロジェクト・料金プラン | サーバーの layout はセッションを見ない。クライアントで `pathname === '/doyaslide'` のときだけ LP。この判定を変えずに、枠で包むかどうかをサーバー側で決める | `verify-slide-cunning-layout-mounted.cjs`、`verify-service-plan-fallback.cjs` |
| adimage | `src/components/adimage/AdImageAppLayout.tsx` ＋ `AdImageSidebar.tsx` | 3 項目 | サーバーのセッション ＋ `isGuestPath` | 無し（足すとよい） |

### 1-B. ブランチ `shell/user-2`: asklink・banner・seo

| ツール | 今の外枠 | 今のナビ | 未ログインの扱い | 守る verify |
|---|---|---|---|---|
| asklink | `src/components/asklink/AskLinkAppLayout.tsx` ＋ `AskLinkSidebar.tsx` | 3 項目 | サーバーのセッション ＋ `isGuestPath` | 無し |
| banner | 外枠もサイドバーも無い（layout は LpJsonLd と PlanUpdatedListener だけ）。作業画面は `/banner/dashboard/*` | ナビは新しく作る: つくる（`/banner/dashboard/create`）・履歴（`/banner/dashboard/history`）・ブランド（`/banner/dashboard/brand`）・プラン（`/banner/dashboard/plan`）・設定（`/banner/dashboard/settings`）。`gallery-test` と `stats` は出さない | `/banner`・`/banner/landing`・`/banner/guide`・`/banner/pricing` は枠を出さない。枠は `/banner/dashboard/**` だけ | 無し |
| seo | `src/components/SeoAppLayout.tsx`（中の Sidebar 関数が `SeoSidebar.tsx` を使う） | 4 項目。料金プランは、ログイン後は `/seo/dashboard/plan` | サーバーのセッションで `currentPlan`・`isLoggedIn`・`firstLoginAt` を渡している。枠でも同じ値を使えるようにする | `verify-seo-sidebar-mounted.cjs`。`src/app/seo/template/layout.tsx` は、親の余白を負の margin で打ち消しているので、枠の余白に合わせて直す |

### 1-C. ブランチ `shell/user-3`: cunning・interview・persona

| ツール | 今の外枠 | 今のナビ | 未ログインの扱い | 守る verify |
|---|---|---|---|---|
| cunning | `src/components/cunning/CunningLayoutShell.tsx` ＋ `CunningSidebar.tsx` | 5 項目 | サーバーのセッション。`/cunning/live/[sessionId]` が公開かどうかを、まず確かめる。公開なら枠を出さない | `verify-slide-cunning-layout-mounted.cjs`、`verify-service-plan-fallback.cjs` |
| interview | `src/components/interview/InterviewLayout.tsx` ＋ `InterviewSidebar.tsx` | 5 項目 | サーバーの layout が、セッションとゲストの Cookie（`doyaInterview.guestId`）を見て、全体を `InterviewGuestClaimGate` で包む。ゲスト（未ログイン）には枠を出さない。Google Fonts と `.interview-root` の style はそのまま残す | `verify-interview-usage-mounted.cjs` |
| persona | `src/components/PersonaAppLayout.tsx` ＋ `PersonaSidebar.tsx` | 2 項目 | サーバーのセッション | `verify-persona-plan-cta.cjs` |

---

## 2. 組織単位のツール（9 セッション。組織の切り替えを枠にまとめる）

組織の切り替えは、SHELL-MIGRATION.md の 2.5 に従い、今の切り替えの部品を ToolFrame の switcher に渡す。今の切り替えの仕組み（URL・保存場所・ヘッダー）は変えない。API の側は変えないので、送るヘッダーとクエリは今と同じにする。

| ブランチ | ツール | 今の外枠と組織の切り替え | 気をつけること | 守る verify |
|---|---|---|---|---|
| `shell/quote` | quote | `QuoteAppLayout.tsx` ＋ `QuoteSidebar.tsx`。`OrgSwitcher`（localStorage `doya.quote.org`、`?org=`、ヘッダー `x-quote-org`）は `src/app/quote/Tool.tsx` にある | `/quote/invite/[token]` は枠を出さない | `verify-quote-sidebar-mounted`、`verify-quote-settings-mounted`、`verify-org-members-mounted`、`verify-org-selection`、`verify-quote-document-mounted`、`verify-quote-workspace-mounted` |
| `shell/shodan` | shodan | 枠は `src/app/shodan/[orgSlug]/layout.tsx`（サーバー、`getShodanContext`、組織が無ければ `/shodan` へ）。`ShodanAppLayout` ＋ `ShodanSidebar.tsx`。組織は URL の slug | `/shodan/invite`・`/shodan/pricing` は枠の外。`/shodan/[orgSlug]/p` が公開かを確かめる | `verify-shodan-list-mounted`、`verify-shodan-detail-mounted`、`verify-shodan-slide-editor-mounted`、`verify-org-team-members-mounted` |
| `shell/aio` | aio | shodan と同じ形（`src/app/aio/[orgSlug]/layout.tsx`、`getAioContext`、slug は `decodeURIComponent`） | 料金プランのリンクは `/aio/pricing?org=<slug>` のまま | `verify-aio-prompts-mounted`、`verify-aio-plan-cta`、`verify-org-team-members-mounted` |
| `shell/aishodan` | aishodan | `AishodanAppLayout.tsx` ＋ `AishodanSidebar.tsx`。`OrgSwitcher` は `Tool.tsx`・`sessions`・`scenarios`・`preview` の各ページにある（ヘッダー `x-aishodan-org`） | `/aishodan/invite` は枠を出さない。ページの中の `OrgSwitcher` は、枠の組織の切り替えと二重にならないようにする | 無し（足すとよい） |
| `shell/mensetsu` | mensetsu | `MensetsuAppLayout.tsx` ＋ `MensetsuSidebar.tsx`。組織は `?org=` とヘッダー `x-mensetsu-org` | `/mensetsu/live/[token]`（候補者が開く面接の画面）は、面接官がログインしていても枠を出さない。`/mensetsu/invite` も同じ | 無し |
| `shell/sfa` | sfa | 枠は `src/app/sfa/[orgSlug]/layout.tsx`（クライアント、`flex h-screen`、`SfaSidebar`、`useOrgSettingsGuard`、`/api/sfa/usage` の取得、15 秒の待ち時間の表示）。組織は URL の slug と、サイドバーの所属組織の一覧 | 15 秒の待ち時間の表示と、所属組織の一覧の機能は残す。`/sfa/invite`・`/sfa/pricing` は枠の外 | `sfa-client-fixture.cjs`（この layout を 160 行目付近で読んでいる）、`verify-service-plan-fallback.cjs` |
| `shell/promane` | promane | 枠は `src/app/promane/[workspaceSlug]/layout.tsx`（サーバー、`requirePromaneAuth`、`getWorkspaceBySlug`）。`src/components/promane/sidebar.tsx` のアイコンは絵文字 | 絵文字を lucide の名前に置き換える（ダッシュボード→LayoutDashboard、プロジェクト→FolderKanban、取引先→Building2、メンバー→Users、工数→Timer、レポート→BarChart3、ヘルプ→Lightbulb、設定→Settings）。`FeedbackButton` と Toaster は残す。`/promane`（LP と組織の選択）・`/promane/invite`・`/promane/pricing` は枠の外 | 無し |
| `shell/hr` | hr | `HrLayout.tsx`（クライアント、`HrLayoutShell`）＋ `HrSidebar.tsx` ＋ `HrOrganizationScope.tsx`。組織は sessionStorage（`hr-selected-organization:v1:<actor>`）とヘッダー `X-HR-Selected-Organization`・`X-HR-Selected-Actor` | LP の判定は `/hr`・`/hr/pricing`・`/hr/invite/*`。`HrOrganizationScope` の fetch と `HrOnboarding` は残す。ナビは本体 5 項目と管理 3 項目の 2 段 | `verify-hr-usage-error.cjs`、`verify-organization-layout-mounted.cjs`、`verify-doyalist-layout-mounted.cjs` |
| `shell/kintai` | kintai | `KintaiLayout.tsx`（クライアント）＋ `KintaiSidebar.tsx` ＋ `KintaiAccessContext`。組織の切り替えは無い（`organizationId` を usage から取るだけ） | LP の判定は `/kintai`・`/kintai/pricing`・`/kintai/invite*`。打刻は `employeeActive` のときだけ、承認と管理の項目はロールで出し分ける。この出し分けを nav.ts の `minServiceRole` と条件で再現する。打刻の画面の操作感は変えない。HubSpot を隠す style は残す | `verify-kintai-usage-error.cjs`、`verify-organization-layout-mounted`、`verify-kintai-disabled-pages`、`verify-doyalist-layout-mounted` |

---

## 2.1 個別の注意

- `shell/user-1`（doyaslide）: 2026-10-18 に画像の保存場所を非公開にした。画像は必ず `SlideImage` か `doyaslideImageSrc` を通して `/api/doyaslide/files/...` から読む（e0fc409c）。Supabase の公開 URL を直接使わない。
- `shell/sfa`: 2026-10-18 に main に入った修正（b0397aff）を消さない。日本語の組織名が二重にエンコードされる不具合の修正で、`src/lib/sfa/client-response.ts`・`src/lib/sfa/client.ts`・`SfaSidebar.tsx`・`CrmRecordsPage.tsx` に `normalizeOrgSlug` がある。switcher に渡す所属組織の一覧のリンクも、この関数を通した slug で作る。組織名が日本語（例: スリスタ）でもダッシュボード・商談・タスクが読み込めることを確かめる。

---

## 3. 統括がそろったあとにすること

1. GitHub で、12 本のブランチが push されたかを確かめる（`git ls-remote origin 'refs/heads/feat/shell-*'`）
2. 統合ブランチに順に取り込み、`npm run build` と、全ツールを `UI_SHELL_SERVICES=all` で開いた画面の確認をする
3. 点検セッションに最終チェックを頼む
4. main への push と、`UI_SHELL_SERVICES` の変更・再デプロイを、1 回の承認依頼として統括のセッションに出す
