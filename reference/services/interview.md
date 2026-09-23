# ドヤインタビューAI

## 概要
- **パス**: `/interview`
- **サービスID**: `interview`
- **説明**: 音声/動画ファイルからインタビュー記事をAI生成
- **ステータス**: active (Phase 1-3 完了)
- **カテゴリ**: text

## 機能

### Phase 1 (MVP)
- Supabase Storage 大容量ファイル直接アップロード (5GB+)
- 署名付きURL方式 (Vercelボディサイズ制限バイパス)
- プロジェクトCRUD + フロントエンド
- 素材アップロード (upload-url → confirm → XHR直接PUT)
- 文字起こし (AssemblyAI — URL渡し, サイズ無制限, speaker diarization)
- レシピ管理 + プリセット10種自動投入
- AI記事生成 (SSE ストリーミング)
- エディタ (自動保存, Markdownプレビュー)

### Phase 2 (校正・タイトル)
- 校正・校閲 (スコア + 修正候補)
- タイトル提案 (5プラットフォーム対応)
- 校正パネル (ワンクリック適用)
- タイトル提案パネル
- レシピ管理画面 (CRUD + 詳細パネル)
- 設定画面 (アカウント, プラン, 利用統計)

### Phase 3 (高度機能)
- プロジェクト概要ページ (進捗ステッパー, 統計)
- ファクトチェック (信頼性スコア, 検証項目)
- SNS投稿文生成 (6プラットフォーム, 3トーン)
- 翻訳 (10言語, Markdown保持, SEO付)
- レシピ自動生成 (サンプル記事から構成分析)

## 料金

| プラン | 文字起こし分数 | アップロード上限 | 記事生成回数 | 月額 |
|--------|-------------|---------------|------------|------|
| ゲスト | 合計5分 | 100MB | 2回/日 | ¥0 |
| 無料会員 | 毎月30分 | 500MB | 5回/日 | ¥0 |
| LIGHT | 毎月60分 | 1GB | 10回/日 | ¥2,980 |
| PRO | 毎月150分 | 2GB | 30回/日 | ¥9,980 |
| Enterprise | 毎月1,000分 | 5GB | 100回/日 | ¥49,980 |

記事生成回数は日本時間の日次枠です。記事の初回生成と同じプロジェクトでの再生成を、それぞれ1回として数えます。プロジェクト作成だけでは消費せず、生成失敗時は予約した回数を返却します。AI修正・校正・タイトル提案は、この生成回数には含みません。

## APIエンドポイント (18+)

### プロジェクト管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/interview/projects` | プロジェクト一覧 |
| POST | `/api/interview/projects` | プロジェクト作成 |
| GET | `/api/interview/projects/[id]` | プロジェクト詳細 |
| PUT | `/api/interview/projects/[id]` | プロジェクト更新 |
| DELETE | `/api/interview/projects/[id]` | プロジェクト削除 |

### 素材管理
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/materials/upload-url` | 署名付きURL取得 |
| POST | `/api/interview/materials/[id]/confirm` | アップロード確認 |
| DELETE | `/api/interview/materials/[id]` | 素材削除 |
| POST | `/api/interview/materials/[id]/transcribe` | 文字起こし開始 |

### 記事生成・編集
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/articles/generate` | AI記事生成 (SSE) |
| GET | `/api/interview/articles/[id]` | 記事取得 |
| PUT | `/api/interview/articles/[id]` | 記事保存 |
| POST | `/api/interview/revise` | 記事リバイズ |

### 高度機能
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/articles/[id]/suggest-titles` | タイトル提案 |
| POST | `/api/interview/articles/[id]/proofread` | 校正・校閲 |
| POST | `/api/interview/articles/[id]/translate` | 翻訳 (10言語) |
| POST | `/api/interview/articles/[id]/sns-posts` | SNS投稿文生成 |
| POST | `/api/interview/articles/[id]/fact-check` | ファクトチェック |

### レシピ管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/interview/recipes` | レシピ一覧 |
| POST | `/api/interview/recipes` | レシピ作成 |
| GET | `/api/interview/recipes/[id]` | レシピ詳細 |
| PUT | `/api/interview/recipes/[id]` | レシピ更新 |
| DELETE | `/api/interview/recipes/[id]` | レシピ削除 |
| POST | `/api/interview/recipes/generate` | レシピ自動生成 |

### その他
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/cleanup` | 古いデータ削除 |

## ファイルアップロードフロー

```
1. POST /api/interview/materials/upload-url
   → Supabase署名付きURL + materialId を返却

2. ブラウザ → PUT <signedUrl> (XHR直接アップロード)
   → Vercelの4.5MBボディ制限をバイパス

3. POST /api/interview/materials/[id]/confirm
   → DB更新 (status: UPLOADED)

4. POST /api/interview/materials/[id]/transcribe
   → AssemblyAI にURL渡し → ポーリングで完了待ち
   → InterviewTranscription に保存
```

## 文字起こし (AssemblyAI)

- **方式**: URL渡し (サーバーでのダウンロード不要, サイズ無制限)
- **モデル**: `universal-2`
- **話者分離**: `speaker_labels: true`
- **言語**: `ja` (デフォルト)
- **ポーリング**: 指数バックオフ 3秒→最大30秒, 合計最大10分

## DB テーブル

すべて `@@map("interview_xxx")` でテーブルプレフィックス付き。

| モデル | テーブル名 | 説明 |
|--------|-----------|------|
| InterviewProject | interview_project | プロジェクト (title, status, interviewee情報) |
| InterviewRecipe | interview_recipe | レシピ (企画案, 質問リスト, AIプロンプト) |
| InterviewMaterial | interview_material | 素材 (音声/動画/PDF, Supabase Storage) |
| InterviewTranscription | interview_transcription | 文字起こし (text, segments, speaker) |
| InterviewDraft | - | ドラフト版 |
| InterviewReview | - | 校閲結果 |

## ファイル構成
```
src/app/interview/
  ├── layout.tsx                    # InterviewLayout
  ├── page.tsx                      # プロジェクト一覧
  ├── projects/
  │   └── [id]/
  │       ├── page.tsx              # プロジェクト概要
  │       └── edit/page.tsx         # エディタ
  └── templates/                    # テンプレート (未完成?)

src/app/api/interview/              # 18+ APIルート
src/components/interview/
  ├── InterviewLayout.tsx           # レイアウト
  ├── InterviewSidebar.tsx          # サイドバー
  ├── InterviewUpgradeCelebration.tsx
  └── InterviewUpsellModal.tsx      # アップセルモーダル

src/lib/interview/
  ├── storage.ts                    # Supabase Storage操作
  ├── transcription.ts              # AssemblyAI連携
  ├── access.ts                     # アクセス制御
  ├── types.ts                      # 型定義 (MaterialType, TranscriptionSegment等)
  ├── prompts.ts                    # AIプロンプトテンプレート
  └── recipes-seed.ts              # プリセットレシピ10種
```

## 対応ファイル形式

### 音声
mp3, wav, m4a, ogg, webm, flac

### 動画
mp4, mov, avi

### ドキュメント
pdf, txt, docx

### 画像
jpg, jpeg, png, webp

## デザイン
- **サイドバー**: `InterviewSidebar` コンポーネント
- **カラー**: purple (`#7f19e6`)
- **アイコン**: `🎙️`
- **進捗表示**: ステッパー (DRAFT → PLANNING → RECORDING → TRANSCRIBING → EDITING → REVIEWING → COMPLETED)
