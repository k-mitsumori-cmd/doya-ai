# ドヤシリーズ アセット制作依頼 第2弾

作成: 2026-08-19 ／ 要件の正本: `reference/asset-gap-and-requirements.md`
第1弾の制作メモ: `reference/generated-assets/2026-08-19-p0-v1/README.md`

## 0. 第1弾で入ったもの（配線済み）

| ID | 内容 | 状態 |
|---|---|---|
| B-01 | 白クマのブランドアイコン（master.svg ＋ 6サイズ） | 配置・配線済み。壊れていたファビコンを置換 |
| L-01〜04 | 新4サービスの横長ロゴ | 配置・`SERVICE_LOGO` 登録済み |
| I-14〜17 | 新4サービスの正方形アイコン | 配置済み（未配線） |
| H/C/O-14〜17 | 新4サービスのヒーロー・カード・OGP背景 | 配置・配線済み |
| H/C/O（既存6件） | banner / hr / kintai / sfa / shodan / aio | 配置・配線済み |
| M-01 | マスコット 256/512 WebP | 配置・`next/image` 配線済み |

---

## 1. 最優先: トップページの見た目が割れている（第1弾の副作用）

カードサムネの配線を入れたことで、`/` のサービス一覧が **画像カード10枚 ＋ アイコンタイル7枚** の混在になった。7件だけ明らかに見劣りするため、揃えるまでが1セット。

対象7件: `seo` / `interview` / `persona` / `doyalist` / `doyaslide` / `cunning` / `promane`

### ⚠️ ただし画像制作の前にコード作業が要る

これらは「実画面キャプチャを基材にする」という要件（H-xx）を満たせない状態にある。第1弾で保留されたのはこのため。

| サービス | 障害 | 先に必要な作業 |
|---|---|---|
| seo / interview / persona / doyalist / cunning | 固有 `mocks.tsx` が無く、汎用 `ServiceFeatureMock`（箇条書き）しか描画されない＝撮る画がない | `F-04` 各サービスの `mocks.tsx` 新設 |
| doyaslide | LP自体が存在しない | `F-02` LP新設（LpShell構成） |
| promane | 旧構成（`Hero` + `FeatureGrid`）で `ProductHero` を使っていない＝`image` スロットが無い | `F-03` `ProductHero` / `FeatureShowcase` へ移行 |

**依頼の順序**: `F-02〜F-04`（コード）→ ローカルで実画面を撮影 → `H/C/O-01〜07`（画像21点）。

### 依頼 R2-A: 既存7サービスの H / C / O（21点）

| 項目 | 仕様 |
|---|---|
| 対象 | seo / interview / persona / doyalist / doyaslide / cunning / promane |
| 成果物 | 各サービス `hero.webp`（1600×1000）／`hero@2x.webp`（3200×2000）／`card.webp`（800×500）／`og-bg.webp`（1200×630） |
| 容量 | hero 300KB以下／card 120KB以下 |
| 配置 | `public/<serviceId>/` |
| 作り方 | 第1弾と同じ。`http://localhost:3017/<serviceId>` の実描画を Chrome で2xキャプチャ → ブランド背景へ配置 → Sharp で WebP 化 |
| 配線 | `page.tsx` の `SERVICE_CARD_IMAGE`、`og/[...slug]/route.tsx` の `OG_BG_SERVICES`、各LPの `image` プロップに追加 |
| 優先 | **P0**（トップページの不揃いが見えているため） |

---

## 2. 依頼 R2-B: 既存13サービスの正方形アイコン（`I-01〜13`）

現状 `public/<id>/icon.png` があるのは新4サービスのみ。既存13件が欠けている。

| 項目 | 仕様 |
|---|---|
| 対象 | banner / seo / interview / persona / hr / kintai / doyalist / doyaslide / cunning / promane / sfa / shodan / aio |
| 寸法 | 512×512（1024で出力して縮小） |
| 形式 | PNG 透過、80KB以下 |
| 配置 | `public/<serviceId>/icon.png`（1024版は `reference/generated-assets/.../<id>/icon-1024.png`） |
| 内容 | **文字を入れない。**16pxで判別できること |
| 作り方 | 既存の `public/<id>/logo.png` から白クマの同一性と太いアウトラインを維持して派生（第1弾と同じ手順が使える） |
| 注意 | 既存ロゴは 2048×2048 系と 2016×864 系が混在している。アイコン化のときにシンボル部だけを切り出して正方形に整える |
| 優先 | P1 |

## 3. 依頼 R2-C: サービス別ファビコン（`B-02`／17件・コード作業のみ）

| 項目 | 仕様 |
|---|---|
| 前提 | R2-B（I-01〜13）の完了 |
| 作業 | 各サービスに `src/app/<serviceId>/icon.png` を置く（App Router の静的ファイル規約）。新規画像制作は不要で、I-xx をそのまま複製する |
| 効果 | 複数ツールをタブで並べたときに見分けがつく |
| 優先 | P2 |

## 4. 依頼 R2-D: 共通UIアイコンセット（`N-01`）

第1弾では未着手。現状も **絵文字が134ファイルに残存**（✓77／✨34／💡33／🎨31／🎉29 ほか）。

| 項目 | 仕様 |
|---|---|
| 形式 | SVG を React コンポーネント化し `src/components/icons.tsx` に集約（このファイルは未作成） |
| 規格 | 24×24 ビューボックス／ストローク 1.75px／線端 round／`currentColor` |
| 初期セット | 約20種 — `check` `sparkle` `idea` `palette` `celebrate` `note` `chart` `user` `search` `list` `target` `rocket` `building` `calendar` `done` ほか |
| 先に決めること | **`F-07` アイコンライブラリの正。** lucide-react 237ファイル vs Material Symbols 171ファイル。規約は後者だが実態は前者が多数 |
| 置換順 | `banner/dashboard/create`（64箇所）→ `seo/jobs/[id]`（48）→ `banner/dashboard`（25）→ 以降 |
| 触らない | LP・トップページ・LPキットは絵文字ゼロで既にクリーン |
| 優先 | P1 |

## 5. 依頼 R2-E: 空状態イラスト（`E-01〜06`）

| 項目 | 仕様 |
|---|---|
| 寸法 | 400×320／SVG |
| 種類 | 未生成／0件／検索ヒットなし／エラー／権限なし／準備中 |
| 配置 | `src/components/EmptyState.tsx` に共通化 |
| 省力化 | ドヤくんの既存15ポーズから `thinking` `sleep` `surprise` `error` を割り当てれば新規制作は最小で済む |
| 優先 | P2 |

## 6. 依頼 R2-F: ドヤゲームポータル カード（`P-01〜03`）

| 項目 | 仕様 |
|---|---|
| 対象 | 呪い日記 / ゆるせん / ヒトリジメ |
| 配置 | `~/Code/games/doyagame-portal-live/img/<slug>-art.jpg` |
| 実装 | `index.html` にカード追加 |
| 判断待ち | 3作品は世界観が違うため、ポータルに混ぜるか別導線にするかは**要決定** |
| 優先 | P1 |

## 7. 依頼 R2-G: 機能スクリーンショット（`S-xx`／約60点）

| 項目 | 仕様 |
|---|---|
| 前提 | `FeatureShowcase` の `ShowcaseRow` に画像スロットを追加する改修 |
| 内容 | サービスごと3〜5枚。「入力 → 処理中 → 出力」の3点が最小構成 |
| 寸法 | 1280×800／WebP／80KB以下 |
| 配置 | `public/<serviceId>/shots/<n>-<slug>.webp` |
| 注意 | 実データを写す場合は社名・メール・金額をダミーへ差し替える |
| 優先 | P1 |

---

## 8. 着手順（第2弾）

1. **R2-A の前工程** — `F-04`（mocks 5件）→ `F-02`（doyaslide LP）→ `F-03`（promane 移行）
2. **R2-A** — 7サービスの H/C/O 21点。ここまででトップページの不揃いが解消
3. **R2-B** — 既存13サービスの正方形アイコン
4. **R2-D** — `F-07` の決定 → UIアイコンセット → 絵文字置換
5. **R2-G** — 機能スクリーンショット
6. **R2-C / R2-E / R2-F** — ファビコン・空状態・ゲームポータル

## 9. 判断が要る項目（着手前にユーザー確認）

| ID | 内容 |
|---|---|
| F-07 | アイコンライブラリの正を Lucide と Material Symbols のどちらにするか |
| P-xx | 呪い日記 / ゆるせん / ヒトリジメ をドヤゲームポータルに載せるか、別導線にするか |
