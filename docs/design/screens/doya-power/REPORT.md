# ドヤパワーの表示の部品 — 報告（ui-next/doyapower-gauge）

- ブランチ: `ui-next/doyapower-gauge`（origin/main `bd19215` から作成。main には入れていない）
- コミット: `5649ed6`（部品と見本のページ）、`93332e1`（375px の直しと写真・報告）、この報告の更新
- 担当範囲: 表示の部品だけ。値はすべて props で受け取る（台帳・残りの計算は `ui-next/doyapower-ledger`）。データ取得・API 呼び出し・メール・通知は無し。本番DB・Stripe・料金は触っていない。
- 触ったファイル（すべて新規。既存の ds の部品は変更なし）
  - `src/components/doya-power/DoyaPower.tsx` … 部品の本体
  - `src/components/doya-power/doya-power.module.css`
  - `src/components/doya-power/time.ts` … 日本時間の日付・回復時刻の言い方
  - `src/components/doya-power/index.ts` … まとめて export
  - `src/components/doya-power/DoyaPowerDemo.tsx` … 見本の中身
  - `src/components/ds/cost-badge.tsx` / `cost-badge.module.css` … ボタンに付ける札
  - `src/app/ds-preview/doya-power/page.tsx` … 見本のページ（既存の ds-preview と同じく本番では 404）
  - `docs/design/screens/doya-power/*.png` と この REPORT.md

## 部品と props

```ts
import { DoyaPowerGauge, PowerEquivalents, LowPowerNotice, MorningRecoveryToast, CostBadge } from '@/components/doya-power'
```

| 部品 | props | 中身 |
|---|---|---|
| `DoyaPowerGauge` | `remaining` `limit` `label?='ドヤパワー'` `unitLabel?='pt'` `conversions?` `nextRecoveryAt?` `now?` `lowRatio?=0.2` `fx?` | 残りのゲージ。青 #0066ff → #009bff → #00e0ff のグラデーション、25/50/75% の目盛り、`残り 330 / 上限 1,000 pt`・`33%`・`明日 6:00 に 1,000 まで回復` を文字で出す。少ないときは「残りわずか」の札（色だけで伝えない）。`role="meter"` と `aria-valuetext`。バーは `transform: scaleX` で伸ばす（レイアウトを動かさない）。高さは固定（バーの行 48px、数字は `tabular-nums`・最小幅つき） |
| `PowerEquivalents` | `remaining` `conversions` `limit?=3` `lead?='あと'` | 「あと バナー33枚／記事110本／資料13件」。換算の表は props |
| `PowerConversion`（型） | `{ id, label, unit, cost, icon? }` | 1回で減る量。例 `{ id:'banner', label:'バナー', unit:'枚', cost:10, icon:'Image' }` |
| `CostBadge`（`@/components/ds/cost-badge`） | `cost` `unitLabel?='ドヤパワー'` `short?` | `<Button icon="Image">バナーを作る<CostBadge cost={10} /></Button>`。札の色はボタンの文字色（currentColor）から作るので、主・副・枠なしのどれでも読める。読み上げは「（ドヤパワーを10使います）」。`short` で「足りません」を文字でも出す |
| `LowPowerNotice` | `remaining` `limit` `nextRecoveryAt?` `now?` `conversions?` `moreHref?` `moreLabel?='ドヤパワーを増やす方法'` `fx?` `onClose?` | 責めない文言（「残り少なくなっています」「たくさん使っていただき、ありがとうございます」「いま作っているものは、そのまま続けられます」）。次の回復の時刻と、増やし方への案内。色は注意の黄（赤は使わない）。`role="status"` |
| `MorningRecoveryToast` | `recoveredAt` `limit` `amount?` `scope?='default'` `conversions?` `fx?` `placement?='fixed'\|'inline'` `ignoreStorage?` `autoHideMs?=8000` | 朝の回復の知らせ。`recoveredAt` が日本時間で今日のときだけ、`scope`（組織 id など）ごとに1日1回。覚えるのは `localStorage`（`doya_power_morning:<scope>` に日本時間の日付）で、読み書きは try/catch。使えないときは開いている間だけメモリで覚える。出すかどうかはクライアントで決める（サーバーでは描かない）。fixed で重ねるのでまわりを押さない。メール・通知は送らない |
| `resolveDoyaPowerFx(fx)` | `{ org?: { mascot?, effects? }, user?: { mascot?, effects? } }` | 組織と個人の表示の設定を合わせる。どちらかがオフならオフ（組織がオフにしたものは個人で戻せない）。省略はオン |
| 補助 | `powerEquivalents()` `shouldShowMorningToast()` `jstDateKey()` `jstDateTime()` `recoveryLabel()` | 計算だけの関数 |

演出の切り方:
- `fx.effects` がオフ、または `prefers-reduced-motion: reduce` → ゲージは最初から最後の形、数え上げ・光の流れ・ドヤくんの揺れ・トーストの入りが止まる（CSS でも二重に止める）
- `fx.mascot` がオフ → ドヤくん（`/character/*-256.webp`）を出さず、lucide のアイコンにする
- アイコンは lucide-react（`ShellIcon` と lucide の直接 import）。絵文字なし

## 実行したコマンドと終了コード

| コマンド | 終了コード |
|---|---|
| `npm ci` | 0 |
| `npx tsc --noEmit -p .`（今回のファイルのエラーだけを grep → 0件） | — （リポジトリ全体には既存の型エラーがあるため、フィルタして確認） |
| `UI_NEXT_ROLLOUT=preview UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build`（最終のコード。`/ds-preview/doya-power` 5.89 kB） | **0** |
| 写真用: 同じ環境変数で `npx next build` → `DS_PREVIEW_SHOT=1 npx next start -p 3456` → Playwright（Chromium）で撮影 | 0 |

⚠️ `/ds-preview` は `NODE_ENV=production`（= `next start`）では 404 になる作り（既存の layout）。写真を撮るときだけ、手元で layout と page の `notFound()` に `&& process.env.DS_PREVIEW_SHOT !== '1'` を一時的に足してビルドし、撮ったあと元に戻した（コミットには入れていない）。

写真（Playwright・deviceScaleFactor 2・全体を撮るときは下のタブバーを隠す）:
- `doya-power-375.png` / `doya-power-375-first.png`（最初の画面）
- `doya-power-1280.png` / `doya-power-1280-first.png`
- `doya-power-375-reduced.png` / `-first.png`（`prefers-reduced-motion: reduce`）

自動の確認（ページの中を全部スクロールして動きを起こしたあと）:

| 幅 | 横のはみ出し | 1文字だけの行 | CLS |
|---|---|---|---|
| 375px | 0px | 0 | 0.00018 |
| 1280px | 0px | 0 | 0.00005 |
| 375px（動きを減らす） | 0px | 0 | 0 |

途中で直したこと: 375px で見本のトーストが枠を 9px はみ出していた → inline のときは幅 100%。回復の時刻の行が切れていた → 折り返しを許す。トーストの見出しに「た」1文字の行 → 見出しを2行に分け、日付は折らない。

## まだ良くない点

1. 見本のページは本番（`next start`）では 404 のまま（既存の ds-preview の決まり）。写真は一時的な手元の変更で撮っている。
2. ドヤくんの絵は既存の `public/character/*-256.webp`。ゲージの 48px では表情が小さく、ポーズ（thumbsup / thinking / hello）が文脈にぴったりではない。
3. 回復の時刻は `now` を渡したときだけ「明日 6:00」になる。渡さないと日付つき（サーバーとクライアントで同じ文字にするため）。使う側が `now` を渡す必要がある。
4. 換算の言い換えは単純な割り算（残り ÷ 1回の量）。組み合わせて使ったときの見込みではない。
5. `CostBadge` の札は `color-mix()` を使う（Chrome 111+ / Safari 16.2+）。古いブラウザでは札の背景が出ない（文字は読める）。
6. 見本の自動確認（1文字だけの行の検出）は自作の簡易スクリプトで、正式なテストではない（リポジトリに自動テストは無い）。
7. 表示の設定（組織・個人）の保存先・画面はまだ無い。今は props で受け取るだけ。

## 次の改善の提案

1. 台帳（ui-next/doyapower-ledger）がつながったら、`(shell)` のヘッダーか ShellUsage の位置に小さなゲージ（1行版）を置く。今のゲージに `compact` を足す。
2. 生成ボタンを押したとき、ゲージが減る量だけ縮む演出（`remaining` の変化を CountUp と scaleX の遷移で見せる。部品はすでに値の変化で動く）。
3. 表示の設定の画面（組織の設定に「ドヤくん」「演出」、個人の設定に同じ2つ）を作り、`resolveDoyaPowerFx` に渡す。
4. ゲージ用のドヤくんの小さい絵（64px で読めるポーズ。回復・少ない・満タン）を作る。
5. `LowPowerNotice` を出す境目（20%）と、閉じたら同じ日に出さないかどうかを、利用の様子を見て決める。
