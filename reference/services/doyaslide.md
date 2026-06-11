# ドヤスライド (`doyaslide`)

## 概要

- **パス**: `/doyaslide`
- **サービスID**: `doyaslide`
- **説明**: AIが**全スライドを1枚絵のフル画像**としてド派手に生成するスライド作成ツール
- **ステータス**: coming_soon（services.ts 登録済み・公開判断待ち）
- **カテゴリ**: image
- **アイコン**: 🖼️ / グラデーション `from-blue-500 to-indigo-600`
- **本番URL（予定）**: `https://doya-ai.surisuta.jp/doyaslide`

> **旧 `/slide`・`/slashslide`（Gemini→Googleスライド下書き型）はこのサービスに統合・廃止済み**。
> `/slide`・`/slashslide` への全アクセスは `next.config.js` のリダイレクトで `/doyaslide` に集約される。
> 旧仕様は `reference/services/slide.md`（廃止記録）を参照。

## コンセプト

- テーマを入力するだけで、各スライドを **gpt-image-2 がビジュアルごと1枚絵で生成**
- 最初にアップしたロゴを各スライドの指定位置に**合成**して統一感を出す
- 生成後は**チャットでその場修正（再生成）**・バージョン履歴で巻き戻し
- 営業・提案・SNS・採用などを「映える画像」で量産

## 生成フロー

```
1. /doyaslide/new で 資料タイプ・テーマ・補足・枚数・比率・カラー・スタイル・ロゴ を入力
   - スタイルは12種（後述）から選択。右に複数ページの仕上がりプレビューを表示
   - 参考URLを入れると analyze で内容を取り込み（タイトル・brief・参考テキスト）
2. POST /api/doyaslide/projects でプロジェクト作成
3. (ロゴあれば) POST /api/doyaslide/assets/logo でアップロード
4. POST /api/doyaslide/structure → Gemini が各スライドの role/headline/subText/visualPrompt を生成
5. /doyaslide/[id]?generate=1 に遷移 → POST /api/doyaslide/generate で全スライドを並行的に画像化
6. エディタでプレビュー・チャット修正・再生成・ロゴ位置/サイズ調整・バージョン巻き戻し
7. PNG(ZIP) / PDF で書き出し（POST /api/doyaslide/export）
```

## 画像生成（重要・統一規約）

- 画像は必ず `src/lib/image-generator.ts:generateImageWithFallback()` 経由。
  - **メイン: `gpt-image-2`**（OpenAI / `src/lib/openai-image.ts`、`OPENAI_IMAGE_MODEL` で上書き可）
  - **フォールバック: `nano-banana-pro-preview`**（Gemini 3 Pro Image系）
- サイズは比率に応じて `1536x1024`(横) / `1024x1024`(正方形) / `1024x1536`(縦)（`ASPECT_TO_SIZE`）
- 品質: 本番スライド=`high`、スタイルプレビュー=`high`（gpt-image-2 は `auto` 非対応）
- 構成テキスト（Gemini）は `@seo/lib/gemini` 系ではなく `src/lib/doyaslide/` 内で組み立て

## スタイルプリセット（6種 = ビジネス系3 + 遊び系3、2026-06-12 改編）

`src/lib/doyaslide/constants.ts: STYLE_PRESETS`。directive（アートディレクション）に加え、遊び系は専用 `layout` を持ち企業資料テンプレートを使わない。

| value | ラベル | group | レイアウト |
|-------|--------|-------|-----------|
| corporate | コーポレート | business | 資料テンプレ（LayerX型） |
| minimal | ミニマル | business | 資料テンプレ |
| luxury | 高級 | business | 資料テンプレ（ダーク×ゴールド） |
| pop | ポップ | fun | 専用（ステッカー/コミック） |
| handwritten | 手書き風 | fun | 専用（スケッチノート/ホワイトボード） |
| isometric | アイソメ図解 | fun | 専用（アイソメ3Dイラスト主役） |

- 旧12種のうち削除6種（flashy/cyber/gradient/retro/nature/mono）は `LEGACY_STYLE_DIRECTIVES` でdirectiveのみ温存（既存プロジェクトの再生成・チャット修正で見た目を維持）。UI・型 `StylePreset` からは削除済み。
- 既定スタイル: `corporate`（new/page.tsx・projects API とも旧 flashy から変更）。

- スタイルプレビューは「スタイル×ページ(表紙/本文/まとめ)」で複数ページを事前生成し、Storageに共有キャッシュ（`style-previews/v5-styles6/{style}-{page}.png`）。モデル/品質/プロンプトを変えたら `STYLE_PREVIEW_DIR` の版を上げると全焼き直し。一括再生成は `npx tsx scripts/regenerate-doyaslide-style-previews.ts`。プレビューAPIは3ページを並列生成（直列だと cold cache 時に maxDuration=300 超過）。

## プロンプト設計（2026-06-12 改修）

`buildImagePrompt` は3系統に分岐:

1. **ビジネス系スタイル**（corporate/minimal/luxury、layout定義なし）: LayerX Company Deck・スライドランド掲載資料の調査に基づく「きちんとした企業資料」テンプレート。本文=タイトル左上（控えめサイズ）+結論リード文+グリッド本文（2-3カラムカード・ピル型ラベル）+フッター線+右下ページ番号。表紙/セクション扉のみ全面ブランド色可
2. **遊び系スタイル**（pop/handwritten/isometric、layout定義あり）: 資料テンプレを使わず、スタイル専用レイアウト言語で生成（openerも「strong distinctive art direction / do NOT fall back to generic business look」）。並べた時に明確に違って見えることを優先
3. **docType=sns**: スタイルに関わらずポスター/カルーセル構成（大きな文字・短い言葉・スクロールを止める）。ページ番号なし。`ComposeProject.docType` 経由で伝搬

共通ルール:
- **構成(Gemini)**: subText は「1行目=結論リード文、2行目以降=・ラベル｜説明 の箇条書き3〜5点」。8枚以上のビジネス資料（sns除く）は2枚目に目次。visualPrompt への**色指定は禁止**。定型roleは「表紙/目次/セクション扉/まとめ/CTA」の表記を強制（本文roleに「タイトル」「セクション」「章」を含めない）
- **デッキ内配色統一**: ビジネス系=STRICT DECK COLOR SYSTEM（テーマカラー+ダークニュートラル+白/グレーのみ）、遊び系/SNS=CONSISTENT DECK PALETTE（スタイルが定めるパレットを全スライド固定）。いずれも visualPrompt 内の色指定は無視させる
- **ページ種別判定**: role の**完全一致**（^表紙$等）のみ特別ページ扱い（「導入事例セクション」等の誤判定防止）
- **ページ番号**: `ComposeSlide.index` を `buildImagePrompt(pageNumber)` に渡し本文ページ右下に描画（generate/regenerate/chat 全ルートで index を渡す）

## APIエンドポイント (13件, `/api/doyaslide/`)

| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/projects` | 一覧取得 / 新規作成（上限チェック） |
| GET/PATCH/DELETE | `/projects/[id]` | 取得 / 更新 / 削除（userId 所有確認） |
| PUT | `/projects/[id]/logo-config` | ロゴ位置・サイズ・背景チップ変更（全スライド再合成） |
| POST | `/assets/logo` | ロゴアップロード |
| POST | `/structure` | Gemini でスライド構成生成 |
| POST | `/generate` | 全（未生成）スライドを画像化 |
| POST | `/analyze` | 参考URL解析→タイトル/brief提案 |
| GET | `/style-preview?style=` | スタイル別の複数ページ仕上がりプレビュー生成（共有キャッシュ） |
| GET/POST | `/slides/[id]/revert` | バージョン一覧 / 指定versionへ巻き戻し |
| POST | `/slides/[id]/chat` | チャット指示で当該スライドを修正・再生成 |
| POST | `/slides/[id]/regenerate` | 当該スライドを再生成 |
| GET | `/export?projectId=&format=pdf|zip` | PDF / PNG(ZIP) 書き出し |
| GET | `/usage` | プラン・使用量（プロジェクト数 / 当月生成枚数） |

全API: `runtime='nodejs' / dynamic='force-dynamic' / maxDuration=300`、認証は `getUserId()`（`src/lib/doyaslide/access.ts`）→ 未ログイン401、データは `userId` で分離（スライドは `slide.project.userId` で所有確認）。

## ファイル構成

```
src/app/doyaslide/
  ├── layout.tsx / page.tsx（プロジェクト一覧） / error.tsx / not-found.tsx
  ├── new/page.tsx        # 作成ウィザード（スタイル複数ページプレビュー・生成メーター）
  ├── [id]/page.tsx       # エディタ（生成進捗・チャット修正・履歴・ロゴ設定・書き出し）
  └── pricing/page.tsx    # UnifiedPricingPlans

src/app/api/doyaslide/    # 13 ルート（上表）

src/components/doyaslide/
  ├── DoyaSlideLayout.tsx  # サイドバー付きレイアウト（bg-slate-50）
  ├── DoyaSlideSidebar.tsx # 専用サイドバー（doyaslideTheme / ToolSwitcherMenu）
  └── DoyaChar.tsx         # ドヤくん吹き出しキャラ

src/lib/doyaslide/        # 10 ファイル
  scrape / storage / templates / logo / prompts / types / access / constants / limits / generate
```

## DBモデル（5モデル, prisma/schema.prisma）

| モデル | @@map | 用途 |
|--------|-------|------|
| DoyaSlideProject | `doyaslide_projects` | プロジェクト（タイトル/資料タイプ/比率/カラー/スタイル/ロゴ設定/状態） |
| DoyaSlideSlide | `doyaslide_slides` | 各スライド（index/role/headline/subText/画像URL/version/状態） |
| DoyaSlideAsset | `doyaslide_assets` | アップロード資産（ロゴ等） |
| DoyaSlideChatMessage | `doyaslide_chat_messages` | スライド別チャット履歴 |
| DoyaSlideVersion | `doyaslide_versions` | スライド画像のバージョン履歴（巻き戻し用） |

## 課金・アクセス制御

- **統一プラン方式**。プラン判定は `User.plan` 単一参照（`src/lib/doyaslide/limits.ts` の `getUserTier` → `tierFrom`）。
- 上限（`limits.ts`）: 無料=月3プロジェクト/20枚、プロ=プロジェクト無制限/月150枚。
- 料金ページは `UnifiedPricingPlans`（serviceId="doyaslide"）。
- `stripe.ts` の `ALL_SERVICE_IDS` に `doyaslide` 登録済み。

## 出力

- **PNG（ZIP）** / **PDF**（`/api/doyaslide/export`）。

## ストレージ

- Supabase Storage 公開バケット `doyaslide`。
  - 生成画像: `{userId}/{projectId}/{uuid}.png`（ロゴ合成前後）
  - スタイルプレビュー（共有）: `style-previews/v2-gptimg2/{style}-{page}.png`
  - ロゴ: `{userId}/logos/{uuid}.{ext}`

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `OPENAI_API_KEY` | gpt-image-2 画像生成 |
| `OPENAI_IMAGE_MODEL` | （任意）メイン画像モデル上書き。未設定で `gpt-image-2` |
| `GOOGLE_GENAI_API_KEY` 等 | 構成生成(Gemini) / 画像フォールバック(nano-banana-pro-preview) |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Storage |
| `NEXT_PUBLIC_STRIPE_DOYASLIDE_PRO_PRICE_ID` | （任意）専用Price ID。未設定なら統一プランにフォールバック |
| `SLIDE_HOSTS` | スライド専用ドメイン（middleware が `/doyaslide` にリライト） |

## 公開前の残タスク（2026-06-02 時点）

- `status: 'coming_soon' → 'active'`（services.ts）
- `public/doyaslide/logo.png` 配置（ToolSwitcher/LP の公式ロゴ用。現状 Lucide フォールバック）
- `/doyaslide/guide`（使い方ガイド）の整備
- エラー報告フォーム（§17.2）— 全社未実装のため共通対応待ち
