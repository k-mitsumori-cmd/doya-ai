# ドヤ広告シミュレーションAI (AdSim)

## 概要
- **パス**: `/adsim`
- **サービスID**: `adsim`
- **説明**: LP URLと月額予算だけで広告提案書を全自動生成
- **ステータス**: coming_soon
- **カテゴリ**: text

## 機能
- LP URL入力 → 業種・ターゲット・KPI自動判定
- 30業種 × 6媒体の業界平均ベンチマークで数値算出
- 媒体別×月次の IMP/CTR/CV/CPA/ROAS をシミュレーション
- 提案テキスト10セクション自動生成
- PDF / PPTX / Excel 出力
- チャット形式で提案内容を修正可能

### 対応媒体 (6種)
Google Ads, Meta (Facebook/Instagram), LINE Ads, X (Twitter) Ads, YouTube Ads, TikTok Ads

### 生成フロー (5ステップ)
1. LP URL入力 → 業種・商品名・ターゲット自動抽出
2. 提案目的・期間・開始月を設定
3. 月額予算・目標CV・目標CPA・目標ROASを設定
4. 媒体配分 (%) を設定
5. 提案者情報・テンプレート選択 → 生成実行

## 料金
統一プラン方式。ドヤマーケAIに課金で全サービスPRO利用可能。

| プラン | 月間上限 | 月額 |
|--------|---------|------|
| 無料 | 3プロジェクト | ¥0 |
| PRO | 無制限 + PPTX出力 | 統一プラン |
| Enterprise | 無制限 | 統一プラン |

## APIエンドポイント (9件)

| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/adsim/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/adsim/projects/[projectId]` | プロジェクト詳細・更新・削除 |
| POST | `/api/adsim/projects/[projectId]/proposal` | 提案テキスト生成 |
| POST | `/api/adsim/projects/[projectId]/simulate` | シミュレーション実行 |
| GET | `/api/adsim/projects/[projectId]/banners` | バナー一覧 |
| POST | `/api/adsim/projects/[projectId]/chat-edit` | チャット形式修正 |
| POST | `/api/adsim/projects/[projectId]/export` | PDF/PPTX/Excel出力 |
| POST | `/api/adsim/auto-generate` | URL入力→全自動生成 |
| POST | `/api/adsim/scrape` | URLスクレイピング |

## DBモデル

### AdSimProject (`ad_sim_projects`)
```
id, userId, guestId, name
status: draft | generating | completed | error
# Step 1
clientName, industry, productName, lpUrl, targetAudience (JSON)
# Step 2
goals[], periodMonths, startMonth (YYYY-MM)
# Step 3
monthlyBudget, targetCv, targetCpa, targetRoas
# Step 4
mediaAllocation (JSON: { google: %, meta: %, line: % ... })
# Step 5
proposerName, proposerEmail, templateId
# 生成結果
simulationData (JSON), proposalText (JSON), chartData (JSON)
# 出力ファイル
pptxUrl, pdfUrl, excelUrl
```

## ファイル構成
```
src/app/adsim/                  # フロントエンド (6ページ)
  ├── page.tsx                  # ダッシュボード
  ├── new/page.tsx              # 新規作成 (5ステップウィザード)
  ├── [projectId]/page.tsx      # プロジェクト詳細
  ├── history/page.tsx          # 履歴一覧
  ├── guide/page.tsx            # ガイド
  └── pricing/page.tsx          # 料金ページ

src/app/api/adsim/              # API (9エンドポイント)

src/lib/adsim/                  # ビジネスロジック
  ├── auto-generator.ts         # URL→全自動生成パイプライン
  ├── simulator.ts              # 媒体別数値シミュレーション
  ├── benchmark.ts              # 30業種×6媒体ベンチマーク
  ├── gemini.ts                 # Gemini API連携
  ├── pptx-generator.ts         # PowerPoint出力
  ├── pdf-generator.ts          # PDF出力
  └── excel-generator.ts        # Excel出力

src/components/
  ├── AdSimAppLayout.tsx        # レイアウト
  └── AdSimSidebar.tsx          # サイドバー
```

## デザイン
- **カラー**: indigo
- **グラデーション**: `from-indigo-500 to-blue-500`
- **アイコン**: `📊`
