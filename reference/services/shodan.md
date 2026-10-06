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


### 組織設定の安全な読み書き（2026-10-07補修候補）

設定の取得失敗・不正応答時は空フォームで保存できないようにする。保存中の入力変更は未保存と表示し、結果不明・競合時は下書きを保持して現保存値の確認後に手動再保存する。設定画面のPUTはexpectedUpdatedAtを送信し、既存updatedAt一致時だけ更新する（初回はnull）。409 PROFILE_CONFLICTは再取得を促す。バージョン省略の旧PUTは互換維持で従来動作のまま。実画面・APIの合成回帰証拠はdocs/audits/2026-10-06-all-services-recheck/org-settings-repair.json。本番反映は同JSONのデプロイ状態と区別する。


### 新規作成の応答・取消・結果確認（2026-10-07補修候補）

企業調査の新規作成は確認済みの利用者・組織に限定し、同時操作を同期的に拒否する。調査応答の必要項目を表示前に検証し、不明結果では入力を保持して再送を止め、組織の一覧で確認する。確認済み結果は直接開ける。認証再確認・組織変更・アンマウント時は要求と遷移タイマーを取り消す。上限拒否時は料金/追加枠/オーナー相談を役割ごとに案内し、現在の利用枠表示を取り直す。実顧客の生成・永続冪等性・本番完了の証明とは区別する。詳細: docs/audits/2026-10-06-all-services-recheck/shodan-new-repair.json。

## 2026-10-07 メンバー管理の追加補修契約（候補・本番未反映）

メンバー操作は認証ユーザー・URLの組織・操作世代に結び付け、組織変更・認証更新・画面離脱後の古い操作と応答を破棄する。現在のACTIVE所属とmyMemberIdを一覧で確認してから操作を有効にする。自己・オーナー・同格以上の削除は画面でも止める。招待入力は送信時の最新値を同期的に取得し、同一ターンの二重操作を止める。通信不明は再送せず一覧確認へ進める。削除成功の応答には対象のmemberIdを含める。確定済みの招待結果は一覧の読込失敗で失わず、取消・参加済みを確認したURLは非表示にする。現在の課金条件と招待ロール規則は維持する。

### スライド資料の切替時の表示契約（2026-10-07追加補修候補）

表示中の資料の差し替え・枚数減少・空資料への変更で範囲外のページを参照しない。新しい資料は先頭ページから表示する。前資料の操作コールバックは新資料のページ選択に影響させない。連続したページ送りは現在の選択位置から処理する。印刷対象は現在渡された資料のみとする。本契約の実コンポーネント合成検証と本番確認は区別する。

### 詳細画面の非同期操作契約（2026-10-07補修候補）

詳細は認証ユーザー・組織・案件・操作世代が一致する間だけ表示・操作する。切替/認証再確認/離脱後は要求を取り消し、古い応答による表示、追加生成、通知、遷移を止める。読込は応答DTO全体と案件IDを検証し、404とサーバー/通信失敗を区別する。processing時のみ重ならないポーリングを行う。再調査/提案生成/スライド生成は共通の同期ロックを使う。結果不明は重ねて再送せず、提案と画像は保存版の確認、新規調査は一覧確認を案内する。認証更新中も同一利用者の不明操作を保持する。提案生成の既存自動開始、有料条件、組織利用枠は維持する。スライドの途中成果は完成扱いにせず編集画面を案内する。コピー/保存/印刷は確認済みの現案件だけを対象とする。合成検証は本番認証後の確認や永続冪等性の証明とは区別する。

### スライド編集・PDFの非同期操作契約（2026-10-07補修候補）

編集画面の読込、再生成、PDF作成は、認証ユーザー・組織・案件・確認した保存版・操作世代に結び付ける。再生成/PDFは共通の同期ロックを使い、離脱/認証更新/組織変更後の追加通信、保存、通知を止める。同じ利用者の認証再確認では下書きと結果不明の操作を保持する。画像の失敗・欠落は構成に沿って表示し、欠落した枠も個別生成できる。再生成はexpectedUpdatedAtを送信し、リース取得後の保存版が不一致なら課金処理前に409で止める（省略する旧クライアントは互換維持）。修正指示は500文字以内、送信時の最新値を使用する。結果不明は自動で再送せず保存版を取り直す。対象画像の識別子で更新を確認し、URL署名更新だけを生成成功と判定しない。保存版確認後の明示的な再生成もリースと版照合を通す。既知の成功は再読込で確認し、古い応答で新しい指示を消さない。PDFは画像/合計容量、枚数、通信・デコード時間、画像サイズを制限し、現保存版だけを出力する。ダウンロード開始と端末への保存確認を区別する。認証後本番確認、実課金、永続冪等性は合成検証と別管理する。
