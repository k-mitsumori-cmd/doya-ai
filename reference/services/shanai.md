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

- `ShanaiCompany.companyProfileId`（null 可・FK なし）は、経営エージェントの自社プロフィールを指すための**予約列**（統合仕様 R-5）。いまは使わない。段0以降、自社プロフィールが入ったらここで結ぶ
- 回答URLのトークン（`surveyToken`）は `src/lib/shanai/token.ts` の CSPRNG（192ビット）で作る。cuid は使わない。担当者は画面から作り直せる（前のURLは使えなくなる）。提出後は公開APIが回答を返さない

録音・写真はドヤインタビューと同じ非公開バケット（`INTERVIEW_STORAGE_BUCKET`）の `{userId}/shanai_{audio|photo}_{interviewId}/` に置く。

### ファイル削除の復旧
- インタビュー削除では音声・写真の両名前空間、写真削除では対象ファイルの削除予定を、DB行の削除と同じトランザクションで保存する。予定の保存に失敗した場合は元の行も残す。
- 既存の `SystemSetting` と `/api/cron/interview-storage-purge` を使う。新規テーブルやストレージ設定は追加しない。APIの `fileCleanupPending: true` はファイル削除待ちを表し、物理ファイルの削除完了とは区別する。
- 既存workerは15分間隔で処理し、失敗時の再試行・プロセス終了後のリース回収に対応する。発行済みアップロードURLからの遅着にも備え、3時間後の最終確認まで削除予定を保持する。実際の完了時刻はcronの実行とストレージの復旧に依存する。
- 写真削除・録音差し替え・アップロード確定は、インタビュー単位のDBロックで直列化する。削除対象のパスは退役記録を残し、削除worker完了後も再登録を拒否する。インタビュー全体の削除時に、そのインタビューの退役記録も片付ける。
- 確定要求の再送では写真を増やさず、同じ録音の完了済み文字起こしを初期化しない。過去の重複写真が同じファイルを参照する場合は、最後の参照を削除するときだけファイル削除を予約する。

## 本番反映の前に必要なこと
1. **DB**: 上の9テーブル（`companyProfileId` 予約列を含む）を `doya-db-push` の手順で本番に反映する（Vercel のビルドは db push しない。忘れると全API が 500）
2. **環境変数**: 既存の `ASSEMBLYAI_API_KEY`・Supabase・LLM の設定をそのまま使う（新規なし）
3. **実機確認**: 録音のアップロード → 文字起こし → 事実 → 記事 → Word / サムネまでを、テスト用の短い録音で1回通す（AssemblyAI と LLM の従量課金が発生するため、実行前に承認を取る）

## 文字起こしの競合・送信結果不明からの復旧

- 録音pathごとの実行tokenとphaseを既存SystemSettingに保存し、同じインタビューの削除・差し替え・完了保存と同じDBロックで照合する。差し替え前の結果・失敗・遅れて受信したjobIDは新しい録音へ書き込まない。音声の差し替え時は長さを未計測へ戻す。
- 外部POSTの直前にpreparedからsubmittingへ永続化する。POST許可前の準備だけが期限切れになった場合は同じ予約回数を再利用できる。既知jobIDは2回上限に達していても再送せず完了待ちへ進む。
- POST後の接続断やjobID保存失敗では外部受付の成否を断定できない。providerの重複排除保証は仮定せず、uncertainを保存し自動再送を停止する。画面の「送信状況を確認する」は既存記録の再確認だけで、受付IDが無いまま新規POSTしない。遅れてjobIDが保存されれば完了待ちへ復帰する。それ以外は運用者によるprovider側の状況照合が必要で、自動照合・取消は未実装。
- 旧版のprocessingでjobIDが無い記録も送信不明として止める。jobIDがあれば既存ジョブとして引き継ぐ。インタビュー削除時は実行記録も同じトランザクションで削除する。新しいテーブル・列・環境変数・キーは不要。
- 検証は `verify-shanai-transcription-postgres.py`（実Prisma/隔離PostgreSQL、外部I/Oは合成）と `verify-shanai-transcription-mounted.cjs`（実VoiceSection/API部品、合成fetch）。本番の有料処理を通した証明ではない。旧版の実行中リクエストが終わるまで公開後最大300秒を移行猶予とする。

## 本番での通しの確認にかかる費用の見込み（2026-10-18 時点）

確認は「録音1件（10分）を通す」と「アンケート1件を通す」の2本。会社サイトの読み取りは1回。
単価は AssemblyAI の料金ページ（Universal-2 が 1時間 $0.15、話者分離が 1時間 $0.02）と、Anthropic の公開価格（Claude Haiku 4.5 が入力 100万トークン $1.00・出力 100万トークン $5.00）。
トークン数はプロンプトの長さからの見積もりで、日本語は1文字を約1トークンとして数えた。

| 処理 | モデル | 回数 | 1回の量（見積もり） | 1回の額 | 小計 |
|------|--------|------|------|------|------|
| 録音の文字起こし（話者分離あり） | AssemblyAI Universal-2 | 1 | 10分 | $0.03 | $0.03 |
| 会社サイトの要約 | Claude Haiku 4.5 | 2（ページ数で分割） | 入力 36,000・出力 3,000 | $0.05 | $0.10 |
| 追加質問の作成（アンケート） | Claude Haiku 4.5 | 1 | 入力 2,000・出力 500 | $0.01 未満 | $0.01 |
| 事実の抽出 | Claude Haiku 4.5 | 2（録音・アンケート） | 入力 6,000・出力 6,000 | $0.04 | $0.08 |
| 記事の生成 | Claude Haiku 4.5 | 2（録音・アンケート） | 入力 6,000・出力 8,000 | $0.05 | $0.10 |
| 合計 | | | | | **約 $0.32** |

- 失敗して作り直す分を2倍とみて、上限の見込みは **約 $0.65**。
- テキスト生成のモデルは `seo/lib/gemini.ts` の既定（`claude-haiku-4-5`）。本番の環境変数 `SEO_CLAUDE_MODEL` が別のモデルを指していると、額は変わる（Claude Sonnet 4.6 なら約3倍）。
- Claude が失敗したときだけ Gemini か GPT-4o に切り替わる。その分はこの表に入れていない。
- 回答URLのメール送付（Resend）は、確認の対象に入れていない。

## 公開するとき
- `src/lib/services.ts` の `UNLISTED_SERVICE_IDS` から `shanai` を外し、`status` を `active` にする
- `src/app/shanai/layout.tsx` の `noindex: true` を外す
- `scripts/security-regression/verify-google-analytics-services.cjs` の公開サービス数を合わせる
- 公開用の OGP 画像・ロゴを置く場合は `src/lib/ogp.ts` / `ToolSwitcherMenu` のロゴ表に追加する

## 経営エージェント（リニューアル）との関係

正本は統合仕様 `docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md`（`feat/ui-renewal-sample`）。レイアウト・トークン・画像の決まりはそちらを参照し、ここには書き写さない。

| 項目 | このブランチでの対応 |
|------|------|
| R-1 ナビをデータで持つ | `src/lib/shanai/nav.ts`（`ShellNavItem[]`）。共通シェルでは `ToolFrame` の `nav` に、OFF のあいだは暫定の `ShanaiSidebar` に同じ配列を渡す |
| 段0（共通シェル） | `src/app/shanai/layout.tsx` が `isShellEnabled('shanai')` を見て、ON のときだけ `ShanaiFrame` が `AppShell`＋`ToolFrame` で包む。回答画面は包まない。手元で見るときは `UI_SHELL_SERVICES=shanai` |
| R-3 ds トークン | 段0の `src/components/ds/tokens.module.css`（`.ds`）を layout で当てる。ds に無い補助の値だけ `src/components/shanai/tokens.css`（`.shanai-ds`）。空状態は `ds/EmptyState`。`src/app/shanai` に色の直書きは無い |
| R-4 読み取りの分離 | `src/lib/shanai/interviews-read.ts`（`listInterviews` / `countInterviews` / `getInterviewDetail`）、`src/lib/shanai/company-read.ts`。API とエージェント道具が同じ関数を呼ぶ |
| R-5 自社プロフィール | `ShanaiCompany.companyProfileId` を予約 |
| R-7 公開画面 | `/shanai/answer/[token]` はアプリ枠を出さない（`src/lib/ui/guest-path.ts`）。AppShell 移行時も対象外（`guestShared`） |
| §5 エージェント道具 | `src/lib/shanai/agent-tools.ts` |
| §6 #15 社員の選択 | 未実装。将来 `ObjectLink(kind='employee', from='shanai.interview', to='hr.employee')` で HR の社員から氏名・部署・入社日を初期値にする |
| §11 状態表示 | 読込（スケルトン）・空（イラスト）・エラー（もう一度）・権限なし・処理中（段階表示）・成功（トースト3秒）。`alert` / `confirm` は使わない |
| §12 画像 | `docs/design/images/shanai/PROMPTS.md` |
| 単体テスト | `npm run test:shanai`（ビルドにも入れてある） |

## マニフェスト草案（R-8。Phase0 で `src/services/shanai/manifest.ts` に移す）

```ts
export const shanaiManifest = {
  id: 'shanai',
  name: 'ドヤ社内インタビュー',
  stage: 'hire',
  status: 'beta', // 開発中（UNLISTED）。公開時に 'active'
  landing: '/shanai',
  ui: {
    nav: SHANAI_NAV, // src/lib/shanai/nav.ts（一覧 / 新しく作る / 会社情報 / 料金プラン）
    icon: '/renewal/icons/shanai.webp',
    mascot: '/ui-renewal/mascots/shanai.webp',
  },
  dataModels: [
    'ShanaiCompany', 'ShanaiCompanySource', 'ShanaiWebPage', 'ShanaiProfileItem',
    'ShanaiInterview', 'ShanaiPhoto', 'ShanaiFact', 'ShanaiArticle', 'ShanaiUsageLog',
  ],
  scope: 'user', // 1ユーザー1社。組織対応は自社プロフィール（companyProfileId）と合わせて行う
  routes: {
    public: ['/shanai', '/shanai/pricing', '/shanai/answer/[token]'],
    api: { public: ['/api/shanai/public/survey/[token]'] },
  },
  guestShared: [{ path: '/shanai/answer/[token]', auth: 'token-param' }],
  cron: [],
  externalApis: [
    { name: 'AssemblyAI', use: '録音の文字起こし', billing: 'metered' },
    { name: 'テキストLLM（@seo/lib/gemini の既定）', use: '会社サイトの要約・事実の抽出・追加質問・記事の生成', billing: 'metered' },
    { name: 'Resend', use: 'shanai.sendAnswerLink のメール送付', billing: 'metered' },
  ],
  agentTools: [
    { key: 'shanai.listInterviews', effect: 'read', cost: 'none', approval: 'none', run: 'src/lib/shanai/interviews-read.ts#listInterviews' },
    { key: 'shanai.draftArticle', effect: 'reversible', cost: 'low', approval: 'setting', run: 'src/lib/shanai/article-service.ts#draftArticle' },
    { key: 'shanai.sendAnswerLink', effect: 'irreversible', cost: 'none', approval: 'required', sensitive: true, run: 'src/lib/shanai/agent-tools.ts' },
  ],
  usage: {
    meters: [
      { key: 'shanaiArticles', label: '記事', unit: '本', free: 3, pro: 30, enterprise: 100, period: { free: 'lifetime', paid: 'month' } },
      { key: 'shanaiTranscripts', label: '文字起こし', unit: '件', free: 3, pro: 30, enterprise: 100, period: { free: 'lifetime', paid: 'month' } },
    ],
    ledger: 'shanai_usage_log',
  },
  links: [
    { kind: 'employee', from: 'shanai.interview', to: 'hr.employee', status: 'planned' }, // §6 #15
    { kind: 'reference', from: 'shanai.article', to: 'mensetsu.companyProfile', status: 'planned' }, // §6 #16
  ],
}
```
