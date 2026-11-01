# ドヤ展示会 出展プロジェクトのサーバー保存（案）

状態: 案。コードとスキーマは変えていない。当面は端末のブラウザ保存（`src/lib/tenjikai/local-store.ts`）で再開できる。

## 1. 今の表で足りるか

結論は「足りない」。理由は次の3つ。

1. `TenjikaiProject` は入力（イベント名・小間・予算・目的など）だけを持つ。AI が作った文面（解析・ブース案の文・制作物の文）と、選んだ案（A/B/C）、選んだノベルティを入れる列がない。
2. `TenjikaiGraphicPanel.imageUrl` はあるが、画像の保存先がない。いまの `/api/tenjikai/image` は画像を base64 のまま返すだけで、Supabase Storage に置いていない（route.ts 末尾のコメントのとおり）。
3. 画面の `ProjectInput` と DB の列が一致しない。例として、画面の入力に `venueId` の選択や `serviceUrl` はあるが、`boothPlans`・`creatives` などの子表は画面の計算結果（`generateBoothPlans` など）で毎回作り直す設計で、保存する行の形が決まっていない。

`TenjikaiGenerationJob` は実行の記録（見込み額・結果）であり、プロジェクトの中身の保存には使えない。

## 2. 提案する変更

最小の形は、プロジェクトに「状態の写し」を1列足し、画像だけを Storage に置く方式。

### 2.1 モデル（prisma/schema.prisma）

```prisma
model TenjikaiProject {
  // 既存の列は変えない
  /// 画面の状態の写し（版つき）。generated（AIの文面）・variant・selectedNovelty を入れる。画像のバイト列は入れない
  state          Json?
  stateVersion   Int      @default(1)
}

model TenjikaiGraphicPanel {
  // imageUrl は既存。Storage の公開でない URL（署名つき）のパスを入れる
}
```

画像は `TenjikaiGraphicPanel` の行に紐づけず、まずは `state.panelImages: { [panelId]: storagePath }` で持つ。面（panel）は入力から毎回計算するため、行を先に作る必要がないから。

### 2.2 SQL（本番へは doya-db-push の手順で手動反映）

```sql
ALTER TABLE "tenjikai_project" ADD COLUMN "state" JSONB;
ALTER TABLE "tenjikai_project" ADD COLUMN "stateVersion" INTEGER NOT NULL DEFAULT 1;
```

列追加のみで、既存の行と既存のクエリに影響しない（null 可）。

### 2.3 API

- `POST /api/tenjikai/projects` 新規作成（入力と state を保存、ID を返す）
- `GET /api/tenjikai/projects` 自分の一覧
- `GET/PUT/DELETE /api/tenjikai/projects/[id]` は必ず `findFirst({ where: { id, userId } })` の二重条件（他人の ID を読めない）
- 画像: `/api/tenjikai/image` の成功後に Storage へ保存し、パスを返す。保存失敗でも画像自体は返す
- URL は `/tenjikai/[projectId]/[section]` に変える案。今の `/tenjikai/booth` は「最後に開いたプロジェクト」へ転送して互換を保つ

### 2.4 画面

- `TenjikaiApp` は、URL の ID があればサーバーから読む。無ければ端末の保存（今回の暫定）を読む
- 端末の保存は移行が済むまで残し、初回に1回だけサーバーへ取り込む

## 3. 決めてほしいこと

- 画像の Storage（バケット名・公開範囲・保存期間）
- 1人あたりの保存できるプロジェクト数の上限
- URL の形を変えてよいか（`/tenjikai/[projectId]/[section]`）
