# ローカル環境での一括生成セットアップ

## 前提条件

1. PostgreSQLデータベースへの接続URL（`DATABASE_URL`）
2. Google AI Studio APIキー（`GOOGLE_GENAI_API_KEY`）

## セットアップ手順

### 1. 環境変数ファイルの作成

```bash
cd doya-ai
cp env.example.txt .env.local
```

### 2. 環境変数の設定

`.env.local` を編集して、以下を設定してください：

```bash
# データベース接続URL（必須）
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# Google AI Studio APIキー（必須）
GOOGLE_GENAI_API_KEY=your-google-ai-studio-api-key
```

### 3. ローカルサーバーの起動

```bash
npm run dev
```

別ターミナルで実行してください。サーバーが起動したら、次のステップに進みます。

### 4. 一括生成スクリプトの実行

```bash
node scripts/local-bootstrap.mjs
```

## 実行時間

- 全テンプレート（約330個）: 約2.75時間
- 1テンプレートあたり: 約30秒（レート制限対策）

## 注意事項

- 既に画像があるテンプレートは自動的にスキップされます
- 最初のテンプレートが自動的に `isFeatured: true` に設定されます
- 処理中にエラーが発生した場合、エラー詳細が表示されます
- 処理は中断されず、エラーが発生したテンプレートをスキップして続行します

## トラブルシューティング

### エラー: "Invalid value undefined for datasource"

→ `.env.local` に `DATABASE_URL` が正しく設定されているか確認してください

### エラー: "バナーが生成されませんでした"

→ `GOOGLE_GENAI_API_KEY` が正しく設定されているか確認してください
→ APIキーのレート制限に達していないか確認してください

### ローカルサーバーが起動しない

→ ポート3000が使用中でないか確認してください
→ `npm install` を実行して依存関係をインストールしてください
