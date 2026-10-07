# ドヤプロマネ

## 概要
- **パス**: `/promane`
- **サービスID**: `promane`
- **説明**: 案件の進捗・収支・人件費を一元管理するプロジェクト管理ツール
- **ステータス**: active
- **カテゴリ**: business (other)
- **アイコン**: 📊
- **カラー**: blue → violet グラデーション

## 機能

### コア機能
- **ガントチャート**: プロジェクト全体の進捗をビジュアル表示
- **カンバンボード**: タスクをドラッグ&ドロップで進捗管理
- **時間記録 → 人件費自動算出**: メンバー時給×作業時間
- **収支管理**: 売上 − 原価（人件費+経費）= 利益 をリアルタイム計算
- **クライアント管理**: 顧客情報とプロジェクト紐付け
- **メンバー招待**: 招待リンク発行（30日有効・トークン形式）
- **レポート**: Recharts による月別/プロジェクト別グラフ

### キャラクター
VRゴーグル付きクマキャラクター 15種:
hello, point, success, working, thinking, jump, thumbsup, surprise, love, ramen, sleep, focus, present, error, bug

## 料金プラン

| プラン | 案件数 | 月額 |
|--------|--------|------|
| 無料 | 3案件まで | ¥0 |
| プロ | 無制限 | ¥4,980 |
| エンタープライズ | 無制限 + SSO | ¥19,800 |

## ファイル構成

```
src/app/promane/
  ├── page.tsx                    — エントリ（WS自動作成→リダイレクト）
  ├── invite/[token]/page.tsx     — 招待承諾ページ
  └── [workspaceSlug]/
      ├── layout.tsx              — サイドバー付きレイアウト
      ├── page.tsx                — ダッシュボード（KPI+プロジェクト一覧）
      ├── projects/page.tsx       — プロジェクト一覧
      ├── projects/new/page.tsx   — プロジェクト作成
      ├── projects/[projectId]/page.tsx — 詳細（ガント+カンバン+収支）
      ├── clients/page.tsx        — 顧客管理
      ├── members/page.tsx        — メンバー管理+招待
      ├── timesheet/page.tsx      — 作業時間記録
      ├── reports/page.tsx        — 収支レポート
      ├── settings/page.tsx       — ワークスペース設定
      └── help/page.tsx           — 使い方ガイド

src/app/api/promane/
  ├── feedback/route.ts           — Slack通知
  ├── invite/route.ts             — 招待リンク発行 (POST)
  └── invite/[token]/route.ts     — 招待検証(GET)・承諾(POST)

src/components/promane/
  ├── sidebar.tsx                 — サイドバー
  ├── character.tsx               — キャラクター
  ├── gantt-chart.tsx             — ガントチャート
  ├── kanban-board.tsx            — カンバンボード（DnD）
  ├── kanban-column.tsx
  ├── kanban-card.tsx
  ├── task-create-form.tsx
  ├── project-form.tsx
  ├── finance-tab.tsx             — 収支詳細
  ├── client-actions.tsx
  ├── member-list.tsx
  ├── timesheet-view.tsx
  ├── report-chart.tsx            — Rechartsグラフ
  └── ui/                          — UIコンポーネント（10ファイル）

src/lib/promane/
  ├── auth.ts                     — getOrCreateWorkspace, requirePromaneAuth 等
  ├── format.ts                   — 通貨・%・時間フォーマット
  ├── utils.ts                    — cn() ユーティリティ
  ├── actions-projects.ts         — プロジェクト Server Actions
  ├── actions-tasks.ts            — タスク Server Actions
  ├── actions-clients.ts          — 顧客 Server Actions
  └── actions-time-entries.ts     — 時間記録/経費 Server Actions
```

## Prisma モデル

`promane_` プレフィックスで命名:

| モデル | テーブル | 説明 |
|--------|---------|------|
| PromaneWorkspace | promane_workspaces | ワークスペース（組織） |
| PromaneMember | promane_members | メンバー（role: owner/admin/member/guest） |
| PromaneClient | promane_clients | 顧客 |
| PromaneProject | promane_projects | プロジェクト（案件） |
| PromaneTask | promane_tasks | タスク（ガント/カンバン） |
| PromaneTimeEntry | promane_time_entries | 作業時間記録 |
| PromaneExpense | promane_expenses | 経費 |
| PromaneComment | promane_comments | コメント |
| PromaneInvitation | promane_invitations | 招待リンク（30日有効） |

## 認証・権限

- NextAuth Google OAuth ベース
- `requirePromaneAuth()`: 未ログインなら `/auth/signin` にリダイレクト
- `getOrCreateWorkspace(userId)`: 初回アクセス時にWS自動作成
- `getWorkspaceBySlug(slug, userId)`: メンバーシップ確認込みでWS取得

### Role 階層
- **owner**: 全権限。WS削除・他オーナー追加可能
- **admin**: メンバー招待・プロジェクト管理
- **member**: プロジェクト編集・タスク作業
- **guest**: 閲覧のみ

## 招待フロー

1. オーナー/管理者が `/promane/[slug]/members` で招待
2. `POST /api/promane/invite` でトークン生成（32バイトhex / 30日有効）
3. 招待先に URL `/promane/invite/{token}` を共有
4. 招待先が `GET /api/promane/invite/[token]` で検証
5. ログイン後 `POST /api/promane/invite/[token]` で承諾→メンバー作成

## Stripe 統合

統一プラン方式（ServiceId: `promane`）。
環境変数:
- `NEXT_PUBLIC_STRIPE_PROMANE_PRO_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_PROMANE_ENTERPRISE_PRICE_ID`

## デザイン

- カラー: blue → violet グラデ
- フォント: text-[15-32px] を多用、font-black 強調
- スペーシング: p-7, rounded-[28px]
- アニメーション: animate-slide-up, animate-bounce-in, animate-float
- キャラクター: 全ページで活用

## 関連リンク

- フィードバック → Slack 通知: `/api/promane/feedback`
- 使い方: `/promane/[workspaceSlug]/help`
- 設定: `/promane/[workspaceSlug]/settings`


第269巡・ローカル補修: タイムシートに月別/全期間の絞り込みと50件単位のページ送りを追加。合計は表示ページではなく対象期間全体。所属/計数/本文はRepeatableRead、ページカーソルは月と本人memberに結び付ける。実DB5群/模擬readを用いた実ブラウザ6群/標準155本とビルド合格。本番未反映。詳細: docs/audits/2026-09-20-loop-269/report.md。


第270巡・ローカル補修: 時間記録の日付は実在するYYYY-MM-DDのみ受け付け、UTC午前0時で保存。既定の「今日」はJST、保存日表示は端末timezoneでずれない。時間は非負整数分、画面の分は0〜59、DB Int範囲を超える値や小数を丸めず拒否。0分は既存仕様どおり。既存データは変更しない。本番未反映。docs/audits/2026-09-20-loop-270/report.md。


第271巡・ローカル補修: 経費HTTP追加/削除はowner/admin/memberの有効所属を必須とし、閲覧専用/未知roleを拒否。HTTP/Server Action/画面で非負整数円（DB Int範囲）、日付、カテゴリ、説明を共通検証。小数を切り捨てない。既定日はJST、表示はdate-only。本番未反映。docs/audits/2026-09-20-loop-271/report.md。

### 第273巡・案件編集の空欄と日付（ローカル補修）

案件編集で顧客・説明・見積工数・開始日・納期・タグを空にした場合はnullとして消去する。Server Actionの省略フィールドは既存値を保持する。新規・更新の日付は実在するYYYY-MM-DDに限定し、部分更新は既存の日付と比較して逆転を拒否する。実DB/模擬ブラウザの証拠は `docs/audits/2026-09-20-loop-273/report.md`。本番未反映。

### 第274巡・案件文字数と選択肢（ローカル補修）

作成/更新/UIで案件名200文字、説明5000文字、タグ500文字を共通検証。超過時は切り詰めず保存拒否。状態8種・請求方式4種の既存選択肢を許可する。省略による部分更新保持と明示空欄解除は維持。証拠は `docs/audits/2026-09-20-loop-274/report.md`。同時案件作成による枠超過は模擬環境で再現し、未修正。本番未反映。

### 第275巡・案件作成上限の競合（ローカル補修）

案件作成は所属・顧客・操作ユーザーのプラン・全参加workspace件数・保存をSerializableで処理する。P2034は最大3試行まで再判定し、上限到達はLIMITを返す。前巡の同時作成枠超過はローカル実DBで補修確認済み。本番未反映。証拠は `docs/audits/2026-09-20-loop-275/report.md`。課金オーナー/招待参加/重複送信/他書込の競合は残件。

### 第276巡・案件の日付同時編集（ローカル補修）

updateProjectもSerializableで既存値取得・検証・保存を行い、P2034時は最大3試行で最新値を検証し直す。矛盾する日付の同時変更は一方を拒否し、矛盾しない変更は双方保持することをローカル実DBで確認。本番未反映。同一フィールドの古い画面からの上書き警告は未対応。証拠は `docs/audits/2026-09-20-loop-276/report.md`。

### 第277巡・管理用修復の競合（ローカル補修）

修復は読み取り時の金額・日付と現在値が一致する場合だけ条件付き更新する。途中の訂正/削除はスキップし、実更新件数だけ計上する。実DBで訂正保護・削除・無関係な説明の保持・再実行を確認。本番未反映。証拠は `docs/audits/2026-09-20-loop-277/report.md`。

Production DB update 2026-09-23: migration219 applied after local backup; all three existing time entries now have projectId and postflight found no missing schema. Code rollout/owner billing checks remain pending. Evidence: docs/audits/2026-09-23-history-order/production-app-schema-report.json.

Latest production status 2026-09-23: code deployment `dpl_4VYkNiY94VqpJHtuJoSSY2NuTi18` is live; public route and unauthenticated boundary passed. Signed-in time-entry, project ownership and billing scenarios still require production-like end-to-end validation.


### 作業時間登録の二重送信・通信断への対応

作業時間の新規登録には送信ごとの操作IDを必須とし、記録本体と操作の保存結果を同じトランザクションで保存する。同じ操作ID・同じ入力の再送は元の記録を返し、入力が変わった再送や取り消し済み操作は登録しない。削除済み記録を再送で復活させない。登録・保存状態確認の直前に、有効なワークスペースメンバーの変更権限を再確認する。

画面は同時送信を防ぎ、ワークスペース・メンバーごとに操作IDだけを端末へ保存する。作業内容は端末保存しない。保存結果が不明な場合は新規登録を止め、「保存状態を確認」または「未完了の送信を取り消す」を案内する。取り消しは未保存の操作を無効化し、保存済みの作業時間は削除しない。応答が45秒以内に確認できない場合も、保存失敗と断定せず確認待ちとして扱う。安全な端末保存やタブ間の排他制御を利用できない環境では、登録を開始せず案内を表示する。

一般メンバーが同じ組織の他メンバーの記録を扱える既存仕様については、別途方針確認中。この二重登録対策ではその権限仕様を変更しない。


### 経費登録の二重送信・保存結果の確認

経費のAPIと既存の登録Server Actionは操作IDを必須とし、同じ利用者・ワークスペース・操作IDの保存結果を共有する。経費本体と保存結果を同じトランザクションで記録する。同じ入力の再送は元の経費を返し、金額などが異なる再送は拒否する。削除済み経費は再送で復活させない。

保存状態の確認は対象案件内でのみ行い、新規経費を作成しない。未完了送信の取り消しは後着の登録を防ぐ操作であり、保存済み経費は削除しない。HTTP 200だけでは成功扱いせず、保存されたID・案件・金額・日付・カテゴリ・説明を確認する。応答を確認できない場合は自動再送せず、保存状態の確認または取り消しを案内する。

端末には利用者・ワークスペース・案件ごとの操作IDのみ保存し、経費の説明や金額は保存しない。利用者・案件が変わると入力フォームを閉じ、前の入力を引き継がない。作業時間の入力も、ワークスペース・メンバーが変わると閉じて案件の選択を解除する。

### 作業メモの保存境界

作業メモは1,000文字以内。画面とサーバーの両方で超過を拒否し、入力の末尾を切り捨てて保存しない。超過時は入力を残して修正を促す。保存応答に返されたメモが送信内容と一致しない場合は、保存完了とせず保存状態の確認へ案内する。

### 顧客情報の登録と復旧

顧客登録は利用者・ワークスペース・送信IDごとに1回だけ作成し、APIとServer Actionが同じ保存記録を参照する。保存結果が不明なら再登録せず確認し、未保存の操作を明示的に取り消せる。会社名200文字・メモ5,000文字・メール形式の検証を登録と更新で共通化し、切り捨て保存は行わない。アカウントやワークスペースの切り替え時には前の入力画面を閉じる。小画面の登録モーダルは高さを制限して内部をスクロール可能にする。

### タスク登録の送信と復旧

タスク登録は利用者・ワークスペース・案件・送信IDごとに保存結果を記録し、タスク本体と同時に確定する。同じ送信IDの再送は元のタスクを返し、別送信IDなら同じ名前でも新規タスクとして登録する。変更権限と所属案件を保存・確認直前に再検証する。送信画面の利用者IDをログイン中の利用者と照合し、アカウントが変わった送信は保存しない。

保存結果が不明な間は入力を保持して再送を止める。保存状態の確認は新規タスクを作らず、未保存の送信だけを明示的に取り消せる。保存済みタスクや削除済みタスクを取り消し・再送で変更しない。端末には利用者・案件ごとの送信IDのみ保存し、タスク内容は保存しない。アカウントや案件が変わると前の下書きを解除する。

保存済みの記録が別画面で削除されていた場合も、サーバーの送信記録から操作の完了を確認する。送信が完了済みで遅延再送でも復活しないと確認できた場合は、元の入力を残したまま次の登録を許可する。送信記録自体がまだ見つからない場合や応答が不正な場合は、確認待ちを解除しない。この扱いはタスク・顧客・経費・作業時間で共通とする。
