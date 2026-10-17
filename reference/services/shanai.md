# ドヤ社内インタビュー（shanai）

## 概要
- **パス**: `/shanai`
- **サービスID**: `shanai`
- **説明**: 社内インタビューの録音、または社員アンケートの回答と写真から、会社の魅力が伝わる社員インタビュー記事とサムネ画像を作る。会社サイト・サービスサイトのURLを登録すると、会社の情報と組み合わせた「その会社だけの記事」になる
- **ステータス**: 開発中（`UNLISTED_SERVICE_IDS`・`coming_soon`・`BETA`・`noindex`）。ログイン後のツール切替からは使える
- **カテゴリ**: text

## いちばん大事な設計: 書いていないことは書かない
記事をいきなり書かせない。2段構えにする。

1. **事実の抽出**: 素材（文字起こし・アンケート回答）から事実を **原文引用つき** で抜き出す。引用が原文に無い事実は保存しない（`src/lib/shanai/evidence.ts` の `quoteExists`）。会社の事実は会社プロフィールから機械的に選び、AIには作らせない
2. **記事の生成**: 担当者がチェックした事実だけを渡して書かせる。各ブロックは根拠の事実ID（`factIds`）を持ち、根拠が無いブロック・原文に無い「一言」には `unsupported` を付けて編集画面で警告する

会社サイトの読み取りも同じ考え方。
- 読むページはAIに選ばせない。リンクの文字とURLの機械判定で選ぶ（`USEFUL_LINK` / `SKIP_LINK`）
- `robots.txt` で禁止されたパスは読まない。照合は正規表現を組み立てない線形時間の実装（ReDoS 対策）
- プロフィール項目はページ本文からの原文引用が必須。本文に無い引用は捨てる

アンケートは材料不足をそもそも起こさない。
- 15問、設問ごとに最低文字数。必須設問が全部満たされるまで提出・事実の抽出ができない（`src/lib/shanai/survey.ts`）
- エピソード系の短い回答には、AIが追加質問を作る（1インタビュー3回まで）

## 画面
| パス | 内容 |
|------|------|
| `/shanai` | 未ログイン: LP / ログイン後: インタビュー一覧 |
| `/shanai/company` | 会社情報（会社名・サムネの色・読み取るURL6件まで・会社プロフィールの確認と手入力） |
| `/shanai/new` | 新規作成（録音 / アンケート、社員情報、関わるサービス、目的・文体） |
| `/shanai/interviews/[id]` | ①素材（録音のアップロードと文字起こし / アンケートURLの共有・代理入力）②写真 ③事実の確認 ④記事の生成・編集・Word・サムネ |
| `/shanai/answer/[token]` | 社員が開くアンケート回答画面（ログイン不要。`guest-path.ts` に登録済みでアプリ枠を出さない。noindex） |
| `/shanai/pricing` | 統一プランの料金表 |

## API
すべて `src/app/api/shanai/`。ログイン必須（公開アンケートのみトークン）。他人の行は `{ id, userId }` の二重条件で決して解決しない。

| メソッド | パス | 内容 | 費用 |
|---------|------|------|------|
| GET/PUT | `/company` | 会社情報の取得・保存（URLを変えたら読み取り結果を作り直す） | — |
| POST | `/company/crawl` | 登録URLを読み取り、プロフィール項目を抽出（3分に1回まで。内容が変わったページだけ要約） | LLM |
| PUT | `/company/items` | プロフィール項目の確認・修正・手入力 | — |
| GET/POST | `/interviews` | 一覧・作成 | — |
| GET/PUT/DELETE | `/interviews/[id]` | 詳細・基本情報更新・削除（録音と写真もストレージから消す） | — |
| POST | `/interviews/[id]/upload-url` | 録音・写真の署名付きアップロードURL（1インタビュー40回まで） | — |
| POST | `/interviews/[id]/confirm-upload` | 実ファイルの大きさ・形式を検証して登録 | — |
| PATCH/DELETE | `/interviews/[id]/photos/[photoId]` | サムネ指定・キャプション・削除 | — |
| POST | `/interviews/[id]/transcribe` | 文字起こし（AssemblyAI）。1回4分待ち、終わらなければ `{pending:true}` で呼び直す（送信済みジョブを待つだけで二重課金しない） | AssemblyAI |
| PUT/POST | `/interviews/[id]/survey` | 担当者による代理入力・確定 | — |
| POST | `/interviews/[id]/followups` | 追加質問の作成（担当者用） | LLM |
| POST/PUT | `/interviews/[id]/facts` | 事実の抽出（1インタビュー5回まで・記事の枠が残っていること）／確認・修正（原文は変更不可） | LLM |
| POST/PUT | `/interviews/[id]/article` | 記事の生成（新しい版・利用枠1回）／編集の保存 | LLM |
| GET | `/interviews/[id]/export` | Word（.docx）。サムネ・本文写真入り | — |
| GET | `/interviews/[id]/thumbnail` | サムネ PNG 1200×630（`?download=1`） | — |
| GET/PUT/POST | `/public/survey/[token]` | 社員の回答画面（取得・下書き保存・追加質問・提出） | LLM（追加質問のみ） |
| GET | `/usage` | 利用状況 | — |

## 利用枠（正本: `src/lib/plan-limit.ts`）
| キー | 無料（累計） | プロ（月次） | ENTERPRISE（月次） |
|------|------|------|------|
| `shanaiArticles`（記事の生成） | 3 | 30 | 100 |
| `shanaiTranscripts`（録音の文字起こし。1件90分まで） | 3 | 30 | 100 |

- 数えるのは台帳 `shanai_usage_log`。**インタビューや記事を削除しても枠は戻らない**（行を数えると削除で枠が戻ってしまう）
- 記事の生成に失敗したときだけ台帳と記事行を消して枠を戻す（`releaseArticle`）
- 枠の確保は LLM・文字起こしの **前**、Serializable トランザクションで行う
- 録音の長さは保存された中身から測る（`inspectInterviewMediaDuration`。ブラウザの申告は使わない）
- services.ts の表示文言（`pricing.free.limit` / `pricing.pro.limit`）と必ず合わせる

## サムネ・Word
- サムネは **画像生成AIを使わない**。本人の実写真（星印の1枚）に、記事の一言・名前・部署・会社名を重ねて合成する（`satori` → `sharp`）。フォントは `assets/fonts/NotoSansJP-*.ttf`（`next.config.js` の `outputFileTracingIncludes` に同梱指定済み）
- Word は `docx@9.5.1`。サムネ・リード・Q&A・一言・会社紹介・本文写真（キャプションつき）。Googleドキュメントで使うときはドライブで開いて変換する（Google API 連携は持たない）

## DB（`prisma/schema.prisma`）
| モデル | テーブル | 内容 |
|--------|---------|------|
| ShanaiCompany | shanai_company | 会社情報（1ユーザー1社） |
| ShanaiCompanySource | shanai_company_source | 読み取るURL（会社/サービス/採用/その他） |
| ShanaiWebPage | shanai_web_page | 読み取ったページ本文とハッシュ |
| ShanaiProfileItem | shanai_profile_item | 会社プロフィール項目（原文引用つき・手入力も） |
| ShanaiInterview | shanai_interview | インタビュー（モード、社員情報、アンケート回答、録音、文字起こし、各種回数） |
| ShanaiPhoto | shanai_photo | 写真（サムネ / 本文） |
| ShanaiFact | shanai_fact | 記事の根拠になる事実（原文引用つき） |
| ShanaiArticle | shanai_article | 記事（版ごと） |
| ShanaiUsageLog | shanai_usage_log | 利用枠の台帳（削除しない） |

録音・写真はドヤインタビューと同じ非公開バケット（`INTERVIEW_STORAGE_BUCKET`）の `{userId}/shanai_{audio|photo}_{interviewId}/` に置く。

## 本番反映の前に必要なこと
1. **DB**: 上の9テーブルを `doya-db-push` の手順で本番に反映する（Vercel のビルドは db push しない。忘れると全API が 500）
2. **環境変数**: 既存の `ASSEMBLYAI_API_KEY`・Supabase・LLM の設定をそのまま使う（新規なし）
3. **実機確認**: 録音のアップロード → 文字起こし → 事実 → 記事 → Word / サムネまでを、テスト用の短い録音で1回通す（AssemblyAI と LLM の従量課金が発生するため、実行前に承認を取る）

## 公開するとき
- `src/lib/services.ts` の `UNLISTED_SERVICE_IDS` から `shanai` を外し、`status` を `active` にする
- `src/app/shanai/layout.tsx` の `noindex: true` を外す
- `scripts/security-regression/verify-google-analytics-services.cjs` の公開サービス数を合わせる
- 公開用の OGP 画像・ロゴを置く場合は `src/lib/ogp.ts` / `ToolSwitcherMenu` のロゴ表に追加する
