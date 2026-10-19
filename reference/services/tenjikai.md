# ドヤ展示会（tenjikai）

- 状態: 開発中（`services.ts` の `status: 'coming_soon'`、`UNLISTED_SERVICE_IDS`、`/tenjikai` は noindex）
- 試作: `~/Code/sandbox/doya-tenjikai`（設計書は試作の `docs/`）
- 経営エージェント化（リニューアル）への組み込み: `docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md`（ui-renewal ブランチ）

## 1. 何をするツールか

自社サービスの URL と出展条件（展示会名・会期・小間数・予算・目的）から、次をまとめて用意する。

- サイトの訴求点とブランドカラーの読み取り
- ブースのレイアウト案 3 パターン（等角図と平面図）
- 制作物（背面パネル・ロールアップ・チラシ・クリアファイル・QR カード・モニター用ループ）のコピーとサイズ
- 目的に合ったノベルティ
- 小間代・施工・印刷・ノベルティ・人件費・物流の予算
- 業者候補と、発注に使う仕様書
- 会期から逆算した締切（申込・入稿・発注・搬入）

## 2. 実装の場所

| 機能 | 場所 |
| --- | --- |
| 画面 | `/tenjikai` と `/tenjikai/<section>`（overview / booth / creatives / novelty / budget / vendors / docs）。本体の `TenjikaiApp.tsx` は `layout.tsx` に置き、URL からセクションを決める（セクションを移っても状態が残る）。`page.tsx` は URL を受けるだけ |
| 共通シェル | フラグ `UI_SHELL_SERVICES` に `tenjikai` があるとき、`TenjikaiShellFrame.tsx` が AppShell＋ToolFrame で包む（ナビは nav.ts）。無いときは暫定の TenjikaiSidebar |
| サイドバー（フラグ OFF） | `src/components/tenjikai/TenjikaiSidebar.tsx`（共通部品 `@/components/sidebar` と `ToolSwitcherMenu`）。項目は `src/lib/tenjikai/nav.ts`（R-1。型は `ShellNavItem`） |
| 見た目 | 色・角丸・影はリニューアルの ds トークン名に合わせる（R-3）。CSS 変数は `src/app/tenjikai/tenjikai.css` の `.tenjikai-root`、SVG とアニメーション用の値は `src/lib/tenjikai/tokens.ts`。Tailwind の `doya-*` / `ink` はその変数を参照する |
| 生成 | `src/lib/tenjikai/engine.ts`（現在はモック。Gemini テキストへの置き換えは別ブランチで作業中） |
| 画像生成 | `src/lib/tenjikai/imagegen.ts`、`/api/tenjikai/image`。**`TENJIKAI_IMAGEGEN_ENABLED=true` のときだけ動く（本番は未設定＝無効）**。ログイン必須・見込み額の承認必須。上限は `src/lib/tenjikai/image-quota.ts` が SystemSetting で数える（1人1日の枚数 `TENJIKAI_IMAGEGEN_PER_USER_DAILY`、全体の1日の金額 `TENJIKAI_IMAGEGEN_DAILY_LIMIT_YEN`）。実行ごとに `TenjikaiGenerationJob` に記録し、外部 API の応答の本文はサーバーのログにだけ残す。モデルと解像度はサーバーが決める（`imageModelChain()`。`gemini-3-pro-image` → `gemini-3-pro-image-preview` → `gemini-2.5-flash-image`、404 のときだけ次へ。先頭は `TENJIKAI_IMAGE_MODEL` で差し替えられる。本番のキーでの生存確認がまだ）。利用者には原価もモデルも見せず、きょう作れる残りの枚数（`GET /api/tenjikai/image`）だけを出す。開発サーバーでは `TENJIKAI_IMAGEGEN_MOCK=true` で見本の画像を返し、`TENJIKAI_DEV_PREVIEW=true` でログインせずに画面を開ける（どちらも `next dev` でだけ効く） |
| 未ログイン | `/tenjikai` 以下はすべて紹介ページ（`src/app/tenjikai/Lp.tsx`）を出す。アプリの画面はログイン後だけ |
| 読み取り | `src/lib/tenjikai/tenjikai-read.ts`（R-4）: `listTasks` / `listCalendarEvents` / `summary` / `classifyTaskKind` |
| ブース設計 | 利用者の流れは「条件を入れる → 3Dで確かめる → 面の画像を作る → 書き出す」の一本（`BoothStudio.tsx` の段階表示と「次にやること」）。条件を入れたら `/tenjikai/booth` に進む。3D（`Booth3D.tsx`）は最初から表示し、枠の大きさが変わるたびに倍率を合わせ直す。スマホでは縦のスクロールを止めない。「面の画像をまとめて作る」で、まだ画像の無い面を1面ずつ作り、できた面から3Dの壁面に貼る。「書き出す」で、割付表（CSV）と面の画像を保存する。割付は `src/lib/tenjikai/graphics.ts` と `GraphicPlanner.tsx` |
| DB | `prisma/schema.prisma` の `Tenjikai*` 14 モデル（テーブル名 `tenjikai_*`）。**本番未反映**。画面はまだ DB を使っていない |

## 3. 本番に出す前にやること

1. `doya-db-push` スキルの手順で `tenjikai_*` テーブルを本番 DB に反映する（ユーザーの承認を得てから。Vercel のビルドは db push をしない）
2. 画面の保存・読み込みを DB につなぐ（`TenjikaiProject` を userId でスコープ。他人のものは `findFirst({ id, userId })` で弾く）
3. 料金と利用枠を決め、`plan-limit.ts` に枠を作る（`services.ts` の pricing は「開発中のため未定」）
4. 公開時は `UNLISTED_SERVICE_IDS` から外し、`src/app/tenjikai/layout.tsx` の `noindex` も外す

## 4. ほかのツールとの連携（ADDON-SERVICES §6）

受け口は相手側のツールが作る。展示会の側では、取り込みに必要な列を持っておく。

| # | 連携 | 展示会の側で持つもの | 相手側 |
| --- | --- | --- | --- |
| 12 | 予算 → 支出管理（`expense.importFromTenjikai`） | `TenjikaiBudgetLine.status`（`planned` / `ordered` / `paid`）。**`ordered` 以降**が取り込み対象。`sourceType='tenjikai.budgetLine'` / `sourceId=TenjikaiBudgetLine.id` | expense |
| 13 | 名刺・リード → SFA リード（`sfa.importLeadsFromTenjikai`） | **未整備**。展示会で集めた名刺・リードを持つモデルがまだ無い。作るときは `TenjikaiLead`（projectId・氏名・会社・メール・メモ・`sfaLeadId String?`）を想定 | sfa（`SfaLead.originType='tenjikai'`） |

`ObjectLink.fromType` の候補: `'tenjikai.project'`、`'tenjikai.budgetLine'`。

自社プロフィールは新設しない（R-5）。`TenjikaiProject.companyProfileId String?` を予約列として持つ（null 可・FK なし）。サイトの読み取り結果（`TenjikaiSiteAnalysis`）は §18.2「自社」の写しの一覧に載せる対象。

## 5. マニフェスト草案（R-8。Phase0 で `src/services/tenjikai/manifest.ts` に移す）

```ts
{
  id: 'tenjikai',
  name: 'ドヤ展示会',
  stage: 'collect',
  status: 'coming_soon', // UNLISTED。ログイン後のサイドバーにだけ「開発中」バッジ付きで出す
  tenant: 'user',
  landing: '/tenjikai',
  ui: {
    nav: TENJIKAI_NAV, // src/lib/tenjikai/nav.ts（label / href / icon / minServiceRole）
  },
  dataModels: [
    'TenjikaiVenue', 'TenjikaiProject', 'TenjikaiSiteAnalysis', 'TenjikaiBoothPlan', 'TenjikaiBoothElement',
    'TenjikaiCreative', 'TenjikaiNovelty', 'TenjikaiBudgetLine', 'TenjikaiVendor', 'TenjikaiVendorRequest',
    'TenjikaiDocument', 'TenjikaiTask', 'TenjikaiGenerationJob', 'TenjikaiGraphicPanel',
  ],
  // テナント列: TenjikaiProject.userId。子モデルは via:project。TenjikaiVenue / TenjikaiVendor は共通マスタ（テナント無し）
  routes: {
    public: [],      // 公開 API なし
    cronLaunch: [],
  },
  guestShared: [],   // ゲスト画面なし
  cron: [],
  externalApis: [
    { name: 'gemini-text', use: 'サイトの読み取り・ブース案・制作物コピー', cost: 'low' },
    { name: 'gemini-image', use: '制作物の画像・ブース完成予想図', cost: 'high', gate: 'TENJIKAI_IMAGEGEN_ENABLED + 見込み額の承認' },
  ],
  agentTools: [
    { key: 'tenjikai.listTasks', reversibility: 'read', costClass: 'none', approval: 'none',
      run: 'tenjikai-read.ts:listTasks' },                       // ホームの「今日のタスク」
    { key: 'tenjikai.planBooth', reversibility: 'reversible', costClass: 'low', approval: 'by-setting',
      run: 'engine.ts:generateBoothPlans' },
    { key: 'tenjikai.generateCreatives', reversibility: 'reversible', costClass: 'high', approval: 'required',
      estimatedPaidCalls: '制作物の枚数 × 生成回数', sensitive: false,
      run: 'imagegen.ts（/api/tenjikai/image と同じ関数）' },  // 承認画面に見込み額（モデル・解像度・単価・枚数・合計）を出す
  ],
  home: {
    tasks: 'tenjikai-read.ts:listTasks',
    calendar: 'tenjikai-read.ts:listCalendarEvents', // 会期・申込・入稿・発注の締切、資料の期限
    cards: [{ key: 'tenjikai.prep', read: 'tenjikai-read.ts:summary', showFrom: '会期 60 日前' }],
  },
  usage: {
    meters: [
      { key: 'tenjikai.projects', unit: 'project', note: '料金未定。plan-limit.ts に枠を作ったらここと揃える' },
      { key: 'tenjikai.imageYen', unit: 'yen', note: 'TenjikaiGenerationJob.estimatedCostYen の合計。1 日の上限は TENJIKAI_IMAGEGEN_DAILY_LIMIT_YEN' },
    ],
  },
}
```
