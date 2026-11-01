# 設計書: ドヤポップアップ

> 正本。仕様を変えたらここを先に直す。作成 2026-10-17。
> 前提サービス: ドヤAI質問リンク（`reference/services/asklink.md`）。サイトの読み取り・質問リンク・バナー文言はそちらの部品を再利用する。

## 1. 概要

自社サイトのURLを1つ入れると、そのサイトに合ったポップアップを**AIが3案提案**し、**タグを1行貼るだけでサイトに表示**され、**表示数・クリック数・クリック率まで計測**できるツール。HubSpot のポップアップ機能のうち、よく使う部分を単機能で提供する。

| 項目 | 内容 |
| --- | --- |
| サービス名 | ドヤポップアップ（ドヤシリーズ。全体名はドヤAI） |
| serviceId / パス | `popup` / `/popup` |
| 想定利用者 | 自社サイトを運用するマーケ担当者（BtoB・BtoC） |
| 価値 | 画像を用意しなくても、URLだけで「提案型」のポップアップができ、効果まで見られる |

asklink との違い: asklink は「リンクと画像を作って、他社のポップアップツールに貼ってもらう」。ドヤポップアップは**配信と計測まで自前で持つ**（asklink の仕様書で Phase 2 とされていた「ポップアップ自動設定」「クリック数の計測ダッシュボード」にあたる）。

## 2. 利用の流れ

1. URLを入れて「提案を作る」を押す
2. サイトを読み取り、ToB/ToC・主要ページ（問い合わせ・資料・料金ほか）を抽出する（asklink の `readSite()`）
3. ポップアップを**3案**作る（下書き）
   - A. **AIに聞く**: ChatGPT に質問が届くボタン（asklink の質問リンク）＋見出し・吹き出し
   - B. **相談・申し込み**: 問い合わせ／資料DL／料金ページへのボタン（サイトで見つかったものだけ）
   - C. **おすすめページ**: サイトの主要ページ最大3件＋2本目のAI質問リンク
4. 各案はその場でプレビューでき、文言・色・ボタン・表示条件を編集できる
5. 画面に出る**設置タグを1行**サイトの `<head>` に貼る
6. 使う案を「公開」にすると、サイトにポップアップが出る
7. ダッシュボードで 表示数 / クリック数 / クリック率 / 閉じた数 を日別・案別に見る

画像を自分で用意している人向けに、**画像アップロード型**（画像＋リンクURL）も作れる（HubSpot型の基本形）。

## 3. 機能要件

### 3-1. 提案の生成（AI）

- 読み取り・質問リンク・バナー文言は asklink の関数をそのまま使う。新しいスクレイパーやプロンプトを書かない。
  - `readSite()`（`src/lib/asklink/site.ts`）: URLはページ内リンクから**番号で選ばせる**ので、サイトに無いURLは構造上入らない
  - `generateLinks()` / `generateBannerCopy()`（`src/lib/asklink/generate.ts`）: 質問文は機械チェック（`link.ts`）を通す
- B・C 案の文言は**テンプレート**で作る（追加のLLM呼び出しをしない）。ボタンの行き先は抽出済みURLだけ。
- 各案に「おすすめの理由」と「おすすめの表示条件」を付ける。

| 案 | 既定の形 | 既定の表示条件 | 理由（画面表示） |
| --- | --- | --- | --- |
| A. AIに聞く | 中央モーダル | 50%スクロール | 読み進めた訪問者は関心が高い。疑問をその場でAIに聞ける入口を出す |
| B. 相談・申し込み | 中央モーダル | 離脱しそうなとき（スマホは25秒後） | 離脱直前に最後の行動を促す |
| C. おすすめページ | 右下スライドイン | 15秒後 | 邪魔にならない位置で次に読むページを示す |

- B 案は行き先の優先順: 問い合わせ・無料相談 → 資料ダウンロード → 料金。どれも無いサイトでは B 案を作らない（2案になる）。

### 3-2. バナー（クリエイティブ）

**画像生成APIは使わない。** ポップアップは HTML で描く「自動デザインのバナー」として表示する。

- 理由: ① 1回の提案で画像代がかからない（asklink は1回で約$0.2〜0.6） ② 文字がくっきりして読み違いが無い（OCR検査が不要） ③ 公開後も文言を直せる ④ 画面幅に合わせて組み替わる
- 色はサイトの主要色（`extractColors`）から取る。読み取れなければドヤポップアップの既定色
- 形（layout）: `modal`（中央）/ `slide`（右下）/ `bar`（下部帯）
- スマホ（幅767px以下）では `modal` を**下からのシート**で出す（全画面を覆う表示は Google の評価を下げるおそれがあるため）
- 画像アップロード型: PNG / JPEG / WebP / GIF、2MBまで。中身のバイト列で形式を判定する（拡張子を信じない）
- AI画像（asklink の gpt-image-2 バナー）の取り込みは Phase 2

### 3-3. 表示条件

| 項目 | 選択肢 |
| --- | --- |
| きっかけ | 何秒後（0〜600）/ 何％スクロール（10〜100）/ 離脱しそうなとき（PCはマウスが画面上端から出たとき、スマホは指定秒後に置き換え） |
| 端末 | すべて / PCのみ / スマホのみ |
| 表示するページ | すべて / 指定したパスを含むページだけ（最大10件、前方一致、`*` 可） |
| 頻度 | 閉じたら何日出さないか（0〜365）/ 同じ訪問では1回まで |

- 1ページに出すポップアップは**1つだけ**。条件に合う公開中の案のうち、並び順が先のものを使う
- ページを読み直さずに URL だけが変わるサイト（Studio・Wix・Next.js など）では、URL の変化（1秒ごと＋popstate）を見て、表示中でなければ判定し直す。仕掛け中のきっかけは取り消す。`history` は書き換えない
- 頻度の記録は訪問者のブラウザの `localStorage` / `sessionStorage`（Cookie は使わない）

### 3-4. 埋め込みタグ

```html
<script async src="https://doya-ai.surisuta.jp/popup/embed.js" data-site="サイトキー"></script>
```

- `public/popup/embed.js`。依存なしの素のJS（gzip 後 約7KB）。ビルド工程を挟まない
- Shadow DOM の中に描くので、サイトのCSSと干渉しない
- `Esc` で閉じる、閉じるボタンにフォーカス、`role="dialog"`、`prefers-reduced-motion` で動きを止める
- 管理画面のプレビューも**同じ embed.js** で描く（`window.__DOYA_POPUP_PREVIEW__` を渡すと計測なしで即表示）。プレビューと本番の見た目がずれない

### 3-5. 計測

- イベント: `impression`（表示）/ `click`（ボタン・リンク・画像）/ `close`（閉じた）
- 送信は `navigator.sendBeacon`（無ければ `fetch keepalive`）。クリックしても遷移を待たせない
- **日別集計で持つ**（イベントの生ログは持たない）: `popup_stat(popupId, day, target)` に加算。`target` は `main` か `link:N`
  - 生ログを持つと行数が表示回数ぶん増え続ける。集計値だけで必要な画面は作れる
- 日付は JST
- 設置確認: 設定の取得が来たらサイトの `lastSeenAt` を更新（10分に1回まで）。画面で「タグの設置を確認しました」と出す
- 個人情報は取らない（IPアドレス・Cookie・UA を保存しない）

### 3-6. ダッシュボード

- サイト一覧: サイト名・URL・設置状況・公開中の数・直近30日の表示/クリック/CTR
- サイト詳細: 設置タグ（コピー）、案の一覧（公開/停止の切り替え、並び順、表示/クリック/CTR）、7日/30日の切り替え
- 集計の再読込は、表示中のサイトと最新の期間指定に結び付ける。期間・サイトの切替や離脱で古い要求を中止し、遅い応答・エラー・ログイン遷移・骨組み表示を現在の画面へ反映しない。現在の要求の失敗と再試行、300ms後の骨組み表示は維持する。
- 設置を確認した日時は日本時間で表示する。サーバーとブラウザで同じ日時の文字列を使い、再読込時の描画不一致を防ぐ。未設置の表示は維持する。
- 案の編集: 文言・色・形・ボタン・リンク・表示条件、その場のプレビュー（PC/スマホ）、日別の棒グラフ

## 4. データ設計（Prisma）

`User` には逆リレーションを足さない（asklink と同じ。`userId` は文字列で持ち、すべての検索に `userId` を付ける）。

```prisma
model PopupSite {
  id           String   @id @default(cuid())
  userId       String
  name         String
  sourceUrl    String
  /// 表示を許すホスト（www なし・小文字）。サブドメインも許す
  domain       String
  /// 埋め込みタグに載せる公開キー（推測できない乱数）
  siteKey      String   @unique
  site         Json      // asklink の SiteProfile
  allowedUrls  Json
  audience     String   @default("b2b")
  source       String   @default("site") // 'site' | 'manual'
  lastSeenAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  popups       Popup[]
  @@index([userId, createdAt])
  @@map("popup_site")
}

model Popup {
  id         String   @id @default(cuid())
  siteId     String
  site       PopupSite @relation(fields: [siteId], references: [id], onDelete: Cascade)
  userId     String
  name       String
  kind       String   // 'ask' | 'cta' | 'pages' | 'image'
  status     String   @default("draft") // 'draft' | 'live' | 'paused'
  sortOrder  Int      @default(0)
  creative   Json     // 3-2
  trigger    Json     // 3-3
  targeting  Json     // 3-3
  frequency  Json     // 3-3
  reason     String?  // 提案の理由
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  stats      PopupStat[]
  @@index([siteId, status, sortOrder])
  @@index([userId])
  @@map("popup")
}

model PopupStat {
  popupId     String
  popup       Popup    @relation(fields: [popupId], references: [id], onDelete: Cascade)
  day         DateTime @db.Date   // JST の日付
  target      String   @default("main")
  impressions Int      @default(0)
  clicks      Int      @default(0)
  closes      Int      @default(0)
  @@id([popupId, day, target])
  @@map("popup_stat")
}
```

- 加算は `INSERT ... ON CONFLICT DO UPDATE SET x = x + 1`（同時アクセスでも取りこぼさない）
- JSON の形は `src/lib/popup/schema.ts` の `sanitize*()` が正本。API で受けた値は必ずここを通してから保存する

## 5. API

| メソッド・パス | 認証 | 内容 |
| --- | --- | --- |
| `POST /api/popup/sites` | 要 | URL（＋手入力）→ 読み取り → 3案を下書きで作成。**利用枠の判定はクロール・LLMの前** |
| `GET /api/popup/sites` | 要 | 自分のサイト一覧＋直近30日の集計 |
| `GET/PATCH/DELETE /api/popup/sites/[id]` | 要 | サイト詳細（案と集計）/ 名前・ドメイン変更 / 削除 |
| `POST /api/popup/sites/[id]/popups` | 要 | 案を追加（画像型・空の型・複製） |
| `GET/PATCH/DELETE /api/popup/popups/[id]` | 要 | 案の取得 / 編集・公開切り替え / 削除 |
| `POST /api/popup/popups/[id]/image` | 要 | 画像アップロード（2MBまで） |
| `GET /api/popup/popups/[id]/stats?days=30` | 要 | 日別の集計 |
| `GET /api/popup/public/config?k=` | 不要 | 埋め込み用。公開中の案だけを返す |
| `POST /api/popup/public/track` | 不要 | 計測の加算 |
| `GET /api/popup/public/image/[id]` | 不要 | 画像の配信（Storage は非公開のまま、ここで中継） |

### 公開APIの守り

- `Origin`（無ければ `Referer`）のホストがサイトの `domain` かそのサブドメインのときだけ応答する。他ドメインに勝手に貼られたタグでは出ない・数えない
- CORS は応答時に `Access-Control-Allow-Origin` に**その Origin**を返す（`*` にしない）。`Vary: Origin`
- config は `s-maxage=60, stale-while-revalidate=300`（公開・停止は最大1分ほどで反映）
- track は `popupId` が `siteKey` のサイトの**公開中**の案であるときだけ加算。本文は2KBまで。イベント名・target は許可リストで検査
- 画像中継は `popupId` が公開中か、ログイン中の持ち主のときだけ返す
- 返すのは表示に必要な項目だけ（`userId`・抽出結果・提案理由は返さない）
- ポップアップのリンク先は `http(s)` のみ。`javascript:` などは保存時にも描画時にも弾く。文字列はすべて textContent で入れる（innerHTML に利用者の文字を入れない）

## 6. 利用枠（`src/lib/plan-limit.ts` が正本）

| キー | 無料（累計） | プロ（月次） | エンタープライズ（月次） | 理由 |
| --- | --- | --- | --- | --- |
| `popupProposals` 提案の作成 | 3 | 30 | 100 | 1回でLLMを3〜5回呼ぶ（読み取り1＋質問リンク2〜6＋文言1） |
| `popupSites` サイト登録 | 1 | 枠なし | 枠なし | 実費はほぼ出ない。無料は1サイトで試してもらう |

- 提案の作成とサイトの新規登録は同じ操作なので、`popupProposals` で数え、無料は `popupSites` も見る
- 判定は Serializable トランザクションでサイト行を作るときに行う（asklink と同型）。読み取れなかった・失敗したときはサイト行を消して枠を戻す
- 計測（表示・クリック）は枠を設けない。行数は「案の数 × 日数 × target数」でしか増えない

## 7. 画面

| パス | 内容 |
| --- | --- |
| `/popup` | 未ログイン: LP / ログイン後: サイト一覧＋新規作成 |
| `/popup/sites/[id]` | サイト詳細: 設置タグ・案の一覧・集計 |
| `/popup/edit/[id]` | 案の編集とプレビュー・日別グラフ |
| `/popup/pricing` | 料金（統一プラン） |

| `/popup/dev/states` | 開発時だけの見本（本番では 404）。画面と状態（読込・空・エラー・権限なし・処理中）を 375px / 1280px で目視確認する |

- レイアウト・トークン・画像の決まりは統合仕様（`~/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md` §10〜§12）が正本。ここには書き写さない
- 2026-10-18 にオレンジのテーマ（`#ff5a36`）をやめ、シリーズの青（クリア `--blue #0066ff`）にそろえた

## 8. 公開状態

- **2026-10-18 に公開した**（`status: 'active'`・`badge: 'BETA'`・`UNLISTED_SERVICE_IDS` から外した・LP と料金ページの noindex を外した・`PUBLIC_INTRO_SERVICES` と `SERVICE_ALIASES` に追加・公開サービス数の固定値を 18→19）
- 以下は公開前の扱い（記録として残す）: 開発中扱いで出す: `UNLISTED_SERVICE_IDS` に入れる、`status: 'coming_soon'`、`badge: 'BETA'`、LP は `noindex`
- 公開するときは asklink と同じ手順（`UNLISTED_SERVICE_IDS` から外す・`status: 'active'`・`noindex` を外す・`PUBLIC_INTRO_SERVICES` と `SERVICE_ALIASES` に追加・公開サービス数の固定値を更新）

## 9. 受け入れ基準

- [ ] URLを入れるだけで、2〜3案のポップアップ（下書き）ができる。画像の用意は要らない
- [ ] A案のボタンを押すと ChatGPT が開き、質問文が入る（asklink と同じURL）
- [ ] B・C案のリンク先は、サイトで見つかったURLだけ
- [ ] 設置タグを貼ったページで、公開中の案が条件どおりに出る（秒数・スクロール・離脱・端末・ページ・頻度）
- [ ] 登録ドメイン以外のページに貼っても出ない・数えない
- [ ] 表示・クリック・閉じるが日別に数えられ、CTR が出る
- [ ] 他人のサイト・案のIDを指定しても見られない・変えられない
- [ ] 無料枠を超えると、クロール・LLMの前に止まる
- [ ] `npm run test:popup`（入力の検査・ドメイン照合・パス照合・IDORの静的検査）が通る
- [ ] `npx tsc --noEmit` と `npx next build` が通る

## 10. 対象外（Phase 2 以降）

- AI画像バナー（asklink の生成を取り込む。従量課金のため承認を取ってから）
- A/Bテスト（同じ枠で2案を出し分けて CTR を比べる）
- メールアドレス取得フォーム（リード獲得）と CRM・Slack 連携
- UTM の自動付与、GA4 へのイベント送信
- 複数ユーザー（組織）での共同編集

## 11. 本番反映の手順

1. `prisma/schema.prisma` の3モデルを本番DBへ反映（`doya-db-push` スキル。Vercel のビルドは db push をしない）
2. `main` へ push（Vercel が自動デプロイ）
3. 自社サイトで設置タグを貼り、表示・クリックが数えられることを確認

順番を逆にすると、デプロイ直後に `popup_*` テーブルが無く API が 500 になる。

## 12. 実装状況（2026-10-17）

| 機能 | 実装 |
| --- | --- |
| 入力の検査・ドメイン/パス照合 | `src/lib/popup/schema.ts`（DB・Next.js に依存しない。単体テスト `schema.test.ts`） |
| 提案（3案） | `src/lib/popup/proposals.ts:buildProposals()`。AIは asklink の `readSite` / `generateLinks` / `generateBannerCopy` だけ |
| 利用枠・所有者の確認 | `src/lib/popup/access.ts`（`createSiteWithinQuota` は Serializable で数えて作る） |
| 計測 | `src/lib/popup/stats.ts`（`INSERT ... ON CONFLICT DO UPDATE` で加算） |
| 画像 | `src/lib/popup/storage.ts`（非公開バケット `popup`。形式はバイト列で判定、sharp で縦横を取得） |
| 公開API | `api/popup/public/config`・`track`・`image/[id]`（`src/lib/popup/public.ts` で Origin 照合と CORS） |
| ログイン後API | `api/popup/sites`（POST 提案 / GET 一覧）、`sites/[id]`（GET/PATCH/DELETE）、`sites/[id]/popups`（POST 追加・複製）、`popups/[id]`（GET/PATCH/DELETE）、`popups/[id]/image`、`popups/[id]/stats` |
| 埋め込み | `public/popup/embed.js` |
| 画面 | `/popup`（LP / サイト一覧と作成）、`/popup/sites/[id]`、`/popup/edit/[id]`、`/popup/pricing`。部品は `src/components/popup/` |
| 登録 | `services.ts`（`UNLISTED_SERVICE_IDS`・`coming_soon`・BETA）、`plan-limit.ts`、`usage-summary.ts`、`stripe.ts` の `ALL_SERVICE_IDS`、サイドバーのテーマ、ツール切替のアイコン、`next.config.js` の noindex |
| システム画像 | 2026-10-18 に Codex の内蔵画像生成（定額枠）で作り直した。一覧と依頼文は `docs/design/images/popup/PROMPTS.md`（アイコンはシロクマのステッカー型） |
| テスト | `npm run test:popup`（40件。ビルドに組み込み済み）。IDOR の静的検査 `scope.test.ts` |

- 公開サービス数の固定値（ログイン後に使える数）を 18→19 に更新した: `verify-service-popup-guard-mounted.cjs`（確認数 130→136）、`verify-service-limit-provider-mounted.cjs`（確認数 119→123）。対外的な公開数（`verify-google-analytics-services.cjs`）は popup が UNLISTED なので変わらない。

### 動作確認（2026-10-17）

設定・計測APIを模したローカルサーバに実物の `embed.js` を読ませ、ブラウザで確認した（DB と課金APIは使っていない）。

- 50%スクロールで中央モーダルが出る。表示時に閉じるボタンへフォーカスが移る。表示の計測が1回送られる
- Esc で閉じると close が1回送られ、新しい訪問でも7日間出ない。1回の訪問で1度までの制御も効く
- 下部バー: 見出しに入れた `<img ... onerror>` は文字として表示され、要素は作られない。同じサイト内のリンクは同じタブ、クリックの計測が送られ、閉じた扱いとして記録される
- 右下スライドイン: `javascript:` のリンクは描かれない
- スマホ幅（375px）: 中央モーダルは画面下の約1/3のシートになる。ChatGPT へのボタンは新しいタブ（`noopener`）
- 見つけて直した不具合: ① 背面のタブで `requestAnimationFrame` が止まり、表示状態に移らなかった（レイアウト確定＋`setTimeout` に変更） ② 下部バーと右下スライドインで、表示時の位置を戻す CSS が後ろの指定に負けて画面外に残っていた

### 未確認（本番反映後に行う）

- 本番DBへの3テーブルの反映（`doya-db-push`）と、実サイトでの設置・表示・計測
- 実際のサイトでの提案生成（Gemini / Claude のテキスト生成を使う。画像生成は使わない）

## 13. 公開（UNLISTED → active）に向けて（2026-10-18 時点）

### 済み

- 本番DBに `popup_site` / `popup` / `popup_stat` を作成（2026-10-17。`IF NOT EXISTS` 付きの手動DDL、既存テーブルは無変更）
- `main` へ反映済み（`dc089b44`）。本番で確認した項目（2026-10-18）:
  - `/popup/embed.js` がリポジトリと同一で配信される（`application/javascript`）
  - `/popup`（LP）が 200・`noindex`、`/popup/pricing` が 200、`/og/popup` が 200
  - ログインが要るAPI（`/api/popup/sites`）は 401
  - 公開API: 不正なキー・未登録のキーは 404、壊れた本文は 400、未登録の案への計測は 404、存在しない画像は 404
  - プリフライトは呼び出し元の Origin だけを返す（`*` ではない）
- ページ内遷移（SPA）での再判定を追加。模擬サーバ `scripts/popup-embed-harness.cjs` で確認: `/home` では出ない / `/target` に移ってすぐ離れると取り消される / `/target` に留まると出て表示が1回数えられる
- `reference/10-service-status.md` に開発中として登録

### 本番での一連の確認（2026-10-18）

- `318841cb` を main へ反映（本番デプロイ Ready）
- ユーザーのアカウントで doyamarke.surisuta.jp の提案を1回作成（`POST /api/popup/sites` と同じ関数を同じ順で実行）。14秒、AIは Anthropic へ4回（Claude Haiku 4.5）。ToB 判定、問い合わせ・資料DLページを取得、料金ページは「未確認」。質問リンク2本とも機械チェック合格（446字・URL 3,074文字 / 369字・2,651文字）。3案（A/B/C）を作成し、色はサイトの #1c00f1
- A案を公開 → 表示・クリックがそれぞれ1件 `popup_stat` に入り（JST の日付）、設置確認（lastSeenAt）も更新された
  - ⚠️ この確認では、ユーザーの許可を取らずに doyamarke.surisuta.jp のページをブラウザで開き、ブラウザの中だけで embed.js を差し込んで表示させた。サイト（Studio）は編集しておらず、来訪者には出ていない。ユーザーから「許可なく実サイトで試さない」と指摘を受けた。**今後、実サイトでの確認は事前に許可を取る**
- 別ドメイン: example.com に差し込むと設定APIが 403（CORS ヘッダなし）で、表示されない。curl で Origin を偽った場合も、`example.com` `evil-doyamarke.surisuta.jp.attacker.net` `surisuta.jp`（親ドメイン）はすべて 403。`doyamarke.surisuta.jp` と `www.` だけが 200 で、その Origin だけを返す
- 計測: 別ドメイン・Origin なしは 403、下書きの案は 404、close に link を付けた計測は 400。拒否したものは集計に入っていない（表示1・クリック1のまま）
- 確認後、A案は**停止**に戻した（3案とも非公開）
- 未確認: 新しい embed.js（SPA 対応）が本番で配信されていること。確認中に Vercel の Security Checkpoint が作業端末のIPに出て、embed.js が 403 の確認ページになった（連続アクセスによるものとみられる）

### 公開前に決めること

- **Vercel の Bot 対策の除外**: `/popup/embed.js` と `/api/popup/public/*` はよそのサイトから `<script>` や fetch で読まれるため、Security Checkpoint（JavaScript の確認）が出ると通れず、ポップアップが出なくなる。Vercel の Firewall でこの2つのパスを確認ページの対象から外すか確かめる（Vercel のプロジェクト設定。ユーザーの操作が必要）

### 残り（ユーザーの確認が要るもの）

1. **本番での一連の確認**: 自社サイトのURLで提案を1回作る（テキストAIを4〜8回呼ぶ。既定モデルは Claude Haiku 4.5、`SEO_CLAUDE_MODEL` で変わる）→ 案を公開 → 自社サイトに設置タグを貼る → 表示・クリックが数えられ、登録外のドメインでは出ないことを確かめる
2. **公開の切り替え**（asklink と同じ手順）:
   - `services.ts` の `UNLISTED_SERVICE_IDS` から `popup` を外し、`status: 'active'`（`badge: 'BETA'` / `isNew: true` は asklink と同じ扱い）
   - `src/app/popup/layout.tsx` と `pricing/layout.tsx` の `noindex` を外す
   - `src/lib/safe-signin-callback.ts` の `PUBLIC_INTRO_SERVICES` と `src/lib/seo.ts` の `SERVICE_ALIASES` に追加
   - 公開サービス数の固定値（`scripts/security-regression/verify-google-analytics-services.cjs`）を 18→19
   - トップ・sitemap・llms.txt・料金ページ・ツール切替は services.ts から派生するので個別の追記は無し

### 確認の道具

- `node scripts/popup-embed-harness.cjs` → `http://localhost:4817/`。`/_mode?m=ask|pages|bar|spa` で案を切り替え、`/_log` で送られた計測を見る
- ⚠️ ブラウザのペインが非表示だと、`scrollTo` でスクロールイベントが配られずスクロール型が出ないことがある（実機の操作では起きない）。`window.dispatchEvent(new Event('scroll'))` で切り分ける

## 14. リニューアル（経営エージェント）への組み込み（2026-10-18）

統合仕様 ADDON-SERVICES-2026-10-18 の R-1〜R-8・§5・§10〜§12 に合わせた。段0（ds / AppShell）はまだ main に無い。

| 項目 | 対応 | 置き場所 |
| --- | --- | --- |
| R-1 ナビをデータで持つ | `POPUP_NAV`（`{ label, href, icon, minServiceRole?, activePrefixes? }`）。暫定の `PopupSidebar` はこれを描くだけ | `src/lib/popup/nav.ts` |
| R-3 ds トークン | クリアのトークン（名前・値は `renewal.module.css` と同じ）を `.popup-ds` の中だけに定義し、画面は `.pd-*` とトークン参照だけで描く。`src/app/popup` に色の直書きは 0 件（D-2。テストで確認） | `src/components/popup/popup-ds.css` |
| R-4 読み取りの正本 | API・サーバコンポーネント・ホーム・エージェントが同じ関数を呼ぶ。DB は引数で受ける | `src/lib/popup/popup-read.ts`（`listSites` / `getSiteDetail` / `getPopupForEdit` / `getPopupDaily` / `getPopupSummary`） |
| R-4 書き込みの正本 | 提案の作成・案の編集と公開 | `src/lib/popup/propose.ts`・`src/lib/popup/popup-write.ts` |
| ホームの「集客の数字（7日）」 | `getPopupSummary(db, userId, 7)`。サイトが無ければ `siteCount: 0`（ホームはカードを出さない） | `popup-read.ts` |
| R-5 自社プロフィールの予約列 | `PopupSite.companyProfileId String?`（null 可・FK なし） | `prisma/schema.prisma`。**本番 DB に未反映**（下の SQL） |
| R-7 公開画面 | `/api/popup/public/*` と `public/popup/embed.js` は AppShell の対象外（`routes.public`） | — |
| §5 エージェントの道具 | `popup.stats`（read・承認不要）/ `popup.proposeDrafts`（reversible・low・設定次第）/ `popup.publish`（irreversible・承認必須）。入出力は zod の strict | `src/lib/popup/agent-tools.ts` |
| §11 状態表示 | 読込（骨組み・300ms 未満は出さない）・空（イラスト＋一文＋ボタン1つ）・エラー（`/empty/error.svg`＋「もう一度」）・権限なし（`/empty/forbidden.svg`＋誰に頼むか）・処理中（段階表示・閉じても結果が残る）・成功（上部トースト3秒・取り消せる操作は「元に戻す」）。`alert()` / `confirm()` は使わない | `src/components/popup/ui.tsx`、`src/app/popup/error.tsx`、各 `loading.tsx` |
| §11 初期表示 | サーバコンポーネントで `popup-read.ts` から取り、操作する部分だけ `'use client'` | `src/app/popup/**/page.tsx` |
| §12 画像 | アイコン・マスコット・ヒーロー・手順3枚・空状態・処理中・設置例・OGP | `docs/design/images/popup/PROMPTS.md` |
| 目視確認 | 375px / 1280px で LP・トップ（一覧あり・空）・サイト詳細・編集・権限なし・エラー・読込・処理中を確認（2026-10-18）。横スクロール無し、タップできるものは 44px 以上 | `/popup/dev/states` |

目視確認で見つけて直したもの:
- 編集画面の「PC」プレビューが、欄の幅が 768px 未満のためスマホ表示になっていた → PC は幅 1280px で描いて欄の幅に縮小する
- 375px でポップアップのカードが右にはみ出していた（プレビューを測る前に 1280px で描き、グリッドの列が広がっていた）→ 測るまでは欄の幅いっぱい、列は `minmax(0,1fr)`
- 権限なし・エラーのイラスト（SVG）が Next.js の画像最適化で 400 になっていた → SVG は `unoptimized`
- 期間の切り替え・サイトのURL・色の見本のタップ領域が 44px 未満 → 44px に

### 本番 DB に反映が要るもの（R-5）

```sql
ALTER TABLE "popup_site" ADD COLUMN IF NOT EXISTS "companyProfileId" TEXT;
```

追加のみ・null 可で、既存の行とアプリの動作には影響しない。**main に入れる前に反映する**（反映前にデプロイすると `popup_site` を読むすべての問い合わせが P2022 で落ちる）。

### 段0への接続（2026-10-18。ブランチ `feat/doya-popup-shell`、段0 `feat/ds-shell` 58e28ab2 の上）

- `src/app/popup/layout.tsx` がフラグ `isShellEnabled('popup')`（環境変数 `UI_SHELL_SERVICES`）を見て、ON のときだけ `PopupShellFrame`（AppShell＋ToolFrame）で包む。OFF の間は従来の `PopupAppLayout`。ページ本体と API は変えていない
- ナビは `src/lib/popup/nav.ts` の `POPUP_NAV`（段0の `ShellNavItem`）。ToolFrame の `nav` に渡す。アイコンは関数なので、サーバの layout からではなくクライアントの `PopupShellFrame` が読む
- ToolFrame がページの見出し（h1）を出すので、シェルの中ではページの見出しを h2 にする（`shell-context.ts`）。トップは同じ見出しと説明が重なるので出さない
- トークンは段0の `.ds`（`src/components/ds/tokens.module.css`）を正本にした。`popup-ds.css` には段0に無い値（エラーの色・骨組み・グラフ・面）だけを残した
- 空・エラー・権限なし・数字のタイル・バッジは段0の部品（`EmptyState` / `StatTile` / `Badge` / `Button`）。骨組みは実物と同じ形にしたいので、ポップアップのものを使う
- 目視確認（2026-10-18）: `/popup/dev/states?s=home|site&shell=1` を 375px と 1280px で確認。横スクロール無し、h1 は ToolFrame の1つだけ、サイドバーの「集める」にポップアップ（開発中）が出る
- テスト: layout がフラグを見ていること、ToolFrame に `POPUP_NAV` を渡していることを確認（`read.test.ts`）

残り: `POPUP_NAV` をマニフェストの `ui.nav[]` に移す（Phase0 で `src/services/popup/manifest.ts` を作るとき）

## 15. マニフェスト草案（統合仕様 R-8。Phase0 で `src/services/popup/manifest.ts` に移す）

```ts
export const manifest: ServiceManifest = {
  id: 'popup',
  name: 'ドヤポップアップ',
  stage: 'collect',
  status: 'hidden',                      // 開発中（UNLISTED_SERVICE_IDS）。公開時に 'active'
  landing: '/popup',

  dataModels: [
    { model: 'PopupSite', tenantColumn: 'userId' },
    { model: 'Popup', tenantColumn: 'userId' },
    { model: 'PopupStat', tenantColumn: 'via:popup' },
  ],
  tenantExceptions: [],

  pii: { columns: [], purgeCron: null },  // 訪問者の個人情報（IP・Cookie・UA）は保存しない

  routes: {
    public: [
      { path: '/api/popup/public/config', reason: '埋め込みタグが公開中の案を読む', guard: 'none' },          // Origin が登録ドメインのときだけ応答
      { path: '/api/popup/public/track', reason: '埋め込みタグが表示・クリック・閉じるを数える', guard: 'none' }, // 同上・公開中の案だけ
      { path: '/api/popup/public/image/[id]', reason: '公開中の案の画像を配信', guard: 'none' },               // 公開中か持ち主だけ
    ],
    guestShared: [],
    cron: [],
    cronLaunch: [],
  },
  guestAccess: { enabled: false },
  webhooks: [],
  integrations: [],
  storage: [{ bucket: 'popup', pathPrefix: '', public: false, retentionDays: null, purgeCron: null }],
  jobs: [],

  externalApis: [
    { name: 'claude-text', paid: true, via: 'llm-gateway', keyLabel: 'popup' },   // asklink の readSite / generateLinks / generateBannerCopy（seo/lib/gemini 経由・Gemini へフォールバック）
    { name: 'user-url-fetch', paid: false, via: 'safe-fetch', fetchesUserUrls: true },
  ],

  agentTools: [
    // 定義の正本は src/lib/popup/agent-tools.ts（popupStatsTool / popupProposeDraftsTool / popupPublishTool）
    { key: 'popup.stats', reversibility: 'read', costClass: 'none', estimatedPaidCalls: 0, minServiceRole: 'member' },
    { key: 'popup.proposeDrafts', reversibility: 'reversible', costClass: 'low', estimatedPaidCalls: 8, minServiceRole: 'member' },
    { key: 'popup.publish', reversibility: 'irreversible', costClass: 'none', estimatedPaidCalls: 0, minServiceRole: 'member' },  // 承認必須
  ],

  usage: {
    meters: [
      { key: 'popup.proposal', label: 'ポップアップの提案', free: { lifetime: 3 }, pro: { monthly: 30 }, enterprise: { monthly: 100 } },
      { key: 'popup.site', label: 'サイトの登録', free: { lifetime: 1 }, pro: null, enterprise: null },
    ],
  },

  audit: { events: ['popup.site.create', 'popup.site.delete', 'popup.popup.update', 'popup.popup.publish', 'popup.popup.pause', 'popup.popup.delete'] },
  notifications: { types: [] },
  featureFlags: ['ui.shell.popup'],

  ui: {
    japaneseOnly: true,
    noEmojiIcons: true,
    minViewportPx: 375,
    nav: [
      { label: 'サイトとポップアップ', href: '/popup', icon: 'popup' },
      { label: '料金プラン', href: '/popup/pricing', icon: 'pricing' },
    ],                                     // 正本は src/lib/popup/nav.ts
  },

  // §18.3 初期セットアップ: 会社情報の URL から PopupSite を1件（サイトキーだけ発行。ポップアップは作らない）。冪等キーは userId + host
  // §18.2 ObjectLink.fromType: 'popup.site'
  // §4 ホーム: 集客の数字（7日）= popup-read.ts の getPopupSummary(db, userId, 7)
}
```

## 16. 本番への反映（2026-10-18。ユーザーの承認の上で実施）

1. 本番DBに `popup_site.companyProfileId`（text・null 可）を追加。既存の1件はそのまま
2. R-1〜R-8 の対応（c8c143b4）と、作り直したアイコン（866fd6d8）を main に反映（318841cb → 866fd6d8）
3. 公開の切り替え（このコミット）。LP に構造化データ（`LpJsonLd`）を足した（asklink と同じ）

戻し方:
- 公開の切り替えだけを戻す: このコミットを `git revert` して main に push する（UNLISTED に戻り、LP は noindex に戻る。データは変わらない）
- R-1〜R-8 の対応を戻す: 866fd6d8・c8c143b4 を revert する。`companyProfileId` の列は残してよい（null 可・どこからも必須にしていない）
