# ドヤインタビューAI

## 概要
- **パス**: `/interview`
- **サービスID**: `interview`
- **説明**: 音声/動画ファイルからインタビュー記事をAI生成
- **ステータス**: active (Phase 1-3 完了)
- **カテゴリ**: text

## 機能

### Phase 1 (MVP)
- Supabase Storage へのファイル直接アップロード。実効上限はプラン・Storage バケット・環境設定のうち最小値
- 署名付きURL方式 (Vercelボディサイズ制限バイパス)
- プロジェクトCRUD + フロントエンド
- 素材アップロード (upload-url → confirm → XHR直接PUT)
- 文字起こし (AssemblyAI — URL渡し、プラン別の月次分数・実効ファイルサイズ上限あり、話者分離対応)
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
- 記事内の事実確認候補の抽出 (整合性のAI参考値, 要確認項目)。外部資料との照合は行わず、「確認済」とは表示しない
- SNS投稿文生成 (6プラットフォーム, 3トーン)
- 翻訳 (10言語, Markdown保持, SEO付)
- レシピ自動生成 (サンプル記事から構成分析)

サムネイルの初回生成はプロジェクトに含め、記事生成後に自動生成し、既存画像があれば再利用する。画面の「再生成」は共通の追加AI編集日次枠を1回使用して新規生成する。失敗時は枠を返却し、同じプロジェクトの同時生成はサーバーで抑止する。新規画像は `interview-materials` の非公開Storageに置き、所有者確認後の画像APIから5分有効の署名付きURLへ転送する。旧DB内のBase64画像は移行完了まで読み取り互換を維持する。旧画像の移行は `node scripts/migrate-interview-thumbnails.cjs` で事前件数を確認し、新版が本番でREADYになってから `--apply` で保存・再取得・照合を行う。

## 料金

| プラン | 文字起こし分数 | アップロード上限 | 記事生成回数 | 月額 |
|--------|-------------|---------------|------------|------|
| ゲスト | 合計5分 | 100MB | 2回/日 | ¥0 |
| 無料会員 | 毎月30分 | 500MB | 5回/日 | ¥0 |
| LIGHT | 毎月60分 | 1GB | 10回/日 | ¥2,980 |
| PRO | 毎月150分 | 2GB | 30回/日 | ¥9,980 |
| Enterprise | 毎月1,000分 | 5GB | 100回/日 | ¥49,800 |

新規申込の料金画面は無料プランと共通PROプランを案内します。LIGHT・Enterpriseは既存契約の利用枠を示すために残しています。1回の文字起こしも利用可能な残り分数を超えて利用できません。技術上の1回最大約180分は、プランの分数枠より大きい利用を保証するものではありません。

表のアップロード上限はプランごとの最大値です。実際に受け付ける1ファイルの容量は、プラン上限、Supabase Storage バケットで確認できた上限、`INTERVIEW_MAX_FILE_SIZE_MB`（未設定時は5GB）の最小値です。プラン上限に達した場合はゲストにログイン、FREE/LIGHTに料金ページ、PRO/Enterpriseに問い合わせを案内します。Storage 側の上限に達した場合は、プラン変更で解決するとは案内せず、ファイルの分割または圧縮を案内します。署名付きURL発行前と、直接アップロード後の実サイズ確認時の両方で判定します。

ダッシュボードから新規アップロードする場合は、同じ `upload-url` API に `preflight: true` とファイル情報を送り、形式と実効容量を先に確認します。成功後にプロジェクトを作成するため、既知の容量超過や非対応形式では空のプロジェクトを作らず、ゲストのプロジェクト件数枠も消費しません。署名付きURLの発行時にも再判定します。

ゲストが作成できるプロジェクトは同じゲストIDにつき累計3件までです。件数確認と作成はゲストID単位のトランザクションロックで直列化し、作成累計を `SystemSetting` に記録します。削除や期限切れの自動整理では件数枠は戻りません。初回の記録作成時は現在残るプロジェクト件数から引き継ぎます（過去に削除された件数は復元できません）。上限到達時はログイン先を返し、ダッシュボードのエラー表示から進めるようにします。この件数枠は、ゲストの記事生成日次2回枠とは別です。

記事生成回数は日本時間の日次枠です。記事の初回生成と同じプロジェクトでの再生成を、それぞれ1回として数えます。プロジェクト作成だけでは消費せず、生成失敗時は予約した回数を返却します。AI修正・校正・タイトル提案は、この生成回数には含みません。

記事1件につき最初の校正1回は記事生成に含まれます。同じ記事の追加校正と、AI修正・タイトル提案・記事内の確認候補抽出・SNS投稿文・翻訳は共通の追加AI編集日次枠を各1回使用します。ゲスト2回、無料5回、LIGHT10回、PRO30回、Enterprise100回です。日本時間の日付切り替えで枠が戻り、生成失敗時は予約回数を返却します。同時校正の重複実行は拒否します。

レシピ自動生成は記事生成と別の日次枠で、ゲストは利用不可、無料5回、LIGHT10回、PRO30回、Enterprise100回です。日本時間の翌日に切り替わり、生成失敗時は回数を返します。サンプル記事は1件15,000文字以内、最大3件です。

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
| POST | `/api/interview/materials/confirm` | アップロード確認 |
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
| POST | `/api/interview/claim-guest` | ログイン後、同じ端末のゲストプロジェクトをアカウントに引き継ぐ |

## ファイルアップロードフロー

```
1. POST /api/interview/materials/upload-url
   → Supabase署名付きURL + materialId を返却

2. ブラウザ → PUT <signedUrl> (XHR直接アップロード)
   → Vercelの4.5MBボディ制限をバイパス

3. POST /api/interview/materials/confirm
   → 実サイズと所有者を確認し、DB更新 (status: COMPLETED)

4. POST /api/interview/materials/[id]/transcribe
   → AssemblyAI にURL渡し → ポーリングで完了待ち
   → InterviewTranscription に保存
```

## 文字起こし (AssemblyAI)

- **方式**: URL渡し (サーバーでのダウンロード不要。利用可能な分数・実効ファイル容量の上限は適用)
- **モデル**: `universal-2`
- **話者分離**: `speaker_labels: true`
- **言語**: `ja` (デフォルト)
- **ポーリング**: 指数バックオフ 3秒→最大30秒, 合計最大10分

## ゲストプロジェクトの引き継ぎ

ログイン後、同じ端末にゲストCookieがある場合は、インタビュー画面を表示する前に同一オリジンの引き継ぎAPIを呼びます。対象はそのCookieに紐づく未登録プロジェクトだけで、所有者をアカウントに原子的・冪等に紐づけます。ゲストIDは既存素材とサムネイルの非公開Storageパスを維持するために残しますが、引き継ぎ後はゲストCookieだけでは閲覧できません。記事生成・追加AI編集の日次使用量と、文字起こしの当月使用時間もアカウント側に合算します。文字起こし処理中は移管を保留し、画面から再試行できます。記事生成中に引き継がれた場合は古いゲスト権限で記事を保存せず、引き継ぎ先へ移った当日分を含めて予約回数を返します。引き継ぎ完了後に古いゲスト画面から送られた生成要求は、枠を予約する前に拒否します。

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
