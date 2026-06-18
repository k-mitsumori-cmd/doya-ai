# ドヤAIO（AI可視性・AEO）要件定義・実装メモ

> ステータス: **coming_soon（2026-06-16 MVP実装・ビルド通過）** / 組織スコープ型・統一プラン。
> 様式は [shodan.md](./shodan.md) / [sfa.md](./sfa.md) に準拠。組織/招待/課金は Shodan・SFA と同型。
> 本番DB push・実スキャンは未実施。Perplexityキー未設定。

## 概要

- **パス**: `/aio`
- **サービスID**: `aio`
- **サービス名**: ドヤAIO
- **本番URL（予定）**: `https://doya-ai.surisuta.jp/aio`
- **説明**: 監視したい質問（プロンプト）を登録すると、**ChatGPT・Gemini・Claude・Perplexity** に反復で投げ、自社ブランドの **言及率（認知度）・Share of Voice・引用元ドメイン・感情** を定点観測する AI可視性 / AEO（回答エンジン最適化）ツール。HubSpot AEO / Semrush AIO 相当。検索の次の「AIに選ばれる」競争を可視化し、AIに引用されるための改善アクションまで提案する。
- **カラー**: ブランド紫 `#7f19e6`（gradient `from-purple-600 to-fuchsia-600`）
- **アイコン**: 🔍（services.ts）／サイドバー・切替メニューは lucide `Eye`
- **データスコープ**: **組織スコープ**（`organizationId` で分離するマルチテナント。SFA/Shodan/勤怠/HRと同型）
- **課金**: 統一プラン。無料=プロンプト3件 / 週1回スキャン／プロ(¥9,980)=無制限・チーム招待。判定は `User.plan`。

## コア機能（要件）

1. **AI可視性の定点観測**: 監視プロンプト × エンジン × 反復回 を実行 → 回答を構造化 → 言及率・SoV・引用元・感情を集計し、スキャン1回＝日付つきスナップショットとして時系列で蓄積。
2. **マルチエンジン対応**: ChatGPT(gpt-4o) / Gemini / Claude(Sonnet) / Perplexity(sonar) の4エンジン。`search`モード（chatgpt/gemini/claude にも Serper のWeb検索結果を注入して「検索付きAI」を再現）と `memory`モード（学習データのみ）を持つ。Perplexity は元々検索グラウンディング付き。
3. **競合比較（Share of Voice）**: 自社＋競合の言及数からシェアを算出。表記ゆれ（日本語名/英語名/ドメイン/社名）はLLMで名寄せし、失敗時は決定的フォールバックで統合。
4. **引用元ドメイン分析**: エンジンが参照した引用URL＋Serperグラウンディングから上位ドメインを集計し、own/competitor/media/affiliate/other にチャネル分類。自社ドメイン引用率も算出。
5. **感情分析・順位**: 言及ありランのポジ/中立/ネガ割合、リスト内の自社の順位（brandRank）。
6. **プロンプト別の言及頻度**: プロンプト×エンジンで「◯回中△回」を表示。
7. **AEO改善アクション**: スキャン結果を基に、引用元メディアへの掲載・自社サイトのAI可読化（構造化データ/llms.txt/クローラ許可）・比較コンテンツ作成などの施策を3〜5件、優先度付きで自動提案。
8. **アカウント・管理機能**: SFA同様に他アカウントを招待可能。組織スコープで情報漏洩しない設計（全クエリ `userId` でメンバーシップ解決＋`organizationId` 絞り）。

## アーキテクチャ

### Prisma モデル（`prisma/schema.prisma` 3302行付近, `aio_*`）
- `AioOrganization` (id/name/slug(unique))
- `AioMember` (organizationId/userId/role(owner/admin/manager/member)/status(ACTIVE/PENDING/INACTIVE)/name/inviteEmail/inviteToken(unique)/acceptedAt) ※SFA同型 / `@@unique([organizationId,userId])`
- `AioBrandProfile` (organizationId @unique / 追跡ブランド: brandName/brandUrl/aliases(Json)/competitors(Json)/category/market)
- `AioPrompt` (organizationId / text(Text) / category / isActive)
- `AioScan` (organizationId / status(processing|done|failed) / engines(Json) / repetitions / errorMessage / awarenessPct / shareOfVoice / sentimentPos/Neu/Neg / ownCitationPct / summary(Json=perEngine,sov[],citations[],promptBreakdown[],recommendations 全文)) ＝**日付つきスナップショット（時系列チャートの単位）**
- `AioResult` (organizationId / scanId / promptId / engine / iteration / brandMentioned / brandRank / sentiment / competitors(Json) / citations(Json) / answerText(Text)) ＝個別ラン結果（プロンプト×エンジン×反復回 の1回ぶん）

### lib（`src/lib/aio/`）
- `types.ts` — 役割/AioContext/EngineId/`availableEngines()`（環境変数キーがあるエンジンのみ返す）/ScanSummary/RunExtract/Recommendation/CitationChannel 型、`effectiveScanStatus()`（processing が `SCAN_STALE_MS=10分` 超で failed 扱い＝maxDuration強制終了の取りこぼし対策）
- `access.ts` — `getAioContext(orgSlug?)`（全API共通入口、userIdでスコープしIDOR安全）/ `orgSlugFrom(req)`（?org= 優先、無ければヘッダ `x-aio-org` を decodeURIComponent）/ `listMemberships()` / `hasMinRole` / `getOrCreateOrganization`（slugはASCIIのみ、衝突時 `-{timestamp}`。SFA/Shodan準拠）
- `engines.ts` — `askEngine(engine, prompt, opts)`：エンジンアダプタ。chatgpt=OpenAI Chat Completions(gpt-4o) / gemini=`@seo/lib/gemini` / claude=Anthropic Messages API raw fetch(`AIO_CLAUDE_MODEL`既定 `claude-sonnet-4-6`) / perplexity=api.perplexity.ai(sonar、citations標準返却)。`serperSearch()`（Serper Google検索／引用元グラウンディング、キー無ければ空配列）、`domainOf()`
- `analyze.ts` — `analyzeAnswer()`：回答本文から brandMentioned/brandRank/sentiment/competitors を `geminiGenerateJson` で構造化。LLM失敗時は素朴な文字列マッチにフォールバック
- `scan.ts` — `executeScan(brand, prompts, engines, repetitions, mode)`：DB非依存の純ロジック。並列プール(pMap)で実行→`aggregate()`で集計→`canonicalizeSov()`で名寄せ→`buildRecommendations()`で改善案生成。1ラン失敗は欠測扱いで全体は止めない
- `client.ts` — クライアントfetchヘルパー（`?org=` / `x-aio-org` 付与）

### API（`src/app/api/aio/`、定型: `runtime='nodejs' / dynamic='force-dynamic' / maxDuration=300`）
- `me` (GET 認証/オンボ状態・所属組織一覧)
- `organization` (POST作成、`getOrCreateOrganization` 冪等)
- `brand-profile` (GET / PUT 追跡ブランド設定: brandName/brandUrl/aliases/competitors/category/market)
- `prompts` (GET一覧 / POST追加), `prompts/[id]` (PATCH/DELETE)
- `scans` (GET履歴=軽量 / POST: **プロンプト×エンジン×反復→集計→保存** を一括実行), `scans/[id]` (GET詳細/DELETE)
- `members` (GET/POST招待), `members/[id]` (PATCH/DELETE), `invite/[token]` (GET/POST承諾)

### UI（`src/app/aio/`）
- `page.tsx`（入口: 未ログイン→Googleログイン / 未組織→作成 / 既存→組織へ。`/me` を直接叩き useSession status ゲートはしない）, `layout.tsx`
- `[orgSlug]/layout.tsx`（メンバーシップ検証＋サイドバー）, `[orgSlug]/page.tsx`（ダッシュボード: 認知度/SoV/引用元/感情/プロンプト別頻度/推移/改善アクション）
- `[orgSlug]/prompts/page.tsx`（監視プロンプト＋追跡ブランド管理）, `[orgSlug]/members/page.tsx`（招待）, `[orgSlug]/settings/page.tsx`（組織設定）
- `invite/[token]/page.tsx`（承諾）, `pricing/page.tsx`（共通 `UnifiedPricingPlans`）
- `src/components/aio/`：`AioShell.tsx`（サイドバー）, `ui.tsx`（共通UIパーツ）

## 課金（統一プラン方式）

- 共通 `UnifiedPricingPlans` を使い、**無料 / プロ（¥9,980/月・税込）** の2プラン表示。プロ1契約でドヤAI全サービスのプロ解放。**プラン判定は `User.plan` が唯一の正**。
- スキャン上限（`src/app/api/aio/scans/route.ts`）:
  - 無料(FREE/GUEST): **週1回**スキャン（`FREE_SCANS_PER_WEEK=1`、超過は 402 `code:'LIMIT'`）、反復 `FREE_REPETITIONS=3`、プロンプト3件
  - プロ(有料): スキャン頻度無制限、反復 `PRO_REPETITIONS=5`、プロンプト無制限・チーム招待

## 運用メモ

- **本番DB pushは手動**: 新規テーブル `aio_*` のため、本番に `POSTGRES_PRISMA_URL` で手動 `prisma db push`（or ALTER）を適用しないと全クエリ500の全停止。新規テーブルなので既存サービスには影響しない（追加のみ）。スキーマ追加後は `npx prisma generate` 必須。
- **Perplexity はキー未設定だと除外**: `availableEngines()` が `PERPLEXITY_API_KEY` の有無を見るため、未設定の本番では perplexity がエンジン一覧から自動的に外れる（他3エンジンで稼働）。同様に `OPENAI_API_KEY`/`GOOGLE_GENAI_API_KEY`/`ANTHROPIC_API_KEY` の有無で各エンジンが有効化される。全滅時は 500。
- **組織スコープ型・IDOR安全**: 全APIは `getAioContext()` 認証必須（無ければ401）。membership を `userId` で解決するため他組織は決して解決されない。クエリは `organizationId` で絞る。ロール変更/招待は `hasMinRole` でガード。
- 環境変数: `OPENAI_API_KEY` / `GOOGLE_GENAI_API_KEY` / `ANTHROPIC_API_KEY`（各エンジン）/ `PERPLEXITY_API_KEY`（任意・未設定なら除外）/ `SERPER_API_KEY`（任意・引用元グラウンディング、無ければ memory相当）/ `AIO_CLAUDE_MODEL`・`AIO_OPENAI_MODEL`・`AIO_PERPLEXITY_MODEL`（任意・モデル上書き）/ `NEXTAUTH_URL`（招待リンク）。
- AI生成は `@seo/lib/gemini`（テキスト/JSON）と各エンジンの直接API経由。**画像生成は使用しない**（将来図解を入れる場合は `generateImageWithFallback()` 経由）。
- スキャンは `maxDuration=300`。長時間化で processing のまま残ったスキャンは `effectiveScanStatus()` が10分超で failed 扱いに補正する。

## 関連ドキュメント
- 組織スコープ共通設計・統一課金: [shodan.md](./shodan.md) / [sfa.md](./sfa.md) / [../05-auth-payments.md](../05-auth-payments.md)
- UIパターン: [../06-ui-patterns.md](../06-ui-patterns.md)
