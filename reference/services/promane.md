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
