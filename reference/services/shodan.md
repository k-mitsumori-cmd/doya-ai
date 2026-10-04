# ドヤ商談準備（Shodan）要件定義・実装メモ

> ステータス: **active（2026-06-13 実装）** / 組織スコープ型・統一プラン。
> 様式は [sfa.md](./sfa.md)（ドヤ営業管理）に準拠。組織/招待は SFA と同型。

## 概要

- **パス**: `/shodan`
- **サービスID**: `shodan`
- **サービス名**: ドヤ商談準備
- **本番URL**: `https://doya-ai.surisuta.jp/shodan`
- **説明**: 商談先企業の **URLを入力するだけ** で深掘りリサーチを行い、プロプランの組織では続けて現状分析・課題仮説・解決策・提案資料（Markdown／スライド）を生成する商談準備ツール。
- **カラー**: ブランド紫 `#7f19e6`（gradient `from-purple-600 to-fuchsia-600`）
- **アイコン**: 🎯（Material Symbols: `target` 系）
- **データスコープ**: **組織スコープ**（`organizationId` で分離するマルチテナント。SFA/勤怠/HRと同型）
- **課金**: 組織オーナーの `User.plan` で判定。企業調査は組織ごとに無料=月5件／プロ=月50件／エンタープライズ=月300件。提案資料とスライド画像の生成・再生成は有料プランのみ。組織メンバー個人の契約は組織枠を変更しない。

## コア機能（要件）

1. **商談準備の自動化**: 商談先URL入力 → 課題仮説の提案から解決策の提示まで自動。最終的な提案資料まで一括作成。
2. **自社情報の活用**: 自社URL/詳細を事前登録 → 登録情報を元に提案資料を最適化。
3. **アカウント・管理機能**: ドヤ商談管理(SFA)同様に他アカウントを招待可能。組織スコープで情報漏洩しない設計（全クエリ `where: { organizationId }` で絞り、`id`+`organizationId` の二重検索で IDOR 防止）。

### 深掘りリサーチ（必須要件）
URL起点で以下まで調査して仮説提案に反映する：
- **実従業員数**（gBizINFO 公的データ優先 / サイト記載フォールバック）
- **マーケティング実施状況**（SNS媒体・問い合わせ/資料請求導線・MA/解析ツール(GA/GTM/HubSpot/Marketo/Pardot等)・広告タグ痕跡）
- **オウンドメディアの有無と所在**（ブログ/ニュース/コラム等を検出）。記事数・更新頻度・規模は信頼できる取得が難しいため算出しない。
- 現状分析は **はっきりめ**（忖度せず、事実ベースで弱みも明示）

## アーキテクチャ

### Prisma モデル（`prisma/schema.prisma` 末尾, `shodan_*`）
- `ShodanOrganization` (id/name/slug)
- `ShodanMember` (organizationId/userId/role/status/inviteEmail/inviteToken) ※SFA同型
- `ShodanCompanyProfile` (organizationId @unique / 自社情報: companyName/url/description/valueProp/products/targetCustomer/pricingNote/caseStudies)
- `ShodanPreparation` (organizationId / targetUrl / targetName / status(processing|researched|done|failed|deleted) / research(Json) / analysis(Json) / proposalMarkdown / errorMessage)

### lib（`src/lib/shodan/`）
- `types.ts` — 役割/Context/CompanyResearch/CompanyAnalysis 型
- `access.ts` — `getShodanContext(orgSlug?)` / `orgSlugFrom(req)`(?org= or x-shodan-org) / `hasMinRole` / `getOrCreateOrganization`（SFA準拠）
- `billing.ts` — ACTIVEな単独オーナーの契約を取得。オーナーが不明・複数なら有料処理を停止する。
- `profile-extraction-budget.ts` — 自社情報のAI自動入力を組織単位でJSTの1日50回まで予約。失敗時も呼び出し回数に含め、再試行の連打を防ぐ。月次の企業調査枠とは別の運用保護枠。
- `slide-generation-lease.ts` — 同じ案件の提案構成生成・スライド初回生成・再生成を短期リースで直列化し、重複生成と保存競合を防ぐ。リースは関数の最大実行時間より長く、終了時にトークン一致で解除する。
- `research.ts` — `researchCompany(url)`：SSRF安全fetch＋サイトクロール＋gBizINFO照合。`src/lib/doyalist/collect/{web-scraper,gbizinfo}` を再利用。
- `ai.ts` — `analyzeCompany(research, own)`（`geminiGenerateJson`）/ `generateProposal(research, analysis, own)`（`geminiGenerateText`＝Claude Sonnet 4.6主）。`@seo/lib/gemini` 経由。
- `client.ts` — クライアントfetchヘルパー（`?org=` 付与）

### API（`src/app/api/shodan/`）
- `me` (GET 認証/オンボ状態), `organization` (POST作成)
- `members` (GET/POST招待), `members/[id]` (PATCH/DELETE), `invite/[token]` (GET/POST)
- `company-profile` (GET/PUT 自社情報)
- `company-profile/extract` (POST 自社URLから下書きを作成。日次の運用保護枠に達したら429と手入力案内)
- `preparations` (GET一覧 / POST: **URL→リサーチ**、組織の月次枠を予約、maxDuration=300), `preparations/[id]` (GET/DELETE)
- `preparations/[id]/generate` (POST: 有料組織で分析→提案資料生成), `preparations/[id]/slides/generate` と `slides/regenerate` (有料組織でスライド画像生成・再生成)

### UI（`src/app/shodan/`）
- `page.tsx`（入口: 未ログイン→Googleログイン / 未組織→作成 / 既存→組織へ。`/me` を直接叩き useSession status ゲートはしない）
- `[orgSlug]/layout.tsx`（メンバーシップ検証＋サイドバー）, `page.tsx`(一覧), `new/`(URL入力), `p/[id]/`(結果表示＋提案コピー/.md保存), `settings/`(自社情報), `members/`(招待)
- `invite/[token]/`(承諾), `pricing/`(UnifiedPricingPlans)
- `src/components/shodan/`：`ShodanSidebar.tsx`, `Markdown.tsx`（依存なしの軽量Markdownレンダラ）

## 運用メモ
- 成功した企業調査を削除した場合、調査内容・提案内容を消去し、当月の利用実績を示す `deleted` 行だけ残す。失敗した調査は行ごと削除して枠を戻す。進行中の調査・資料生成は削除できない。一覧と詳細では `deleted` を表示せず、月次利用枠には含める。
- **本番DB**: 既存の `shodan_*` テーブルを使用する。スキーマを変更する際は現在のマイグレーションと本番DB状態を確認し、無条件に `prisma db push` しない。
- 環境変数: `ANTHROPIC_API_KEY`(主) / `GOOGLE_GENAI_API_KEY`(フォールバック) / `GBIZINFO_API_TOKEN`(従業員数等) / `NEXTAUTH_URL`(招待リンク)。
- 有料組織の提案スライドは画像生成を使用する。生成APIの実費が発生するため、検証で実際の生成を行う場合は事前に費用を確認する。
