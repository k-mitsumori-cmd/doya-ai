# doya-media-worker

ドヤ部下の重いメディア処理を受け持つ Cloud Run Jobs 用ワーカー。仕様・使い方・環境変数は `../reference/12-media-worker.md` を見る。

- 起動: `MEDIA_JOB_ID` を渡すとその1件を処理して終わる。渡さないと順番待ちを古い順に最大 `MEDIA_DRAIN_MAX` 件（既定5）処理する。
- ビルド: `docker build -t doya-media-worker .`（またはデプロイ手順の `gcloud builds submit`）
- 確認: `npm run typecheck`、`npx tsx --test test/e2e.test.ts`
