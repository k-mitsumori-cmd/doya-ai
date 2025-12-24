# ドヤバナーAI 開発仕様書

> **この仕様書を必ず読んでから開発してください。**  
> 過去に発生したエラーの原因と対策をまとめています。

---

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [技術スタック](#技術スタック)
3. [ディレクトリ構成](#ディレクトリ構成)
4. [環境変数（必須）](#環境変数必須)
5. [認証・セッション](#認証セッション)
6. [Stripe決済](#stripe決済)
7. [プラン管理](#プラン管理)
8. [画像生成API](#画像生成api)
9. [⚠️ 絶対に守るべきルール](#️-絶対に守るべきルール)
10. [過去に発生したエラーと対策](#過去に発生したエラーと対策)
11. [デプロイ手順](#デプロイ手順)
12. [本番チェックリスト](#本番チェックリスト)

---

## プロジェクト概要

**ドヤバナーAI** は、URLを入力するだけでAIがサイトを解析し、最適なバナー画像を自動生成するサービスです。

- **本番URL**: `https://doya-ai.surisuta.jp`
- **バナー機能エントリ**: `/banner` (URL自動生成ページ)
- **ダッシュボード**: `/banner/dashboard/*`

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 認証 | NextAuth.js (Google OAuth) |
| データベース | PostgreSQL + Prisma |
| 決済 | Stripe |
| AI (テキスト) | Google Gemini API |
| AI (画像) | Nano Banana Pro |
| ホスティング | Vercel |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── banner/           # バナー機能のページ群
│   │   ├── page.tsx      # /banner (URL自動生成)
│   │   ├── url/          # /banner/url
│   │   ├── dashboard/    # ダッシュボード
│   │   ├── gallery/      # ギャラリー
│   │   └── pricing/      # 料金ページ
│   ├── api/
│   │   ├── auth/         # NextAuth
│   │   ├── banner/       # バナー生成API
│   │   └── stripe/       # Stripe関連API
│   └── auth/             # ログインページ
├── components/           # 共通コンポーネント
├── lib/                  # ユーティリティ・設定
│   ├── auth.ts           # NextAuth設定
│   ├── stripe.ts         # Stripe設定
│   ├── pricing.ts        # プラン定義
│   ├── prisma.ts         # Prismaクライアント
│   └── nanobanner.ts     # 画像生成ロジック
└── types/                # 型定義
```

---

## 環境変数（必須）

Vercelの環境変数に以下を**必ず**設定してください。

### 基本設定
```env
NEXTAUTH_URL=https://doya-ai.surisuta.jp
NEXTAUTH_SECRET=（ランダム文字列）
NEXT_PUBLIC_APP_URL=https://doya-ai.surisuta.jp
```

### データベース
```env
DATABASE_URL=postgresql://...
```

### Google OAuth
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Stripe
```env
STRIPE_SECRET_KEY=sk_live_...          # 本番はsk_live_、テストはsk_test_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BANNER_PRO_MONTHLY=price_...
STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY=price_...
```

### AI
```env
GEMINI_API_KEY=...
NANOBANANA_API_KEY=...
```

---

## 認証・セッション

### NextAuthの設定ファイル
- **`src/lib/auth.ts`**: authOptions定義
- **`src/app/api/auth/[...nextauth]/route.ts`**: ハンドラー

### ⚠️ 注意点

1. **ハンドラーは標準形式を維持する**
   ```typescript
   // ✅ 正しい
   import NextAuth from 'next-auth'
   import { authOptions } from '@/lib/auth'
   const handler = NextAuth(authOptions)
   export { handler as GET, handler as POST }

   // ❌ 間違い（500エラーの原因）
   // リクエストごとにauthOptionsを動的生成するとセッションが壊れる
   ```

2. **NEXTAUTH_URLは末尾スラッシュなし**
   ```
   ✅ https://doya-ai.surisuta.jp
   ❌ https://doya-ai.surisuta.jp/
   ```

3. **Google OAuth設定**
   - 承認済みリダイレクトURI: `https://doya-ai.surisuta.jp/api/auth/callback/google`

---

## Stripe決済

### 価格ID設定
`src/lib/stripe.ts` の `STRIPE_PRICE_IDS` で管理。

### ⚠️ 注意点

1. **テスト/ライブモードを混在させない**
   - `sk_test_` と `price_...（ライブ）` を混ぜると決済エラー
   - 本番は `sk_live_` / `pk_live_` / ライブのwebhook secret を揃える

2. **戻り先URLは環境変数から取得**
   ```typescript
   // ✅ 正しい
   const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
   
   // ❌ 間違い（ハードコード）
   const baseUrl = 'https://doya-ai.vercel.app'
   ```

3. **Webhook署名検証を必ず行う**
   - `STRIPE_WEBHOOK_SECRET` が正しくないとイベント処理されない

---

## プラン管理

### プラン定義
`src/lib/pricing.ts` に集約。

| プラン | 日次上限 | サイズ指定 | 月額 |
|--------|----------|------------|------|
| GUEST | 3枚 | 1080x1080固定 | ¥0 |
| FREE (ログイン) | 9枚 | 1080x1080固定 | ¥0 |
| PRO | 50枚 | カスタム可 | ¥9,980 |
| ENTERPRISE | 500枚 | カスタム可 | ¥49,800 |

### 日次リセット
- **00:00 JST** にリセット
- `getJstStartOfToday()` を使用

---

## 画像生成API

### エンドポイント
- `POST /api/banner/from-url`: URLからバナー自動生成
- `POST /api/banner/generate`: 手動設定で生成
- `POST /api/banner/refine`: チャットで編集

### ⚠️ 注意点

1. **画像サイズは厳密に保持**
   - refine時に元サイズを維持（sharpで後処理）

2. **リクエストサイズ制限**
   - 画像アップロードはクライアントで圧縮してから送信
   - Base64で10MB以上になると413エラー

---

## ⚠️ 絶対に守るべきルール

### 1. NextAuthハンドラーを改変しない
```typescript
// src/app/api/auth/[...nextauth]/route.ts
// このファイルは標準形式を維持すること
```
**理由**: 動的生成すると `/api/auth/session` が500になりサイト全体が死ぬ

### 2. useSearchParamsはSuspenseで包む
```typescript
// ✅ 正しい
function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  )
}

function PageInner() {
  const searchParams = useSearchParams()
  // ...
}
```
**理由**: Vercelビルド時に `useSearchParams() should be wrapped in a suspense boundary` エラー

### 3. 環境変数のハードコードを避ける
```typescript
// ✅ 正しい
const url = process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'

// ❌ 間違い
const url = 'https://doya-ai.vercel.app'
```
**理由**: ドメイン変更時に全箇所修正が必要になる

### 4. Stripeのモードを統一する
- 本番: `sk_live_` + `pk_live_` + ライブのPrice ID + ライブのWebhook Secret
- テスト: `sk_test_` + `pk_test_` + テストのPrice ID + テストのWebhook Secret

### 5. 大きなファイルを一度に読み込まない
- ギャラリー/履歴はサムネイル優先
- 必要な時だけフル画像を取得

---

## 過去に発生したエラーと対策

| エラー | 原因 | 対策 |
|--------|------|------|
| HTTP 500 (全ページ) | NextAuthハンドラーの改変 | 標準形式に戻す |
| `redirect_uri_mismatch` | NEXTAUTH_URL不一致 | 環境変数とGoogle OAuth設定を確認 |
| Vercelビルド失敗 | `useSearchParams()` 未wrap | `<Suspense>` で包む |
| Stripe決済エラー | test/liveモード不一致 | 全てのStripe設定を同一モードに統一 |
| 画像アップロード失敗 | リクエストサイズ超過 | クライアントで圧縮 |
| プラン反映されない | Webhook未到達 | `/api/stripe/sync/latest` で手動同期 |
| 解約日が表示されない | Stripe APIから直接取得していない | `/api/stripe/subscription/status` を使用 |

---

## デプロイ手順

### 1. コミット
```bash
git add -A
git commit -m "feat: 変更内容"
```

### 2. Vercelへプッシュ（subtree使用）
```bash
git branch -D doya-ai-deploy 2>/dev/null || true
git subtree split --prefix=doya-ai -b doya-ai-deploy
git push vercel doya-ai-deploy:main --force
```

### 3. Vercelダッシュボードで確認
- ビルドログにエラーがないか
- デプロイ完了後に主要ページを確認

---

## 本番チェックリスト

デプロイ後に以下を確認：

- [ ] `https://doya-ai.surisuta.jp/` が200で表示される
- [ ] `/api/auth/session` が200を返す
- [ ] `/banner` が正常に表示される
- [ ] Googleログインが動作する
- [ ] バナー生成が動作する（無料枠で1枚テスト）
- [ ] Stripe決済ページに遷移できる
- [ ] 決済後にプランが反映される

---

## 連絡先

問題が発生した場合は、このドキュメントを参照してから対応してください。
それでも解決しない場合は開発チームへ連絡。

---

*最終更新: 2025年12月24日*

