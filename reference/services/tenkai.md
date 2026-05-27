# ドヤ展開AI (Tenkai - Content Repurposing)

## 概要
- **パス**: `/tenkai`
- **サービスID**: `tenkai`
- **説明**: 1つのコンテンツを9つのプラットフォームに自動展開
- **ステータス**: coming_soon
- **カテゴリ**: text

## 機能
- URL / テキスト / YouTube動画 / 動画ファイル → コンテンツ分析
- 9プラットフォームに最適化して自動変換
- ブランドボイス設定で一貫したトーン維持
- テンプレートによるカスタマイズ
- 再生成・フィードバック反映
- APIキー発行（外部連携用）

### 対応プラットフォーム (9種)
| ID | プラットフォーム | 特徴 |
|----|---------------|------|
| blog | ブログ記事 | 長文・SEO対応 |
| x | X (Twitter) | 280字制限・ハッシュタグ |
| instagram | Instagram | キャプション・ハッシュタグ30個 |
| facebook | Facebook | 長文投稿対応 |
| linkedin | LinkedIn | ビジネストーン |
| line | LINE | リッチメッセージ形式 |
| newsletter | メールニュースレター | 件名・本文・CTA |
| press-release | プレスリリース | 報道資料形式 |
| note | note | 記事形式 |

### 入力ソース
- **URL**: Webページをスクレイピング
- **テキスト**: 直接入力
- **YouTube**: 動画URLから字幕抽出
- **動画ファイル**: アップロード → 文字起こし

## 料金
統一プラン方式。ドヤマーケAIに課金で全サービスPRO利用可能。

## APIエンドポイント (23件)

### プロジェクト管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/tenkai/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/tenkai/projects/[projectId]` | プロジェクト詳細 |
| GET | `/api/tenkai/projects/[projectId]/outputs` | プロジェクト出力一覧 |

### コンテンツ入力
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/tenkai/content/analyze` | コンテンツ分析 |
| POST | `/api/tenkai/content/ingest/url` | URL入力 |
| POST | `/api/tenkai/content/ingest/text` | テキスト入力 |
| POST | `/api/tenkai/content/ingest/youtube` | YouTube動画入力 |
| POST | `/api/tenkai/content/ingest/video` | 動画アップロード |

### 生成
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/tenkai/generate/[platform]` | プラットフォーム別生成 |
| POST | `/api/tenkai/generate/regenerate` | 再生成 |

### 出力管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenkai/outputs` | 全出力一覧 |
| GET/PUT/DELETE | `/api/tenkai/outputs/[outputId]` | 出力詳細・編集・削除 |
| POST | `/api/tenkai/outputs/[outputId]/export` | エクスポート |

### ブランドボイス・テンプレート
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/tenkai/brand-voices` | ブランドボイス一覧・作成 |
| GET/PUT/DELETE | `/api/tenkai/brand-voices/[id]` | ブランドボイス詳細 |
| GET/POST | `/api/tenkai/templates` | テンプレート一覧・作成 |
| GET/PUT/DELETE | `/api/tenkai/templates/[id]` | テンプレート詳細 |

### システム
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenkai/usage` | 使用量情報 |
| GET/POST/DELETE | `/api/tenkai/api-key` | APIキー管理 |
| GET | `/api/tenkai/account` | アカウント情報 |
| GET | `/api/tenkai/health` | ヘルスチェック |

## DBモデル (6個)

### TenkaiProject (`tenkai_projects`)
```
id, userId, title
inputType: url | text | youtube | video
inputUrl, inputText, inputVideoUrl, transcript
analysis (JSON), status: draft | analyzing | ready | generating | completed
wordCount, language (default: ja)
outputs → TenkaiOutput[]
```

### TenkaiOutput (`tenkai_outputs`)
```
id, projectId → TenkaiProject
platform (9種), content (JSON — プラットフォーム固有構造)
charCount, qualityScore (0.0-1.0), isEdited
status: pending | generating | completed | failed
tokensUsed, brandVoiceId → TenkaiBrandVoice
templateId, feedback, version (default: 1)
UNIQUE: projectId + platform + version
```

### TenkaiBrandVoice (`tenkai_brand_voices`)
```
id, userId, name
firstPerson (default: 私)
formalityLevel, enthusiasmLevel, technicalLevel, humorLevel (1-5)
targetAudience, sampleText
preferredExpressions[], prohibitedWords[]
isDefault
```

### TenkaiTemplate (`tenkai_templates`)
```
id, userId (null = システムテンプレート)
platform, name, description
promptOverride, structureHint (JSON), isSystem
```

### TenkaiUsage (`tenkai_usage`)
```
id, userId, yearMonth (YYYY-MM形式)
creditsUsed, tokensTotal, projectsCreated
UNIQUE: userId + yearMonth
```

### TenkaiApiKey (`tenkai_api_keys`)
```
id, userId
keyPrefix (sk-doya-xxxx 先頭8文字), keyHash (SHA-256)
lastUsedAt, isActive
```

## ファイル構成
```
src/app/tenkai/                 # フロントエンド (10ページ)
  ├── page.tsx                  # → /tenkai/projects へリダイレクト
  ├── create/page.tsx           # 新規作成
  ├── projects/page.tsx         # プロジェクト一覧
  ├── [projectId]/page.tsx      # プロジェクト詳細
  ├── brand-voice/page.tsx      # ブランドボイス管理
  ├── templates/page.tsx        # テンプレート管理
  ├── settings/page.tsx         # 設定
  ├── pricing/page.tsx          # 料金
  └── guide/page.tsx            # ガイド

src/app/api/tenkai/             # API (23エンドポイント)

src/lib/tenkai/                 # ビジネスロジック
  ├── generation-pipeline.ts    # 生成パイプライン (メイン)
  ├── access.ts                 # アクセス制御・使用量管理
  ├── validation.ts             # バリデーション
  ├── scraper.ts                # URLスクレイピング
  ├── brand-voice.ts            # ブランドボイス処理
  ├── storage.ts                # ストレージ管理
  └── prompts/                  # プラットフォーム別プロンプト (9ファイル)

src/components/tenkai/          # 専用コンポーネント
  ├── PricingTable.tsx
  ├── ProjectCard.tsx
  ├── StepAnalysis.tsx
  ├── StepGeneration.tsx
  └── TenkaiSidebar.tsx
```

## デザイン
- **カラー**: purple
- **グラデーション**: `from-purple-500 to-pink-500`
- **アイコン**: `🔄`
