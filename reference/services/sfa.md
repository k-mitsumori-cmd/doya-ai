# ドヤ営業管理（要件定義書）

> ステータス: **active（2026-06-12 公開）** / 本書は実装前の仕様書として作成。実装済み（6頁・9API・11モデル）。
> 作成日: 2026-06-01
> 様式は [cunning.md](./cunning.md) / 組織スコープ設計は [kintai.md](./kintai.md) / [hr](../10-service-status.md) に準拠。

## 概要

- **パス**: `/sfa`
- **サービスID**: `sfa`
- **サービス名**: ドヤ営業管理
- **本番URL（予定）**: `https://doya-ai.surisuta.jp/sfa`
- **説明**: 取引先・商談・活動を一元管理する、**日本の中小企業向けに「シンプル・かわいい・安い・AI標準搭載」** のSFA/営業管理ツール。Salesforceの主要機能（取引先/商談/パイプライン/予測/活動履歴）を、設定不要・即日使える形で提供する。
- **ステータス**: `active`（2026-06-12 公開）
- **カテゴリ**: business（管理ツール型 / **画面パターンC**）
- **アイコン**: `📈`（Material Symbols: `monitoring` / `trending_up`）
- **カラー**: `from-green-500 to-lime-600`（**空きカラー** green/lime を使用。成長・売上を想起）／ブランド紫 `#7f19e6` はCTA・強調に併用
- **データスコープ**: **組織スコープ**（`organizationId` で分離するマルチテナント。ドヤ勤怠・ドヤHRと同型）

---

## 1. ポジショニングと差別化

| 観点 | Salesforce / 既存SFA | ドヤ営業管理 |
|------|---------------------|-------------|
| 導入 | 初期設定・項目設計が大変、ベンダー支援前提 | **サインアップ即日**・初期データ自動投入・テンプレ標準 |
| 価格 | 1人月数千円〜数万円 | **統一プラン¥9,980で全サービス込み**・無料枠あり |
| UI | 多機能ゆえに複雑 | ポップ・かわいい・必要機能に絞った3クリック設計 |
| AI | 上位プラン限定（Einstein等） | **全プランでAI標準搭載**（スコアリング/次アクション/議事録/文面生成） |
| 日本語 | 英語ベースの和訳UI | **完全日本語ネイティブ**・日本の商習慣（稟議・与信・名刺）前提 |
| エコシステム | 別途連携設定 | **ドヤリスト/カンニング/インタビュー/コピー**とワンクリック連携 |

- **ターゲット**: 5〜100名規模の中小企業・スタートアップの営業チーム。Excel/スプレッドシート管理から脱却したいが、Salesforceは重すぎる層。
- **コア価値**: 「入力が苦にならないSFA」。営業が嫌う**入力負荷をAIで肩代わり**（音声→議事録、活動の自動要約、次アクション提案）し、**定着率**で勝つ。

---

## 2. 中核データモデル（概念）

営業管理の標準オブジェクト構成。Salesforce準拠の用語に日本語ラベルを当てる。

```
取引先（会社 / Account）
   ├─ 担当者（コンタクト / Contact）   … 取引先に紐づく人
   ├─ 商談（案件 / Deal）              … 取引先に対する売上機会。パイプラインの主役
   │     ├─ 商品明細（Line Item）      … 商談に紐づく商品×数量×金額
   │     └─ 活動（Activity）           … 商談に紐づく履歴
   └─ 活動（Activity）                 … 取引先/担当者に紐づく履歴

リード（見込み客 / Lead）              … 取引先化する前の未精査の見込み（ドヤリストから流入）
   └─ 「取引先＋担当者＋商談」へ転換（コンバート）

活動（Activity）= 電話 / 訪問・商談 / メール / メモ / タスク
タスク（ToDo）  = 期日・担当者付きのやること（活動の予定版）
```

- **リード→取引先転換（コンバート）**: リードを精査し有望と判断したら、ワンクリックで「取引先＋担当者＋商談」を生成。元リードは `converted` 化。
- **パイプライン（営業ステージ）**: 既定ステージは編集可能。初期値＝ `見込み → アプローチ → 提案 → 見積 → 交渉 → 受注 / 失注`。各ステージに**確度（%）** と**色**を持たせる。

---

## 3. 機能要件

### 3.1 取引先・担当者管理（Account / Contact）

- 取引先の登録・編集・検索・タグ付け（業界・地域・規模・与信ランク・自社担当）
- 担当者（人）は取引先に複数紐づく。役職・部署・メール・電話・名刺メモ・キーマン判定
- **重複検知**: 法人番号・会社名・ドメインで重複候補を警告（リスト品質維持）
- 取引先詳細画面に**タイムライン**（全活動・商談・タスクを時系列表示）
- **名刺取り込み（Phase2）**: 名刺画像アップ→OCR（`generateImageWithFallback`は生成用なので、OCRはGemini Vision/`gpt-4o`で読取）→担当者自動作成

### 3.2 リード管理 ＆ ドヤリスト連携（差別化の入口）

- リードの手動登録／CSVインポート／**ドヤリストからのワンクリック取り込み**
  - 連携: ドヤリストで生成した企業リスト（法人名・住所・代表者・従業員数・資本金・URL）を `sfa_leads` に取り込み。出典フィールド `source = 'doyalist'` を保持
  - ドヤリストが生成した**営業メール文面・電話スクリプト**もリードのメモに同時取り込み可能
- **リードステータス**: `new（新規）/ working（対応中）/ nurturing（育成中）/ qualified（有望）/ converted（転換済）/ disqualified（除外）`
- リード一覧はテーブル＋フィルタ（ステータス・スコア・担当・流入元）。一括操作（担当割当・ステータス変更・除外）

### 3.3 商談パイプライン（カンバン / 案件管理）— 主役画面

- **カンバンボード**: ステージ列をドラッグ&ドロップで移動（ドヤプロマネの `kanban-board.tsx` を踏襲）
- 各カードに: 取引先名・商談名・金額・確度・予定クローズ日・担当・最終活動からの経過日数
- **停滞アラート**: 最終活動から N 日（既定14日）動いていない商談を赤バッジで警告
- ステージ移動時に**必須項目チェック**（例: 「提案」へは提案資料添付、「受注」へは金額・受注日必須）
- **金額×確度＝重み付きパイプライン**を自動集計
- 商談詳細: 商品明細・関係者・活動履歴・添付ファイル・受注/失注理由

### 3.4 活動管理（タイムライン）

- 活動種別: `call（電話）/ meeting（商談・訪問）/ email（メール）/ note（メモ）/ task（ToDo）`
- どの活動も「取引先 / 担当者 / 商談」に紐づけて記録
- **入力負荷の軽減（コア体験）**:
  - クイック入力（種別＋一言メモで即記録、所要1ステップ）
  - 音声・録音アップ → 文字起こし → **AI議事録**（後述 §3.7、ドヤインタビュー連携）
  - メール送信記録の半自動化（Phase2: Gmail連携）
- 活動完了時に「次アクション」を促すモーダル（無入力で離脱させない設計）

### 3.5 タスク・リマインダー（ToDo）

- 期日・担当者・関連先（取引先/商談）付きのタスク
- マイダッシュボードに「今日やること」「期限切れ」「今週の商談」を集約
- 期日リマインダー（アプリ内＋メール、Phase2でSlack/カレンダー）

### 3.6 ダッシュボード・予測・レポート

- **個人ダッシュボード**: 今日のタスク・担当商談・今月見込み・直近活動
- **マネージャーダッシュボード**: メンバー別パイプライン・活動量・予実
- **売上予測（フォーキャスト）**: 当月/当四半期の `確度加重見込み` と `コミット` を集計。前月比・目標比
- **レポート（Recharts）**: ステージ別商談数・金額、勝率、平均商談期間、流入元別CV、担当別実績、失注理由分析
- CSV/Excelエクスポート（ドヤ勤怠 `attendance/export` のBOM付きCSV方式を踏襲）

### 3.7 AI機能（全プラン標準搭載 — 最大の差別化）

> テキスト生成は `@seo/lib/gemini` の `geminiGenerateText` / `geminiGenerateJson`（既定 `gemini-2.0-flash`、fallback `gpt-4o`）。画像生成は不要。

| 機能 | 内容 | 入力 | 連携元 |
|------|------|------|--------|
| **AIリードスコアリング** | 受注確度を0-100で算出し色分け。企業属性（業界/規模/資本金）＋活動量＋ステージ滞留から推定 | リード/商談データ | gBizINFO属性（ドヤリスト） |
| **次アクション提案** | 停滞商談に「次の一手」を提案（例: 決裁者へ再アプローチ、見積提示） | 商談履歴 | — |
| **AI議事録** | 商談音声→文字起こし→要約・決定事項・ネクストアクション抽出→活動に自動記録 | 録音/文字起こし | **ドヤインタビュー** |
| **メール文面生成** | フォローアップ・提案・お礼メールのドラフトを商談文脈から生成 | 商談/担当者 | **ドヤコピーAI** |
| **商談リスク分析** | 失注予兆（停滞・返信減・キーマン不在）を検知しアラート | 商談履歴 | — |
| **日報・週報自動生成** | その日の活動から日報/週報を自動作成（コピペで報告完了） | 活動ログ | — |
| **AI自然言語検索** | 「今月失注した製造業の商談」等の自然文をクエリに変換して抽出 | 全データ | — |
| **商談前ブリーフ** | 商談直前に取引先の概要・過去履歴・想定質問を要約カンペ化 | 取引先/商談 | **ドヤカンニング**（商談中のリアルタイム回答支援へ接続） |

### 3.8 通知・外部連携

- **アプリ内通知＋メール**（Resend / `sendEmail`）: タスク期日・商談停滞・担当割当
- **Slack通知**: フィードバック送信、（任意で）受注時の祝賀通知（ドヤプロマネ `feedback` 方式）
- **ドヤサービス連携サマリ**:
  - ドヤリスト → リード取り込み
  - ドヤインタビュー → 商談音声の議事録化
  - ドヤカンニング → 商談中のリアルタイム回答支援＋終了後に議事録を商談へ記録
  - ドヤコピー/SEO → 営業文面生成
  - ドヤHR/勤怠 → 同型の組織・メンバー基盤（組織スコープ共通設計）
- **Phase2**: Google カレンダー双方向同期 / Gmail 送受信記録 / Webhook

---

## 4. 権限・ロール（`src/lib/sfa/access.ts`）

ドヤ勤怠の `getKintaiContext()` と同型の `getSfaContext()` を全API共通の入口とする。`{ userId, organizationId, role, memberId }` を返し、無ければ401。

### ロール階層（`ROLE_HIERARCHY`）

| ロール | 値 | 表示名 | 権限概要 |
|--------|----|------|---------|
| `member` | 0 | メンバー（営業担当） | 自分の担当データの作成・編集、共有データ閲覧 |
| `manager` | 1 | マネージャー | 自チームの全データ閲覧・割当・予実管理 |
| `admin` | 2 | 管理者 | 組織設定・パイプライン定義・メンバー招待・CSV出力・全データ |
| `owner` | 3 | オーナー | 全権限。組織削除・課金・他オーナー追加 |

- **データ可視範囲**: 既定は「自分の担当＋共有設定された取引先」。manager+ はチーム全体。admin+ は組織全体。
- **権限昇格ガード**: `owner` 付与は owner のみ。未知ロールは `member` フォールバック（kintai準拠）。
- 全API: ID直指定の後に必ず `organizationId` 一致を確認（不一致は404）＝**IDOR対策**。ロール/ステータス/種別は**ホワイトリスト検証**。

---

## 5. 組織・初回オンボーディング

`getOrCreateOrganization()` / `POST /api/sfa/organization`（body: `{ name, memberName }`）。kintai準拠で初回に以下を自動セットアップ：

1. slug生成（衝突時 `-{timestamp}`）
2. `SfaOrganization` 作成
3. 作成者を `SfaMember`（role=`owner`, status=`ACTIVE`）登録
4. **既定パイプライン**（見込み/アプローチ/提案/見積/交渉/受注/失注、確度プリセット付き）を作成
5. **サンプルデータ**（取引先1・商談1・タスク1）を投入し、空画面を回避＝初見でも使い方が分かる
6. 既存ACTIVEメンバーがあれば冪等に既存組織を返す

---

## 6. 招待フロー（kintai/promane準拠）

1. admin/owner が `/sfa/[org]/members` で招待（メール指定）
2. `inviteToken = crypto.randomUUID()`、`SfaMember` を `status:'PENDING'` で作成
3. 招待メール自動送信（紫グラデHTML、リンク `/sfa/invite/{token}`、入力は `esc()` でHTMLエスケープ）
4. **有効期限48時間**（超過は410 Gone）
5. ログイン後 `POST /api/sfa/invite/[token]` で承諾 → `status:'ACTIVE'` / `inviteToken=null` / `acceptedAt=now`
6. 同組織の重複メンバーシップは整理、`P2002` は「既に所属しています」

---

## 7. 料金（統一プラン方式）

**統一プラン方式**（[[feedback_unified_plan]] / [[project_unified_plan_2plan]]）。料金ページ `/sfa/pricing` は共通 `UnifiedPricingPlans` を使い、UIには **無料 / プロ（¥9,980/月・税込）** の2プランで表示。プロ1契約でドヤAI全サービスのプロ解放。**プラン判定は `User.plan` が唯一の正**（USS.plan では判定しない）。

### プラン別上限（`getSfaLimitsByUserPlan` / `SFA_PRICING`）

| `User.plan` | メンバー数 | 取引先/商談 | AI実行 | 内部プラン名 |
|-------------|-----------|-----------|--------|------------|
| FREE | 3名 | 各50件 | 月20回 | 無料 |
| LIGHT / STARTER | 10名 | 各1,000件 | 月300回 | スターター(¥2,980) |
| PRO | 50名 | 無制限 | 無制限 | プロ(¥9,980) |
| ENTERPRISE | 無制限(-1) | 無制限 | 無制限＋SSO | エンタープライズ(¥49,800) |
| `DOYA_DISABLE_LIMITS=1` | 無制限 | 無制限 | 無制限 | （開発用） |

> 内部 `services.ts`/`pricing.ts` には段階上限が残るが、**UI表示価格は統一2プラン**。

---

## 8. DBモデル（`sfa_` プレフィックス）

| モデル | テーブル | 主フィールド / 制約 |
|--------|---------|------------------|
| `SfaOrganization` | `sfa_organizations` | name, slug(unique) |
| `SfaMember` | `sfa_members` | userId, role(owner/admin/manager/member), status(ACTIVE/PENDING/INACTIVE), inviteToken(unique), inviteEmail, acceptedAt / `@@unique([organizationId,userId])` |
| `SfaAccount` | `sfa_accounts` | name, corporateNumber, industry, prefecture, address, url, employeeCount, capital, creditRank, ownerMemberId(自社担当), tags(JSON) / `@@index([organizationId])` |
| `SfaContact` | `sfa_contacts` | accountId, name, nameKana, title, department, email, phone, isKeyPerson, note |
| `SfaLead` | `sfa_leads` | name(企業/個人), corporateNumber, contactName, email, phone, status(new/working/nurturing/qualified/converted/disqualified), score(Int), source(doyalist/csv/manual), assigneeMemberId, convertedAccountId, raw(JSON) / `@@index([organizationId,status])` |
| `SfaPipeline` | `sfa_pipelines` | name, isDefault |
| `SfaStage` | `sfa_stages` | pipelineId, name, order, probability(Int), color, isWon(Bool), isLost(Bool) |
| `SfaDeal` | `sfa_deals` | accountId, contactId, name, amount, currency('JPY'), stageId, probability, expectedCloseDate, status(open/won/lost), wonAt, lostAt, lostReason, assigneeMemberId, lastActivityAt / `@@index([organizationId,stageId])` |
| `SfaLineItem` | `sfa_line_items` | dealId, productName, quantity, unitPrice, amount |
| `SfaActivity` | `sfa_activities` | type(call/meeting/email/note), accountId?, contactId?, dealId?, subject, body, occurredAt, durationMin, memberId, aiSummary?, transcriptId?(ドヤインタビュー連携) / `@@index([organizationId,occurredAt])` |
| `SfaTask` | `sfa_tasks` | title, dueDate, status(open/done), priority, accountId?, dealId?, assigneeMemberId, completedAt / `@@index([organizationId,assigneeMemberId,status])` |
| `SfaInvitation` | （`SfaMember.inviteToken` で兼ねる or 独立） | — |

> 安全な追加のみ（新model追加・nullableカラム）。既存カラム変更は禁止に近い（§12 安全ルール準拠）。`npx prisma generate` 必須。

---

## 9. APIエンドポイント（定型: `runtime='nodejs' / dynamic='force-dynamic' / maxDuration=300`、export系のみ60）

| メソッド | パス | 権限 |
|---------|------|------|
| POST | `/api/sfa/organization` | ログイン |
| GET | `/api/sfa/usage` | ゆるめ（未所属でオンボ判定） |
| GET / POST | `/api/sfa/accounts` | member+ |
| GET / PATCH / DELETE | `/api/sfa/accounts/[id]` | 担当/manager+ |
| GET / POST | `/api/sfa/contacts` | member+ |
| GET / PATCH / DELETE | `/api/sfa/contacts/[id]` | 担当/manager+ |
| GET / POST | `/api/sfa/leads` | member+ |
| PATCH / DELETE | `/api/sfa/leads/[id]` | 担当/manager+ |
| POST | `/api/sfa/leads/import` | member+（CSV / ドヤリスト取込） |
| POST | `/api/sfa/leads/[id]/convert` | 担当/manager+（取引先+商談生成） |
| GET / POST | `/api/sfa/deals` | member+ |
| GET / PATCH / DELETE | `/api/sfa/deals/[id]` | 担当/manager+ |
| PATCH | `/api/sfa/deals/[id]/stage` | 担当/manager+（ステージ移動・必須項目検証） |
| GET / POST | `/api/sfa/activities` | member+ |
| PATCH / DELETE | `/api/sfa/activities/[id]` | 担当/manager+ |
| GET / POST | `/api/sfa/tasks` | member+ |
| PATCH / DELETE | `/api/sfa/tasks/[id]` | 担当/manager+ |
| GET / POST / PATCH | `/api/sfa/pipelines` `/stages` | admin+ |
| GET | `/api/sfa/dashboard` | 本人/ロール別範囲 |
| GET | `/api/sfa/forecast` | manager+ |
| GET | `/api/sfa/reports` | manager+ |
| GET | `/api/sfa/export` | admin+（CSV/Excel・BOM付き） |
| GET / POST | `/api/sfa/members` | admin+ |
| GET | `/api/sfa/invite/[token]` | 公開（トークン） |
| POST | `/api/sfa/invite/[token]` | ログイン |
| POST | `/api/sfa/ai/score` | member+（リード/商談スコアリング） |
| POST | `/api/sfa/ai/next-action` | member+ |
| POST | `/api/sfa/ai/summarize` | member+（議事録・活動要約） |
| POST | `/api/sfa/ai/draft-email` | member+ |
| POST | `/api/sfa/ai/search` | member+（自然言語検索） |
| POST | `/api/sfa/feedback` | ログイン（Slack通知） |

---

## 10. 画面構成（パターンC: 管理ツール型）

```
src/app/sfa/
  ├── layout.tsx / page.tsx（WS自動作成→[org]へ）/ error.tsx
  ├── invite/[token]/page.tsx           招待受け入れ
  ├── pricing/page.tsx                  料金（UnifiedPricingPlans）
  └── [orgSlug]/
      ├── layout.tsx                    サイドバー付き
      ├── page.tsx                      ダッシュボード（今日のタスク/担当商談/月次見込み）
      ├── deals/page.tsx                商談パイプライン（カンバン）★主役
      ├── deals/[id]/page.tsx           商談詳細（明細・活動・AI次アクション）
      ├── leads/page.tsx                リード一覧（フィルタ・一括操作・ドヤリスト取込）
      ├── leads/[id]/page.tsx           リード詳細・コンバート
      ├── accounts/page.tsx             取引先一覧
      ├── accounts/[id]/page.tsx        取引先詳細（タイムライン）
      ├── contacts/page.tsx             担当者一覧
      ├── activities/page.tsx           活動履歴（全社/自分）
      ├── tasks/page.tsx                ToDo
      ├── reports/page.tsx              レポート（Recharts）
      ├── forecast/page.tsx             売上予測（manager+）
      ├── members/page.tsx              メンバー管理・招待（admin+）
      ├── settings/page.tsx             組織・パイプライン定義（admin+）
      └── help/page.tsx                 使い方ガイド

src/components/sfa/  SfaSidebar.tsx / kanban-board.tsx / deal-card.tsx /
                    timeline.tsx / quick-activity.tsx / lead-table.tsx /
                    forecast-chart.tsx / character.tsx / ui/
src/lib/sfa/        access.ts / access-client.ts / types.ts / constants.ts /
                    format.ts / ai.ts（スコアリング/要約/文面）/ doyalist-import.ts /
                    actions-*.ts（accounts/leads/deals/activities/tasks の Server Actions）
```

### キャラクター（ドヤくん派生）`public/sfa/characters/{mood}_{日本語}.png`

| 場面 | 表情 | 場面 | 表情 |
|------|------|------|------|
| 初回/ダッシュボード | `hello` | 受注 | `jump` |
| AI処理中 | `working` / `thinking` | 目標達成 | `thumbsup` |
| 商談停滞アラート | `surprise` | エラー | `error` |

---

## 11. UI/デザイン

- ブランド: ポップ・かわいい・プロ品質。角丸 `rounded-2xl`〜`rounded-[28px]`、`font-bold`以上、framer-motion（fade-in-up・カード hover lift・カンバン DnD）
- カラー: `from-green-500 to-lime-600` グラデをアクセントに、CTAはブランド紫 `#7f19e6`
- アイコン: Material Symbols Outlined
- 通知: 共通 `react-hot-toast`
- **UI日本語**。金額は `¥` 3桁区切り、確度は `%`、日付は和暦不要のYYYY/MM/DD
- 入力フォームは**3クリック以内で1件登録**を死守。空画面にはサンプルデータとガイドを出す（初見配慮）

---

## 12. 非機能要件

| 項目 | 要件 |
|------|------|
| マルチテナント | `organizationId` で完全分離。全クエリにスコープ必須 |
| パフォーマンス | 一覧はページング（既定50, 最大200）。カンバンはステージ別に遅延ロード |
| データ移行 | CSVインポート（取引先/リード/商談）・エクスポート（BOM付きCSV/Excel） |
| 監査 | 重要操作（ステージ変更・受注/失注・削除）は `updatedBy`/タイムスタンプ記録。削除は論理削除（`isActive`/`deletedAt`） |
| AIコスト | スコアリングはバッチ＋キャッシュ。リアルタイム生成は `gemini-2.0-flash` 優先 |
| 可用性 | Gemini障害時は `gpt-4o` フォールバック |

---

## 13. セキュリティ（kintai監査基準を踏襲）

- 全APIで `getSfaContext()` 認証必須（無ければ401）
- ID直指定の後に `organizationId` 一致を必ず確認（不一致404）＝**IDOR対策**
- 自分の担当データは `ctx.memberId` で限定、共有・チーム範囲はロールで判定
- ロール/ステータス/活動種別/ステージ遷移を**ホワイトリスト検証**
- 権限昇格防止: `owner` 付与は owner のみ。招待は UUID トークン＋48h期限＋HTMLエスケープ
- メンバー/取引先削除は論理削除
- CSVインポートは行数・カラム・型を検証（インジェクション・巨大ファイル対策）

---

## 14. フェーズ計画

| フェーズ | 範囲 |
|---------|------|
| **MVP（Phase1）** | 組織/招待/ロール、取引先・担当者、商談カンバン、活動タイムライン、タスク、個人ダッシュボード、ドヤリスト取込、AIスコアリング＋次アクション＋活動要約、CSV入出力、料金ページ |
| **Phase2** | 売上予測・マネージャーダッシュボード・レポート、AI議事録（ドヤインタビュー連携）・メール文面生成・自然言語検索、商談前ブリーフ（ドヤカンニング接続）、停滞アラート |
| **Phase3** | Google カレンダー/Gmail 連携、名刺OCR、Webhook、SSO（Enterprise）、モバイル最適化、商談リスク分析の高度化 |

---

## 15. サービス登録チェックリスト（§12準拠）

- [ ] `src/lib/services.ts` に `sfa` を追加（`status:'coming_soon'`→公開時`active`、icon `📈`、gradient `from-green-500 to-lime-600`、order=既存最大+1、pricing、features 5-8）
- [ ] `src/lib/pricing.ts` に `SFA_PRICING`、`src/lib/stripe.ts` の `ServiceId`/`PlanId` に `sfa-*` 追加（既存を壊さない）
- [ ] `src/components/ToolSwitcherMenu.tsx` の `SERVICE_ICON_MAP` に Lucide アイコン＋グラデ登録
- [ ] `prisma/schema.prisma` に `sfa_` モデル追加 → `npx prisma generate` → `npx next build` → `npx prisma db push`
- [ ] AI生成は `@seo/lib/gemini`（テキスト）経由。画像生成不要
- [ ] `reference/10-service-status.md` を更新
- [ ] 本番デプロイ: `git push origin main`（Vercel自動デプロイ）

---

## 16. 環境変数（任意）

統一課金のため未設定でもバナーAIのPrice IDにフォールバックして動作。

```env
NEXT_PUBLIC_STRIPE_SFA_STARTER_PRICE_ID      # 任意
NEXT_PUBLIC_STRIPE_SFA_PRO_PRICE_ID          # 任意
NEXT_PUBLIC_STRIPE_SFA_ENTERPRISE_PRICE_ID   # 任意
NEXTAUTH_URL                                 # 招待リンク絶対URL
DOYA_DISABLE_LIMITS=1                         # 全制限無効（開発用）
```

---

## 関連ドキュメント
- 組織スコープ共通設計・統一課金: [kintai.md](./kintai.md) / [../05-auth-payments.md](../05-auth-payments.md) / [../06-ui-patterns.md](../06-ui-patterns.md) §13・§15.3
- カンバン/収支UIの実装参照: [promane.md](./promane.md)
- 連携元: ドヤリスト（営業リスト生成）/ ドヤカンニング（[cunning.md](./cunning.md)・商談アシスト）/ ドヤインタビュー（議事録）
