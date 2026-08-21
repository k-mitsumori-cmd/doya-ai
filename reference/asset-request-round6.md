# ドヤマーケAI 残作業 一括依頼（第6弾）

作成: 2026-08-21
対象: ドヤマーケAI（`doya-ai.surisuta.jp` / 09_Cursol）内のみ
要件の正本: `reference/asset-gap-and-requirements.md`
既存の依頼書: 第2弾 `asset-request-round2.md` ／ 第3弾 `round3` ／ 第4弾 `round4` ／ 第5弾 `round5`

---

## 0. 全体像

第1〜4弾でロゴ・アイコン・ヒーロー・カード・OGP・スクショ・仕組み図・自社利用実績は
完了し、本番稼働中。**残っているのは以下の5件**（2026-08-21 実測）。

| ID | 内容 | 規模 | 優先 | 状態 |
|---|---|---|---|---|
| R6-A | 正方形ロゴ4点の横長化 | 4点 | P0 | 依頼書あり（`round5`）。配色は **A（現状維持）で決着**（2026-08-21 一任） |
| R6-B | 空状態の展開 | 7画面 | P1 | **完了**（2026-08-21）。当初10画面としたが実体を見て7画面に絞った |
| R6-C | 絵文字の置換 | 131ファイル / 508箇所 | P1 | `icons.tsx` は完成済み。置換が未着手 |
| R6-D | 旧ブランド紫の置換 | 503箇所 | P2 | — |
| R6-E | ユースケース シーン画像 | 34点 | — | **作らない判断**（2026-08-21 一任）。箇条書きで成立しており、各LPには既にヒーロー・スクショ3枚・仕組み図がある |

### 重要な前提

**公開されている面（トップページ・17サービスのLP・LPキット）は、絵文字も旧紫も
すでに0箇所**で、クリーンな状態にある。R6-C と R6-D が残っているのは
**すべてログインの内側のツールUI**。緊急度は件数の見た目ほど高くない。

---

## 1. R6-A: 正方形ロゴ4点の横長化 【P0】

詳細は **`reference/asset-request-round5.md`** に記載済み。ここでは要点のみ。

- 対象: `banner` / `seo` / `interview` / `persona`（2048×2048 のまま残っている4点）
- 目標: 2016×864 / PNG透過 / 150KB以下
- 方式: **日本語ロゴタイプは生成せず、既存ロゴから画素ごと切り出して合成する**
  （第4弾で丸ごと生成を試し、banner が「ドヤバー・A」に破綻して4点とも不採用）
- 軽量化: `sharp().png({ palette: true, colors: 128, quality: 60, effort: 10, dither: 0 })`

### 配色の決着: A（現状維持）

2026-08-21 に一任を受け、**A（配色はそのまま・寸法だけ直す）** を採用した。

理由は2つ。合成方式ではロゴタイプと既存の絵をそのまま使うため、配色を変えると
絵の部分を作り直すことになり、第4弾で失敗した生成の不確実性を再び抱え込む。
また既存ユーザーの見え方を変えずに、並びの不揃いという実害だけを消せる。

⚠️ ただし `persona` の紫は旧ブランド `#7f19e6` に近く、R6-D の置換方針とは
逆行したまま残る。ロゴの配色見直しは、R6-D が片付いた後に別件として扱う。

---

## 2. R6-B: 空状態の展開 【P1・新規制作なし】

`EmptyState` コンポーネントと `public/empty/*.svg` 6点は完成済み。
現在の適用は **4画面のみ**で、公開17サービスの一覧・履歴画面の大半が
素のテキスト表示のまま。

### 対象10画面

```
src/app/persona/history/page.tsx
src/app/cunning/history/page.tsx
src/app/kintai/employees/page.tsx
src/app/aishodan/sessions/page.tsx
src/app/doyalist/history/page.tsx
src/app/interview/projects/page.tsx
src/app/adimage/history/page.tsx
src/app/hr/employees/page.tsx
src/app/interview/projects/new/page.tsx
src/app/hr/employees/new/page.tsx
```

適用済み: `doyaslide/projects` / `banner/dashboard/history` / `quote/Tool` / `seo/jobs/[id]`

### 仕様

| 項目 | 内容 |
|---|---|
| 使い方 | `import { EmptyState } from '@/components/EmptyState'` |
| 種類 | `not-generated` / `zero` / `no-results` / `error` / `forbidden` / `preparing` |
| 使い分け | 生成物がまだ無い→`not-generated`／登録が0件→`zero`／絞り込み結果が0件→`no-results` |
| 文言 | `title` は名詞止めを避け、次の行動が分かる一文にする。`description` は任意 |
| 導線 | 可能なら `action` に「作成する」等のボタンを渡す。行き止まりにしない |
| 新規制作 | **不要。**SVG6点は配置済み |

---

## 3. R6-C: 絵文字の置換 【P1】

グローバル規約「UIに絵文字アイコンを使わない」に反する箇所が
**131ファイル・508箇所**残っている。受け皿の `src/components/icons.tsx`
（Lucideラッパー・24×24 / stroke 1.75 / `currentColor`）は完成済みだが、
**採用しているファイルは1つだけ**で置換がほぼ手つかず。

### 置換の優先順（多い順）

| ファイル | 箇所 |
|---|---|
| `src/app/doyalist/history/page.tsx` | 22 |
| `src/app/cunning/live/[sessionId]/page.tsx` | 20 |
| `src/app/banner/test/page.tsx` | 17 |
| `src/app/seo/create/page.tsx` | 13 |
| `src/components/promane/task-edit-modal.tsx` | 12 |
| `src/app/shodan/[orgSlug]/p/[id]/page.tsx` | 11 |
| `src/components/promane/task-create-form.tsx` | 10 |
| `src/components/AIAssistant.tsx` | 10 |
| `src/app/admin/users/page.tsx` | 10 |

### 対応表（頻出24種 → `UiIcon` の name）

| 絵文字 | 箇所 | name | 絵文字 | 箇所 | name |
|---|---|---|---|---|---|
| ✓ | 26 | `check` | 🚀 | 10 | `rocket` |
| 💡 | 24 | `idea` | 🧠 | 8 | `idea` |
| ✨ | 24 | `sparkle` | 🔄 | 8 | `refresh` |
| 🎉 | 21 | `celebrate` | 👥 | 8 | `users` |
| 👤 | 20 | `user` | 🎬 | 8 | `image` |
| 🎨 | 20 | `palette` | ✅ | 8 | `done` |
| 📝 | 18 | `note` | 📍 | 7 | `target` |
| 📊 | 16 | `chart` | 📈 | 7 | `chart` |
| 📋 | 14 | `list` | 💼 | 7 | `building` |
| 🔍 | 13 | `search` | 💬 | 7 | `note` |
| 🏢 | 13 | `building` | 🎙 | 7 | `phone` |
| 🎯 | 12 | `target` | 📅 | 11 | `calendar` |

`icons.tsx` に用意済みの name は次の32種。表に無い絵文字はここから選ぶ。

```
check sparkle idea palette celebrate note chart user search list target rocket
building calendar done phone cart users food home book finance health laptop
wand energy trophy warning image document link refresh
```

### 規約

| 項目 | 内容 |
|---|---|
| 置換先 | `<UiIcon name="..." size={16} />` 等。サイズは元の絵文字の見え方に合わせる |
| 色 | `currentColor` なので親のテキスト色を継承する。個別指定しない |
| 意味が無い場合 | Lucide に該当が無ければ `icons.tsx` に追加する。**新規SVGの自作は最後の手段** |
| **触らない** | トップページ・17サービスのLP・LPキット（既に0箇所） |
| 装飾目的の絵文字 | アイコン化せず**削除**してよい。無理に絵を当てない |

---

## 4. R6-D: 旧ブランド紫の置換 【P2】

`#7f19e6` が **503箇所**。2026-06のリブランドで `#0066ff` へ移行済みだが、
既存サービス内のUIに残っている。

### 分布（ファイル数）

| 範囲 | ファイル数 |
|---|---|
| `interview` 配下 | 14（＋ `components/interview` 4） |
| `kintai` 配下 | 13（＋ `components/kintai` 3） |
| `api` 配下 | 6 |
| `sfa` / `doyaslide` / `components/sidebar` ほか | 各2〜4 |

`interview/projects/[id]/materials/page.tsx` が52箇所で最多。

### 置換規則

| 用途 | 置換先 |
|---|---|
| 基調・主ボタン・リンク | `#0066ff` |
| グラデーションの相方 | `#009bff` または `#00e0ff` |
| 強調・警告寄りのアクセント | `#ff1e72` |
| フォーカスリング | `#0066ff`（透明度は元のまま） |

第1弾で `ToolSwitcherMenu.tsx` を置換済み。**そのときの置換パターンを踏襲する。**

### 注意

- `api` 配下の6ファイルは、生成画像のプロンプトや既定値に色が埋まっている可能性がある。
  UIの色と混同せず、**生成物の見た目が変わらないか確認してから**置換する
- 一括 `sed` で機械的に置くと、グラデーションの相方まで青一色になり階調が消える。
  ファイル単位で見て、上の規則に沿って割り当てる

---

## 5. R6-E: ユースケース シーン画像 34点 【P2】

要件書 `U-xx`。`UseCases` セクション用に17サービス×2枚。当初からP2で未着手。

| 項目 | 仕様 |
|---|---|
| 寸法 | 1200 × 800 |
| 形式 | WebP / 150KB以下 |
| 配置 | `public/<serviceId>/usecases/<n>-<slug>.webp` |
| 内容 | そのサービスが使われる場面。人物を描く場合は **East Asian（日本人・韓国系）の顔**を明示指定 |
| 文字 | **日本語を焼き込まない。**文字はHTML側で出す |
| 実装 | `UseCases` セクションに画像スロットを追加する改修が前提 |
| 判断 | **作らない**（2026-08-21 決着）。`UseCases` は箇条書きで成立しており、各LPには既にヒーロー1点・スクショ3点・仕組み図1点がある。34点を足しても1画面あたりの情報密度が上がるだけで、伝達は改善しない。要件書 `U-xx` は取り下げる |

---

## 6. 共通規約

- 絵文字を使わない（UI・画像内とも）
- 画像に日本語テキストを焼き込まない。文字は HTML / SVG 側で後乗せ
- 人物は East Asian（日本人・韓国系）の顔を明示指定
- 基調は `#0066ff`。アクセントは `#ff1e72` / `#ffd400` / `#00e0ff` / `#009bff` から1色
- 画像生成は `generateImageWithFallback()` 経由（直接API呼び出しは禁止）
- 透過が要る用途は `background: 'transparent'` を明示的に渡す（既定は不透過）
- アイコンは `lucide-react` が正本。`src/components/icons.tsx` のラッパーを使う。
  LPキット内の Material Symbols は互換維持のため凍結し、新規追加しない
- `logo.webp` は作らない（パレットPNGより大きく、コードからも参照されていない）
- 検証は `npx tsc --noEmit` ＋ `npx next build`。自動テストは無い

---

## 7. 着手順

1. **R6-A** — 配色判断（A / B）を受けてから4点を制作。並びの不揃いが消える
2. **R6-B** — 10画面の配線。新規制作ゼロで体験が揃う
3. **R6-C** — 絵文字508箇所。多い順に潰す
4. **R6-D** — 旧紫503箇所。`interview` と `kintai` に集中しているので2サービス単位で
5. **R6-E** — 必要性を見極めてから判断

## 8. 判断が要る項目

2026-08-21 に一任を受け、**判断待ちの項目は無くなった**。

| ID | 決着 |
|---|---|
| R6-A | A（配色は現状維持・寸法だけ直す） |
| R6-E | 作らない。要件書の `U-xx` は取り下げ |
