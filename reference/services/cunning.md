# ドヤカンニング（要件定義書）

> ステータス: **active（2026-06-12 公開）** / 2026-06-02 にPhase 1〜3相当をコード実装。
> 作成日: 2026-06-01 ／ 実装更新: 2026-06-02
>
> 実装メモ:
> - 文字起こしは「数秒チャンクをOpenAI音声APIにPOST」する near-realtime 方式（Vercel ServerlessはWS長時間保持不可のため。Google STT streaming直結はPhase 2）。
> - 回答生成は gemini-2.0-flash 優先 / gpt-4o フォールバック（SSEではなくJSON応答。ストリーミングはPhase 2）。
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
- **回答生成モデル**: `gemini-2.0-flash`（低レイテンシ優先、`@seo/lib/gemini` の `geminiGenerateText` ラッパー経由）。フォールバック `gpt-4o`（`src/lib/openai.ts`）
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
   ├─ 回答生成（gemini-2.0-flash, ストリーミング / fallback gpt-4o）
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
