# `src/components/seo/` について

ここは**コンポーネント置き場**です。`SwipeCard` / `TinderSwipeCard` /
`CompetitorAnalysisTab` は実際に使われている正規のコンポーネントなので消さないでください。

## 過去にあった罠（2026-08-17 に解消済み）

このディレクトリには以前 `route.ts` / `page.tsx` が15個ありました。
`src/components/` は App Router の外なので、Next.js はそれらを route/page として
認識せず、**一度も実行されていませんでした**。ビルドも型チェックも通るため
誰も気づかない状態でした。

同じ 2026-04-03 の一括操作（`1930245`）で `src/app/seo/template/` 配下にも
route handler の重複が7本作られており、こちらは到達可能なURLでしたが
**画面からは一度も呼ばれていません**でした。両方とも削除済みです。

**スワイプ機能の正本は次の2つです。直すときは必ずこちらを編集してください。**

- API: `src/app/api/swipe/**` の **`route.ts` のみ**
- 画面: `src/app/seo/swipe/page.tsx`
- コンポーネント: **このディレクトリ直下の `.tsx`**（`src/components/seo/*.tsx`）

⚠️ `src/app/api/swipe/test/` にも `SwipeCard.tsx` / `TinderSwipeCard.tsx` /
`CompetitorAnalysisTab.tsx` が置かれているが、**それらは使われていない複製**。
中身も現行と食い違っている。API配下に置かれた `.tsx` はどこからも読まれないので、
そちらを直しても画面は変わらない。

## 教訓

`route.ts` / `page.tsx` は `src/app/` 配下にしか置けません。
`middleware.ts` も同じ理由で一度も実行されていませんでした
（リポジトリ直下にあり、App Router が `src/app` 配下にある構成では
`src/middleware.ts` でないと認識されない。2026-08-17 に移設して解消）。

動いているか疑わしいときは `npx next build` の出力を見てください。
ルートとして認識されていれば一覧に出ます。
