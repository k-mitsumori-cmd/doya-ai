# 10. サービスステータス管理

> 全サービスの実装状態・課金設定・ドキュメント状況を一元管理するドキュメント。
> コードベースの実態と突き合わせて定期的に更新すること。

## ステータス凡例

| 記号 | 意味 |
|------|------|
| ✅ | 実装済み・設定済み |
| ⚠️ | 部分的・暫定的 |
| ❌ | 未実装・未設定 |
| 🔗 | 他サービスに統合 |
| 🕐 | 開発予定 |

### 開発ステータス定義

| ステータス | 意味 |
|-----------|------|
| `active` | 本番稼働中 |
| `beta` | テスト公開中 |
| `coming_soon` | 開発予定（LP表示のみ） |
| `maintenance` | メンテナンス中 |
| `deprecated` | 廃止予定 |
| `not_implemented` | 定義のみ・未実装 |

---

## サービスステータス一覧

### 課金方針: 統一プラン方式

ドヤAIは**統一プラン方式**を採用。1つのサブスクリプション（ドヤマーケAI）に課金すれば、全サービスのPROプランが利用可能。サービス個別の課金は行わない。

### 実装マトリクス

| サービス | パス | ステータス | services.ts | ページ | API | DBモデル | Stripe | ドキュメント |
|---------|------|-----------|-------------|--------|-----|---------|--------|------------|
| ドヤバナーAI | `/banner` | active | ✅ | ✅ 16頁 | ✅ 17件 | ✅ 1モデル | ✅ 統一プラン | ✅ |
| ドヤライティングAI | `/seo` | active | ✅ | ✅ 45頁 | ✅ 54件 | ✅ 12モデル | ✅ 統一プラン | ✅ |
| ドヤインタビュー | `/interview` | active | ✅ | ✅ 15頁 | ✅ 21件 | ✅ 7モデル | ✅ 統一プラン | ✅ |
| ドヤコピーAI | `/copy` | active | ✅ | ✅ 12頁 | ✅ 11件 | ✅ 3モデル | ✅ 統一プラン | ✅ |
| ドヤLP AI | `/lp` | active | ✅ | ✅ 9頁 | ✅ 9件 | ✅ 2モデル | ✅ 統一プラン | ✅ |
| ドヤ広告シミュレーションAI | `/adsim` | coming_soon | ✅ | ✅ 6頁 | ✅ 9件 | ✅ 1モデル | ✅ 統一プラン | ✅ |
| ドヤ展開AI | `/tenkai` | coming_soon | ✅ | ✅ 10頁 | ✅ 23件 | ✅ 6モデル | ✅ 統一プラン | ✅ |
| ドヤペルソナAI | `/persona` | active | ✅ | ✅ 5頁 | ✅ 3件 | ⚠️汎用 | ✅ 統一プラン | ✅ |
| ドヤボイスAI | `/voice` | active | ✅ | ✅ 10頁 | ✅ 12件 | ✅ 2モデル | ✅ 統一プラン | ❌ |
| ドヤ動画AI | `/movie` | active | ✅ | ✅ 11頁 | ✅ 15件 | ✅ 3モデル | ✅ 統一プラン | ❌ |
| カンタンマーケAI | `/kantan` | maintenance | ✅ | ✅ 10頁 | ❌ | ⚠️汎用 | ⚠️レガシー | ✅ |
| ドヤロゴ | `/logo` | maintenance | ✅ | ✅ | ✅ 1件 | ⚠️汎用 | ⚠️暫定 | ✅ |
| ドヤSwipe | `/seo/swipe` | maintenance | ❌ | 🔗 SEO内 | ✅ 11件 | ✅ 3モデル | 🔗 SEO | ✅ |
| ドヤオープニングAI | `/opening` | maintenance | ✅ | ✅ | ✅ 5件 | ✅ 2モデル | ❌ | ❌ |
| ドヤWeb診断AI | `/shindan` | maintenance | ✅ | ✅ 3頁 | ❌ | ❌ | ❌ | ✅ |
| ドヤスライド | `/doyaslide` | active | ✅ | ✅ 7頁 | ✅ 13件 | ✅ 5モデル | ✅ 統一プラン | ✅ |
| ドヤカンニング | `/cunning` | active | ✅ | ✅ 7頁 | ✅ 11件 | ✅ 7モデル | ✅ 統一プラン | ✅ |
| ドヤ営業管理 | `/sfa` | active | ✅ | ✅ 6頁 | ✅ 9件 | ✅ 11モデル | ✅ 統一プラン | ✅ |
| ドヤ商談準備 | `/shodan` | active | ✅ | ✅ 9頁 | ✅ 9件 | ✅ 4モデル | ✅ 統一プラン | ✅ |
| ドヤ広告バナーAI | `/adbanner` | active | ✅ | ✅ 5頁 | ✅ 7件 | ✅ 2モデル | ✅ 統一プラン | ✅ |
| 旧スライド | `/slide` | deprecated | ❌ | 🔗 /doyaslide | 🔗 旧 | ⚠️汎用 | ❌ | 🔗 doyaslide |
| 旧SlashSlide | `/slashslide` | deprecated | ❌ | 🔗 /doyaslide | 🔗 旧 | ⚠️汎用 | ❌ | 🔗 doyaslide |
| ドヤHR | `/hr` | active | ✅ | ✅ 14頁 | ✅ 30件 | ✅ 10モデル | ✅ 統一プラン | ❌ |
| ドヤ勤怠 | `/kintai` | active | ✅ | ✅ | ✅ | ✅ | ✅ 統一プラン | ❌ |
| ドヤリスト | `/doyalist` | active | ✅ | ✅ 7頁 | ✅ 11件 | ✅ 4モデル | ✅ 統一プラン | ✅ |
| ドヤプロマネ | `/promane` | active | ✅ | ✅ 12頁 | ✅ 3件 | ✅ 9モデル | ✅ 統一プラン | ✅ |
| 管理画面 | `/admin` | active | ❌ | ✅ 15頁 | ✅ 16件+ | ✅ 3モデル | ❌ | ❌ |

### Stripe統合ステータス

全サービスが統一プラン方式で管理される。`stripe.ts` の PlanId / ServiceId 型で定義。

```typescript
type PlanId =
  'seo-light' | 'seo-pro' | 'seo-enterprise' |
  'banner-light' | 'banner-basic' | 'banner-pro' | 'banner-enterprise' |
  'interview-light' | 'interview-pro' | 'interview-enterprise' |
  'copy-light' | 'copy-pro' | 'copy-enterprise' |
  'lp-light' | 'lp-pro' | 'lp-enterprise' |
  'voice-light' | 'voice-pro' | 'voice-enterprise' |
  'movie-light' | 'movie-pro' | 'movie-enterprise' |
  'adsim-light' | 'adsim-pro' | 'adsim-enterprise' |
  'hr-starter' | 'hr-pro' | 'hr-enterprise' |
  'bundle'

type ServiceId = 'seo' | 'banner' | 'interview' | 'copy' | 'lp' | 'voice' | 'movie' | 'adsim' | 'hr' | 'bundle'
```

---

## 各サービス詳細

### 1. ドヤバナーAI (`banner`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | image | A/B/C 3案同時バナー生成 |
| **ページ** | ✅ 16頁 | `src/app/banner/` — dashboard/(11件), gallery/, landing/, pricing/ |
| **API** | ✅ 17件 | `src/app/api/banner/` |
| **Lib** | ✅ | `banners.ts`, `banner-prompts-v2.ts` |
| **DBモデル** | ✅ | BannerTemplate |
| **課金** | ✅ 統一プラン | ServiceId: banner |
| **ドキュメント** | ✅ | reference/services/banner.md |

### 2. ドヤライティングAI (`seo`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | 最大規模サービス |
| **カテゴリ** | text | SEO + LLMO 長文記事生成 |
| **ページ** | ✅ 45頁 | `src/app/seo/` — 18サブディレクトリ |
| **API** | ✅ 54件 | `src/app/api/seo/` |
| **Lib** | ✅ | `seo/lib/` (pipeline.ts=175KB) |
| **DBモデル** | ✅ 12モデル | SeoArticle, SeoJob, SeoSection 他 |
| **課金** | ✅ 統一プラン | ServiceId: seo |
| **ドキュメント** | ✅ | reference/services/seo.md |

### 3. ドヤインタビュー (`interview`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | text | 音声→文字起こし→記事生成 |
| **ページ** | ✅ 15頁 | `src/app/interview/` — projects/, recipes/, settings/, skills/ |
| **API** | ✅ 21件 | `src/app/api/interview/` |
| **Lib** | ✅ | `src/lib/interview/` (storage, transcription, access, types, prompts) |
| **DBモデル** | ✅ 7モデル | InterviewProject, InterviewRecipe 他 |
| **課金** | ✅ 統一プラン | ServiceId: interview |
| **ドキュメント** | ✅ | reference/services/interview.md |

### 4. ドヤコピーAI (`copy`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | text | 5タイプのAIコピーライターで20案以上生成 |
| **ページ** | ✅ 12頁 | `src/app/copy/` — new/ (display/search/sns), [projectId]/, history/, templates/, settings/ |
| **API** | ✅ 11件 | `src/app/api/copy/` — generate, generate-search, generate-sns, brushup, export 他 |
| **Lib** | ✅ | `src/lib/copy/` (gemini.ts, personas.ts) |
| **DBモデル** | ✅ 3モデル | CopyProject, CopyItem, CopyBrandVoice |
| **課金** | ✅ 統一プラン | ServiceId: copy |
| **ドキュメント** | ✅ | reference/services/copy.md |

### 5. ドヤLP AI (`lp`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | text | LP構成案3パターン + セクション別コピー + HTMLエクスポート |
| **ページ** | ✅ 9頁 | `src/app/lp/` — new/ (4ステップ), [projectId]/, history/ |
| **API** | ✅ 9件 | `src/app/api/lp/` — analyze-url, generate-structure, generate-copy, brushup-section, export-html, themes 他 |
| **Lib** | ✅ | `src/lib/lp/` (wireframe.ts, prompts.ts, html-export.ts, themes.ts) |
| **DBモデル** | ✅ 2モデル | LpProject, LpSection |
| **課金** | ✅ 統一プラン | ServiceId: lp |
| **ドキュメント** | ✅ | reference/services/lp.md |

### 6. ドヤ広告シミュレーションAI (`adsim`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | coming_soon | 実装完了済み、公開前 |
| **カテゴリ** | text | LP URL + 予算 → 30業種×6媒体シミュレーション → PDF/PPTX/Excel |
| **ページ** | ✅ 6頁 | `src/app/adsim/` — new/ (5ステップ), [projectId]/, history/ |
| **API** | ✅ 9件 | `src/app/api/adsim/` — projects, simulate, proposal, export, auto-generate, scrape 他 |
| **Lib** | ✅ | `src/lib/adsim/` (auto-generator, simulator, benchmark, pptx/pdf/excel-generator, gemini) |
| **DBモデル** | ✅ 1モデル | AdSimProject |
| **課金** | ✅ 統一プラン | ServiceId: adsim |
| **ドキュメント** | ✅ | reference/services/adsim.md |

### 7. ドヤ展開AI (`tenkai`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | coming_soon | 実装完了済み、公開前 |
| **カテゴリ** | text | 1コンテンツ→9プラットフォーム自動展開 |
| **ページ** | ✅ 10頁 | `src/app/tenkai/` — create/, projects/, brand-voice/, templates/, settings/ |
| **API** | ✅ 23件 | `src/app/api/tenkai/` — projects, generate, content, outputs, brand-voices, templates, usage, api-key |
| **Lib** | ✅ | `src/lib/tenkai/` (generation-pipeline, prompts/ 9種, access, scraper, brand-voice) |
| **DBモデル** | ✅ 6モデル | TenkaiProject, TenkaiOutput, TenkaiBrandVoice, TenkaiTemplate, TenkaiUsage, TenkaiApiKey |
| **課金** | ✅ 統一プラン | ServiceId: tenkai (独自使用量管理 TenkaiUsage) |
| **ドキュメント** | ✅ | reference/services/tenkai.md |

### 8. ドヤペルソナAI (`persona`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | text + image | URL→ペルソナ分析・画像生成 |
| **ページ** | ✅ 5頁 | `src/app/persona/` — history/ |
| **API** | ✅ 3件 | `src/app/api/persona/` — generate, portrait, banner |
| **Lib** | ❌ | なし |
| **DBモデル** | ⚠️ | 汎用 Generation |
| **課金** | ✅ 統一プラン | ServiceId定義予定 |
| **ドキュメント** | ✅ | reference/services/persona.md |

### 9. ドヤボイスAI (`voice`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | audio | 音声コンテンツ生成 |
| **ページ** | ✅ 10頁 | `src/app/voice/` |
| **API** | ✅ 12件 | `src/app/api/voice/` |
| **DBモデル** | ✅ 2モデル | VoiceProject, VoiceRecording |
| **課金** | ✅ 統一プラン | ServiceId: voice |
| **ドキュメント** | ❌ | 未作成 |

### 10. ドヤ動画AI (`movie`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | services.ts 登録済み |
| **カテゴリ** | video | 動画コンテンツ生成 |
| **ページ** | ✅ 11頁 | `src/app/movie/` |
| **API** | ✅ 15件 | `src/app/api/movie/` |
| **DBモデル** | ✅ 3モデル | MovieProject, MovieScene, MovieRenderJob |
| **課金** | ✅ 統一プラン | ServiceId: movie |
| **ドキュメント** | ❌ | 未作成 |

### 11. ドヤHR (`hr`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | active | Phase 1 MVP実装済み (2026-05-26) |
| **カテゴリ** | business | タレントマネジメントシステム |
| **ページ** | ✅ 14頁 | `src/app/hr/` |
| **API** | ✅ 30件 | `src/app/api/hr/` |
| **DBモデル** | ✅ 10モデル | HrOrganization, HrEmployee, HrEvaluation 他 |
| **課金** | ✅ 統一プラン | ServiceId: hr |
| **ドキュメント** | ❌ | 未作成 |

### ドヤスライド (`doyaslide`)【新・画像主体】

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | coming_soon | services.ts 登録済み・公開判断待ち |
| **カテゴリ** | image | 全スライドを gpt-image-2 で1枚絵フル生成 |
| **ページ** | ✅ 7頁 | `src/app/doyaslide/` — page/new/[id]/pricing + layout/error/not-found |
| **API** | ✅ 13件 | `src/app/api/doyaslide/` — projects, structure, generate, analyze, export, style-preview, slides/[id]/(chat,regenerate,revert), assets/logo, logo-config, usage |
| **Lib** | ✅ 10 | `src/lib/doyaslide/` — generate, prompts, constants(12スタイル), limits, access, storage, logo, scrape, templates, types |
| **DBモデル** | ✅ 5モデル | DoyaSlideProject / Slide / Asset / ChatMessage / Version (`doyaslide_*`) |
| **画像生成** | ✅ | `generateImageWithFallback()`（gpt-image-2 / fallback nano-banana-pro-preview） |
| **課金** | ✅ 統一プラン | ServiceId: doyaslide（User.plan判定・limits.ts） |
| **ドキュメント** | ✅ | reference/services/doyaslide.md |
| **残タスク** | ⚠️ | active化 / public/doyaslide/logo.png / /guide |

> 旧 `/slide`・`/slashslide`（Googleスライド下書き型）はこのサービスに統合し **deprecated**（`/doyaslide` へリダイレクト）。

### 12. カンタンマーケAI (`kantan`)

| 項目 | 状態 | 詳細 |
|------|------|------|
| **ステータス** | maintenance | `/seo` にリダイレクト中 |
| **カテゴリ** | text | チャット型AIマーケアシスタント (68+エージェント) |
| **ページ** | ✅ 10頁 | `src/app/kantan/` |
| **API** | ❌ | フロント直接呼出 |
| **DBモデル** | ⚠️ | 汎用 Generation, UserServiceSubscription |
| **課金** | ⚠️ | レガシー方式 |
| **ドキュメント** | ✅ | reference/services/kantan.md |

### 13-17. その他サービス

| サービス | パス | ステータス | ページ | API | 備考 |
|---------|------|-----------|--------|-----|------|
| ドヤロゴ | `/logo` | maintenance | ✅ | ✅ 1件 | 暫定無料 |
| ドヤSwipe | `/seo/swipe` | maintenance | 🔗 SEO内 | ✅ 11件 | SEOサブ機能 |
| ドヤオープニングAI | `/opening` | maintenance | ✅ | ✅ 5件 | アニメーション生成 |
| ドヤWeb診断AI | `/shindan` | maintenance | ✅ 3頁 | ❌ | 仕様定義のみ |
| 旧スライド | `/slide` | deprecated | 🔗 /doyaslide | 🔗 旧 | /doyaslideへ統合・リダイレクト |
| 旧SlashSlide | `/slashslide` | deprecated | 🔗 /doyaslide | 🔗 旧 | /doyaslideへ統合・リダイレクト |
| 管理画面 | `/admin` | active | ✅ 15頁 | ✅ 16件+ | 独自認証 |

---

## 優先対応事項

### 高優先度

| # | 対応内容 | 対象サービス | 理由 |
|---|---------|-------------|------|
| 1 | ドキュメント作成 | Voice, Movie, HR | 実装済みだがドキュメント未作成 |
| 2 | coming_soon → active 移行 | AdSim, Tenkai | 実装完了済み、公開判断待ち |
| 3 | カンタンのレガシー課金移行 | カンタン | 統一プラン方式への統合が必要 |

### 中優先度

| # | 対応内容 | 対象サービス | 理由 |
|---|---------|-------------|------|
| 4 | coming_soon → active 移行 | ドヤスライド | 実装完了・公開判断待ち（旧 /slide・/slashslide は /doyaslide へ統合・廃止済み） |
| 5 | shindan 実装判断 | 診断AI | services.ts登録済みだが実装ゼロ |
| 6 | オープニングAI ドキュメント | Opening | 実装済みだがドキュメント未作成 |

---

## 運用ガイド

### ステータス更新タイミング

以下のタイミングでこのドキュメントを更新すること：

1. **新サービス追加時** — 新しい行を追加、全項目の状態を記録
2. **Stripe統合時** — 課金統合ステータスを更新
3. **services.ts 変更時** — 登録状態を更新
4. **コードベース検証時** — マトリクス全体を実態と突き合わせ
5. **料金改定時** — 料金情報を更新

### 検証方法

```bash
# services.ts の登録サービス確認
grep -n "id:" src/lib/services.ts

# pricing.ts のサービス定義確認
grep -n "_PRICING" src/lib/pricing.ts

# stripe.ts の PlanId/ServiceId 確認
grep -n "PlanId\|ServiceId" src/lib/stripe.ts

# 各サービスのページ存在確認
ls src/app/*/page.tsx

# 各サービスのAPIルート数確認
find src/app/api -name "route.ts" | sort

# Prismaモデル一覧
grep "^model " prisma/schema.prisma
```

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2026-02-17 | 初版作成。コードベース実態調査に基づきステータス記録 |
| 2026-02-17 | 9サービスを maintenance に変更: カンタン, ロゴ, Swipe, 診断, スライド, SlashSlide, LP, 動画, プレゼン |
| 2026-02-18 | ドヤ展開AI (tenkai) を追加。インタビューStripe統合ステータスを更新。ページ数・API数を実態に合わせて修正 |
| 2026-02-20 | ドヤオープニングAI (opening) を追加。Slack通知/Cronジョブ/GTM・HubSpot連携の運用機能を全ドキュメントに反映。README.md全面改訂 |
| 2026-02-22 | opening→maintenance、tenkai→coming_soon、persona/tenkai/opening services.ts登録反映。サイドバー共通コンポーネント化 (`src/components/sidebar/`) |
| 2026-05-27 | 大規模更新: AdSim/Copy/LP/Voice/Movie/HR追加。統一プラン方式反映。Prisma 103モデル・API 327件に実態合わせ。tenkai.md新規作成 |
| 2026-06-02 | ドヤスライド刷新: 画像主体の新 `/doyaslide`（gpt-image-2フル生成・5モデル・13API・12スタイル）を追加。旧 `/slide`・`/slashslide` を deprecated とし `/doyaslide` へリダイレクト統合。doyaslide.md 新規作成・slide.md に廃止記録追記 |
| 2026-06-02 | ドヤカンニング (`/cunning`) MVP実装: Web会議のタブ音声→質問検出→回答カンペ。near-realtime文字起こし(OpenAI・whisperフォールバック)、gemini-flash回答、字句RAG、PiPカンペ、想定問答準備。7頁・11API・7モデル(cunning_*)。本番DBは手動DDLで作成。services.ts登録・cunning.md更新 |
| 2026-06-02 | ドヤスライドを active 化（coming_soon→active、badge 開発中→NEW）。ドヤカンニングは coming_soon のまま |
| 2026-06-12 | ドヤ営業管理(sfa)・ドヤカンニング(cunning)を active 化。ドヤスライドのプロンプトを「きちんとした企業資料」設計に全面改修（LayerX/スライドランド調査反映・デッキ内配色統一・ページ番号描画・スタイルプレビュー v4-document 焼き直し） |
