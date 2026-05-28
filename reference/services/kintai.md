# ドヤ勤怠 — 開発ナレッジ集

> **このドキュメントの位置づけ**
> 他の人が AI ツール（Claude / ChatGPT）を使ってドヤ勤怠と同じようなサービスをゼロから作れるようにまとめた「実践ナレッジ集」。
> 「Claude に何を渡すか」「ChatGPT に何を頼むか」「どの順番で進めるか」が全部書いてあります。

---

## 目次

1. [このサービスは何？](#1-このサービスは何)
2. [使う AI ツール一覧](#2-使う-ai-ツール一覧)
3. [開発の全体フロー](#3-開発の全体フロー)
4. [Step 1: ロゴ・キャラクター作成（ChatGPT / 画像生成）](#step-1-ロゴキャラクター作成)
5. [Step 2: DB 設計（Claude に依頼）](#step-2-db-設計claude-に依頼)
6. [Step 3: 画面作成（Claude に依頼）](#step-3-画面作成claude-に依頼)
7. [Step 4: API 実装（Claude に依頼）](#step-4-api-実装claude-に依頼)
8. [Step 5: 認証・権限まわり（Claude に依頼）](#step-5-認証権限まわりclaude-に依頼)
9. [Step 6: 仕上げ（Claude に依頼）](#step-6-仕上げclaude-に依頼)
10. [Claude に渡すときのコツ](#claude-に渡すときのコツ)
11. [トラブルシューティング](#トラブルシューティング)
12. [付録: コピペ用プロンプト集](#付録-コピペ用プロンプト集)

---

## 1. このサービスは何？

**ドヤ勤怠** = 中小企業向けのクラウド勤怠管理システム。

### 何ができる？

- ワンクリックで出退勤の打刻
- 残業・深夜・遅刻を自動で集計
- 打刻ミスや休暇申請をシステム内で承認
- かわいいクマキャラクターで楽しく使える

### 競合
- KING OF TIME（高機能だが高い）
- ジョブカン（中堅）
- → ドヤ勤怠は「シンプル・かわいい・安い」で差別化

### ターゲット
- 従業員 5〜100 名の中小企業
- Excel で勤怠管理に限界を感じている会社

---

## 2. 使う AI ツール一覧

| ツール | 用途 | 月額目安 |
|--------|------|---------|
| **Claude (Claude Code)** | コード生成・設計・実装の主軸 | $20 |
| **ChatGPT (画像生成)** | ロゴ作成（gpt-image-1 / DALL-E） | $20 |
| **ChatGPT (Plus)** | キャラクター画像生成・補助 | （上記に含む）|
| **Cursor** | エディタ（Claude/GPT 連携） | $20 |
| **Vercel** | デプロイ先 | $20〜 |
| **Supabase** | DB（PostgreSQL） | 無料〜 |
| **Resend** | メール送信 | 無料〜 |
| **Stripe** | 決済 | 売上の 3.6% |

**合計**: 開発初期は月 $60〜80 程度で始められる。

---

## 3. 開発の全体フロー

```
┌─────────────────────────────────────────────────────┐
│ Step 1: ロゴ・キャラクター作成                         │
│   → ChatGPT で画像生成（10分）                        │
├─────────────────────────────────────────────────────┤
│ Step 2: DB 設計                                       │
│   → Claude に「勤怠管理の DB を Prisma で設計して」    │
│   → schema.prisma 完成（30分）                       │
├─────────────────────────────────────────────────────┤
│ Step 3: 画面作成                                       │
│   → Claude に「打刻画面を Next.js + Tailwind で」     │
│   → 16ページ完成（数日）                              │
├─────────────────────────────────────────────────────┤
│ Step 4: API 実装                                       │
│   → Claude に「打刻 API を作って」と依頼              │
│   → 18 エンドポイント完成（数日）                      │
├─────────────────────────────────────────────────────┤
│ Step 5: 認証・権限                                     │
│   → Claude に「NextAuth で組織分離して」              │
│   → 完成（1日）                                       │
├─────────────────────────────────────────────────────┤
│ Step 6: 仕上げ                                         │
│   → Claude に「CSV エクスポート追加」など             │
│   → リリース可能な状態に（数日）                       │
└─────────────────────────────────────────────────────┘

合計: 1〜2 週間で MVP が完成（1 人開発の場合）
```

---

## Step 1: ロゴ・キャラクター作成

### 1-1. ロゴを ChatGPT で作る

**ChatGPT に渡すプロンプト例**:

```
シンプルでかわいい勤怠管理サービスのロゴを作って。

サービス名: ドヤ勤怠
イメージ:
- 時計のアイコンがメイン
- 紫色 (#7f19e6) がブランドカラー
- ポップで親しみやすい
- ビジネスでも使える清潔感
- 角丸でフラットなデザイン

サイズ: 512x512 px
背景: 透過 PNG
```

**コツ**:
- 何度か生成して気に入ったものを選ぶ
- 「もう少しシンプルに」「文字を入れて」など微調整を依頼
- 最終的に `public/images/kintai-logo.png` として保存

### 1-2. キャラクター（クマ）を ChatGPT で作る

**ChatGPT に渡すプロンプト例**:

```
かわいいクマのマスコットキャラクターを 15 種類の表情で作って。
すべて同じキャラクターで、表情だけを変えた状態。

キャラクター設定:
- 茶色のクマ
- 目がくりっと大きい
- ふわふわした質感
- 親しみやすい雰囲気
- 全身が見える（座っているポーズ多め）

作る表情:
1. hello（挨拶している）
2. working（パソコンで作業中）
3. ramen（ラーメンを食べて休憩中）
4. sleep（居眠り中）
5. jump（大喜びでジャンプ）
6. success（V サインで成功ポーズ）
7. error（泣いている）
8. thinking（考え込んでいる）
9. surprise（驚いている）
10. focus（集中している）
11. point（解説中、指差し）
12. thumbsup（いいねポーズ）
13. present（プレゼン中）
14. bug（怒っている）
15. love（大好きポーズ）

スタイル: フラットデザイン、PNG 透過背景
サイズ: 512x512 px
```

**保存先**:
```
public/kintai/characters/
├── hello.png
├── working.png
├── ramen.png
├── sleep.png
├── jump.png
├── success.png
├── error.png
├── thinking.png
├── surprise.png
├── focus.png
├── point.png
├── thumbsup.png
├── present.png
├── bug.png
└── love.png
```

**コツ**:
- 1 枚ずつ生成して、表情が違うが同じキャラに見えるよう調整
- ChatGPT で「同じキャラで違う表情」と指示すると揃いやすい
- 違和感のあるものは作り直す

---

## Step 2: DB 設計（Claude に依頼）

### Claude に渡すプロンプト

```
中小企業向けの勤怠管理システムを作りたい。
Prisma + PostgreSQL で DB スキーマを設計してください。

必要な機能:
1. 組織管理（会社・団体の単位）
2. 組織メンバー（社員）の管理
3. 部署管理（階層あり）
4. 就業ルール（9:00-18:00 などのルール）
5. 打刻記録（出勤・退勤・休憩開始・休憩終了）
6. 日次勤怠サマリー（自動計算した結果）
7. 申請・承認フロー（打刻修正・休暇・残業・休日出勤）

要件:
- 複数組織を1つのDBで管理（マルチテナント）
- 他組織のデータが絶対に見えない設計
- 打刻修正の履歴が残る（監査ログ）
- IP アドレスを打刻時に記録（不正防止）
- 役割: system_admin / hr_admin / manager / employee の4段階
- すべての勤怠系テーブルに kintai_ プレフィックス
- 雇用形態: 正社員・パート・契約
- 深夜時間（22:00-05:00）を別途記録

出力フォーマット: prisma/schema.prisma のコード
```

### 出力される DB モデル（7 個）

Claude が出力するモデル:

1. `KintaiOrganization` — 組織
2. `KintaiMember` — メンバー（権限付き）
3. `KintaiDepartment` — 部署（階層構造）
4. `KintaiWorkRule` — 就業ルール
5. `KintaiEmployee` — 従業員（Member と 1:1）
6. `KintaiClockRecord` — 打刻記録
7. `KintaiAttendance` — 日次勤怠サマリー
8. `KintaiRequest` — 申請

### 重要なポイント

Claude が出力したスキーマで、必ず以下を確認:

- [ ] 全テーブルに `organizationId` がある（他組織との分離）
- [ ] `KintaiClockRecord` に `originalTimestamp`, `isModified` がある（監査ログ）
- [ ] `KintaiClockRecord` に `ipAddress` がある
- [ ] `@@map("kintai_xxx")` でプレフィックス指定されている
- [ ] `@@unique([organizationId, userId])` 等の制約がある

### マイグレーション

```bash
# Claude が出した schema.prisma を保存後
npx prisma generate
npx prisma db push
```

---

## Step 3: 画面作成（Claude に依頼）

### 作る画面 16 個

| URL | 画面名 | 優先度 |
|-----|--------|--------|
| `/kintai` | ランディングページ | 中 |
| `/kintai/pricing` | 料金プラン | 中 |
| `/kintai/dashboard` | マイページ | **高** |
| `/kintai/clock` | 打刻画面 | **最高** |
| `/kintai/attendance` | 勤怠カレンダー | **高** |
| `/kintai/requests` | 申請一覧 | 高 |
| `/kintai/requests/new` | 新規申請 | 高 |
| `/kintai/approvals` | 承認管理（管理者） | 高 |
| `/kintai/employees` | 従業員管理 | 高 |
| `/kintai/departments` | 部署管理 | 中 |
| `/kintai/settings` | 就業ルール | 中 |
| `/kintai/admin/attendance` | 部署勤怠レポート | 中 |
| `/kintai/invite/[token]` | 招待受け入れ | 高 |

### Claude に渡すプロンプト（打刻画面の例）

```
Next.js 14 (App Router) + Tailwind CSS + TypeScript で打刻画面を作って。

画面: /kintai/clock
目的: 従業員がワンクリックで出退勤を打刻できる

UI 要件:
- 中央に大きな打刻ボタン4つ:
  1. 出勤 (clock_in) 緑色
  2. 退勤 (clock_out) オレンジ色
  3. 休憩開始 (break_start) 青色
  4. 休憩終了 (break_end) 紫色
- 角丸は rounded-2xl
- ボタンはホバーで translateY(-2px) リフト
- 現在時刻をリアルタイム表示（1秒更新）
- 本日の打刻タイムラインを下に表示
- かわいいクマキャラクター（public/kintai/characters/）を画面に配置
  - 未出勤時: sleep.png
  - 出勤中: working.png
  - 休憩中: ramen.png
  - 退勤済: thumbsup.png

ロジック:
- 出勤中は退勤・休憩開始のみ表示
- 休憩中は休憩終了のみ表示
- 退勤済は出勤のみ表示（同日複数出退勤OK）
- 打刻成功時にトースト通知（react-hot-toast）

API:
- GET /api/kintai/clock?date=YYYY-MM-DD で当日記録を取得
- POST /api/kintai/clock で打刻

デザイン方針:
- ブランドカラー: 紫 #7f19e6
- フォント: Noto Sans JP, font-bold 以上
- アニメーション: framer-motion で fade-in-up
- とにかくポップでかわいく

完成したコードをすべて出力して。
```

### 他の画面のプロンプト例

**ダッシュボード**:
```
/kintai/dashboard を作って。
当日の勤務状況（出勤時刻・現在の状態）、月間サマリー（労働時間・残業時間・遅刻回数）、最近の申請（直近5件）、クイックアクション（打刻ボタン、申請ボタン）を表示。
GET /api/kintai/dashboard で全データを一括取得。
```

**勤怠カレンダー**:
```
/kintai/attendance を作って。
月別カレンダー表示で、各日にその日の labor hours を表示。
月切り替えボタン付き。
CSV/Excel エクスポートボタン（hr_admin 以上のみ表示）。
hr_admin の場合、他従業員の勤怠も選択して見られる。
```

**従業員管理**:
```
/kintai/employees を作って。
従業員一覧テーブル、検索、ページネーション、新規作成、編集、削除、招待リンク再送信。
プラン別の従業員数上限を表示（X / 5 名など）。
hr_admin 以上のみアクセス可能。
```

### コツ

- **1 画面ずつ依頼する**（一気に全部頼まない）
- **API は後で実装するので、今は仮データ（モックデータ）で OK** と伝える
- **完成したら手で動かして確認**してから次の画面へ
- 違和感があれば「ここの色を紫っぽく」「ボタンをもっと大きく」と微調整を依頼

---

## Step 4: API 実装（Claude に依頼）

### 作る API 18 個

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/kintai/organization` | 初回組織作成 |
| GET | `/api/kintai/clock` | 当日打刻取得 |
| POST | `/api/kintai/clock` | 打刻記録 |
| GET | `/api/kintai/attendance` | 月次勤怠 |
| GET | `/api/kintai/attendance/export` | CSV/Excel |
| POST | `/api/kintai/attendance/recalculate` | 再計算 |
| POST | `/api/kintai/attendance/admin` | 管理者修正 |
| GET | `/api/kintai/dashboard` | マイページデータ |
| GET/POST | `/api/kintai/departments` | 部署 CRUD |
| PATCH | `/api/kintai/departments/[id]` | 部署更新 |
| GET/POST | `/api/kintai/work-rules` | ルール CRUD |
| PATCH | `/api/kintai/work-rules/[id]` | ルール更新 |
| GET/POST | `/api/kintai/employees` | 従業員 CRUD |
| GET/PATCH | `/api/kintai/employees/[id]` | 従業員操作 |
| POST | `/api/kintai/employees/[id]/invite` | 招待再送 |
| GET | `/api/kintai/invite/[token]` | 招待受入 |
| GET/POST | `/api/kintai/requests` | 申請 |
| GET/PATCH | `/api/kintai/requests/[id]` | 申請操作 |

### Claude に渡すプロンプト（打刻 API の例）

```
Next.js 14 の API ルートで打刻 API を作って。

パス: src/app/api/kintai/clock/route.ts

要件:
- GET /api/kintai/clock?date=YYYY-MM-DD
  → 指定日の打刻記録を取得（自分のもののみ）
  → 現在の状態（未出勤/出勤中/休憩中/退勤済）も返す

- POST /api/kintai/clock
  → 打刻記録を作成
  → 状態遷移バリデーション（出勤してないと退勤できない等）
  → IP アドレスを記録
  → 退勤時に当日の勤怠サマリーを再計算

定型句（必須）:
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

認証:
- getKintaiContext(req) でセッションと organizationId を取得
- ctx がなければ 401 を返す

セキュリティ:
- type の値を ['clock_in', 'clock_out', 'break_start', 'break_end'] でホワイトリスト検証
- 必ず ctx.employeeId で自分のデータのみ操作

JST 対応:
- 日付範囲は JST 基準で計算（UTC + 9時間オフセット）

エラーハンドリング:
- try/catch でラップ
- 失敗時は console.error してから 500 を返す

完成したコードをすべて出力して。
```

### 全 API に共通する定型句

Claude に必ず「これを全 API に入れて」と伝えるテンプレ:

```typescript
// src/app/api/kintai/{xxx}/route.ts

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getKintaiContext } from '@/lib/kintai/context'
import { hasMinRole } from '@/lib/kintai/permissions'

export async function GET(req: NextRequest) {
  try {
    // 1. 認証チェック
    const ctx = await getKintaiContext(req)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 権限チェック（管理者 API の場合）
    if (!hasMinRole(ctx.role, 'hr_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. データ取得（必ず organizationId でフィルター）
    const data = await prisma.kintaiXxx.findMany({
      where: { organizationId: ctx.organizationId }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[kintai/xxx] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## Step 5: 認証・権限まわり（Claude に依頼）

### Claude に渡すプロンプト

```
NextAuth.js で認証システムを作って。

要件:
- Google OAuth 認証
- セッションは JWT（30日有効）
- セッション取得時に DB から User と KintaiMember を確認

src/lib/kintai/context.ts に getKintaiContext() を実装:
- セッションから userId を取得
- KintaiMember を検索（status: ACTIVE のもの）
- 見つからなければ null を返す
- 見つかれば以下を返す:
  {
    session,
    organizationId: member.organizationId,
    memberId: member.id,
    employeeId: employee.id,
    role: member.role,
  }

src/lib/kintai/permissions.ts に hasMinRole() を実装:
- 4段階のロール階層: employee(0) < manager(1) < hr_admin(2) < system_admin(3)
- hasMinRole(userRole, requiredRole) で判定

セキュリティルール:
- 他組織の userId が DB にあっても、organizationId が違えば見えない
- role の更新は system_admin のみ可能
- 自分の role を自分で変更できない
```

---

## Step 6: 仕上げ（Claude に依頼）

### 6-1. 勤務時間計算ロジック

```
src/lib/kintai/calculate.ts に calculateDailyAttendance() を作って。

入力:
- records: 当日の全打刻記録（KintaiClockRecord[]）
- workRule: 就業ルール（KintaiWorkRule）

計算:
- clockIn = 最初の clock_in の時刻
- clockOut = 最後の clock_out の時刻
- breakMinutes = 全 break_start / break_end ペアの合計時間
- workMinutes = (clockOut - clockIn) - breakMinutes
- overtimeMinutes = max(0, workMinutes - 所定労働時間)
- lateMinutes = max(0, clockIn - workStart)
- earlyLeaveMinutes = max(0, workEnd - clockOut)
- nightMinutes = 22:00-05:00 (JST) と勤務時間の重複部分

出力: KintaiAttendance の更新用オブジェクト
```

### 6-2. CSV / Excel エクスポート

```
src/app/api/kintai/attendance/export/route.ts を作って。

要件:
- GET /api/kintai/attendance/export?year=YYYY&month=MM&format=csv|excel
- hr_admin 以上のみアクセス可
- 対象月の全従業員の勤怠を出力

CSV フォーマット（UTF-8 BOM 付き）:
従業員名,部署,日付,出勤,退勤,勤務時間(分),残業時間(分),遅刻(分),早退(分),ステータス
田中太郎,開発部,2026-05-01,09:00,18:00,480,0,0,0,通常

Excel フォーマット:
- XML SpreadsheetML 形式（.xls 互換）
- 月名をワークシート名にする（"2026年5月"）

レスポンスヘッダー:
- CSV: Content-Type: text/csv; charset=utf-8
- Excel: Content-Type: application/vnd.ms-excel
- Content-Disposition: attachment; filename="kintai_2026_05.csv"
```

### 6-3. 招待メール

```
src/lib/kintai/email.ts に sendInvitationEmail() を作って。

要件:
- Resend API を使用
- HTML メールテンプレート（紫グラデーション）
- 招待リンク: https://{domain}/kintai/invite/{token}
- 「組織に参加する」ボタン付き
- タグ: { name: 'service', value: 'doya-kintai' }

呼び出し元:
- POST /api/kintai/employees（新規作成時）
- POST /api/kintai/employees/[id]/invite（再送信時）

エラー時:
- メール送信失敗してもユーザー作成は成功とする
- console.error でログのみ
```

### 6-4. 招待受け入れ

```
src/app/kintai/invite/[token]/page.tsx を作って。

フロー:
1. URL からトークンを取得
2. 未認証なら Google ログインへリダイレクト
3. 認証済みなら GET /api/kintai/invite/[token] を呼ぶ
4. サーバー側でトークン検証:
   - KintaiMember を inviteToken で検索
   - status を ACTIVE に更新
   - userId = session.user.id を設定
   - acceptedAt = now()
5. /kintai/dashboard へリダイレクト

エラーハンドリング:
- 無効なトークン: 「招待リンクが無効です」と表示
- 期限切れ: 「招待リンクの期限が切れています」
- 既に他人が使用: 「このリンクは使用済みです」
```

---

## Claude に渡すときのコツ

### 1. 全体像を最初に伝える

```
最初にこう伝える:
「中小企業向けの勤怠管理 SaaS を作っています。
Next.js 14 + Prisma + PostgreSQL + NextAuth + Tailwind の構成です。
これから複数のファイルを順番に作ります。
全部のファイルが連携する前提で、依頼ごとに矛盾しないように作ってください。」
```

### 2. 1 ファイルずつ依頼する

❌ 悪い例: 「勤怠管理システム全部作って」
✅ 良い例: 「打刻画面 1 ページだけ作って」

### 3. 「定型句」を毎回伝える

API なら毎回:
```
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
```

を入れて、と毎回伝える（忘れがちなので）。

### 4. セキュリティルールを毎回伝える

「他組織のデータが絶対に見えてはいけない。
全クエリに `organizationId` フィルターを必ず入れて。」
と毎回念押し。

### 5. 確認してから次へ進む

```
依頼 → コード生成 → 自分で読む → ローカルで動かす → 問題なければ次へ
```

一気に作って後でバグまみれ、を防ぐ。

### 6. エラーが出たら Claude にそのまま投げる

```
「次のエラーが出ました。解決方法を教えて」
[エラーメッセージをそのまま貼る]
```

Claude はエラーから原因を逆算できる。

---

## トラブルシューティング

### よくある詰まりポイント

| 問題 | 原因 | 対処 |
|------|------|------|
| 他組織のデータが見える | organizationId フィルター漏れ | 全 API を再確認。Claude に「organizationId が抜けてる API ない？」と聞く |
| 打刻時刻が 9 時間ズレる | JST 変換忘れ | `+9 時間オフセット` 処理を入れる |
| 退勤押せない | 状態遷移バリデーション漏れ | 「出勤中なら退勤可」「休憩中なら自動で休憩終了挿入」を実装 |
| 招待メールが届かない | Resend のドメイン未認証 | Resend ダッシュボードで送信元ドメインを認証する |
| 月次集計がズレる | UTC/JST の月境界 | 月初を JST 00:00 = UTC 前日 15:00 で計算する |
| 権限チェック忘れ | hr_admin チェックなし | 管理 API には必ず `hasMinRole()` を入れる |

### デバッグの順序

1. ブラウザの DevTools で Network タブを確認 → エラーコード（401 / 403 / 500）を見る
2. `console.log` を仕込んで Claude に「ここまで来てる」を伝える
3. Prisma クエリの結果を JSON で確認
4. それでもダメなら Claude にエラーメッセージ + 関連ファイルを丸ごと貼る

---

## 付録: コピペ用プロンプト集

### A. ChatGPT 用（画像生成）

#### ロゴ生成
```
シンプルでかわいい勤怠管理サービスのロゴを作って。
サービス名: ドヤ勤怠
イメージ: 時計アイコン、紫 #7f19e6、ポップ、ビジネス感、角丸フラット
サイズ: 512x512px、透過 PNG
```

#### キャラ生成（1 枚ずつ）
```
かわいい茶色のクマのマスコットキャラクターで「[表情名]」している姿。
くりっと大きな目、ふわふわ質感、全身が見える、フラットデザイン、PNG 透過。
表情リスト: hello / working / ramen / sleep / jump / success / error / thinking / surprise / focus / point / thumbsup / present / bug / love
```

### B. Claude 用（コード生成）

#### DB スキーマ
```
Prisma で勤怠管理の DB スキーマを設計して。
モデル: 組織、メンバー、部署（階層）、就業ルール、従業員、打刻記録、日次勤怠、申請
要件: マルチテナント、組織分離、監査ログ（修正履歴・IP）、kintai_ プレフィックス
4段階ロール: system_admin / hr_admin / manager / employee
```

#### API テンプレート
```
Next.js 14 で API ルートを作って。
パス: src/app/api/kintai/{機能名}/route.ts
必須定型句: runtime='nodejs', dynamic='force-dynamic', maxDuration=300
認証: getKintaiContext() で organizationId 取得、なければ 401
セキュリティ: 必ず where: { organizationId: ctx.organizationId } を入れる
入力検証: ホワイトリスト方式（enum 配列で includes チェック）
エラー: try/catch + console.error + 500
```

#### 画面テンプレート
```
Next.js 14 + Tailwind + framer-motion で画面を作って。
パス: src/app/kintai/{機能名}/page.tsx
デザイン: ブランドカラー #7f19e6、rounded-2xl、font-bold 以上、ポップでかわいく
キャラクター: public/kintai/characters/ から状況に応じた表情を配置
アニメーション: fade-in-up で登場、ホバーで translateY(-2px)
ローディング: クマ working.png + スケルトン
エラー: クマ error.png + 分かりやすいメッセージ
モバイル対応: レスポンシブ必須
```

#### セキュリティ監査依頼
```
このプロジェクトのセキュリティを監査して。チェック項目:
1. 全 API に getKintaiContext() の null チェックがあるか
2. 全クエリに organizationId フィルターがあるか
3. role の値がホワイトリスト検証されているか
4. 個別取得 API でオーナーシップ確認しているか
5. inviteToken が crypto.randomUUID() で生成されているか
6. 打刻修正に originalTimestamp が記録されているか
7. レスポンスに他組織の情報が含まれていないか
```

---

## 開発に必要な環境変数

`.env.local` に以下を設定:

```bash
# 認証
NEXTAUTH_SECRET=ランダム文字列（openssl rand -base64 32）
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=Google Cloud Console から取得
GOOGLE_CLIENT_SECRET=Google Cloud Console から取得

# DB
DATABASE_URL=postgresql://...  ← Supabase から取得

# メール
RESEND_API_KEY=re_xxx  ← Resend から取得
RESEND_FROM_EMAIL=noreply@yourdomain.com

# 決済（任意）
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

---

## デプロイ手順

```
1. GitHub にリポジトリを作る
2. Vercel にログインしてプロジェクトをインポート
3. 環境変数を Vercel に設定（上記の .env.local の内容）
4. main ブランチに push → 自動デプロイ
5. カスタムドメインを設定（任意）
```

---

## まとめ

このナレッジ集に従って AI ツールを使えば、**1 人 × 1〜2 週間**でドヤ勤怠相当の MVP を作れます。

**重要なポイント**:
- Claude に「全体像 → 1 ファイル」の順で依頼する
- セキュリティルール（organizationId 必須）を毎回伝える
- 画像は ChatGPT、コードは Claude と使い分ける
- 1 ステップずつ動作確認しながら進める

**質問があれば、Claude にこのドキュメント全体を貼って質問してください。**
コンテキストを理解した状態で答えてくれます。

---

**更新履歴**

| 日付 | 内容 |
|------|------|
| 2026-05-28 | 初版作成（AI ツール活用ナレッジ集） |
