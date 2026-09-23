# ドヤカンニング（要件定義書）

> ステータス: **active（2026-06-12 公開）** / 2026-06-02 にPhase 1〜3相当をコード実装。
> 作成日: 2026-06-01 ／ 実装更新: 2026-06-02
>
> 実装メモ:
> - 文字起こしは「数秒チャンクをOpenAI音声APIにPOST」する near-realtime 方式（Vercel ServerlessはWS長時間保持不可のため。Google STT streaming直結はPhase 2）。
> - 回答生成は gemini-2.5-flash 優先 / gpt-4o フォールバック（SSEではなくJSON応答。ストリーミングはPhase 2）。
> - RAGは pgvector 未導入のため字句バイグラム類似検索（MVP）。embeddingsはPhase 2。
> - ライブ画面は共有タブの映像を表示し、最新回答を映像下にカンペ表示（テレプロンプター風）。
> - 本番DBの cunning_* テーブルは手動DDLで作成済み（Vercelはdb pushをスキップするため）。

## 概要

- **パス**: `/cunning`
- **サービスID**: `cunning`
- **説明**: Google Meet / Zoom 等のWeb会議に流れる**相手の日本語音声をリアルタイム解析**し、相手の質問に対する**最適な回答を即座に画面提示**するAIカンペ（リアルタイム回答支援）ツール
- **ステータス**: `active`（2026-06-12 公開）
- **カテゴリ**: realtime / audio
- **アイコン**: 🎧（`hearing` / Material Symbols）
- **カラー**: ブランド紫 `#7f19e6`
- **想定ユースケース**:
  1. **商談アシスト** — 自社サービスの商談中、相手（見込み顧客）の質問に対し、自社サービス情報に基づいた回答を即時提示
  2. **採用面接対策** — 面接中、面接官の質問に対し、応募先企業に最適化した回答案を即時提示

---

## ターゲットと提供価値

| ユースケース | ユーザー | 課題 | 提供価値 |
|------------|---------|------|---------|
| 商談アシスト | 営業担当・カスタマーサクセス | 想定外の質問に即答できない／製品知識のばらつき | 製品ナレッジに基づく即答カンペで対応品質を標準化 |
| 面接対策 | 求職者 | 企業ごとに刺さる回答を用意しきれない | 企業情報に最適化した回答案をリアルタイム表示 |

> **注意（適正利用）**: 本ツールは「回答案の提示による支援（カンペ）」であり、発話するか否かはユーザーが判断する。面接・商談の相手方規約や録音に関する法令・同意要件を順守する旨を利用規約・UIで明示する（後述「コンプライアンス」参照）。

---

## 機能要件

### 1. 連携と音声解析（リアルタイム）

- **対象音声**: PCに入力される**相手（リモート参加者）の日本語音声**をリアルタイム取得
- **キャプチャ方式**（重要な技術判断 — 推奨順）:

  | # | 方式 | 取得対象 | 長所 | 短所 | 採否 |
  |---|------|---------|------|------|------|
  | A | **ブラウザのタブ音声共有** `getDisplayMedia({ audio: true })` | Meet/Zoom **Webクライアントのタブ音声** | 追加インストール不要・Web完結 | タブ音声共有の許可操作が必要／Zoomデスクトップアプリの音声は取れない | **推奨（MVP）** |
  | B | **仮想オーディオデバイス**（BlackHole 等）+ `getUserMedia` | システム出力全体 | デスクトップアプリ含め全取得 | ユーザー側セットアップが必要 | Phase 2（上級者向け案内） |
  | C | **デスクトップヘルパー / 拡張機能** | システムループバック | 取得が安定 | 別アプリ配布が必要・工数大 | 将来検討 |

  > MVPは **方式A（タブ音声共有）** を前提とする。Meet/ZoomはWebクライアント利用を案内。Zoomデスクトップアプリ利用者には方式B（仮想デバイス）をガイドする。
  > 自分（ユーザー）のマイク音声は対象外（必要なら話者分離で除外）。タブ音声は相手の音声のみが流れるため実質的に相手発話を取得できる。

- **ストリーミング文字起こし**:
  - WebブラウザでキャプチャしたPCMをWebSocket経由でサーバーへ送出 → STTストリーミングへ中継
  - **STTプロバイダ（日本語リアルタイム対応が必須）**:
    - **第1候補: Google Cloud Speech-to-Text（streaming, `ja-JP`）** — 日本語リアルタイム精度・実績が高い
    - 代替: Deepgram（`nova-2`, 日本語ストリーミング対応）、AssemblyAI Streaming（※日本語リアルタイム対応状況を要確認。既存の `interview` はバッチ用途で `universal-2` を採用）
  - 部分確定（interim）と確定（final）を区別し、**finalセグメント単位**で回答生成をトリガー
  - 目標レイテンシ: 発話終了 → 文字起こし確定 **1秒以内**

### 2. 即時回答生成

- 相手の発話（質問）を検出 → **質問判定** → 回答を即時生成しオーバーレイ表示
- **質問検出**: finalセグメントに対し軽量判定（疑問符・疑問表現・依頼表現のヒューリスティック＋LLM分類）。雑談・相づちはスキップ
- **回答生成モデル**: `gemini-2.5-flash`（低レイテンシ優先、`@seo/lib/gemini` の `geminiGenerateText` ラッパー経由）。フォールバック `gpt-4o`（`src/lib/openai.ts`）
- **出力形式**:
  - **要点（一言回答）**: 3秒で読める短文（最優先表示）
  - **詳細（話すスクリプト）**: そのまま読み上げられる2〜4文
  - **根拠**: 参照したナレッジ／企業情報の出典チップ
- **目標レイテンシ**: 質問確定 → 回答初表示 **2〜3秒以内**（ストリーミング表示で体感短縮）
- **逐次更新**: 質問が続いて文脈が変わった場合は最新質問を優先し、回答を差し替え

### 3. コンテキストに応じた最適化

#### (a) サービス情報モード（商談アシスト）

- 事前に**自社サービス情報を読み込んだナレッジベース**を構築し、それに基づいた回答を生成
- **ナレッジ投入手段**:
  - テキスト直接入力 / ファイルアップロード（pdf, txt, docx, md）
  - URL指定（サービスサイト・料金ページ等）→ スクレイピング取り込み（既存 `src/lib/tenkai/scraper.ts` / `lp/analyze-url` の手法を流用）
  - FAQ・想定問答（Q&Aペア）の登録
- **RAG**: 投入ナレッジをチャンク化・埋め込み（embeddings）し、質問にマッチする該当箇所を検索 → プロンプトに注入
- セッション開始時に使用するナレッジベース（プリセット）を選択

#### (b) 企業面接モード（面接対策）

- **採用面接ページのURLを入力** → 企業情報・募集要項を解析 → その企業に最適化した回答を提示
- **解析対象**: 求人/採用ページのスクレイピング（事業内容・求める人物像・職務内容・バリュー等を抽出）
- 任意で**応募者プロフィール / 職務経歴 / 志望動機メモ**を併せて登録 → 「企業 × 応募者」で回答を個別最適化
- 想定質問（志望動機・強み弱み・逆質問 等）の**事前準備カンペ**も生成可能

> (a)(b) は内部的に「コンテキストソース」を切り替える同一エンジン。セッション作成時に **モード（商談 / 面接）** と **コンテキスト（ナレッジベース or 企業URL）** を選択する。

---

## 非機能要件

| 項目 | 要件 |
|------|------|
| レイテンシ | 文字起こし確定1秒以内 / 回答初表示2〜3秒以内 |
| 同時実行 | 1ユーザー1アクティブセッション（MVP） |
| 接続 | 音声送出・回答配信は WebSocket（または SSE）でリアルタイム双方向 |
| 可用性 | STT/LLM障害時はフォールバックプロバイダへ自動切替 |
| プライバシー | 音声は文字起こし後に原則破棄（保存はオプトイン）。文字起こしテキストはセッション単位で暗号化保存 |
| ブラウザ | Chrome / Edge 最新（`getDisplayMedia` 音声対応ブラウザ前提） |

---

## 技術構成

```
[ブラウザ]
  getDisplayMedia({audio:true}) でMeet/Zoomタブ音声取得
   └─ AudioWorklet でPCM(16kHz)化
       └─ WebSocket でサーバーへ送出
                 │
[サーバー / Next.js API or 専用WSエンドポイント]
   ├─ STTストリーミング中継（Google STT streaming, ja-JP）
   │    └─ interim/final セグメント
   ├─ 質問検出（ヒューリスティック + 軽量LLM分類）
   ├─ コンテキスト取得（RAG: ナレッジ検索 / 企業情報）
   ├─ 回答生成（gemini-2.5-flash, ストリーミング / fallback gpt-4o）
   └─ WebSocket/SSE で回答を逐次クライアントへ配信
                 │
[ブラウザ オーバーレイUI]
   要点 → 詳細スクリプト → 出典 を即時表示
```

> **WebSocket注意**: Vercel Serverless Functions は長時間WebSocketを保持できない。リアルタイムSTT中継は以下のいずれかで実装する（要技術選定）:
> - 外部リアルタイム基盤（例: 別ホストのNode WSサーバー / Supabase Realtime / Ably 等）
> - クライアント↔STTプロバイダの直結（ephemeralトークン方式）＋サーバーは回答生成のみSSE
>
> MVPの現実解: **クライアント→STTはプロバイダ直結（短期トークン）**、**回答生成はNext.js APIのSSEストリーミング**に分離する構成を推奨。

---

## API エンドポイント（想定）

すべて `runtime='nodejs' / dynamic='force-dynamic' / maxDuration=300`、Next.js 15互換 params 準拠。

### セッション管理
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/cunning/sessions` | セッション作成（モード・コンテキスト指定） |
| GET | `/api/cunning/sessions` | セッション一覧 |
| GET | `/api/cunning/sessions/[id]` | セッション詳細（文字起こし・回答履歴） |
| DELETE | `/api/cunning/sessions/[id]` | セッション削除 |
| POST | `/api/cunning/sessions/[id]/stt-token` | STTプロバイダ短期トークン発行 |

### リアルタイム回答
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/cunning/answer` | 質問テキスト → 回答生成（SSEストリーミング） |
| POST | `/api/cunning/classify` | 発話セグメントが質問かを判定 |

### ナレッジベース（商談モード）
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/cunning/knowledge` | ナレッジベース一覧 |
| POST | `/api/cunning/knowledge` | ナレッジベース作成 |
| POST | `/api/cunning/knowledge/[id]/ingest` | ファイル/URL/テキスト取り込み（チャンク化＋埋め込み） |
| DELETE | `/api/cunning/knowledge/[id]` | 削除 |

### 企業コンテキスト（面接モード）
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/cunning/company/analyze` | 採用URL解析 → 企業プロファイル抽出 |
| GET/POST | `/api/cunning/profiles` | 応募者プロフィール管理 |

---

## DB テーブル（Prisma, `@@map("cunning_xxx")`）

| モデル | テーブル名 | 主なフィールド |
|--------|-----------|--------------|
| CunningSession | cunning_session | userId, mode(SALES/INTERVIEW), contextRef, status, startedAt, endedAt |
| CunningTranscript | cunning_transcript | sessionId, speaker, text, isFinal, startMs, endMs |
| CunningAnswer | cunning_answer | sessionId, questionText, summary, script, sources(JSON), latencyMs |
| CunningKnowledgeBase | cunning_knowledge_base | userId, name, description |
| CunningKnowledgeChunk | cunning_knowledge_chunk | knowledgeBaseId, content, embedding(vector/JSON), sourceUrl |
| CunningCompanyProfile | cunning_company_profile | userId, url, companyName, businessSummary, requirements(JSON) |
| CunningApplicantProfile | cunning_applicant_profile | userId, name, resume, motivation |

> 埋め込み検索は pgvector が理想。導入していない場合はJSON保存＋アプリ側コサイン類似度で代替（MVP）。

---

## 画面構成（UI）

```
src/app/cunning/
  ├── layout.tsx              — CunningLayout（紫テーマ・専用サイドバー）
  ├── page.tsx               — ダッシュボード（セッション一覧 / 新規開始）
  ├── live/
  │   └── [sessionId]/page.tsx — ★ ライブ画面（音声共有 + リアルタイム回答オーバーレイ）
  ├── knowledge/
  │   ├── page.tsx           — ナレッジベース一覧
  │   └── [id]/page.tsx      — ナレッジ編集・取り込み
  ├── company/page.tsx       — 企業URL解析・応募者プロフィール
  └── history/page.tsx       — 過去セッションの文字起こし・回答ログ

src/components/cunning/      — LiveOverlay, AnswerCard, AudioCaptureButton, ContextPicker 等
src/lib/cunning/
  ├── stt.ts                — STTストリーミング中継／トークン発行
  ├── answer.ts             — 回答生成（gemini-flash, プロンプト）
  ├── classify.ts           — 質問判定
  ├── rag.ts                — チャンク化・埋め込み・検索
  ├── company.ts            — 採用URL解析
  ├── scraper.ts            — URL取り込み（tenkai/scraperを流用）
  ├── access.ts             — アクセス制御・使用量管理
  └── types.ts              — 型定義
```

### ライブ画面の要件
- **音声共有開始ボタン**: クリックで `getDisplayMedia` 許可ダイアログ → タブ音声共有開始
- **リアルタイム字幕**: 相手の発話を逐次表示（interim はグレー、final は黒）
- **回答カード**: 質問検出ごとにカード生成。要点（大）→ 詳細スクリプト（中）→ 出典チップ
- **常時手前表示**: 別ウィンドウ／ピクチャーインピクチャ対応で会議画面の脇に置けると理想（Phase 2）
- **コンテキスト切替**: セッション中もナレッジ／企業の参照先を切替可能

---

## 料金（統一プラン方式）

> 個別課金しない。**ドヤマーケAI（¥9,980）契約でPRO機能が全解放**（[[feedback_unified_plan]] / [[project_unified_plan_2plan]]）。

| プラン | 同時セッション | 月間利用時間 | ナレッジベース | 月額 |
|--------|-------------|------------|-------------|------|
| 無料会員 | 1 | 合計60分 | 1個 | ¥0 |
| PRO（ドヤマーケAI） | 1 | 月20時間 | 無制限 | ¥9,980 |

> 使用量は文字起こし時間（分）で計上。`access.ts` で月次リセット管理。

---

## コンプライアンス・倫理上の配慮

- 利用規約・UIに以下を明示:
  - 録音／音声取得に関する**相手方の同意・各サービス規約・適用法令**の順守はユーザー責任
  - 本ツールは**回答案の提示（支援）**であり、最終的な発話判断はユーザーが行う
- 音声データはデフォルトで保存せず、文字起こし後に破棄（保存はオプトイン）
- 面接利用は「**面接準備・自己整理の支援**」を主目的として位置づけ、虚偽申告を推奨しない旨を注記

---

## 開発フェーズ（提案）

| フェーズ | 内容 |
|---------|------|
| **Phase 0 設計** | STT/WS基盤の技術選定（Google STT直結＋SSE回答）、pgvector有無の確認 |
| **Phase 1 MVP** | タブ音声共有 → 日本語STT → 質問検出 → gemini-flash回答（コンテキストなし）→ ライブ画面 |
| **Phase 2 商談モード** | ナレッジベース取り込み（ファイル/URL/Q&A）＋RAG回答 |
| **Phase 3 面接モード** | 採用URL解析＋応募者プロフィール最適化 |
| **Phase 4 体験向上** | PiP/別ウィンドウ常時表示・回答の話速最適化・履歴/振り返り |

---

## 登録時の必須作業（実装着手時）

1. `src/lib/services.ts` に `cunning` サービス登録（カテゴリ・パス・アイコン・ステータス）
2. `reference/10-service-status.md` の実装マトリクスに行追加
3. `prisma/schema.prisma` に `cunning_*` モデル追加 → `npx prisma generate`
4. 統一プラン判定は `User.plan` 単一参照（[[project_unified_plan_2plan]]）。個別Stripe ServiceId は追加しない方針
5. 画像生成を使う場合は `generateImageWithFallback()` 経由（本サービスでは画像生成は基本不要）

## 2026-09-20 ローカル補修メモ（本番未反映）

- 議事録生成は保存済みの発話・回答を全件対象とし、createdAt・id順で入力する。先頭200/100件の取得制限と末尾60/40件の入力制限は廃止。
- 議事録JSONの`sourceCoverage`に対象の発話数・回答数を保持し、結果画面・履歴に表示する。旧形式で件数不明の場合は再生成を案内する。
- 保存失敗がある場合の`incompleteInput`は再生成でも保持する。生成結果の必須項目・型・スコアを検証し、不正結果では既存議事録を上書きしない。
- 録音終了時は最終音声・回答保存を待ってから終了情報と議事録を保存する。45秒で待ち合わせが完了しない場合は再試行を案内する。
- 利用時間の送信は累計`totalSeconds`。ロック内で保存済み値との最大値を採用し、再送を二重加算しない。ただしサーバー計測・月跨ぎ配分・複数端末での予約は未完了。
- 非常に長い会話の分割生成、実AIによる品質、全画面の通し検証は継続対象。関連する全体修正と公開前確認を終えるまで先行公開しない。
- 検証根拠: `docs/audits/2026-09-20-loop-246/`〜`2026-09-20-loop-248/`。


第264巡: セッション作成はオブジェクト/既知mode/型・長さ(title120、補足1000、ID128)を検証し400で案内。3参照IDはid+userIdの存在確認後だけ保存、不在/所有外は同じ404。補足欄に1000文字制限/文字数表示を追加。実DB4グループ合格、本番未反映。server recording/month split/cross-device reservation（253）は別途未完了。


第253巡継続: recording-ledger.tsのサーバー時間台帳を実装（API/UI未接続）。Userロック、60秒予約、停止時返却、期限切れ精算、JST月配賦、再送tokenを実DB11群で確認。通信断は最終予約期限まで最大60秒分を計上する設計。旧使用数移行/切替/最終音声/画面は未完了のため、まだ有効化しない。本番未反映。


第253巡・旧使用量引継ぎ: leaseのない旧durationSecを元のJST開始月に取込み、再実行は二重計上せず増加分だけ反映。削除済み使用も維持、新leaseのms/予約は変更しない。実DB7群＋台帳11群再合格。API/UI未切替、旧PATCH併用は未解決。DOYA_DISABLE_LIMITSのサーバー設定も台帳に反映済み。


第253巡・予約込みusage: サーバー台帳read helperで経過精算/期限切れ/当月used+reserved/次月JST resetを計算、整数表示の二重切上げも防止。実DB7群＋既存11/7群合格。API未接続。残枠0でも自分の予約で継続中の録音を誤拒否しないよう、token付き音声受付と同時切替が必須。


第253巡・録音API: recordingVersion列（既定1）を追加し、新台帳はversion2のみ開始可。認証付きrecording POSTでstart/heartbeat/stopを処理し、旧PATCHの時間/endはversion2に対し409拒否。通常作成UIはまだ1で移行未完了。stop/期限切れ/更新時上限でSessionもendedに統一。実API+DB7群、台帳12/usage7/legacy7群合格。新列DDL先行が公開前必須。本番未適用。


第253巡・音声受付: version2 transcribeは録音tokenで受付、停止後finalはremote/self各1回・15秒猶予。受付済み処理はstop後保存、delete後保存拒否を実DB6群で確認。providerエラー生本文をログに出さない。final受付は単発で失敗時の再試行/cache未実装。新UI/最後の回答/送信中の順序確認は未完了、version1一般利用を維持。本番未反映。


第253巡・最終回答: 新transcribeが最終マーカー/保存IDを返し、answerは同じ所有セッションの最終remote本文から終了後120秒以内に1試行だけ生成可能。クライアントの質問差替え/並列重複/重複transcriptを防止。実DB回答6群＋音声6群、標準150本/型検査/build合格。finalの失敗再試行/成功結果再取得、新UI/usage/prep/切替は未完了。本番未反映。追加2列は253 migrationへ記載。


第253巡・最終回答の復旧: 成功済み結果は最終transcriptのunique FKで結び、期限後も所有者/tokenを検証してAI再実行なしで返す。確定した失敗は該当claimだけ解除し120秒受付内の再試行を許可。古いclaim/不正token/保存済み回答は解除不可。タイムアウト後も元AIが未完了の場合はclaimを維持。実DB回答11群合格。プロセスクラッシュ等の未完了claim復旧、新UIと録音全通しは残件。本番未反映。


第253巡・削除中の遅延保存: Userが先に削除されると回答/音声/議事録の遅延保存を拒否するようUserロック・存在確認を追加。古い認証IDも実在User照合で拒否。実DB回答12/音声8/認証議事録4群合格。既存孤立データ清掃は別途残件、本番未反映。


第253巡・最終音声再試行: 初回15秒猶予、同一音声bytes/言語だけ終了後120秒以内・最大3試行。処理中は拒否し確定失敗後にclaim解除。成功/無音は保存済みtranscriptを返しAI再実行なし。最終transcriptはchannel別部分unique index。最後の回答は録音終了/最終transcript作成の遅い方から120秒まで。追加6列/indexはローカルのみ、UI再送/クラッシュ復旧/本番反映は残件。


第253巡・usage接続: 月次使用量/開始判定をサーバー台帳へ接続し確保中の秒数も控除。usage取得失敗時は開始不可・再確認可、残1秒は使用可能。確保中と消費上限の案内を分離。native prepは録音tokenを検証し自分の予約で動作する。新録音UI/旧新切替は未完了。新テーブルDDL先行必須、本番未反映。


第253巡・録音クライアント制御: active応答へvalidForMsを追加し、録音controllerが通信時間を差し引きmonotonic時計で期限を管理。開始重複/遅い応答/停止再試行/通信失敗を12ケース、実DB19群で確認。まだliveページ未接続で、新UI全通しや旧新切替は未完了。本番未反映。


第253巡・live version2接続: 許可後録音/heartbeat/停止精算、token付き音声・回答・prep、最終音声IDを回答へ接続。最後の未確定前半も保存済みIDを最大16件照合して結合。正常経路ブラウザ5群・実DB回答15群合格。一般作成はまだversion1。再送UI/応答順序/旧新切替/実機通し等は未完了、本番未反映。


第253巡・応答順序: upload並列・画面反映はチャネル別送信順。停止後に遅れて届く前半を最終回答に保持（最大64保存ID）。DB受付時刻audioReceivedAtを追加し、前半照合と議事録/fingerprintに使用。実DB35群と順序逆転ブラウザ5群合格。新列はローカルのみ適用。受付順そのものの逆転、履歴カーソル順、再送UI、旧新切替等は未完了。本番未反映。


履歴順序補修（2026-09-20、ローカルのみ）: 文字起こし一覧/続き取得を議事録と同じ音声受付時刻順（旧行は保存時刻）へ統一。同時刻は保存時刻/idで安定化。発話ページカーソルはsessionId/改訂時刻を持ち、遅れた発話保存等で更新された場合は409と読み直し導線を表示。初回の件数/本文/改訂はRepeatableReadで整合。専用DB10群、画面コールバック8群、模擬HTTP付き実ブラウザ6群合格。本番反映/全サービス完了は未実施。

### 第283巡・最終音声の処理中断（ローカル補修）

version2の最終音声は、受付済みの同じhashに限り、停止後15分・最大3試行まで再送可能。処理権は330秒で回収でき、保存時にも現在のclaimedAtを確認して古い処理の結果を拒否する。初回15秒受付は維持。再送UI/通常窓の順序・停止後到着対応は未完了で、version2新規作成を一般有効化していない。本番未反映。検証は `docs/audits/2026-09-20-loop-283/report.md`。

### 第284巡・最終音声の再送UI（ローカル補修）

version2で失敗した最後の音声は、元Blob/言語をページ内に保持して話者別に再送する。未保存の最終音声がある間は議事録へ進まず、回復した音声だけ失敗状態を解除する。ページを閉じた後の復旧は未対応。通常窓の停止後到着/sequence管理は残るため新規version2は未有効化。本番未反映。実React画面・合成MediaRecorder/HTTPのChrome検証は `docs/audits/2026-09-20-loop-284/report.md`。


### 第285巡・音声窓の予約台帳（API/UI未接続）

CunningAudioWindowで録音中の事前予約と話者別sequenceを保持し、停止後も既存予約を受け付ける基盤を追加。hash固定・最大3試行・330秒claim回収と保存時照合・15分回復期間・成功キャッシュを実DB8群で検証。3500ms窓と先読み1枠で予約数を制限。新テーブルSQLはローカルのみ。API/画面/履歴順/最終回答・議事録の完了判定への接続が残るため、通常窓の欠落問題を解消済みとは扱わない。新規version2は未有効化。詳細は `docs/audits/2026-09-20-loop-285/report.md`。


### 第286巡・音声窓API（UI未接続）

予約/終了確定APIと予約音声のアップロードAPIを追加。全窓保存と停止確認前は確定できず、議事録APIも未保存/未確定を拒否する。予約が議事録生成中に追加された場合は改訂CASで保存拒否。同時刻予約は議事録/fingerprintでsequence順へ整列し、全窓確定から最終回答の受付期間を確保。実DB・合成AI9群と従来台帳/回答/議事録回帰を検証。UI・発話履歴・旧API混在防止・実録音・本番反映は未完了。`docs/audits/2026-09-20-loop-286/report.md`。


### 第287巡・新旧音声方式の混在拒否（ローカルのみ）

lease.audioProtocolを最初の許可された音声受付/窓予約で原子的に固定する。旧native方式のprovider実行中でも新予約を拒否し、windows方式の旧音声API呼出はprovider前に拒否。実DB/API6群（10回の競合を含む）、旧最終音声/新窓API・台帳の回帰を確認。追加列は287/migration.sql、本番未適用。既存worker排出とUI接続は残件。`docs/audits/2026-09-20-loop-287/report.md`。


### 第288巡・窓クライアント（Live未接続）

音声の事前予約・話者別順序・元Blob/言語保持・同一要求の再送・未使用予約の無音確定・全窓確定照合を行うaudio-window-clientを追加。標準9群、実API/ローカルDBとの接続4群を検証。Live MediaRecorderとの組み込み、実ブラウザ録音、本番反映はまだ実施していない。`docs/audits/2026-09-20-loop-288/report.md`。


### 第289巡・Live画面を窓方式へ接続（ローカル）

version2 Liveは開始前予約・先読み・通常/最終音声保持再送・全窓確定→最後の回答→議事録へ接続済み。失敗時停止、終了処理の排他、保存待ち中の再送無効化、終了後ラベルを補修。実Chrome/React・合成音声/HTTPで4パターン各7項目合格。実マイク長時間・UI+実DB全通し・離脱復旧・64件超の未確定発話・履歴sequence・最終回答クラッシュ回復は残件。本番未反映、新規version2一般作成は未有効化。`docs/audits/2026-09-20-loop-289/report.md`。


### 第290巡・Liveから実API/DBまでの検証

録音中の通常回答が未追跡の発話を二重作成し、窓の終了確定を妨げる不具合を実Chrome/実API/PG18で再現・補修。version2の質問は回答履歴に保存し、音声発話を重複作成しない。通常終了・保存応答紛失・provider失敗の3ケース各10条件で、全窓保存/2回答/議事録/使用秒精算を確認。認証と音声機器・AIは合成。実録音/離脱復旧/履歴sequence/最終回答クラッシュ/本番反映は残件。`docs/audits/2026-09-20-loop-290/report.md`。


第291巡（ローカルのみ）: 最終回答は入力/context/言語をhash固定し、330秒claim・15分回復・最大3試行を実装。保存時claim照合で旧workerを拒否し、カード再試行の言語を固定。実DB5群/言語2条件/実Chrome応答紛失10条件・build合格。DDL291未本番適用、再試行後表示とreload復元は残件。証拠: docs/audits/2026-09-20-loop-291/report.md。

Pass292 (local only): final-answer failure retains pending input and stops report creation; retry preserves language and only successful saving completes finalization. Recovery resolves only the matching answer failure. Chrome/API/PG test confirms one complete report after retry; auth/media/AI synthetic. 165 regressions, types and Next build passed. Existing incomplete reports, reload and production release remain open. Evidence: docs/audits/2026-09-20-loop-292/report.md.

History fix (2026-09-23, local only): transcript history and cursor v3 use audio-window sequence after receipt time, matching report ordering. Isolated PG18 verified206 rows across4 pages, no omission/duplication, owner isolation and cursor rejection; full build passed. Production preflight confirms cunning_audio_windows still absent, so migration285 must precede deployment. Evidence: docs/audits/2026-09-23-history-order/report.md.

Production DB update 2026-09-23: migrations253,285,287,291 applied. Read-only postflight found the lease/window tables and answer columns, restrictive RLS/no browser SELECT. Code rollout and real-session cutover remain pending. Evidence: docs/audits/2026-09-23-history-order/production-app-schema-report.json.

Latest production status 2026-09-23: new code deployment `dpl_4VYkNiY94VqpJHtuJoSSY2NuTi18` is live; public route and unauthenticated API boundary passed. Real microphone/tab capture, long-running session, reload final-input restoration and 64+ pending transcript context are still unverified/unresolved. Do not equate the public smoke with a real-session pass.
