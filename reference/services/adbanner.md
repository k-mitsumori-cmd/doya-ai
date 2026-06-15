# ドヤ広告バナーAI

> 自動マーケティング広告バナーデザインAIツール。広告に特化したバナーを量産し、AIフィードバックと
> パフォーマンス数値で改善し続ける「作って終わりではない」運用型クリエイティブツール。

## 概要

| 項目 | 内容 |
|------|------|
| **サービス名** | ドヤ広告バナーAI |
| **serviceId** | `adbanner` |
| **パス** | `/adbanner` |
| **本番URL** | `https://doya-ai.surisuta.jp/adbanner` |
| **ステータス** | `coming_soon`（実装着手時）→ 実装完了で `active` |
| **カテゴリ** | image |
| **課金** | 統一プラン方式（ドヤマーケAI課金で PRO 解放） |
| **アイコン** | `campaign`（Material Symbols Outlined） |
| **カラー** | purple / orange（既存 banner=purple/pink と差別化） |

## コンセプト / 既存 `/banner` との差別化

既存「ドヤバナーAI」(`/banner`) は **A/B/C 3案を単発生成**するツール。
本サービスは **広告運用に特化し、作り続けて改善し続ける** ことが主役。

| | 既存 `/banner` | 新 `/adbanner`（本サービス） |
|---|---|---|
| コンセプト | 1回作って終わり | キャンペーン単位で量産・改善し続ける |
| 主役機能 | 3案同時生成 | URL/サービス名/色/ロゴ反映の**量産** + **AI自動フィードバック** + **数値投入での改善**（Phase2） |
| データ単位 | 生成履歴のみ | **キャンペーン** > バナー群 > フィードバック / パフォーマンス / 改善履歴 |
| ゴール | きれいなバナー | **成果の出る広告クリエイティブを継続供給** |

> 画像生成エンジンは既存と共通（`generateImageWithFallback()`）。プロンプトのみ広告特化で新規作成。

## ターゲットユーザー

- 広告運用担当者 / マーケター（Meta・Google・LINE広告などのバナーを大量に回す人）
- 中小企業の経営者・1人マーケ（デザイナーに頼まず自分で量産したい人）
- 代理店（クライアント別にキャンペーン管理して量産したい人）

## 入力 → 出力

```
入力: サービスURL or サービス名 + 訴求軸 + ブランドカラー + ロゴ + サイズ + 媒体
   ↓
出力: 広告特化バナー 複数パターン（PNG）
   ↓
AI自動フィードバック: 各バナーに対し「視認性 / 訴求の強さ / CTA / 媒体適合」を採点・改善提案
   ↓ （Phase2）
パフォーマンス数値入力（imp / click / CTR / CV など）
   ↓
改善提案 → 次世代バナーを再生成（勝ちパターンを継承して量産）
```

---

## 機能仕様

### Phase 1（MVP・初回実装範囲）

#### 1. バナー生成機能
- **(a) 入力からの自動生成**
  - サービスURL入力 → スクレイピングで会社名・サービス内容・色・OG画像等を抽出し反映
  - サービス名・訴求テキスト直接入力でも生成可能
- **(b) ブランド反映 + 複数パターン量産**
  - ブランドカラー（複数色）指定を反映
  - ロゴ画像アップロード → 生成時にロゴ用セーフゾーンを確保し、生成後に実ロゴを Sharp で合成（後述「ロゴの扱い」参照。AIにロゴを描かせない）
  - サイズプリセット（媒体別）: 1080x1080 / 1200x628 / 1080x1920 / 728x90 / 300x250 等
  - 訴求軸・媒体・トーンを変えて **N案を一括量産**（例: 1リクエストで4〜8案）

#### 2. AI自動フィードバック機能
- 生成された各バナーに対し AI（Gemini）が自動採点 + 改善提案
- 評価観点（広告特化）:
  - **視認性**（3秒で何の広告かわかるか / 文字の可読性）
  - **訴求の強さ**（ベネフィットが伝わるか）
  - **CTA**（行動喚起が明確か）
  - **媒体適合**（選択した媒体のレギュレーション・推奨に沿うか。例: テキスト占有率）
  - **ブランド整合**（指定カラー・ロゴが活きているか）
- 各観点を 100点満点で採点 + 総合スコア + 「次にこう直すと良い」提案文
- 提案を1クリックで反映して再生成（リファイン）

### Phase 2（次フェーズ・改善ループ）

#### 3. パフォーマンス数値投入による改善
- バナーごとに広告実績を入力 / CSV取込（imp, click, CTR, spend, CV, CPA 等）
- 実績 × AIフィードバックを突き合わせ「勝ち要素 / 負け要素」を分析
- 勝ちパターンの要素（配色・コピー・レイアウト傾向）を継承して次世代バナーを自動量産
- キャンペーンの世代（generation）管理で改善の推移を可視化

---

## 画面構成

```
src/app/adbanner/
  ├── page.tsx                      # LP / サービストップ
  ├── layout.tsx                    # レイアウト（AdBannerSidebar）
  ├── pricing/page.tsx              # 料金（UnifiedPricingPlans を流用）
  └── dashboard/
      ├── page.tsx                  # キャンペーン一覧
      ├── new/page.tsx              # 新規キャンペーン作成（URL/名前/色/ロゴ/媒体/サイズ入力）
      └── [campaignId]/page.tsx     # キャンペーン詳細（量産バナー一覧 + 各AIフィードバック + 再生成）
                                    #   Phase2: パフォーマンス入力タブ・改善提案タブ
```

- サイドバー: `src/components/sidebar/` の共通サイドバーを `adbanner` テーマで使用
- UI: 日本語 / ブランドカラー `#7f19e6` / Material Symbols Outlined / Tailwind のみ

---

## データモデル（Prisma / プレフィックス `adbanner_`）

> 本番DBは設計上 db push がスキップされるため、列追加後は `POSTGRES_PRISMA_URL` で手動 ALTER/push する。

```prisma
model AdBannerCampaign {
  id          String   @id @default(cuid())
  userId      String?               // 未ログインゲストは null + guestId
  guestId     String?
  name        String                // キャンペーン名
  sourceUrl   String?               // 入力サービスURL
  serviceName String?               // 入力サービス名
  appeal      String?               // 訴求軸メモ
  brandColors Json?                 // ["#7f19e6", ...]
  logoPath    String?               // Supabase Storage のロゴパス
  media       String?               // 媒体 (meta / google / line / x ...)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  banners     AdBannerCreative[]
  @@map("adbanner_campaign")
}

model AdBannerCreative {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     AdBannerCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  imagePath    String              // 生成画像 (Supabase Storage)
  size         String              // 1080x1080 等
  prompt       String   @db.Text   // 使用プロンプト
  variantLabel String?             // 訴求/トーンのバリエーションラベル
  generation   Int      @default(1) // 改善世代 (Phase2)
  parentId     String?             // 元バナー (Phase2 改善元)
  model        String?             // 使用モデル / fallbackUsed
  feedback     Json?               // AI採点結果 { visibility, appeal, cta, fit, brand, total, advice }
  metrics      Json?               // Phase2: { imp, click, ctr, spend, cv, cpa }
  createdAt    DateTime @default(now())
  @@map("adbanner_creative")
}
```

- ロゴ・生成画像は Supabase Storage に保存（`@/lib/interview/storage` のヘルパ流用可）
- 使用量カウントは既存 `Generation`（serviceId='adbanner'）または UserServiceSubscription 方式に合わせる

---

## API エンドポイント

```
src/app/api/adbanner/
  ├── campaigns/route.ts              # GET一覧 / POST作成
  ├── campaigns/[id]/route.ts         # GET詳細 / PATCH / DELETE
  ├── analyze-url/route.ts            # POST: URLスクレイピング→ブランド情報抽出
  ├── generate/route.ts              # POST: N案一括量産（generateImageWithFallback）
  ├── feedback/route.ts              # POST: 指定バナーにAI自動フィードバック
  ├── refine/route.ts                # POST: フィードバック反映で再生成
  ├── logo/upload-url/route.ts       # POST: ロゴ署名付きアップロードURL
  └── image/route.ts                 # GET: 画像取得（サムネ優先）
  # ── Phase2 ──
  ├── metrics/route.ts               # POST: パフォーマンス数値入力 / CSV取込
  └── optimize/route.ts              # POST: 数値×FB分析→改善案・次世代量産
```

API 定型（全ルート共通）:
```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
// 認証: getServerSession(authOptions)。ゲストは guestId(Cookie) で利用回数管理
// レスポンス: { success: boolean, data?, error? }
```

---

## AI 利用方針

**画像生成は ChatGPT（OpenAI gpt-image-2 / ChatGPT Images 2.0）一本で行う。** 呼び出しは統一ディスパッチャ
`generateImageWithFallback()` 経由（メインエンジンが gpt-image-2）。直接 API を叩かない。
**nano-banana-pro-preview は基本使わない**（adbanner はロゴを入力画像として渡さないため、常に gpt-image-2 が選択される。
nano-banana は gpt-image-2 がAPI障害で完全に落ちた時の最終フォールバックとしてのみ残る）。

| 用途 | エンジン | 備考 |
|------|---------|------|
| バナー画像生成 | `generateImageWithFallback()`（`src/lib/image-generator.ts`） | **gpt-image-2（ChatGPT Images 2.0）のみ**。`inputImages` は渡さない（=常にgpt-image-2経路） |
| URL解析・ブランド抽出 | Gemini（`geminiGenerateJson`） | スクレイプ結果から色・サービス概要をJSON抽出 |
| AI自動フィードバック | Gemini（`geminiGenerateJson`） | 画像+メタ情報を渡し観点別採点JSONを返す |
| 改善提案（Phase2） | Gemini（`geminiGenerateJson`） | 数値×FBから改善案を生成 |

### ロゴの扱い（重要・確定仕様）
ロゴは **gpt-image-2 に描かせない**（AIはロゴを正確に再現できないため）。代わりに次の2段構え:

1. **生成時にロゴ用スペースを空ける** — プロンプトで「指定位置（例: 左上 / 右下）にロゴ配置用の余白（無地・単色のセーフゾーン）を確保し、そこには文字・図形を置かない」と明示的に指示
2. **生成後に実ロゴを重ねる** — アップロードされた実ロゴ画像を **Sharp で合成（composite）** し、上記セーフゾーンにオーバーレイ

- 合成ロジック: 新規 `src/lib/adbanner/logo-overlay.ts`（Sharp 使用、プロジェクトに導入済み）
- ロゴ配置設定: 位置（9分割グリッドの隅・中央）/ 余白(padding) / 最大幅(%) をキャンペーン設定として保持
- これにより **ブランドロゴが原寸・高精度で必ず正しく入る**（AI生成のブレを排除）

### 広告特化プロンプト設計（新規 `src/lib/adbanner/prompts.ts`）
- 既存 `banner-prompts-v2.ts` は流用せず、広告に特化して新規作成（確定方針）
- プロンプト要素: 媒体別レギュレーション / 訴求軸テンプレ（ベネフィット・限定・権威・実績・共感）/ CTA定型 / 文字占有率の指示 / ブランドカラー・ロゴ指示
- 量産時は「訴求軸 × トーン」の組合せでバリエーションを作る

---

## 料金（`src/lib/pricing.ts` に `ADBANNER_PRICING`）

統一プラン方式に準拠。日次リセットは 00:00 JST（`getJstStartOfToday()`）。

| プラン | 日次上限（生成枚数） | フィードバック | サイズ | Phase2改善 |
|--------|---------------------|---------------|--------|-----------|
| ゲスト | 3枚/日 | 1回まで | 1080x1080固定 | × |
| 無料会員 | 9枚/日 | あり | 1080x1080固定 | × |
| PRO（¥9,980 統一プラン） | 60枚/日 | あり | 全サイズ | ○ |

> 個別課金はしない。プラン判定は `User.plan` 単一参照（unified-plan.ts / UnifiedPricingPlans）。

---

## 実装手順（`reference/07-dev-guide.md` 準拠）

1. **services.ts 登録** — `SERVICES` に `id:'adbanner'` を追加（status は最初 `coming_soon`）
   ```typescript
   {
     id: 'adbanner',
     name: 'ドヤ広告バナーAI',
     icon: 'campaign',
     color: 'purple',
     gradient: 'from-purple-500 to-orange-500',
     href: '/adbanner',
     dashboardHref: '/adbanner/dashboard',
     status: 'coming_soon',
     category: 'image',
     order: <既存末尾+1>,
     requiresAuth: false,
   }
   ```
2. **pricing.ts** — `ADBANNER_PRICING` を追加
3. **auth.ts** — session callback でプラン参照は統一プラン（`User.plan`）に従う（個別プランフィールドは不要）
4. **Prisma** — `AdBannerCampaign` / `AdBannerCreative` を追加 → `npx prisma generate` → 本番は手動DDL
5. **ページ** — `src/app/adbanner/`（LP / dashboard / new / [campaignId] / pricing）
6. **API** — `src/app/api/adbanner/`（上記エンドポイント、Phase1分のみ）
7. **lib** — `src/lib/adbanner/`（prompts.ts / generate.ts / scrape.ts / feedback.ts / access.ts / types.ts）
8. **サイドバー** — `src/components/sidebar/` に adbanner テーマ追加
9. **service-status.md 更新** — 新サービス行を追加
10. **ビルド確認** — `npx next build`（`09_Cursol/src/` のみ編集）

---

## フェーズ計画

| フェーズ | 範囲 | 状態 |
|---------|------|------|
| **Phase 1（MVP）** | キャンペーン作成 / URL解析 / 量産生成 / ロゴ・色反映 / AI自動フィードバック / 再生成 | 今回実装 |
| **Phase 2** | パフォーマンス数値入力（手動・CSV）/ 数値×FB分析 / 勝ちパターン継承の次世代量産 / 世代管理 | 次回 |
| **Phase 3（候補）** | 広告媒体API連携で数値自動取得 / 動画クリエイティブ / 自動スケジュール量産 | 将来 |

---

## 守るべきルール（既存サービス共通）

1. **編集は `09_Cursol/src/` のみ**（`doya-ai/` は本番に反映されない）
2. **画像生成は `generateImageWithFallback()` 経由**（直接 OpenAI/Gemini を叩かない）
3. **NextAuth ハンドラーを改変しない**（全ページ500の原因）
4. **`useSearchParams()` は `<Suspense>` で包む**（Vercelビルド失敗回避）
5. **本番DBは手動 push**（列追加後 `POSTGRES_PRISMA_URL` で ALTER）
6. **個別課金しない**（統一プラン方式・`User.plan` 単一参照）
7. **大きな画像は一度に読み込まない**（一覧はサムネ優先、Base64は10MB超で413）
8. **非ASCII を HTTP ヘッダに生で入れない**（必要なら `encodeURIComponent`）

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-06-13 | 初版作成。要件定義（Phase1=量産生成+AI自動フィードバック / Phase2=数値改善ループ）。serviceId=adbanner 確定。未実装 |
