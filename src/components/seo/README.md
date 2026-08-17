# ⚠️ このディレクトリの `route.ts` / `page.tsx` は**絶対に実行されない**

`src/components/` は App Router の外です。Next.js が route/page として認識するのは
`src/app/` 配下だけなので、ここに置かれた以下の15ファイルは**どれだけ直しても本番に反映されません**。

```
page.tsx / start/route.ts / log/route.ts / generate/route.ts
question-images/route.ts / question-images/generate/route.ts
celebration-images/route.ts / celebration-images/generate/route.ts
generate-images/page.tsx / generate-question-images/page.tsx
test/page.tsx / test/route.ts / test/start/route.ts
test/question/route.ts / test/finalize/route.ts
```

**動いている本物は `src/app/api/swipe/**` と `src/app/seo/swipe/` にあります。**
スワイプ機能を直すときは、必ずそちらを編集してください。

このディレクトリの `.tsx`（`SwipeCard` / `TinderSwipeCard` / `CompetitorAnalysisTab`）は
実際に使われている正規のコンポーネントです。**それらは消さないでください。**

## なぜ残してあるか

過去のリファクタの取り残しと見られますが、消すのは破壊的な操作なので、
内容を確認いただくまで残しています。不要と判断できたら route/page の15ファイルだけ削除してください。

## 同じ罠

`middleware.ts` も同じ理由で一度も実行されていませんでした（リポジトリ直下に置かれており、
App Router が `src/app` 配下にある構成では `src/middleware.ts` でないと認識されない）。
2026-08-17 に `src/middleware.ts` へ移設して解消済みです。
