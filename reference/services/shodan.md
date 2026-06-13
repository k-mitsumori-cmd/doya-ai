# ドヤ商談準備（Shodan）要件定義・実装メモ

> ステータス: **active（2026-06-13 実装）** / 組織スコープ型・統一プラン。
> 様式は [sfa.md](./sfa.md)（ドヤ営業管理）に準拠。組織/招待は SFA と同型。

## 概要

- **パス**: `/shodan`
- **サービスID**: `shodan`
- **サービス名**: ドヤ商談準備
- **本番URL**: `https://doya-ai.surisuta.jp/shodan`
- **説明**: 商談先企業の **URLを入力するだけ** で、深掘りリサーチ → 現状分析（はっきりめ）→ 課題仮説 → 解決策 → **提案資料（Markdown）** までを一括生成する商談準備ツール。
- **カラー**: ブランド紫 `#7f19e6`（gradient `from-purple-600 to-fuchsia-600`）
- **アイコン**: 🎯（Material Symbols: `target` 系）
- **データスコープ**: **組織スコープ**（`organizationId` で分離するマルチテナント。SFA/勤怠/HRと同型）
- **課金**: 統一プラン。無料=月5件まで／プロ(¥9,980)=無制限・チーム招待。判定は `User.plan`。

## コア機能（要件）

1. **商談準備の自動化**: 商談先URL入力 → 課題仮説の提案から解決策の提示まで自動。最終的な提案資料まで一括作成。
2. **自社情報の活用**: 自社URL/詳細を事前登録 → 登録情報を元に提案資料を最適化。
3. **アカウント・管理機能**: ドヤ商談管理(SFA)同様に他アカウントを招待可能。組織スコープで情報漏洩しない設計（全クエリ `where: { organizationId }` で絞り、`id`+`organizationId` の二重検索で IDOR 防止）。

### 深掘りリサーチ（必須要件）
URL起点で以下まで調査して仮説提案に反映する：
- **実従業員数**（gBizINFO 公的データ優先 / サイト記載フォールバック）
- **マーケティング実施状況**（SNS媒体・問い合わせ/資料請求導線・MA/解析ツール(GA/GTM/HubSpot/Marketo/Pardot等)・広告タグ痕跡）
- **オウンドメディア有無と規模**（ブログ/ニュース/コラム等の検出・記事数概算・サイト規模感）
- **記事の更新頻度**（最新記事日と直近1年の本数から high/medium/low/inactive を判定）
- 現状分析は **はっきりめ**（忖度せず、事実ベースで弱みも明示）

## アーキテクチャ

### Prisma モデル（`prisma/schema.prisma` 末尾, `shodan_*`）
- `ShodanOrganization` (id/name/slug)
- `ShodanMember` (organizationId/userId/role/status/inviteEmail/inviteToken) ※SFA同型
- `ShodanCompanyProfile` (organizationId @unique / 自社情報: companyName/url/description/valueProp/products/targetCustomer/pricingNote/caseStudies)
- `ShodanPreparation` (organizationId / targetUrl / targetName / status(processing|done|failed) / research(Json) / analysis(Json) / proposalMarkdown / errorMessage)

### lib（`src/lib/shodan/`）
- `types.ts` — 役割/Context/CompanyResearch/CompanyAnalysis 型
- `access.ts` — `getShodanContext(orgSlug?)` / `orgSlugFrom(req)`(?org= or x-shodan-org) / `hasMinRole` / `getOrCreateOrganization`（SFA準拠）
- `research.ts` — `researchCompany(url)`：SSRF安全fetch＋サイトクロール＋gBizINFO照合。`src/lib/doyalist/collect/{web-scraper,gbizinfo}` を再利用。
- `ai.ts` — `analyzeCompany(research, own)`（`geminiGenerateJson`）/ `generateProposal(research, analysis, own)`（`geminiGenerateText`＝Claude Sonnet 4.6主）。`@seo/lib/gemini` 経由。
- `client.ts` — クライアントfetchヘルパー（`?org=` 付与）

### API（`src/app/api/shodan/`）
- `me` (GET 認証/オンボ状態), `organization` (POST作成)
- `members` (GET/POST招待), `members/[id]` (PATCH/DELETE), `invite/[token]` (GET/POST)
- `company-profile` (GET/PUT 自社情報)
- `preparations` (GET一覧 / POST: **URL→リサーチ→分析→提案を一括実行**, maxDuration=300), `preparations/[id]` (GET/DELETE)

### UI（`src/app/shodan/`）
- `page.tsx`（入口: 未ログイン→Googleログイン / 未組織→作成 / 既存→組織へ。`/me` を直接叩き useSession status ゲートはしない）
- `[orgSlug]/layout.tsx`（メンバーシップ検証＋サイドバー）, `page.tsx`(一覧), `new/`(URL入力), `p/[id]/`(結果表示＋提案コピー/.md保存), `settings/`(自社情報), `members/`(招待)
- `invite/[token]/`(承諾), `pricing/`(UnifiedPricingPlans)
- `src/components/shodan/`：`ShodanSidebar.tsx`, `Markdown.tsx`（依存なしの軽量Markdownレンダラ）

## 運用メモ
- **本番DB**: 新規テーブルのため `npx prisma db push`（POSTGRES_PRISMA_URL）を本番に適用しないと全クエリ500。新規テーブルなので既存サービスには影響しない（追加のみ）。
- 環境変数: `ANTHROPIC_API_KEY`(主) / `GOOGLE_GENAI_API_KEY`(フォールバック) / `GBIZINFO_API_TOKEN`(従業員数等) / `NEXTAUTH_URL`(招待リンク)。
- 画像生成は使用していない（提案資料はMarkdownテキスト）。将来図解を入れる場合は `generateImageWithFallback()` 経由。
