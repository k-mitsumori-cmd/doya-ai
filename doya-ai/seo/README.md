# ドヤ記事作成（/seo）

「SEO + LLMOに強い長文記事」を**分割生成パイプライン**で安定して作るためのツールです。  
URLは `https://<host>/seo` です（Next.js App Router配下）。

## できること（実装済み）
- **記事作成フォーム**: キーワード/ペルソナ/検索意図/タイトル/目標文字数/参考URL/トーン/禁止事項
- **参考URLの本文抽出→要約/構造解析**（丸写し禁止の方針で要点化）
- **ジョブ式の分割生成**（advance方式）  
  - アウトライン作成 → セクション分割生成 → セクション整合性チェック → 統合版生成
- **品質監査（監査レポート）** と **自動修正（リライト）**
- **バナー画像 / 図解画像の生成**（Gemini画像生成、PNGでローカル保存）
- **リンクチェック**（HEAD/GETで到達確認、リダイレクト先表示）
- **“AIっぽさメモ”**（次回リライトの入力に反映）

## 動かし方
- 必須環境変数:
  - `DATABASE_URL`（PostgreSQL）
  - `GOOGLE_GENAI_API_KEY`（Gemini API）

```bash
cd doya-ai
npm install
npm run db:push
npm run dev
```

## 注意（ローカル保存について）
- 画像は `doya-ai/seo/storage/images/` に保存します（**ローカル前提**）。
- **Vercelなどのサーバレス本番**ではファイル永続ができないため、将来的にはS3/R2等へ差し替え推奨です。

## 開発メモ（依存関係）
- ESLintの整合性のため、`@typescript-eslint/eslint-plugin` / `@typescript-eslint/parser` を `devDependencies` に追加しています。  
  `npm install` 後に `npm run lint` が通る想定です。

## 設計メモ（重要）
- 生成ジョブは `POST /api/seo/jobs/:id/advance` を叩くたびに **1ステップだけ前進**します。  
  サーバレスでも「途中から再開」「失敗したセクションだけ再実行」がしやすい構成です。
- 生成物はDBに保存します（記事/アウトライン/セクション/監査/メモ/画像メタ/リンクチェック）。
- 画像ファイルは `doya-ai/seo/storage/images/` に保存します（ローカル前提）。


