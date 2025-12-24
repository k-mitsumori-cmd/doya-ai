# 🔐 管理者認証システム セットアップガイド

本番環境向けのセキュアな管理者認証システムのセットアップ手順です。

## 📋 前提条件

1. Prismaスキーマのマイグレーションが完了していること
2. データベースが正常に接続できること
3. 必要なパッケージがインストールされていること

## 🔧 セットアップ手順

### 1. 環境変数の設定

`.env.local`（またはVercelの環境変数）に以下を追加：

```env
# 管理者認証用JWT秘密鍵（必須）
# NEXTAUTH_SECRETを使用することも可能
ADMIN_JWT_SECRET=your-super-secret-key-min-32-characters-long

# または既存のNEXTAUTH_SECRETを使用（推奨）
# ADMIN_JWT_SECRETは設定しなくても、NEXTAUTH_SECRETが使用されます
```

**⚠️ 重要**: 本番環境では必ず強力な秘密鍵を設定してください（32文字以上推奨）

### 2. データベースマイグレーション

Prismaスキーマをデータベースに適用：

```bash
npx prisma generate
npx prisma db push
```

### 3. 初期管理者ユーザーの作成

管理者ユーザーを作成するには、スクリプトを使用します：

```bash
# tsxが必要な場合
npm install -D tsx

# 管理者ユーザー作成
npx tsx src/scripts/create-admin.ts <username> <password> [email] [name]
```

### 3.0 すでに管理者がいるか確認

```bash
npx tsx src/scripts/check-admin-users.ts
```

### 3.1 既存管理者のパスワードをリセット（または存在しなければ作成）

ユーザー名が既に存在するか不明な場合や、パスワードを忘れた場合は `upsert-admin.ts` を使うと安全です。

```bash
npx tsx src/scripts/upsert-admin.ts <username> <password> [email] [name]
```

**例**:
```bash
npx tsx src/scripts/create-admin.ts admin SecureP@ssw0rd123! admin@example.com "管理者"
```

**パスワード要件**:
- 12文字以上
- 大文字を含む
- 小文字を含む
- 数字を含む
- 記号を含む（!@#$%^&*など）

## 🔒 セキュリティ機能

### 実装されているセキュリティ対策

1. **Cloudflare Turnstile**: ボット対策CAPTCHA（オプション）
2. **パスワードハッシュ化**: bcrypt（12ラウンド）を使用
3. **レート制限**: 
   - ログイン試行は15分間に最大5回まで
   - 上限を超えると15分間ロックアウト
   - IPアドレスとユーザー名の両方で制限
4. **JWTトークン**: 24時間有効期限
5. **HTTPOnly Cookie**: XSS攻撃から保護
6. **SameSite Cookie**: CSRF攻撃から保護
7. **ログイン試行ログ**: すべての試行を記録（成功/失敗）
8. **セッション管理**: データベースでセッションを管理
9. **タイミング攻撃対策**: ユーザーが存在しない場合も同じ処理時間

### Cloudflare Turnstile（CAPTCHA）の設定

ボットによる不正ログイン試行を防ぐため、Cloudflare Turnstileを導入できます。

#### 1. Cloudflare Dashboardでの設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. サイドバーの「Security」→「Turnstile」を選択
3. 「Add Widget」をクリック
4. サイト名を入力（例: "DOYA-AI Admin"）
5. ドメインを追加（例: `doya-ai.vercel.app`）
6. Widget Modeを「Managed」に設定
7. 「Create」をクリック
8. **Site Key**と**Secret Key**を取得

#### 2. 環境変数の設定

Vercel（または`.env.local`）に以下を追加:

```env
# フロントエンド用サイトキー（公開可）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAX...

# バックエンド用シークレットキー（非公開）
TURNSTILE_SECRET_KEY=0x4AAAAAAAX...

# CAPTCHAを必須にする場合（オプション）
REQUIRE_TURNSTILE=true
```

#### 3. 動作確認

1. `/admin/login`にアクセス
2. CAPTCHAウィジェットが表示されることを確認
3. CAPTCHAを完了するとログインボタンが有効になる

#### テスト用キー（開発時のみ）

開発時にテストする場合、Cloudflareが提供するテスト用キーを使用できます:

```env
# テスト用（常に成功）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# テスト用（常に失敗）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=2x00000000000000000000AB
TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AB
```

### 追加のCloudflareセキュリティ（推奨）

#### Cloudflare Access（ゼロトラスト）

管理画面をさらに保護するため、Cloudflare Accessを設定できます:

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. 「Add an Application」→「Self-hosted」
3. Application name: "DOYA-AI Admin"
4. Application domain: `doya-ai.vercel.app/admin/*`
5. ポリシーを設定（例: 特定のメールアドレスのみ許可）

これにより、管理画面へのアクセス前にCloudflareの認証が必要になります。

#### WAFルール

Cloudflare WAFで追加のセキュリティルールを設定:

1. Security → WAF → Custom Rules
2. 「Create rule」
3. 例: 特定の国からの管理画面アクセスをブロック
   - Expression: `(http.request.uri.path contains "/admin") and (ip.geoip.country ne "JP")`
   - Action: Block

### セキュリティ推奨事項

1. **環境変数の保護**: 
   - `.env.local`を`.gitignore`に追加
   - Vercelでは環境変数を設定画面で設定

2. **HTTPSの使用**: 
   - 本番環境では必ずHTTPSを使用
   - `secure`フラグが自動的に有効になります

3. **定期的なパスワード変更**: 
   - 管理者パスワードを定期的に変更

4. **ログイン試行の監視**: 
   - `AdminLoginAttempt`テーブルを定期的に確認
   - 不審なアクセスを検出

5. **セッション管理**: 
   - 不要なセッションを定期的に削除
   - 最大5セッションまで保持

## 📊 データベース構造

### AdminUser テーブル
- 管理者ユーザー情報
- パスワードはハッシュ化されて保存

### AdminLoginAttempt テーブル
- すべてのログイン試行を記録
- IPアドレス、User Agent、成功/失敗を記録

### AdminSession テーブル
- アクティブなセッションを管理
- トークン、有効期限、IPアドレスを記録

## 🚀 使用方法

### ログイン

1. `/admin/login`にアクセス
2. ユーザー名またはメールとパスワードを入力（どちらでもOK）
3. 認証成功後、ダッシュボードにリダイレクト

### 初期管理者の自動作成（Bootstrap / 任意）

本番環境で **管理者がまだ1人も存在しない場合のみ**、環境変数から初期管理者を自動作成できます。

```env
ADMIN_BOOTSTRAP_EMAIL=k-mitsumori@surisuta.jp
ADMIN_BOOTSTRAP_PASSWORD=StrongP@ssw0rd123!
```

※ 既に管理者が存在する場合は何もしません。

### 緊急復旧ログイン（Break-glass / 任意・推奨はしない）

「既存の管理者がいるが、誰もログインできない」などの緊急時だけ使う復旧手段です。  
有効化した場合、指定のメール/パスワードでログイン成功した瞬間に、そのメールの管理者をDBに作成/更新します。

```env
ADMIN_BREAKGLASS_ENABLED=true  # true / 1 / on / yes でも可
ADMIN_BREAKGLASS_EMAIL=k-mitsumori@surisuta.jp
ADMIN_BREAKGLASS_PASSWORD=StrongP@ssw0rd123!
```

※ `ADMIN_BREAKGLASS_PASSWORD` は **12文字以上** かつ **大文字/小文字/数字/記号** を含める必要があります。

⚠️ 使い終わったら必ず `ADMIN_BREAKGLASS_ENABLED` を `false` に戻してください。

### ログアウト

1. 管理画面の「ログアウト」ボタンをクリック
2. セッションが削除され、ログインページにリダイレクト

### セッション確認

サーバーサイドでは自動的に認証チェックが行われます。  
クライアントサイドでは`/api/admin/auth/session`エンドポイントを使用します。

## 🔍 トラブルシューティング

### ログインできない

1. **パスワードが正しいか確認**
2. **ロックアウトされていないか確認**（15分待つ）
3. **データベース接続を確認**
4. **環境変数（ADMIN_JWT_SECRET）が設定されているか確認**

### セッションが切れる

1. **JWTトークンの有効期限**は24時間です
2. **ブラウザのCookieが有効か確認**
3. **HTTPSを使用しているか確認**（本番環境）

### エラーログの確認

```bash
# Vercelのログを確認
vercel logs

# またはローカルで確認
npm run dev
```

## 📝 API エンドポイント

### POST /api/admin/auth/login
- 管理者ログイン
- リクエスト: `{ username: string, password: string }`
- レスポンス: `{ success: boolean, adminUser: {...} }`

### POST /api/admin/auth/logout
- 管理者ログアウト
- セッションを削除

### GET /api/admin/auth/session
- セッション確認
- レスポンス: `{ authenticated: boolean, adminUser?: {...} }`

## ⚠️ 注意事項

1. **本番環境では必ず強力な秘密鍵を設定してください**
2. **管理者アカウントは最小限に保つ**
3. **定期的にセキュリティ監査を実施**
4. **ログイン試行ログを定期的に確認**

## 📚 関連ファイル

- `src/lib/admin-auth.ts` - 認証ユーティリティ
- `src/lib/admin-middleware.ts` - 認証ミドルウェア
- `src/app/api/admin/auth/*` - 認証API
- `src/app/admin/login/page.tsx` - ログインページ
- `src/scripts/create-admin.ts` - 管理者作成スクリプト

