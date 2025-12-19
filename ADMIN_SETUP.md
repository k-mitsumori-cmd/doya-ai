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

1. **パスワードハッシュ化**: bcrypt（12ラウンド）を使用
2. **レート制限**: 
   - ログイン試行は15分間に最大5回まで
   - 上限を超えると15分間ロックアウト
   - IPアドレスとユーザー名の両方で制限
3. **JWTトークン**: 24時間有効期限
4. **HTTPOnly Cookie**: XSS攻撃から保護
5. **SameSite Cookie**: CSRF攻撃から保護
6. **ログイン試行ログ**: すべての試行を記録（成功/失敗）
7. **セッション管理**: データベースでセッションを管理
8. **タイミング攻撃対策**: ユーザーが存在しない場合も同じ処理時間

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
2. ユーザー名とパスワードを入力
3. 認証成功後、ダッシュボードにリダイレクト

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

