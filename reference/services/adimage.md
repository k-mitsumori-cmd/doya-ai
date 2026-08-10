# ドヤ広告画像AI（adimage）— 要件定義・設計

> サービスURLを入れるだけで、各広告媒体・各配置に**そのまま入稿できる**広告画像セットを自動制作し、
> フィードバックボタンひとつでAIが改善し続ける運用型クリエイティブツール。
> **既存 `/adbanner`（ドヤ広告バナーAI）の次世代版**であり、完成後 `/adbanner` は統合・廃止する。
>
> ステータス: **Phase 1 実装済み / 本番稼働中**（2026-08-08）。本番: https://doya-ai.surisuta.jp/adimage
> ✅ `/adbanner` の統合・廃止は**完了**（2026-08-10・第9章）。308リダイレクト済み。

## 概要

| 項目 | 内容 |
|------|------|
| **サービス名** | ドヤ広告画像AI |
| **serviceId** | `adimage` |
| **パス** | `/adimage` |
| **本番URL（予定）** | `https://doya-ai.surisuta.jp/adimage` |
| **ステータス** | `coming_soon` で開始 → 実装完了・移行完了で `active` |
| **カテゴリ** | image |
| **データスコープ** | **userId / guestId(Cookie) スコープ**（adbanner 同型。組織スコープは Phase 3） |
| **課金** | 統一プラン方式（`User.plan` 単一参照。個別課金なし） |
| **カラー** | `lime`（`from-lime-400 to-green-500` / ACCENT `#65a30d`）※空きカラーから選定 |
| **アイコン** | services.ts: `🖼️` ／ UI: Material Symbols `imagesmode` ／ ToolSwitcher: lucide `Images` |
| **order** | 27（既存の最大が 26） |
| **前身** | `/adbanner`（2026-06-26 本番稼働）を統合・308リダイレクトで廃止 |

---

## 1. なぜ「次世代版」なのか — 既存 `/adbanner` の構造的欠陥

新規に作り直す根拠。いずれも実コードで確認済みで、**部分修正では直らない設計レベルの問題**。

### 欠陥1: AIフィードバックが生成画像を一切見ていない

`src/lib/adbanner/feedback.ts:22-39` は、Gemini に渡しているのが**プロンプト文字列だけ**。

```typescript
'（画像の設計指示＝プロンプトと条件から評価します）',
...
i.prompt.slice(0, 1500),
```

つまり「視認性（文字の可読性）」を採点しているのに、**実際に出た画像を見ていない**。文字が崩れていても、はみ出していても高得点が出る。ユーザーご要望の「フィードバックで改善」の土台そのものが機能していない。

### 欠陥2: 極端なアスペクト比でクリエイティブが破壊される

`src/lib/adbanner/generate.ts:33-37,68` — gpt-image-2 が出せるのは 1024×1024 / 1536×1024 / 1024×1536 の3種のみ。それを媒体実寸へ **`fit: 'cover'` で切り抜いている**。

```typescript
let buf = await sharp(raw).resize(sz.w, sz.h, { fit: 'cover' }).png().toBuffer()
```

728×90（8:1）を 1536×1024（3:2）から cover で切り出すと、**縦の約82%が捨てられる**。見出しもCTAもロゴも残らない。300×250 も同様。GDNサイズは事実上使い物にならない。

### 欠陥3: 焼き込んだ文字を検証しないまま出している

文字を画像に焼き込むこと自体は正しい（実測でも gpt-image-2 の日本語再現は良好だった）。問題は**焼き込んだ結果を一切検証していない**こと。
確率的に生成された文字が指定どおり描かれたか・指定外の文字が混入していないかを確認する仕組みがなく、崩れた画像がそのままユーザーに出る。
さらに欠陥②の切り抜きが重なるため、**正しく描かれた文字を後段で自ら破壊している**。

> 本サービスは「焼き込みは維持したまま、**切り抜きを廃止し、検証を追加する**」ことでこれを解決する（第2章）。

### 欠陥4: 改善指示が構造化されていない

`src/app/api/adbanner/refine/route.ts:38-39` — フィードバックの `advice` を文字列として `appeal` に連結しているだけ。

```typescript
const appeal = [base.campaign.appeal, advice ? `改善指示: ${advice}` : ''].filter(Boolean).join(' / ')
```

何を指示したか／それが効いたかを後から追えない。世代を重ねるほど指示が文字列として積み上がり、意図が薄まる。学習も比較もできない。

### 結論

「URLを入れると媒体別画像が出る」という**外形は同じでも、中身は作り直しが必要**。次世代版はこの4点を設計の起点にする。

---

## 2. コアコンセプト — フルベイク（テキスト込み完全生成）方式

**確定方針: テキストを含めて画像生成AIに一枚絵として描かせる。後からテキストを重ねる合成は行わない。**
オーバーレイ合成はデザインの一体感が失われ、クオリティが落ちるため採用しない。

### 2.1 実測による裏付け（2026-08-06 実API検証）

この方針が成立するかを、設計前に実際のAPIで検証した。結果は**完全に成立する**。

| 検証項目 | 結果 |
|---------|------|
| gpt-image-2 の対応サイズ | **幅・高さが16の倍数なら任意サイズ可**（3プリセット固定ではない） |
| アスペクト比の上限 | **厳密に 3:1**（`1792x592`=3.03:1 は400拒否 / `1536x512`=3.00:1 は受理） |
| 真の9:16生成 | **`1152x2048` で成功**（比率 0.5625 = 正確な 9:16） |
| 日本語テキストの再現 | **完璧**。「もう広告に悩まない」「URLを入れるだけ」「無料ではじめる」を字形崩れ・誤字なく描画 |
| セーフエリア指示の遵守 | **有効**。「縦10分割して上1〜2・下9〜10に文字を置かない」で文字が中央60%に収まった |
| 生成時間 | 1152×2048 で medium **38秒** / high **93秒** |

実際に返ってきたエラーメッセージ（一次情報）:
```
Invalid size '1080x1920'. Width and height must both be divisible by 16.
Invalid size '1792x592'. The maximum supported aspect ratio is 3:1.
```

### 2.2 「切り抜かない」ための生成サイズ設計

既存 adbanner の破綻原因は、3プリセットから `fit:'cover'` で切り抜いていたこと。次世代は**切り抜きを一切しない**。

```
1. 目標サイズ（例 1080×1920）と同じアスペクト比で、
   幅・高さともに16の倍数、かつ目標以上の解像度の「生成サイズ」を選ぶ
     → 1152×2048（正確に 9:16、1080×1920 より大きい）
2. その生成サイズでテキスト込みで生成する
3. 目標サイズへ「純粋な縮小」だけで書き出す（クロップなし・アスペクト維持）
     → 1152×2048 → 1080×1920
```

縮小なので**文字はむしろシャープになる**。切り取られる領域が存在しないので、文字切れが原理的に起きない。

### 2.3 品質保証は「合成」ではなく「検証と再生成」で担保する

テキストを焼き込むと後から直せないため、**出力を検査して不合格なら作り直す**ループで品質を守る（第5章 5.4）。
- 指定した文字列が正しく描かれたかを **OCR照合**（Gemini Vision）で判定
- セーフエリア侵食・禁止テキスト混入を判定
- 不合格は自動リトライ（最大2回）。ユーザーには合格したものだけ見せる

---

## 3. ターゲット / ユースケース

- 広告運用担当・マーケター — Meta / Google のクリエイティブを毎週差し替える人
- 中小企業の1人マーケ・経営者 — デザイナーに頼まず自分で入稿物を揃えたい人
- 代理店 — クライアント別・キャンペーン別に量産して回す人

**中心的な体験**: 「URLを貼る → 30秒後に Meta / Google / Instagram 各配置のサイズが揃った広告画像セットが出る → 気に入らないものはボタンを押すだけで直る」

---

## 4. 入力 → 出力

```
入力: サービスURL（必須・これだけで開始できる）
      ＋ 任意: ブランドカラー / ロゴ / 訴求軸 / 配信媒体・配置の選択
   ↓ analyze-url
ブランド抽出: サービス名・説明・提供価値・ブランドカラー・ロゴ候補・トーン（Gemini）
   ↓ copy（Gemini）
コピー確定: 見出し / サブコピー / CTA を訴求軸×トーンで生成（文字数上限つき）
   ※ 画像生成の前にコピーを確定させる。全アスペクトで同一コピーを使い、コンセプトの一貫性を保つ
   ↓ generate（gpt-image-2 / テキスト込みフルベイク）
各アスペクトごとに「16の倍数・目標以上」の生成サイズで、テキストを焼き込んだ一枚絵を生成
   ↓ verify（自動検査）
OCR照合（指定文字列と一致するか）＋ セーフエリア侵食 ＋ 余計な文字の混入 → 不合格は自動再生成（最大2回）
   ↓ export-size
目標サイズへ純粋な縮小のみで書き出し（クロップなし）→ 実寸PNG
   ↓ feedback
AI採点（Visionで実画像を採点）＋ 決定的チェック（コントラスト / セーフエリア / OCR一致率）
   ↓ refine（フィードバックボタン）
構造化された改善指示（RefineDirective）を前回プロンプトに差分適用して次世代を生成
   ↓ export
媒体別フォルダに整理した ZIP で一括ダウンロード（そのまま入稿）
```

---

## 5. 機能仕様

### Phase 1（MVP・初回実装範囲）

#### 5.1 URLクイックスタート
- サービスURLのみで開始。スクレイプ → Gemini でブランド情報を構造化抽出
- 抽出項目: サービス名 / 説明 / 提供価値 / ブランドカラー（CSS・OG画像から）/ ロゴ候補URL / 業種 / トーン
- 抽出結果は**編集可能**（AIの推測を押し付けない）
- 抽出したブランドは `AdImageBrand` として保存し、次回以降は選ぶだけで使える（毎回URLを入れ直さない）

#### 5.2 コピー確定（画像生成より先に行う）
- 訴求軸（ベネフィット / 限定・緊急 / 権威・実績 / 共感・課題提起 / 価格 / 無料お試し）× トーンで N パターン
- **文字数上限を Gemini に渡す**（見出し 全角13字以内 / サブ 全角16字以内 / CTA 全角8字以内）
  - 上限の根拠: 焼き込みは文字数が増えるほど字形が崩れやすく、9:16では横幅も限られる。**短いほど再現性が上がる**
- コード側で文字数を検証し、超過は自動短縮
- 禁止表現チェック（薬機法・景表法まわりの誇大表現を簡易フィルタ）
- **確定したコピーは全アスペクトで共通**。同一コンセプトの一貫性を保つ

#### 5.3 フルベイク画像生成（テキスト込み）

`generateImageWithFallback()` 経由（**直接API禁止**）。メイン gpt-image-2。

**プロンプト構造（実測で有効性を確認した構成）**
```
1. 媒体・配置・アスペクトの宣言   「Instagram/Facebookストーリーズ広告。縦長9:16のフルブリード構図」
2. ブランド・トーン・配色         「青(#0066ff)基調、明るく信頼感がありモダン」
3. 全面デザイン指示               「画面全体をデザインで埋める（白い余白帯を作らない）」
4. ■描画するテキスト（鍵括弧で厳密に指定）
     大見出し（最も大きく、2行）: 「もう広告に悩まない」
     サブコピー（中サイズ）:       「URLを入れるだけ」
     CTAボタン（角丸ボタン内の白文字）: 「無料ではじめる」
5. ■配置ルール（セーフエリア）    ← 9:16で最重要。下記 5.3.1
6. 書体・コントラスト指示         「太いゴシック体で、背景とのコントラストを強く」
7. 禁止事項                       「指定した3つ以外の文字・数字・ロゴは描かない」
```

**効いたポイント（実測）**
- テキストを**鍵括弧で囲って項目名つきで列挙**すると、指定どおりに描かれる
- 「指定した3つ以外の文字を描かない」を明記しないと、それらしい英字ダミーテキストが混入する
- 「画面全体をデザインで埋める（白い余白帯を作らない）」を入れないと、上下に無地の帯を作って中央にカードを置く構図になり、**縦長の面積を活かせない**（1回目の検証で実際に発生した）

#### 5.3.1 縦長 9:16（Facebook / Instagram ストーリーズ・リール）の作り方

本サービスで最も難易度が高く、かつ需要が高い配置。以下を確定仕様とする。

**(a) 生成サイズ: `1152x2048`**
- 1152 ÷ 16 = 72、2048 ÷ 16 = 128 → **両方16の倍数**（APIの必須条件を満たす）
- 1152 : 2048 = **正確に 9:16**（0.5625）。1080×1920 と完全に同じ比率
- 目標の 1080×1920 より大きいので、書き出しは**縮小のみ・クロップなし**
- 比率 1.78:1 は上限 3:1 の内側なので受理される
- ※ `1080x1920` を直接指定すると `Width and height must both be divisible by 16` で400になる。**必ず 1152×2048 で生成すること**

**(b) セーフエリア指示（プロンプトに必ず含める）**

ストーリーズは上下がアプリUIに隠れる。「上15%・下20%を空ける」と書くと**無地の帯**を作ってしまうため、次の書き方を使う。

```
■ 配置ルール（厳守）:
  画面を縦に10分割したとき、上から1〜2の帯と、9〜10の帯には文字を一切置かない。
  （この領域はSNSアプリのUIに隠れるため。ただし背景デザインは continue させ、無地の白帯にはしない）
  文字はすべて縦方向の中央60%（3〜8の帯）に収める。
  大見出し→サブコピー→CTAボタンの順に上から縦に積む。
```

**「10分割の何番目」という数え方で指示するのが要点**。パーセント指定より遵守率が高く、「背景は continue させる」の一文でフルブリードを保てる（実測で文字が縦30〜72%に収まり、上下は装飾のみになった）。

**(c) 縦構図の指定**
9:16は縦に間延びしやすいため、「大見出し→サブ→CTAを上から縦に積む」と**要素順を明示**する。これがないと横並びレイアウトを縦に引き伸ばした構図になりやすい。

**(d) 品質設定**
`quality: 'medium'` を既定とする（実測 38秒）。`high` は 93秒かかり、`maxDuration=300` の中で複数案を回すと破綻する。文字の可読性は medium で十分に確保できている。

#### 5.4 自動検査（フルベイクの品質保証）

焼き込みは後から直せないため、**出す前に検査する**。`src/lib/adimage/verify.ts`

| 検査 | 方法 | 不合格時 |
|------|------|---------|
| **OCR照合** | Gemini Vision に画像を渡し「画像内の文字をすべて書き出せ」→ 正規化して指定文字列と比較 | 再生成 |
| **余計な文字の混入** | OCR結果に指定外の文字列がないか | 再生成 |
| **セーフエリア侵食** | Gemini Vision に「各テキストの位置を0〜1の正規化座標(ymin,ymax)で返せ」→ 9:16なら 0.2〜0.8 の外に出ていないか | 再生成 |
| **コントラスト** | 文字領域と周辺の輝度差を Sharp で実測 | 警告表示 |

- リトライは**最大2回**（`maxDuration=300` を超えないため）。2回とも不合格なら「要確認」フラグ付きで提示する（黙って捨てない）
- 正規化は全角/半角・空白・約物を吸収して比較する（OCRの表記ゆれで誤判定しないため）

#### 5.5 目標サイズへの書き出し
- 生成サイズ → 目標サイズは **純粋な縮小のみ**（`sharp().resize(w, h)`、クロップなし）
- 比率が完全一致しない配置（1.91:1 など）のみ `fit:'fill'` を使うが、**歪みは0.6%未満**に収まる組み合わせだけを採用する（第6章の表で担保）
- 1コンセプトにつき、選択した配置のアスペクト種類ぶんだけ生成する（同一アスペクトの複数配置は1回の生成を使い回せる）

#### 5.6 ロゴの扱い（⚠️ 唯一の例外・要判断）

**ロゴだけは合成を維持することを推奨する。** テキストと違い、ロゴは1pxの狂いも許されないブランド資産で、画像生成AIには原理的に正確な再現ができない（形状・字間・色が必ず変わる）。

- プロンプトで**ロゴ用のセーフゾーン**（例: 右下に無地に近い領域）を確保させ、生成後に実ロゴを Sharp で合成する
- 背後の平均輝度を測り、コントラスト不足なら自動で下敷きプレートを敷く
- **「ロゴなし」も選択可能**にする。SNS広告は配信時にアカウント名・アイコンが必ず表示されるため、ロゴ未挿入でも成立する

> テキストのオーバーレイは行わない（本方針の中核）。ロゴのみ例外扱いとする。この例外を認めない場合は「ロゴなし」運用となる。

#### 5.7 AI自動フィードバック（実画像ベース）
2系統を必ず併用する。

**(a) 準決定的チェック** — `src/lib/adimage/inspect.ts`
検査に使った Vision のバウンディングボックス（5.4）を再利用して算出する。焼き込み方式ではレイアウト値が手元にないため、**座標はVisionから取得し、そこから先の計算はコードで行う**（採点のブレを抑える）。

| 指標 | 内容 |
|------|------|
| OCR一致率 | 指定文字列と実際に描かれた文字の一致度（0〜100%）。**焼き込み方式の最重要指標** |
| テキスト占有率 | Vision が返したテキスト矩形の面積合計 ÷ 画像面積（%） |
| セーフエリア侵食 | 9:16 で文字が 0.2〜0.8 の外に出ていないか |
| コントラスト比 | 文字領域と周辺の輝度差を Sharp で実測（WCAG式）。4.5:1 未満を警告 |
| ロゴ可視性 | ロゴ領域のコントラスト（ロゴ合成時のみ） |

**(b) Vision採点（Gemini に実画像を渡す）** — `src/lib/adimage/feedback.ts`
- `geminiGenerateText({ parts: [{ inlineData: { mimeType:'image/png', data: base64 } }, { text: rubric }] })` で**生成された実画像そのもの**を評価
  - ※ `seo/lib/gemini.ts:218` の `Part` 型が `inlineData` に対応済み。`geminiGenerateJson` はテキスト専用のため、Vision は `geminiGenerateText` + JSON抽出で実装する
- 観点: 視認性 / 訴求の強さ / CTA明確さ / 媒体適合 / ブランド整合 を各100点 + 総合 + 改善提案
- 入力画像はサムネ（長辺768px程度）に縮小して渡す（トークン・帯域の節約）

#### 5.8 フィードバックボタン（ご要望の中核）
「押すだけで直る」ための3系統。**すべて同一の `RefineDirective` に正規化**して `refine` へ流す。

| 種別 | UI | 例 |
|------|-----|-----|
| ワンクリック定型 | チップボタン | 「文字を大きく」「訴求をもっと強く」「情報を減らす」「色を明るく」「CTAを目立たせる」「別の構図で」 |
| 自由記述 | テキスト入力 | 「もっと20代女性向けの雰囲気に」 |
| AI提案の採用 | 採点結果の advice に「これで直す」ボタン | 決定的チェック違反は**自動で directive 化**（例: コントラスト不足 → `textColor: 'auto-contrast'`） |

**RefineDirective（構造化改善指示）**
```typescript
interface RefineDirective {
  ops: Array<
    | { op: 'emphasizeText'; target: 'headline'|'sub'|'cta'; degree: 'more'|'much_more' }
    | { op: 'rewriteCopy';   target: 'headline'|'sub'|'cta'; instruction: string }
    | { op: 'changeAppealAxis'; axis: string }
    | { op: 'adjustVisual';  instruction: string }   // 「別の構図で」「もっと明るく」
    | { op: 'reduceElements' }                        // 情報を減らす
    | { op: 'boostContrast' }
  >
  note?: string  // 自由記述の原文
}
```

**適用方式: プロンプト継承 + 差分適用**

フルベイクでは層の部分差し替えができないため、改善は**必ず画像の再生成**になる。ただし毎回ゼロから作るのではなく、
**前回の完全なプロンプト（`AdImageConcept.visualPrompt` に保存）を土台に、directive を該当セクションへ差分適用**して再生成する。

| ops | プロンプトのどこに効かせるか |
|-----|---------------------------|
| `emphasizeText` | 「4. 描画するテキスト」の該当項目のサイズ記述を強める（例: 中サイズ → 画面幅いっぱいの特大） |
| `rewriteCopy` | コピーを再生成して「4.」を差し替え（他セクションは完全に据え置き） |
| `changeAppealAxis` | コピーを別訴求軸で作り直し「4.」を差し替え |
| `adjustVisual` | 「2. ブランド・トーン・配色」に追記 |
| `reduceElements` | 「7. 禁止事項」に「装飾要素を減らし余白を増やす」を追記、サブコピーを省略 |
| `boostContrast` | 「6. 書体・コントラスト指示」を強化 |

**プロンプトの他の部分を一切変えない**ことで、「別物になった」ではなく「同じ案が良くなった」と感じられる出力になる。

改善版は `generation + 1` / `parentId` で系譜を残し、`AdImageFeedback` に directive・採点・OCR一致率を保存する。**何を指示して何点が何点になったか**が全部残る。

> ⚠️ 焼き込み方式では、どの改善も生成枚数を消費する（レイヤー方式のような「無料の再描画」は存在しない）。この前提でプラン上限を設計する（第8章）。

#### 5.9 一括エクスポート
- 媒体別・配置別フォルダに整理した ZIP でダウンロード（`meta/feed_1080x1080.png` 等）
- ファイル名に コンセプト名・訴求軸・世代 を含め、入稿時に判別できるようにする

### Phase 2（改善ループの完成）

- **実績数値の投入**: 配信実績（imp / click / CTR / spend / CV / CPA）を手入力・CSV取込
- **勝ち要素分析**: 実績 × 採点 × directive を突き合わせ、「効いた訴求軸・配色・レイアウト」を抽出
- **勝ちパターン継承の次世代量産**: 上位クリエイティブの要素を引き継いで自動量産
- **世代比較ビュー**: 世代ごとのスコア推移・CTR推移

### Phase 3（候補）

- 組織スコープ化（チーム招待・クライアント別ワークスペース。sfa/aio の `access.ts` 型を移植）
- 広告媒体APIとの連携（実績自動取得）
- 動画クリエイティブ（静止画→短尺化）
- 自動スケジュール量産（週次で新案を自動生成しSlack通知）

---

## 6. 媒体・配置・サイズ定義

### 6.1 設計方針
既存 adbanner は「媒体 → サイズ」の2階層だったが、実務は**配置（placement）単位**で入稿する。次世代は **媒体 → 配置 → サイズ** の3階層で持つ。

> ⚠️ 媒体レギュレーションは頻繁に変わる。定数は `src/lib/adimage/placements.ts` **1ファイルに集約**し、コード各所にベタ書きしない。

### 6.2 配置プリセット（Phase 1 実装分）

**生成サイズは「16の倍数・3:1以内・目標以上・比率一致」を全て満たす値を事前計算して固定する。**
これにより書き出しは常に純粋な縮小のみとなり、クロップによる文字切れが原理的に起きない。

| 媒体 | 配置 | 目標サイズ | 比率 | **生成サイズ** | 検証 | 構図 |
|------|------|-----------|------|--------------|------|------|
| Meta（Instagram） | ストーリーズ／リール | 1080×1920 | 9:16 | **1152×2048** | 完全一致・実測OK | vertical-stack |
| Meta（Instagram） | フィード縦 | 1080×1350 | 4:5 | **1088×1360** | 完全一致 | hero-center |
| Meta（Facebook） | フィード | 1080×1080 | 1:1 | **1216×1216** | 完全一致 | hero-center |
| Meta（Facebook） | フィード横長 | 1200×628 | 1.91:1 | **1280×672** | 歪み0.32% | split-left |
| Google | レスポンシブ スクエア | 1200×1200 | 1:1 | **1216×1216** | 完全一致 | hero-center |
| Google | レスポンシブ 横長 | 1200×628 | 1.91:1 | **1280×672** | 歪み0.32%・実測OK | split-left |
| Google | レスポンシブ 縦長 | 960×1200 | 4:5 | **1088×1360** | 完全一致 | hero-center |
| Google（GDN） | レクタングル | 300×250 | 6:5 | **960×800** | 完全一致 | compact |
| Google（GDN） | ワイドスカイスクレイパー | 300×600 | 1:2 | **1024×2048** | 完全一致 | vertical-stack |
| X | 画像ポスト | 1600×900 | 16:9 | **2048×1152** | 完全一致 | split-left |
| LINE | Card | 1200×628 | 1.91:1 | **1280×672** | 歪み0.32% | split-left |
| LINE | Square | 1080×1080 | 1:1 | **1216×1216** | 完全一致 | hero-center |
| Yahoo!（YDA） | ディスプレイ | 1200×628 | 1.91:1 | **1280×672** | 歪み0.32% | split-left |

**生成サイズは6種類に集約される**（1152×2048 / 1088×1360 / 1216×1216 / 1280×672 / 960×800 / 1024×2048 / 2048×1152）。
同じ生成サイズを共有する配置は**1回の生成を使い回せる**ため、全配置を選んでも生成回数は最大7回に収まる。

> ご要望の「Facebook / Instagram」は Meta の配置として整理している（別媒体ではなく同一媒体の別配置。入稿先も Meta 広告マネージャで共通）。

### 6.2.1 ⚠️ Phase 1 で対応できない配置（3:1超過）

gpt-image-2 の**アスペクト比上限が厳密に 3:1** のため、以下は焼き込み方式では生成できない（実測で400拒否を確認）。

| 配置 | サイズ | 比率 | 判定 |
|------|--------|------|------|
| Google（GDN） リーダーボード | 728×90 | 8.09:1 | ✗ 生成不可 |
| Google（GDN） モバイルバナー | 320×100 | 3.20:1 | ✗ 生成不可 |

**対応方針: Phase 1 では非対応とする。** 現在の Google 広告はレスポンシブディスプレイ広告が主流で、
**1.91:1 / 1:1 / 4:5 の素材を入稿すれば、リーダーボードを含む各枠へ自動でフィットして配信される**ため、
固定サイズの 728×90 を個別に用意する実務上の必要性は小さい。

どうしても必要になった場合の選択肢（Phase 2 で判断）:
- (a) 3:1 で生成して左右に背景色を延長する（純粋な拡張。文字は触らない）
- (b) この2サイズのみテキスト合成方式にする（フルベイク方針の例外を作る）

### 6.3 構図プリセット（プロンプト断片）

レイヤー方式ではないため、これらは**コード上のレイアウト定義ではなくプロンプトの断片**として持つ。
`src/lib/adimage/compositions.ts` に集約する。

| 構図 | 用途 | プロンプトで指示する内容 |
|------|------|------------------------|
| `vertical-stack` | 9:16 / 1:2 | 縦10分割の3〜8帯に、大見出し→サブ→CTAを上から縦に積む。上1〜2・下9〜10は背景装飾のみ |
| `hero-center` | 1:1 / 4:5 | 画面中央に大見出し、その下にサブ、最下部にCTAボタン。上下左右8%は文字を置かない |
| `split-left` | 1.91:1 / 16:9 | 左半分にテキストを縦積み、右半分にグラフィカルなビジュアル。左右端8%は文字を置かない |
| `compact` | 300×250 等の小面積 | 見出し1行とCTAのみ。**サブコピーは描かない**（小面積に3要素を入れると潰れる） |

各構図は **セーフエリアの指示文 / 要素の並び順 / 省略する要素** を定義する。小面積では要素を落とす（詰め込まない）。

### 6.4 レギュレーション指標

| 指標 | 基準 | 備考 |
|------|------|------|
| テキスト占有率 | 20%以下を推奨として警告表示 | Meta の「20%ルール」は厳格な入稿拒否としては撤廃済みだが、テキスト過多は配信効率に影響する。Google レスポンシブディスプレイ広告も画像内テキスト20%以下を推奨。**入稿拒否ではなく品質警告として扱う** |
| OCR一致率 | 100%を合格とする | 焼き込み方式の最重要指標。不一致は自動再生成（5.4） |
| コントラスト比 | 4.5:1 以上 | WCAG AA相当。下回れば `boostContrast` を提案 |

---

## 7. アーキテクチャ

### 7.1 lib 構成（`src/lib/adimage/`）

| ファイル | 役割 |
|---------|------|
| `types.ts` | 全型定義。`AdPlatform` / `Placement` / `Composition` / `Concept` / `CopySet` / `RefineDirective` / `VerifyResult` / `InspectResult` |
| `placements.ts` | 媒体・配置・**目標サイズ・生成サイズ**・レギュレーションの**唯一の正本**（6.2/6.4の表）。`genSizeFor(placementKey)` を提供 |
| `compositions.ts` | 構図プリセット＝**プロンプト断片**（セーフエリア指示文・要素順・省略ルール）。6.3の表 |
| `access.ts` | userId / guestId(Cookie) 解決、プラン判定、日次上限、`ownerWhere()`（IDOR防止）。adbanner の `access.ts` を踏襲 |
| `scrape.ts` | URL取得・HTML解析（adbanner の実装を移植・強化） |
| `brand.ts` | スクレイプ結果 → ブランド情報の構造化抽出（Gemini） |
| `copy.ts` | コピー生成（文字数上限つき）＋ 文字数検証・自動短縮・禁止表現チェック |
| `prompt.ts` | **中核その1**。7セクション構造のプロンプト組み立て（5.3）と、`RefineDirective` の差分適用 |
| `generate.ts` | **中核その2**。生成サイズ決定 → `generateImageWithFallback()` → 検査 → 不合格リトライ → 目標サイズへ縮小 → Storage保存 |
| `verify.ts` | OCR照合・余計な文字の検出・セーフエリア侵食判定（Gemini Vision）。合否とバウンディングボックスを返す |
| `logo-overlay.ts` | ロゴ合成（adbanner から移植。自動コントラスト下敷きを追加）※テキストは合成しない |
| `inspect.ts` | 準決定的チェック（OCR一致率・占有率・コントラスト）。`verify.ts` の座標を再利用 |
| `feedback.ts` | Vision採点（実画像を Gemini に渡す） |
| `refine.ts` | `RefineDirective` の正規化と、`prompt.ts` を使った差分適用・再生成 |
| `storage.ts` | Supabase Storage 入出力（adbanner から移植） |
| `client.ts` | クライアント fetch ヘルパー |

> **Satori / resvg-js / フォント同梱は不要になった**（テキストをコード合成しないため）。初版設計にあった `render.ts` / `fonts.ts` は廃止。

### 7.2 Prisma モデル（プレフィックス `adimage_`）

```prisma
model AdImageBrand {
  id          String   @id @default(cuid())
  userId      String?              // 未ログインは null + guestId
  guestId     String?
  name        String               // ブランド/サービス名
  sourceUrl   String?
  description String?  @db.Text
  valueProps  Json?                // ["提供価値1", ...]
  colors      Json?                // ["#0066ff", ...]
  logoPath    String?              // Supabase Storage
  logoConfig  Json?                // { pos, maxWidthPct, paddingPct }
  industry    String?
  tone        String?
  ngWords     Json?                // 禁止表現
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  campaigns AdImageCampaign[]
  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@map("adimage_brand")
}

model AdImageCampaign {
  id         String   @id @default(cuid())
  brandId    String
  brand      AdImageBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)
  userId     String?
  guestId    String?
  name       String
  objective  String?              // 認知 / 獲得 / 再訪 など
  appeal     String?  @db.Text    // 訴求メモ
  placements Json                 // 選択した配置キー ["meta.feed_square", ...]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  concepts AdImageConcept[]
  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@map("adimage_campaign")
}

model AdImageConcept {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     AdImageCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  label        String                // 「ベネフィット訴求 × 信頼感」
  appealAxis   String
  tone         String
  copy         Json                  // { headline, sub, cta } ＝焼き込む文字列。OCR照合の正解データでもある
  compositionKey String              // 既定の構図プリセット
  genPaths     Json                  // 生成サイズごとの原本 { "1152x2048": "path", "1280x672": "path" }
  visualPrompt String   @db.Text     // ★完全なプロンプト全文。refine の差分適用の土台になるため必ず保存する
  model        String?               // 使用モデル / fallbackUsed
  generation   Int      @default(1)
  parentId     String?               // 改善元コンセプト
  createdAt    DateTime @default(now())

  creatives AdImageCreative[]
  feedbacks AdImageFeedback[]
  @@index([campaignId, createdAt])
  @@map("adimage_concept")
}

model AdImageCreative {
  id           String   @id @default(cuid())
  conceptId    String
  concept      AdImageConcept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  placementKey String                // "meta.story"
  size         String                // 目標サイズ "1080x1920"
  genSize      String                // 生成サイズ "1152x2048"（縮小のみで書き出したことの記録）
  compositionKey String
  imagePath    String                // 実寸PNG (Supabase Storage)
  verify       Json?                 // { ocrMatch, extraText, safeAreaOk, retries, boxes }
  inspect      Json?                 // { textAreaPct, contrast, ... }
  createdAt    DateTime @default(now())

  feedbacks AdImageFeedback[]
  metrics   AdImageMetric[]
  @@index([conceptId])
  @@index([placementKey])
  @@map("adimage_creative")
}

model AdImageFeedback {
  id         String   @id @default(cuid())
  conceptId  String
  concept    AdImageConcept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  creativeId String?                // 特定サイズへのFBなら設定
  creative   AdImageCreative? @relation(fields: [creativeId], references: [id], onDelete: SetNull)
  source     String                 // 'ai_vision' | 'ai_inspect' | 'user_chip' | 'user_text'
  scores     Json?                  // { visibility, appeal, cta, fit, brand, total }
  advice     String?  @db.Text
  directive  Json?                  // RefineDirective（構造化改善指示）
  applied    Boolean  @default(false)
  resultId   String?                // 適用して生まれたコンセプトID
  createdAt  DateTime @default(now())

  @@index([conceptId, createdAt])
  @@map("adimage_feedback")
}

// Phase 2
model AdImageMetric {
  id         String   @id @default(cuid())
  creativeId String
  creative   AdImageCreative @relation(fields: [creativeId], references: [id], onDelete: Cascade)
  imp        Int?
  click      Int?
  spend      Int?
  cv         Int?
  periodFrom DateTime?
  periodTo   DateTime?
  createdAt  DateTime @default(now())

  @@index([creativeId])
  @@map("adimage_metric")
}
```

**設計意図**: `Concept`（アイデア）と `Creative`（実寸出力物）を分離したことが adbanner との最大の差。1コンセプトから何サイズ書き出しても、改善の単位・課金の単位は**コンセプト**で数えられる。

### 7.3 API（`src/app/api/adimage/`）

全ルート定型: `runtime='nodejs'` / `dynamic='force-dynamic'` / `maxDuration=300`、レスポンス `{ success, data?, error?, code? }`

| エンドポイント | メソッド | 内容 |
|---------------|---------|------|
| `analyze-url` | POST | URLスクレイプ → ブランド情報抽出 |
| `brands` | GET / POST | ブランド一覧・作成 |
| `brands/[id]` | GET / PATCH / DELETE | ブランド詳細・更新・削除 |
| `brands/[id]/logo` | POST | ロゴアップロード（署名付きURL） |
| `campaigns` | GET / POST | キャンペーン一覧・作成 |
| `campaigns/[id]` | GET / PATCH / DELETE | 詳細・更新・削除 |
| `generate` | POST | **コンセプトN案生成**（コピー確定 → 生成サイズごとにフルベイク生成 → 検査 → 目標サイズ書き出し） |
| `add-placement` | POST | 既存コンセプトに配置を追加。**同じ生成サイズが既にあれば縮小だけ（無料・即時）／無ければ1回生成する** |
| `inspect` | POST | 準決定的チェック（軽量・同期） |
| `feedback` | POST | Vision採点（実画像を渡す） |
| `refine` | POST | `RefineDirective` を適用して次世代コンセプトを生成 |
| `creatives/[id]` | GET / DELETE | 個別クリエイティブ |
| `export` | POST | 媒体別フォルダ構成の ZIP 生成 |
| `image` | GET | 画像取得（サムネ優先・署名付きURL） |
| `usage` | GET | 当日の使用量・残枠 |
| Phase 2: `metrics` | POST | 実績投入 / CSV取込 |
| Phase 2: `optimize` | POST | 勝ち要素分析 → 次世代量産 |

**タイムアウト設計（実測に基づく）**: `generate` は Vercel の 300秒上限に収める。
- 1枚あたりの実測は 1152×2048 / `quality:'medium'` で **38秒**（`high` は93秒なので使わない）
- **検査で不合格になると再生成が走る**ため、1枚あたり最大3回（初回＋リトライ2回）＝最悪114秒を見込む
- 並行度3・1枚あたり `raceTimeout` 150秒で保護（adbanner の実績値を踏襲）
- **1リクエストの生成サイズ数は3種類までに制限**する。4種類以上を選んだ場合はクライアント側で複数リクエストに分割する
- 目標サイズへの縮小は Sharp のみなので数十ms。同一生成サイズを共有する配置は追加コストゼロ

### 7.4 画面構成（`src/app/adimage/`）

```
src/app/adimage/
├── page.tsx                        # LP + URLクイックスタート（#start）
├── layout.tsx                      # buildServiceMetadata('adimage') + LpJsonLd
├── lp-data.ts                      # ACCENT / STEPS / BENEFITS / FAQ
├── mocks.tsx                       # LP用UIモック
├── pricing/{layout,page}.tsx       # 共通 UnifiedPricingPlans
└── dashboard/
    ├── layout.tsx                  # AdImageSidebar（共通 sidebar + ToolSwitcherMenu）
    ├── page.tsx                    # キャンペーン一覧
    ├── brands/page.tsx             # ブランド管理（再利用の起点）
    ├── new/page.tsx                # 新規作成（URL → 抽出結果の確認・編集 → 配置選択）
    └── [campaignId]/page.tsx       # コンセプト一覧 / サイズ展開 / フィードバック / 世代ツリー
```

**`[campaignId]` 画面の構成（本サービスの主戦場）**
- コンセプトカード: 代表プレビュー + 総合スコア + 世代バッジ
- 展開すると配置別サムネのグリッド（各サムネに決定的チェックの警告バッジ）
- カード下に**フィードバックチップ列**（「文字を大きく」「訴求を強く」…）+ 自由記述欄
- 「AIに採点させる」ボタン → Vision採点 → advice に「これで直す」ボタン
- 世代ツリー: 親子関係を辿って改善の経緯を確認できる

UI規約: 日本語 / Tailwind のみ / Material Symbols Outlined / **絵文字アイコンは使わない**。

---

## 8. 課金（統一プラン方式）

判定は `User.plan` 単一参照。個別課金はしない。日次リセットは JST 00:00。

**カウント単位は「AI画像生成の実行回数」**（生成サイズ1種類につき1回）。焼き込み方式では改善も再生成を伴うため、
レイヤー方式のような「無料の再描画」は存在しない。ただし次の2つは**カウントしない**。

- **検査不合格による自動リトライ**（5.4）— サービス側の品質責任であり、ユーザーに転嫁しない
- **同じ生成サイズを共有する配置への書き出し**（例: 1.91:1 の生成1回で Meta横長・Google横長・LINE Card・YDA の4配置が埋まる）— 縮小のみで追加コストがない

| プラン | 生成回数/日 | 目安 | 配置 | フィードバック | ZIP一括 | Phase2 |
|--------|-----------|------|------|---------------|---------|--------|
| ゲスト | 3 | 1コンセプト × 主要3比率 | 主要3配置 | Vision採点 1回まで | × | × |
| 無料会員 | 12 | 4コンセプト × 主要3比率 | 主要3配置 | あり | × | × |
| PRO（¥9,980 統一プラン） | 90 | 10コンセプト × 全7比率 ＋ 改善20回 | **全配置** | 無制限 | ○ | ○ |

> ユーザー価値の核: **1回の生成が複数配置に効く**。1.91:1 を1回生成すれば Meta / Google / LINE / Yahoo! の4配置が同時に埋まる。
> 「主要3比率」= 9:16（ストーリーズ）/ 1:1（フィード）/ 1.91:1（横長）で、実務で使う配置の大半をカバーする。

実装:
- `src/lib/adimage/access.ts` に `DAILY_LIMIT: Record<AdPlanTier, number> = { GUEST: 3, FREE: 12, PRO: 90 }`
- カウントは `AdImageCreative` ではなく **`AdImageConcept.genPaths` の生成回数**を集計する（配置数で二重計上しない）
- 上限超過は **402 + `code: 'LIMIT'`**（既存サービスと同じ規約）
- `src/lib/stripe.ts` の `ALL_SERVICE_IDS` に `adimage` を追加（解約時のFREE化対象）

---

## 9. `/adbanner` の統合・廃止計画

前例: 旧 `/slide`・`/slashslide` → `/doyaslide`（`next.config.js:133-165` の 308 リダイレクト）。同じ手順を踏む。

| Phase | 内容 | 判断ポイント |
|-------|------|-------------|
| **A. 並存実装** | `/adimage` を `coming_soon` で実装。`/adbanner` は稼働継続 | 既存ユーザーへの影響ゼロ |
| **B. 検証** | 本番DB手動push → 実データで生成・採点・改善を検証 → `active` 化 | 両方が一覧に並ぶ期間。adbanner の badge を外し adimage を NEW に |
| **C. データ移行** | `scripts/migrate-adbanner-to-adimage.ts` で `adbanner_campaign` → `adimage_brand` + `adimage_campaign`、`adbanner_creative` → `adimage_concept` + `adimage_creative` | ⚠️ **guestId のデータは移行しない**（Cookie が一致しないため到達不能）。userId 保有分のみ移行 |
| **D. 廃止** | `services.ts` から `adbanner` を除去 → `next.config.js` に 308 リダイレクト追加 → sitemap から除外 → SEO資産を移管 | 後述の作業を漏らさない |

**Phase D の具体作業**
1. `next.config.js` の `redirects()` に追加（**308恒久**。307だと旧URLがインデックスに残り指名検索が分散する）
   ```js
   { source: '/adbanner/dashboard/:path*', destination: '/adimage/dashboard', permanent: true },
   { source: '/adbanner/pricing',          destination: '/adimage/pricing',   permanent: true },
   { source: '/adbanner',                  destination: '/adimage',           permanent: true },
   { source: '/adbanner/:path*',           destination: '/adimage',           permanent: true },
   ```
2. `src/lib/services.ts` — `adbanner` エントリを削除（`/slide` と同じく registry から外す）
3. `src/app/sitemap.ts` — `SERVICES_WITH_PRICING_PAGE` から `'adbanner'` を削除
4. `src/lib/seo.ts` — `SERVICE_ALIASES.adbanner` の別表記（`ドヤ広告バナー` 等）を **`adimage` 側へ移す**。指名検索の受け皿を新URLに寄せる。`SERVICE_SEO.adbanner` も `adimage` にリネーム
5. `src/components/ToolSwitcherMenu.tsx` — `adbanner` のマッピングを削除し `adimage` を追加。ロゴ画像 `/adimage/logo.png` を用意
6. `src/app/adbanner/` `src/app/api/adbanner/` `src/lib/adbanner/` `src/components/adbanner/` を削除
   - ⚠️ **ファイル削除は最後・単独コミット**で行う（並行作業中は実施しない）
   - Prisma の `adbanner_*` テーブルと **DBデータは残す**（移行検証が終わるまで削除しない。ロールバック余地を確保）
7. `reference/services/adbanner.md` に廃止記録を追記（削除しない。`slide.md` と同じ扱い）
8. `reference/10-service-status.md` を更新

**注意**: `/adbanner` は 2026-06-26 から本番稼働しており SEO資産がある。**リダイレクトを入れる前に registry から外すと、リンク切れ期間が生じる**。順序は「リダイレクト追加 → registry 削除 → ファイル削除」を厳守。

---

## 10. AI 利用方針

| 用途 | エンジン | 呼び出し |
|------|---------|---------|
| **画像生成（テキスト込み）** | **gpt-image-2** | `generateImageWithFallback()`（`src/lib/image-generator.ts`）**必須経由**。`inputImages` は渡さない＝常に gpt-image-2 経路 |
| URL解析・ブランド抽出 | Gemini | `geminiGenerateJson()` |
| コピー生成 | Gemini | `geminiGenerateJson()`（文字数上限をプロンプトに明示） |
| OCR照合・座標取得 | Gemini Vision | `geminiGenerateText({ parts: [{inlineData}, {text}] })` ＋ JSON抽出 |
| Vision採点 | Gemini Vision | 同上 |
| Phase2 勝ち要素分析 | Gemini | `geminiGenerateJson()` |

### 10.1 「Imagen か Gemini か」への回答 — **どちらでもなく gpt-image-2 が正解**

| 候補 | 判定 | 理由 |
|------|------|------|
| **gpt-image-2**（OpenAI / ChatGPT Images 2.0） | ✅ **採用** | 実測で 9:16（1152×2048）と日本語広告コピーの焼き込みが完璧に成立。既に本番稼働中のメインエンジンで、統一ディスパッチャの標準経路 |
| Imagen | ❌ **使用禁止** | プロジェクトのブランドUI規約（`CLAUDE.md`）で **Imagen / Nano Banana無印 / Gemini 2.x画像系は使用禁止**と明記されている。検討の余地なし |
| nano-banana-pro-preview（Gemini 3 Pro Image） | △ フォールバックのみ | ディスパッチャの障害時フォールバックとして残す。入力画像を渡す場合のみ直接使われる。**日本語焼き込みの主エンジンには使わない** |

> **結論: 追加のモデル導入は不要。** 既存の gpt-image-2 で要件を完全に満たせることを実APIで確認済み（第2章 2.1）。

### 10.2 ⚠️ 共通ファイルの改修が必須（本サービスの前提条件）

現状のコードは gpt-image-2 の能力を**人為的に3プリセットへ縛っている**。本サービスはこの解除が前提。

**(1) `src/lib/openai-image.ts:17`** — 型が4値に固定されている
```typescript
// 現状
export type GptImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
// 改修後（テンプレートリテラル型で任意サイズを許容）
export type GptImageSize = `${number}x${number}` | 'auto'
```

**(2) `src/lib/image-generator.ts:173-184`** — `mapSizeForGptImage2()` が全サイズを3プリセットに丸めている
```typescript
// 現状: ratio を見て 1536x1024 / 1024x1536 / 1024x1024 のどれかに丸める（=本サービスが成立しない）
// 改修後: 16の倍数・3:1以内・上限3840px を満たすなら「そのまま通す」。
//         満たさない場合のみ、最も近い有効サイズへ丸める（16の倍数へ切り上げ・比率を3:1にクランプ）
```

**後方互換の担保（重要）**: 既存サービス（banner / adbanner / doyaslide / persona 等）は現在3プリセットのいずれかを渡している。
改修後もそれらは**有効サイズとしてそのまま通過する**ため挙動は変わらない。
ただし共通ファイルの変更にあたるため、`npx next build` に加えて**既存の画像生成サービスの実挙動を1つ以上目視確認**すること。

**禁止（従来どおり）**: Nano Banana 無印 / Imagen / Gemini 2.x 画像系の直接使用。画像生成は必ず統一ディスパッチャ経由。

---

## 11. 実装リスクと対策

### 11.1 焼き込みテキストの再現ばらつき（本方式の主リスク）

**リスク**: 画像生成AIによる文字描画は確率的で、**毎回100%正しいとは限らない**。長い文字列・画数の多い漢字・4行以上のときに崩れやすい。
検証では3回とも完璧だったが、これは「短いコピー・3要素・明確な指示」という条件下での結果であり、常に保証されるものではない。

**対策（設計に織り込み済み）**:
1. **文字数上限を厳しく設定**（見出し13字 / サブ16字 / CTA 8字）。短いほど崩れない
2. **OCR照合による自動検査 → 不合格は自動再生成**（5.4）。ユーザーには合格したものだけ見せる
3. 2回リトライしても不合格なら「要確認」フラグ付きで提示（黙って捨てず、ユーザーに判断させる）
4. **OCR一致率を採点の最重要指標として常時記録**し、崩れやすいパターン（文字数・書体指示・比率）を運用で特定していく

> この「検証と再生成」があることが、焼き込み方式を実運用に耐えさせる条件。**検査を省略すると品質が保証できない**ため、PoCの次に実装する。

### 11.2 ⚠️ `GOOGLE_GENAI_API_KEY` が無効（検証中に発見・要対応）

`.env.local` の `GOOGLE_GENAI_API_KEY` で Gemini API を叩いたところ **`API_KEY_INVALID`（400）** が返った。

```
"message": "API key not valid. Please pass a valid API key.", "reason": "API_KEY_INVALID"
```

**影響**:
- 画像生成の**フォールバック経路（nano-banana-pro-preview）がローカルでは機能しない**。gpt-image-2 が落ちたときに救済されない
- 本サービスは **OCR照合・Vision採点で Gemini に強く依存する**ため、このキーが無効だと中核機能が動かない
- ※ `seo/lib/gemini.ts` は Claude / ChatGPT へのフォールバックを持つためテキスト生成は救済されるが、**Vision は代替経路の確認が必要**

**対応（実装着手前に確認すること）**:
1. **本番（Vercel）の `GOOGLE_GENAI_API_KEY` が有効かを確認**する（ローカルのみ古い可能性がある）
2. 無効なら新しいキーを発行して `.env.local` と Vercel 環境変数の両方を更新（Vercelは**再デプロイするまで反映されない**）
3. Vision が使えない場合の代替として、OCR照合を **ChatGPT（gpt-4o のvision）** で行う経路を用意しておく

### 11.3 その他のリスク

| リスク | 対策 |
|--------|------|
| `generate` が300秒を超える | `quality:'medium'` 固定（実測38秒／`high`は93秒なので使わない）。生成サイズは1リクエスト3種類まで／並行度3／1枚150秒の `raceTimeout`／リトライは最大2回。超える場合はクライアントで分割リクエスト |
| 指定外の文字が混入する（英字ダミー等） | プロンプトの禁止事項で明示（実測で有効）＋ OCR照合で `extraText` を検出したら自動再生成 |
| 上下に無地の白帯ができて縦長を活かせない | 「画面全体をデザインで埋める（白い余白帯を作らない）」＋「背景デザインは continue させる」を必ず入れる（1回目の検証で実際に発生した既知の失敗パターン） |
| 本番DBが未反映で全クエリ500 | `adimage_*` は新規テーブルのみ（既存に影響なし）。デプロイ後に `POSTGRES_PRISMA_URL` で手動 `prisma db push` を**必ず実施**。`npx prisma generate` も忘れない |
| ZIP生成でメモリ超過 | `vercel.json` の `functions` で `export` ルートに `memory: 1024` を指定。大量時は分割ZIP |
| 大きな画像を一覧で読み込んで413 | 一覧は必ずサムネ（署名付きURL）。Base64 を返さない |
| 移行スクリプトの二重実行 | 冪等化（移行済みフラグ or `sourceUrl`+`createdAt` で突合）。ドライラン必須 |

---

## 12. 実装手順

0. **前提確認** — 本番 Vercel の `GOOGLE_GENAI_API_KEY` が有効かを確認（11.2）。無効なら先に更新する
1. **共通ディスパッチャの改修（最優先）** — `openai-image.ts` の型拡張と `image-generator.ts:mapSizeForGptImage2()` の書き換え（10.2）。
   既存の画像生成サービスが壊れていないことを目視確認してから次へ進む
2. `src/lib/services.ts` に `adimage` エントリ追加（`status: 'coming_soon'` / `order: 27` / `requiresAuth: false`）
3. `reference/services/adimage.md`（本書）を正本として維持
4. `prisma/schema.prisma` に `adimage_*` 6モデル追加 → `npx prisma generate`
5. `src/lib/adimage/` 実装（`placements.ts` → `compositions.ts` → `prompt.ts` → `generate.ts` → `verify.ts` の順。
   **生成と検査が土台**。`verify.ts` を後回しにしない）
6. `src/app/api/adimage/` 実装（`analyze-url` → `generate` → `add-placement` → `inspect` → `feedback` → `refine` の順）
7. `src/app/adimage/` 実装（dashboard 優先、LPは後。LPは共通キット `src/components/lp/` で組む）
8. `src/components/sidebar/themes.ts` に `adimageTheme` 追加、`ToolSwitcherMenu.tsx` に登録
9. `src/lib/seo.ts` に `SERVICE_SEO.adimage` / `SERVICE_ALIASES.adimage` 追加、`src/app/sitemap.ts` の `SERVICES_WITH_PRICING_PAGE` に追加
10. `src/lib/stripe.ts` の `ALL_SERVICE_IDS` に `adimage` 追加
11. 検証: `npx next build` ＋ `npx tsc --noEmit`（**自動テストは無い**）
12. デプロイ → **本番 手動 db push** → 実データ検証 → `active` 化
13. 移行スクリプト実行 → `/adbanner` 廃止（第9章の Phase D）
14. `reference/10-service-status.md` 更新

---

## 13. 守るべきルール（既存サービス共通）

1. **編集は `09_Cursol/src/` のみ**（`doya-ai/` は本番に反映されない）
2. **画像生成は `generateImageWithFallback()` 経由**（直接 OpenAI/Gemini を叩かない）
3. **本番DBは手動 push**（新規テーブル追加後に `POSTGRES_PRISMA_URL` で実施。怠ると全クエリ500）
4. **個別課金しない**（統一プラン・`User.plan` 単一参照）
5. **`useSession` の `status` で fetch をゲートしない**（画面が空で固定される実績あり）
6. **非ASCII を HTTPヘッダに生で入れない**（必要なら `encodeURIComponent`）
7. **`useSearchParams()` は `<Suspense>` で包む**（Vercelビルド失敗回避）
8. **NextAuth ハンドラーを改変しない**（全ページ500の原因）
9. **UIに絵文字アイコンを使わない**（Material Symbols / 専用SVGのみ）
10. **ファイルの削除→再作成をしない**（既存ファイルは Edit で変更）
11. **他サービスの `src/app/{他}/` `src/lib/{他}/` を触らない**
12. **型エラーを無害と決めつけない**（`ignoreBuildErrors: true` のため実行時バグが混ざる。Prismaスキーマと突き合わせて triage）

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-08-06 | 初版作成。要件定義〜設計。`/adbanner` の構造的欠陥4点（Vision未使用の採点／cover切り抜きによる極端比率の破綻／文字のAI焼き込み／非構造化な改善指示）を根拠に次世代版として設計。レイヤー分離レンダリング・配置3階層・RefineDirective・コンセプト単位課金を採用。`/adbanner` は統合後308リダイレクトで廃止する計画を策定。未実装 |
| 2026-08-06 | **方針転換: レイヤー分離合成 → フルベイク（テキスト込み完全生成）方式へ全面改訂**（オーバーレイ合成は一体感が落ちるため不採用）。実APIで検証し次を確定: gpt-image-2 は「16の倍数」なら任意サイズ可・アスペクト上限は厳密に3:1・**1152×2048 で真の9:16が生成可能**・日本語広告コピーの焼き込みは完璧・medium 38秒。これに伴い (1) 全配置の生成サイズを事前計算した表に差し替え（クロップ全廃）、(2) 9:16のセーフエリア指示を「縦10分割の帯番号」方式で確定、(3) 品質保証をOCR照合＋自動再生成ループへ、(4) 改善は「プロンプト継承＋差分適用」へ、(5) 課金単位を生成回数へ、(6) Satori/フォント同梱を廃止、(7) 共通ディスパッチャ改修を前提条件として追加。728×90・320×100 は3:1超過のためPhase 1非対応と判断。`GOOGLE_GENAI_API_KEY` 無効を検出（要対応） |


---

## 実装状況（2026-08-08・Phase 1）

| 機能 | 状態 | 実装 |
|---|---|---|
| URLクイックスタート（5.1） | 済 | `src/lib/adimage/brand.ts` |
| コピー確定（5.2） | 済 | `copy.ts`（文字数上限の機械検証つき） |
| フルベイク生成（5.3） | 済 | `prompt.ts` / `generate.ts` |
| 自動検査（5.4） | 済 | `verify.ts` / `vision.ts` |
| 実寸書き出し（5.5） | 済 | `generate.ts:exportToSize()`（縮小のみ） |
| Visionフィードバック | 済 | `feedback.ts:evaluateCreative()` |
| 構造化改善（refine） | 済 | `api/adimage/concepts/[id]/refine` |
| ZIP一括ダウンロード | 済 | `api/adimage/concepts/[id]/export` |
| ロゴ合成（5.6） | 未 | 「ロゴなし」運用。Phase 2 |
| コントラスト実測（Sharp） | 未 | Vision採点で代替中。Phase 2 |
| 効果指標の取り込み（AdImageMetric） | 未 | Phase 2（モデルも未作成） |

### 共通ファイルの改修（10.2）— 実施済み

- `src/lib/openai-image.ts:GptImageSize` を `` `${number}x${number}` | 'auto' `` に変更
- `src/lib/image-generator.ts:mapSizeForGptImage2()` を「有効ならそのまま通す」に変更
  （16の倍数へ丸め・3:1へクランプ・512〜3840に収める。無効時のみ調整）

**後方互換の確認結果**: 既存の呼び出し元は全て3プリセットのいずれかを渡しており、
それらは素通りする（`1024x1024` / `1024x1536` / `1536x1024` / `auto` すべて不変）。
`adbanner` は自前で3プリセットに丸めてから渡しているため、挙動は完全に変わらない。

**実APIでの受理確認**（2026-08-08）: `1088x1088` / `1200x624` / `1152x2048` / `1280x672`
いずれも HTTP 200 で、**指定どおりの寸法**が返ることを確認した。

### 実装上の要点

- **Visionは専用経路を用意した**（`vision.ts`）。共通の `geminiGenerateText()` は
  `joinPartsText()` で parts の text だけを抜き出すため、`inlineData` で画像を渡しても捨てられる。
  ⚠️ これが adbanner の欠陥1（フィードバックが画像を見ていない）の直接の原因。同じ轍を踏まないこと。
- **検査に失敗したときは「合格」にしない。** Vision呼び出しが落ちた場合は `needsReview` を立てる。
  合格扱いにすると検査が無いのと同じになる。
- **2回リトライしても不合格なら「要確認」で提示する。** 黙って捨てると、費用だけ消えて何も出ない。
- **OCR照合は表記ゆれを吸収する**（NFKC・空白・約物を除去）。しないと、正しく描けている画像を
  何度も作り直すことになる。
- **混入文字は3字未満を無視し、1件までは許容する。** 装飾の誤検出で通らなくなるため。
- `quality: 'medium'` 固定。`high` は実測93秒で、複数サイズを回すと `maxDuration=300` に収まらない。


### 本番実機検証（2026-08-09）

URL入力 → ブランド抽出 → コピー4案 → 3配置で生成 → 検査 まで実際に通した。

**見つかった不具合（修正済み）:**
- 同じ親コンセプトから2回改善すると保存パスが衝突し、`uploadPng(upsert)` が
  **先の世代の画像を上書き**していた（レコードはそのパスを指したままなので画像だけ黙って差し替わる）
  → 世代ごとに一意な接尾辞を付けた。

**検証できたこと:**
- 9:16（1152×2048）で日本語が一切崩れず描画され、そのまま入稿できる品質
- **自動検査が実際に不合格を捕まえ、再生成で直った**
  （1回目はセーフエリア侵食 → 2回目で合格）。検査は飾りではなく機能している
- 生成→実寸の書き出しは歪み0.000%、クロップなし
- Visionフィードバックが実画像を見て採点（視認性5/訴求4/CTA5/配置5/ブランド5）
- 本番UIで3配置すべて「文字OK」判定


### `/adbanner` 統合完了（2026-08-10）

ユーザー判断により統合した。手順は第9章の Phase D に従い、
**リダイレクト追加 → registry 除外**の順で実施（逆にすると旧URLにリンク切れ期間が出る）。

統合の前提として、adbanner にあって adimage に無かった**ロゴ合成を移植**した
（`src/lib/adimage/logo.ts` / `api/adimage/brands/[id]/logo`）。
- 背景が暗いときだけ白い下敷きを敷く（常に敷くと白背景で四角が浮く）
- 実寸へ縮小した**後**に載せる（生成サイズで載せると縮んで潰れる）
- 合成に失敗しても画像自体は返す（ロゴが入らないことより画像が出ない方が困る）

⚠️ adbanner のテーブル・データ・コードは残置。`HIDDEN_SERVICE_IDS` から
`'adbanner'` を外せば復帰できる。詳細は `reference/services/adbanner.md`。
