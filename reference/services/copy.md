# ドヤコピーAI (Copy)

## 概要
- **パス**: `/copy`
- **サービスID**: `copy`
- **説明**: 商品URLとペルソナから20案以上の広告コピーを瞬時に生成
- **ステータス**: active
- **カテゴリ**: text

## 機能
- 商品URL分析 → ペルソナ自動生成 → コピー一括生成
- 5種類のAIコピーライタータイプ
- ディスプレイ広告 / 検索広告 (Google/Yahoo RSA) / SNS広告 に対応
- チャット形式ブラッシュアップ
- ブランドボイス設定 (トーン・NG/必須ワード)
- レギュレーション設定 (薬機法・景品表示法)
- CSV / Excel エクスポート

### 5つのAIコピーライタータイプ
1. **ストレート** — ベネフィット直訴型
2. **エモーショナル** — ペインポイント訴求型
3. **ロジカル** — データ・実績訴求型
4. **プロボカティブ** — 常識を覆す切り口
5. **ストーリー** — ビフォーアフター型

### 対応広告形式
- **ディスプレイ広告**: バナー見出し + 説明文 + CTA
- **検索広告**: Google/Yahoo RSA形式 (見出し15本 + 説明文4本)
- **SNS広告**: X / Instagram / Facebook / LINE (プラットフォーム別最適化)

## 料金
統一プラン方式。ドヤマーケAIに課金で全サービスPRO利用可能。

| プラン | 月間上限 | 月額 |
|--------|---------|------|
| 無料 | 5コピー | ¥0 |
| PRO | 無制限 | 統一プラン |
| Enterprise | 無制限 | 統一プラン |

## APIエンドポイント (11件)

| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/copy/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/copy/projects/[id]` | プロジェクト詳細・更新・削除 |
| GET/POST | `/api/copy/projects/[id]/items/[itemId]` | コピーアイテム操作 |
| POST | `/api/copy/generate` | ディスプレイ広告コピー生成 |
| POST | `/api/copy/generate-search` | 検索広告コピー生成 |
| POST | `/api/copy/generate-sns` | SNS広告コピー生成 |
| POST | `/api/copy/generate-persona` | ペルソナ分析・自動抽出 |
| POST | `/api/copy/analyze-url` | 商品URL分析 |
| POST | `/api/copy/brushup` | チャット形式ブラッシュアップ |
| GET/POST | `/api/copy/brand-voice` | ブランドボイス管理 |
| POST | `/api/copy/export` | CSV/Excelエクスポート |

## DBモデル

### CopyProject (`copy_projects`)
```
id, userId, guestId, name, status (draft)
productUrl, productInfo (JSON), persona (JSON), personaSource
regulations (JSON), brandVoiceId → CopyBrandVoice
copies → CopyItem[]
```

### CopyItem (`copy_items`)
```
id, projectId → CopyProject
type, platform (ディスプレイ/検索/SNS), writerType (5タイプ)
headline, description (TEXT), catchcopy, hashtags[], cta
appealAxis, charCount, score, isFavorite
revisions (JSON[])
```

### CopyBrandVoice (`copy_brand_voices`)
```
id, userId, name, tone
vocabulary (JSON), examples (JSON)
ngWords[], requiredWords[]
```

## ファイル構成
```
src/app/copy/                   # フロントエンド (12ページ)
  ├── page.tsx                  # ダッシュボード
  ├── new/page.tsx              # 新規 (ディスプレイ)
  ├── new/search/page.tsx       # 新規 (検索広告)
  ├── new/sns/page.tsx          # 新規 (SNS広告)
  ├── [projectId]/page.tsx      # プロジェクト詳細
  ├── [projectId]/edit/page.tsx # 編集
  ├── [projectId]/export/page.tsx # エクスポート
  ├── history/page.tsx          # 履歴
  ├── templates/page.tsx        # テンプレート
  ├── settings/page.tsx         # ブランドボイス設定
  ├── guide/page.tsx            # ガイド
  └── pricing/page.tsx          # 料金

src/app/api/copy/               # API (11エンドポイント)

src/lib/copy/                   # ビジネスロジック
  ├── gemini.ts                 # AI生成 (5ライタータイプ別プロンプト)
  └── personas.ts               # ペルソナ自動生成

src/components/
  ├── CopyAppLayout.tsx         # レイアウト
  ├── CopySidebar.tsx           # サイドバー
  └── copy/
      └── ProductInfoForm.tsx   # 商品情報入力フォーム
```

## デザイン
- **カラー**: green
- **グラデーション**: `from-green-500 to-emerald-500`
- **アイコン**: `✍️`
