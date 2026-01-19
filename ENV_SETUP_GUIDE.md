# 環境変数設定ガイド

## 一括生成に必要な環境変数

ローカル環境でバナーテンプレートの一括生成を実行するには、以下の**2つの環境変数**を設定する必要があります。

### 1. DATABASE_URL（必須）

PostgreSQLデータベースへの接続URLです。

#### 設定方法

`.env.local` ファイルに以下を追加：

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

#### 接続URLの例

**Supabaseの場合:**
```
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=public
```

**Vercel Postgresの場合:**
```
DATABASE_URL=postgres://default:password@xxxxx.vercel-storage.com:5432/verceldb
```

**ローカルPostgreSQLの場合:**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/doya_ai?schema=public
```

#### 取得方法

- **Supabase**: プロジェクト設定 → Database → Connection string
- **Vercel Postgres**: Vercel Dashboard → Storage → Postgres → .env.local
- **Neon**: Dashboard → Connection Details → Connection string
- **ローカル**: PostgreSQLをインストールして作成

---

### 2. GOOGLE_GENAI_API_KEY（必須）

Google AI Studio APIキーです。バナー画像の生成に使用されます。

#### 設定方法

`.env.local` ファイルに以下を追加：

```bash
GOOGLE_GENAI_API_KEY=your-api-key-here
```

#### 取得方法

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. 「Get API key」をクリック
3. 「Create API key」でキーを作成
4. 生成されたAPIキーをコピーして `.env.local` に貼り付け

**注意**: APIキーは秘密情報です。`.env.local` は `.gitignore` に含まれているため、Gitにコミットされません。

---

## セットアップ手順

### ステップ1: 環境変数ファイルを作成

```bash
cd doya-ai
cp env.example.txt .env.local
```

### ステップ2: 環境変数を設定

`.env.local` を編集して、上記の2つの環境変数を設定：

```bash
# データベース接続URL
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# Google AI Studio APIキー
GOOGLE_GENAI_API_KEY=your-google-ai-studio-api-key
```

### ステップ3: 設定の確認

```bash
# 環境変数が正しく読み込まれるか確認（オプション）
node -e "require('dotenv').config({ path: '.env.local' }); console.log('DATABASE_URL:', process.env.DATABASE_URL ? '設定済み' : '未設定'); console.log('GOOGLE_GENAI_API_KEY:', process.env.GOOGLE_GENAI_API_KEY ? '設定済み' : '未設定');"
```

---

## その他の環境変数（オプション）

一括生成には上記2つだけで十分ですが、他の機能を使用する場合は以下も設定が必要です：

- `NEXTAUTH_URL`: NextAuth.jsのURL（認証機能を使用する場合）
- `NEXTAUTH_SECRET`: NextAuth.jsのシークレット（認証機能を使用する場合）
- `GOOGLE_CLIENT_ID`: Google OAuth（認証機能を使用する場合）
- `GOOGLE_CLIENT_SECRET`: Google OAuth（認証機能を使用する場合）

---

## トラブルシューティング

### エラー: "Invalid value undefined for datasource"

→ `DATABASE_URL` が正しく設定されているか確認してください
→ `.env.local` ファイルが `doya-ai` ディレクトリに存在するか確認してください

### エラー: "バナーが生成されませんでした"

→ `GOOGLE_GENAI_API_KEY` が正しく設定されているか確認してください
→ APIキーが有効か確認してください（Google AI Studioで確認）

### 環境変数が読み込まれない

→ `.env.local` ファイルが `doya-ai` ディレクトリのルートに存在するか確認してください
→ ローカルサーバーを再起動してください（`npm run dev`）
