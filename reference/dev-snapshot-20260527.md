# 開発スナップショット 2026-05-27

## 概要
2026-05-25〜27にかけて開発した新機能のまとめ。
ビルドの不安定化により一旦 f1803b5（2025-12-18）に戻した。
以下の内容は後日、1つのエージェントで統合して再開発する。

---

## 1. ドヤリストAI（営業リスト生成AI）

### コミット
- `b338ad7` feat: ドヤリストAI追加（既存履歴を保持）

### ファイル構成
```
src/app/doyalist/
  ├── layout.tsx          — DoyalistLayout共通レイアウト
  ├── page.tsx            — ダッシュボード
  ├── new/page.tsx        — 新規プロジェクト作成
  ├── pricing/page.tsx    — 料金ページ
  ├── projects/page.tsx   — プロジェクト一覧
  ├── projects/[id]/page.tsx       — プロジェクト詳細
  ├── projects/[id]/approach/page.tsx — アプローチ管理
  ├── projects/[id]/company/[companyId]/page.tsx — 企業詳細
  ├── settings/page.tsx   — 設定
  └── templates/page.tsx  — テンプレート管理

src/app/api/doyalist/
  ├── analyze/route.ts     — AI企業分析
  ├── approach/bulk/route.ts — 一括アプローチ生成
  ├── approach/generate/route.ts — アプローチ文生成
  ├── checkout/route.ts    — Stripe Checkout
  ├── collect/route.ts     — 企業収集
  ├── companies/[id]/enrich/route.ts — 企業情報エンリッチ
  ├── companies/[id]/route.ts — 企業CRUD
  ├── export/route.ts      — CSV/Excelエクスポート
  ├── projects/[id]/route.ts — プロジェクトCRUD
  ├── projects/route.ts    — プロジェクト一覧
  ├── suggest-target/route.ts — ターゲット提案
  ├── templates/[id]/route.ts — テンプレートCRUD
  ├── templates/route.ts   — テンプレート一覧
  └── usage/route.ts       — 使用量確認

src/components/doyalist/
  ├── DoyalistLayout.tsx   — サイドバー付きレイアウト
  └── DoyalistSidebar.tsx  — サイドバー
```

### 機能概要
- AIによる営業リスト自動生成
- 企業情報のエンリッチメント（AI分析で詳細情報付与）
- アプローチ文の自動生成（メール/DM/電話スクリプト）
- 一括アプローチ生成
- CSV/Excelエクスポート
- テンプレート管理
- Stripe課金（ドヤAI統一課金体系）

### Prismaモデル
`b338ad7` のスキーマを参照。DoyalistProject, DoyalistCompany, DoyalistApproach, DoyalistTemplate 等。

---

## 2. ドヤプロマネ（プロジェクト管理）

### 開発元
別リポジトリ `~/Code/project-manager/` で開発後、ドヤAIに統合。
GitHub: `https://github.com/k-mitsumori-cmd/doya-promane` （独立リポジトリも存在）

### ファイル構成
```
src/app/promane/
  ├── page.tsx                    — エントリ（WS自動作成→リダイレクト）
  ├── invite/[token]/page.tsx     — 招待承諾ページ
  └── [workspaceSlug]/
      ├── layout.tsx              — サイドバー付きレイアウト
      ├── page.tsx                — ダッシュボード（KPI+セットアップ+2カラム）
      ├── projects/page.tsx       — プロジェクト一覧（カード型）
      ├── projects/new/page.tsx   — プロジェクト作成フォーム
      ├── projects/[projectId]/page.tsx — ガントチャート+カンバン+収支
      ├── clients/page.tsx        — 顧客管理
      ├── members/page.tsx        — メンバー管理+招待
      ├── timesheet/page.tsx      — 作業時間記録
      ├── reports/page.tsx        — 収支レポート+グラフ
      ├── settings/page.tsx       — ワークスペース設定
      └── help/page.tsx           — 使い方ガイド

src/app/api/promane/
  ├── feedback/route.ts           — フィードバック→Slack通知
  ├── invite/route.ts             — 招待リンク作成
  └── invite/[token]/route.ts     — 招待検証・承諾

src/components/promane/
  ├── sidebar.tsx        — サイドバー（絵文字ナビ+フィードバックモーダル）
  ├── character.tsx      — キャラクターコンポーネント
  ├── gantt-chart.tsx    — ガントチャート（2週間表示）
  ├── kanban-board.tsx   — カンバンボード（DnD対応）
  ├── kanban-column.tsx  — カンバンカラム
  ├── kanban-card.tsx    — カンバンカード
  ├── task-create-form.tsx — タスク追加フォーム
  ├── project-form.tsx   — プロジェクト作成/編集フォーム
  ├── finance-tab.tsx    — 収支詳細タブ
  ├── client-actions.tsx — 顧客CRUD
  ├── member-list.tsx    — メンバー一覧+招待
  ├── timesheet-view.tsx — タイムシートUI
  ├── report-chart.tsx   — Rechartsグラフ
  └── ui/               — UIコンポーネント（10ファイル）

src/lib/promane/
  ├── auth.ts            — 認証ヘルパー（getServerSession互換）
  ├── format.ts          — 通貨/パーセント/時間フォーマット
  ├── utils.ts           — cn()ユーティリティ
  ├── actions-projects.ts — プロジェクトServer Actions
  ├── actions-tasks.ts   — タスクServer Actions
  ├── actions-clients.ts — 顧客Server Actions
  └── actions-time-entries.ts — 時間記録/経費Server Actions
```

### Prismaモデル（promane_プレフィックス）
- PromaneWorkspace — ワークスペース（組織）
- PromaneMember — メンバー（role: owner/admin/member/guest）
- PromaneClient — 顧客
- PromaneProject — プロジェクト（案件）
- PromaneTask — タスク（ガントチャート/カンバン）
- PromaneTimeEntry — 作業時間記録
- PromaneExpense — 経費
- PromaneComment — コメント
- PromaneInvitation — 招待リンク

### 機能概要
- 案件の進捗管理（ガントチャート+カンバン）
- 収支自動計算（売上-人件費-経費=利益）
- 時間記録→人件費自動算出
- メンバー招待リンク
- 顧客管理
- レポート（Rechartsグラフ）
- キャラクター（VRゴーグルくま）15種
- フィードバック→Slack通知

### キャラクター画像（15枚）
```
public/character/
  hello.png, point.png, success.png, working.png, thinking.png,
  jump.png, thumbsup.png, surprise.png, love.png, ramen.png,
  sleep.png, focus.png, present.png, error.png, bug.png
```

---

## 3. ドヤ勤怠（勤怠管理MVP）

### 場所
ドヤHR（`/hr`）内のサブ機能として `/kintai` パスで実装。
※ 別セッションで開発されたため、このスナップショットには含まれない場合あり。

### 概要
- 打刻（出勤/退勤）
- 勤怠一覧
- 申請（修正/休暇/残業）
- メンバー管理
- ドヤAI課金体系に統合

---

## 4. 変更されたファイル（既存サービスへの影響）

### next.config.js
- `outputFileTracing: false` を追加（ビルドスタックオーバーフロー対策）
- ※ 戻す際はこの変更を元に戻す必要あり

### src/lib/pricing.ts
- 料金表示のSSR対応修正

### prisma/schema.prisma
- PromaneWorkspace等のモデル追加
- DoyalistProject等のモデル追加
- User にpromaneWorkspaces/promaneMembers リレーション追加
- KintaiMemberにinviteToken/inviteEmail追加

---

## 5. 復元手順

```bash
# f1803b5に戻す
git reset --hard f1803b5
git push origin main --force

# Vercelが自動でf1803b5をデプロイ
# → 全サービス（バナー/SEO/インタビュー等）が正常に動く状態に復帰
```

## 6. 再開発時の注意

1. **1つのエージェントで統合開発する**（並行エージェントによるコンフリクトを防ぐ）
2. **Prismaスキーマの変更は慎重に** — db pushでSupabaseに反映後、revertすると不整合が起きる
3. **page.tsxのジェネリクス型注釈** — SWCパーサーが `useState<T>()` を正しくパースできない場合がある。`useState('value' as T)` を使う
4. **LOGO/generatorモジュール** — f1803b5時点では存在するが、スタブ化が必要な場合あり
