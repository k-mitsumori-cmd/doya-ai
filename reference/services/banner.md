# ドヤバナーAI

## 概要
- **パス**: `/banner`
- **サービスID**: `banner`
- **本番URL**: `https://doya-ai.surisuta.jp/banner`
- **説明**: AIでプロ品質のバナーをA/B/C 3案同時生成
- **ステータス**: active
- **カテゴリ**: image

## 機能
- A/B/C 3案同時生成
- 10種類の業界テンプレート
- 6種類のサイズプリセット (1080x1080, 1200x628, 1080x1920 等)
- ブランドカラー設定
- 高品質PNG出力
- テンプレートから選んで生成 / 0からバナー作成
- URLから自動生成
- 生成履歴・ギャラリー
- チャットでリファイン

## 料金

| プラン | 月次上限（画像枚数） | 契約条件 |
|--------|----------------------|----------|
| ゲスト | 生成不可（ログイン必須） | — |
| 無料会員 | 15枚/月 | ¥0 |
| LIGHT相当 | 50枚/月 | 既存・個別付与の条件を参照 |
| PRO | 150枚/月 | 統一PRO ¥9,980/月（税込） |
| Enterprise相当 | 1,000枚/月 | 既存・個別契約の条件を参照 |

画像の生成枠は日本時間の月単位で管理します。月が変わると新しい枠を使用でき、日次リセットではありません。画像枚数の根拠は `src/lib/pricing.ts` の `BANNER_PRICING` / `getBannerMonthlyLimitByUserPlan()`、使用状況の根拠は `src/lib/usage-summary.ts` です。統一プランとサービス個別付与の上位を採用します。

公開料金画面は無料・統一PROの案内です。LIGHT・Enterprise相当の利用枠が存在することは、公開料金画面から新規契約できることを意味しません。購入条件は `reference/11-billing-spec.md` と現在の料金画面を参照してください。

バナーのAI相談・コピー提案には、画像の月次枚数とは別の日次枠があります。料金画面では無料10回/日、PRO100回/日、既存LIGHT30回/日、Enterprise相当1,000回/日と案内しています。

生成前の月次枠確認は4画面共通の `useBannerQuota` でサーバーの使用状況を読みます。ログイン状態・利用者・プランの切り替え後に古い表示や応答を引き継がず、確認不能時にログイン済み利用者の生成を許可しません。クライアントの確認は枠の予約ではなく、最終的な上限判定と予約はサーバーで行います。

## APIエンドポイント (28+)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/banner/generate` | バナー生成 (Gemini 3 Pro Image) |
| POST | `/api/banner/from-url` | URLからバナー自動生成 |
| POST | `/api/banner/refine` | チャットでリファイン |
| POST | `/api/banner/chat` | チャット・リファイン |
| POST | `/api/banner/copy` | コピー提案 |
| GET | `/api/banner/history` | 生成履歴取得 |
| GET | `/api/banner/gallery` | ギャラリー |
| GET | `/api/banner/image` | 画像取得 |
| GET | `/api/banner/stats` | 統計 |
| * | `/api/banner/test/*` | テスト用エンドポイント群 |

## AI モデル
- **画像生成**: `gemini-3-pro-image-preview` (環境変数 `DOYA_BANNER_IMAGE_MODEL` で変更可)
- Gemini API 直接呼出し (`generativelanguage.googleapis.com`)

## ファイル構成
```
src/app/banner/
  ├── page.tsx                # トップ / LP
  ├── url/                    # /banner/url (URL自動生成)
  ├── landing/                # ランディングページ
  ├── gallery/                # ギャラリー表示
  ├── pricing/                # 料金ページ
  └── dashboard/
      ├── page.tsx            # 選んで生成
      ├── create/page.tsx     # 0からバナー作成
      └── plan/page.tsx       # プラン・使用量

src/app/api/banner/           # 28+ APIルート
src/components/DashboardSidebar.tsx  # Banner/SEO共有サイドバー
src/lib/banners.ts            # バナー生成ロジック
src/lib/banner-prompts-v2.ts  # プロンプトテンプレート
src/lib/nanobanner.ts         # 小型バナー
src/lib/pricing.ts            # BANNER_PRICING
```

## DB テーブル
- `BannerTemplate` — テンプレート (業界・カテゴリ別)
- `Generation` — 生成履歴 (serviceId='banner')

## デザイン
- **サイドバー**: `DashboardSidebar` コンポーネント
- サイドバーナビ: 「選んで生成」(HOT)「0からバナー作成」「プラン・使用量」
- **カラー**: purple / pink
- **グラデーション**: `from-purple-500 to-pink-500`
- **アイコン**: `🎨`

## Stripe 環境変数
```env
STRIPE_SECRET_KEY=sk_live_...          # 本番はsk_live_、テストはsk_test_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BANNER_PRO_MONTHLY=price_...
STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY=price_...
```

---

## 絶対に守るべきルール

### 1. NextAuthハンドラーを改変しない
```typescript
// src/app/api/auth/[...nextauth]/route.ts は標準形式を維持
```
**理由**: 動的生成すると `/api/auth/session` が500になりサイト全体が死ぬ

### 2. useSearchParamsはSuspenseで包む
```typescript
function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  )
}
```
**理由**: Vercelビルド時にエラー

### 3. 環境変数のハードコードを避ける
```typescript
// ✅ 正しい
const url = process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'

// ❌ 間違い
const url = 'https://doya-ai.vercel.app'
```

### 4. Stripeのモードを統一する
- 本番: `sk_live_` + `pk_live_` + ライブのPrice ID + ライブのWebhook Secret
- テスト: `sk_test_` + `pk_test_` + テストのPrice ID + テストのWebhook Secret

### 5. 大きなファイルを一度に読み込まない
- ギャラリー/履歴はサムネイル優先
- 必要な時だけフル画像を取得

### 6. 画像サイズは厳密に保持
- refine時に元サイズを維持 (sharpで後処理)
- Base64で10MB以上は413エラー → クライアントで圧縮してから送信

---

## 過去に発生したエラーと対策

| エラー | 原因 | 対策 |
|--------|------|------|
| HTTP 500 (全ページ) | NextAuthハンドラーの改変 | 標準形式に戻す |
| `redirect_uri_mismatch` | NEXTAUTH_URL不一致 | 環境変数とGoogle OAuth設定を確認 |
| Vercelビルド失敗 | `useSearchParams()` 未wrap | `<Suspense>` で包む |
| Stripe決済エラー | test/liveモード不一致 | 全Stripe設定を同一モードに統一 |
| 画像アップロード失敗 | リクエストサイズ超過 | クライアントで圧縮 |
| プラン反映されない | Webhook未到達 | `/api/stripe/sync/latest` で手動同期 |
| 解約日が表示されない | Stripe APIから直接取得していない | `/api/stripe/subscription/status` を使用 |