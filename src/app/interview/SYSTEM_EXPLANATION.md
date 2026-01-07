# ドヤインタビューAI - システム説明

## 動画・音声アップロードから記事生成までの流れ

### 1. 素材アップロード（`/interview`）

**ユーザー操作:**
- ドラッグ&ドロップまたはファイル選択で音声・動画・テキスト・PDFをアップロード

**システム処理:**
1. **ファイル検証**
   - ファイルタイプ判定（audio/video/text/pdf）
   - ファイルサイズチェック

2. **プロジェクト作成**
   - `POST /api/interview/projects`
   - 新しいプロジェクトレコードを作成
   - ステータス: `UPLOADING`

3. **ファイル保存**
   - `POST /api/interview/materials/upload`
   - ファイルをサーバーの `uploads/interview/{projectId}/` に保存
   - `InterviewMaterial` レコードを作成
   - ステータス: `UPLOADED`

### 2. 文字起こし処理（音声・動画の場合）

**システム処理:**
1. **文字起こしAPI呼び出し**
   - `POST /api/interview/transcribe`
   - 音声・動画ファイルを文字起こしAPI（Google Speech-to-Text、Whisper等）に送信
   - 現在はプレースホルダー実装（実際のAPI連携はTODO）

2. **文字起こし結果の保存**
   - `InterviewTranscription` レコードを作成
   - テキスト、セグメント情報、信頼度スコアを保存
   - ステータス: `COMPLETED`

3. **素材ステータス更新**
   - `InterviewMaterial.status` を `COMPLETED` に更新

### 3. 構成案生成

**システム処理:**
1. **文字起こしテキストの取得**
   - プロジェクトに紐づく全ての `InterviewTranscription` を取得
   - テキストを結合

2. **AIによる構成案生成**
   - `POST /api/interview/outline`
   - `lib/interview/prompts.ts` の `generateOutline()` を呼び出し
   - Google Gemini APIを使用して構成案を生成
   - プロンプト内容:
     - 文字起こしテキスト
     - 企画案情報（タイトル、概要、質問リスト）
     - 出力形式: リード文、見出し、段落要約、引用候補

3. **構成案の保存**
   - `InterviewProject.outline` に保存（Text型）

### 4. 記事ドラフト生成

**システム処理:**
1. **構成案の取得**
   - `InterviewProject.outline` を取得

2. **AIによる記事生成**
   - `POST /api/interview/draft`
   - `lib/interview/prompts.ts` の `generateDraft()` を呼び出し
   - Google Gemini APIを使用して記事を生成
   - プロンプト内容:
     - 文字起こしテキスト
     - 構成案（見出し、段落要約）
     - トーン設定（friendly/professional/casual/formal）
     - 出力形式: リード文、本文、要点メモ、タイトル案

3. **ドラフトの保存**
   - `InterviewDraft` レコードを作成
   - バージョン管理（version: 1, 2, 3...）
   - 文字数、読了時間を自動計算
   - ステータス: `DRAFT`

### 5. 校閲・品質チェック（オプション）

**システム処理:**
1. **校閲実行**
   - `POST /api/interview/review`
   - `lib/interview/prompts.ts` の `generateReview()` を呼び出し
   - Google Gemini APIを使用して校閲レポートを生成

2. **校閲結果の保存**
   - `InterviewReview` レコードを作成
   - スコア、読みやすさスコア、修正提案を保存

### 6. エクスポート

**システム処理:**
1. **フォーマット変換**
   - `POST /api/interview/export`
   - フォーマット: Markdown / HTML / Word（docx）
   - ドラフト内容を指定フォーマットに変換

2. **出力**
   - ファイルダウンロードまたはコピー

## データベース構造

```
InterviewProject (プロジェクト)
  ├── InterviewMaterial[] (素材)
  ├── InterviewTranscription[] (文字起こし)
  ├── InterviewDraft[] (ドラフト)
  └── InterviewReview[] (校閲)

InterviewRecipe (レシピ・テンプレート)
  └── InterviewProject[] (使用プロジェクト)
```

## APIフロー図

```
[ユーザー] ファイルアップロード
    ↓
[API] POST /api/interview/projects (プロジェクト作成)
    ↓
[API] POST /api/interview/materials/upload (ファイル保存)
    ↓
[API] POST /api/interview/transcribe (文字起こし) [音声・動画の場合]
    ↓
[API] POST /api/interview/outline (構成案生成)
    ↓
[AI] Google Gemini API (構成案生成)
    ↓
[API] POST /api/interview/draft (記事生成)
    ↓
[AI] Google Gemini API (記事生成)
    ↓
[DB] InterviewDraft 保存
    ↓
[ユーザー] プロジェクト詳細ページで確認・編集
```

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), React, Framer Motion
- **バックエンド**: Next.js API Routes
- **データベース**: PostgreSQL (Prisma ORM)
- **AI**: Google Gemini API
- **ファイルストレージ**: ローカルファイルシステム（本番環境ではS3等を推奨）
- **文字起こし**: Google Speech-to-Text / OpenAI Whisper（実装予定）

## 注意事項

1. **ファイルストレージ**: 現在はローカルファイルシステムを使用。本番環境ではS3等のクラウドストレージを推奨
2. **文字起こしAPI**: 現在はプレースホルダー実装。実際のAPI連携が必要
3. **エラーハンドリング**: 各ステップでエラーが発生した場合、ユーザーに通知し、手動で再実行可能
4. **パフォーマンス**: 大きなファイルの処理には時間がかかるため、非同期処理と進捗表示を実装

