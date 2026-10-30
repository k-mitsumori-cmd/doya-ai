# 「ドヤAI」の表示の洗い出し（2026-10-30）

ドヤAI → **ドヤバディ**（英語 DOYA BUDDY）の名前の変更の準備です。本人の決定（2026-10-30）、一覧は Obsidian「ドヤAI_09_ドヤバディへの名前の変更_やることの一覧」。

- 調べた範囲: `src` `seo` `public` `prisma` `scripts` `next.config.js` `vercel.json`（検索語は「ドヤAI」。「Doya AI」「DoyaAI」「ドヤマーケAI」は別に表の下で数えた）。ドキュメント（docs・reference）は含めていない。
- コードの中の識別名（doya-ai、doya_ai など）は変えない。
- 下の表は「ファイル → 件数 → 代表の1行」。切り替えの旗（BRAND_RENAME_ROLLOUT）をオフにしている間は、どれも今の表示のまま。

- 合計: **478件**（282ファイル）。


## 切り替えの仕組み（旗の裏）

- 旗: `NEXT_PUBLIC_BRAND_RENAME_ROLLOUT`（`off` が既定。`all` で「ドヤバディ」に切り替わる）。画面（クライアント）でも読むので `NEXT_PUBLIC_` を付けた。値を変えたら再デプロイが要る。
- 正本: `src/lib/brand/`（`brandName()`・`brandNameEn()`・`brandNameWithFormer()`・`brandAlternateNames()`・`brandText()`）。旗が off の間は、どの関数も今の「ドヤAI」のままの結果を返す。
- `brandText()` は、サービス名の「ドヤAI」だけを置き換える。ツールの名前（ドヤAIO・ドヤAI質問リンク・ドヤAI商談）と、URL・識別名（doya-ai）は変えない。
- すでに旗の裏でつないだ所（旗が off の間は、いまの表示のまま。試験で確かめた）:
  1. サイト名・タグライン・説明文・別名の一覧（`src/lib/seo.ts` の `SITE_CONFIG`・`SITE_ALTERNATE_NAMES`）。切り替え後は alternateName に「ドヤAI」「DOYA AI」「Doya AI」「DoyaAI」を入れる。
  2. トップの `<title>`（`SERVICE_SEO.portal.title`）。切り替え後は「ドヤバディ（旧ドヤAI） | AI SaaSサービス群」。説明文・キーワードも切り替わる。
  3. メール送信（`src/lib/email.ts` の `sendEmail`）。切り替え後は、送り主の名前・件名・本文の「ドヤAI」が「ドヤバディ」になる。ただし送り主の名前は環境変数 `RESEND_FROM_EMAIL` の中にあるので、旗とは別に、切り替える日に値も確かめる。
- まだつないでいない所: 上の表の、画面の文言（G）・lib の定数（E）・AI の指示文（C）・public（D）。切り替える日までに、表の順に `brandText()` を通す形へ直す（直す所と順番は、統括の監査のあとに決める）。

## A. title・meta・OGP・構造化データ・サイトマップ・llms.txt・manifest（14ファイル・39件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `src/lib/seo.ts:11` | 17 | name: 'ドヤAI', |
| `prisma/schema.prisma:122` | 8 | // 三ツ星アプリ Vol.01 ナグサメ（toCシリーズ、ドヤAIとは独立） |
| `src/components/opening/OpeningAppLayout.tsx:58` | 2 | ドヤAIポータル |
| `public/site.webmanifest:2` | 2 | "name": "ドヤAI", |
| `src/app/llms.txt/route.ts:18` | 1 | '# ドヤAI', |
| `src/app/llms-full.txt/route.ts:15` | 1 | '# ドヤAI — 詳細版', |
| `src/app/layout.tsx:51` | 1 | alt: 'ドヤAI - AI SaaSサービス群', |
| `src/app/(mitsuboshi)/layout.tsx:6` | 1 | * ただしドヤAIのヘッダー・サイドバー・ToolSwitcher は一切 import しない。 |
| `src/app/(shell)/seo/Lp.tsx:26` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/seo/create/page.tsx:325` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/banner/landing/layout.tsx:25` | 1 | images: [{ url: ogImage, width: 1200, height: 630, alt: '${SVC.name} - ドヤAI' }], |
| `src/app/(shell)/banner/layout.tsx:14` | 1 | // ルートlayoutのtemplateで末尾に「\| ドヤAI」が付く。 |
| `src/app/pricing/layout.tsx:7` | 1 | // absolute でルートlayoutの template（' \| ドヤAI'）の二重付与を防ぐ |
| `seo/lib/gemini.ts:159` | 1 | meta: { app: 'ドヤAI', kind: 'billing', severity: 'urgent' }, |

## B. メール・ドリップ・通知（送り主の名前・件名・本文）（15ファイル・70件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `src/lib/slack/notify.test.ts:16` | 24 | assert.equal(stripEmoji(':tada: *【ドヤAI】無料会員が登録しました*'), '*【ドヤAI】無料会員が登録しました*') |
| `scripts/seed-drip.ts:53` | 11 | <h1 style="color:#fff;font-size:18px;margin:0;font-weight:800;">ドヤAI</h1> |
| `src/lib/notifications.ts:101` | 6 | system: 'ドヤAI (09_Cursol・Next.js/Prisma)', |
| `src/app/api/drip/unsubscribe/route.ts:105` | 5 | <title>配信停止 - ドヤAI</title> |
| `src/lib/support-chat/mail.ts:22` | 4 | const subject = '【ドヤAI】お問い合わせへのご返信（受付番号 ${input.ticketNo}）' |
| `scripts/drip/content/backup-2026-10-06-steps.json:62` | 4 | "bodyHtml": "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\… |
| `src/app/api/admin/drip/seed/route.ts:39` | 3 | prisma.dripTemplate.create({ data: { name: 'D0_ウェルカム', subject: 'ドヤAIへのご登録ありがとうございます — 三… |
| `src/lib/slack/notify.ts:38` | 3 | /** アプリ名（例: ドヤAI / 呪い日記 / 弊社、限界につき。） */ |
| `scripts/drip/content/video-library-2026-10.json:107` | 3 | "lead": ["自社サービスのURLや資料を入れるだけで、AIが見込み客と音声で一次商談をし、議事録・ヒアリング結果・適合スコアまで残す「ドヤAI商談」を開発しました。",… |
| `scripts/drip/video-email.mjs:23` | 2 | aio: { name: 'ドヤAIO', path: '/aio' }, |
| `src/app/admin/drip/settings/page.tsx:176` | 1 | placeholder="例: ドヤAI" |
| `src/app/api/inbound-email/route.ts:93` | 1 | ], undefined, { app: 'ドヤAI', kind: 'inquiry', severity: 'action' }) |
| `src/app/api/admin/drip/settings/route.ts:21` | 1 | fromName: 'ドヤAI', |
| `src/app/api/cron/drip-sender/route.ts:329` | 1 | fromName: (map.fromName as string) \|\| 'ドヤAI', |
| `src/lib/interviewx/email.ts:37` | 1 | subject: '【ヒヤリングのお願い】${params.companyName \|\| 'ドヤAI'}より - ${params.projectTitle}', |

## C. AI の指示文・チャット（システムプロンプト、AI に渡す名前）（20ファイル・30件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `src/lib/support-chat/knowledge.ts:4` | 6 | // 答えの範囲は「ドヤAIの説明・料金・使い方」に限る（設計書 4.1）。材料はここに集める。 |
| `src/lib/support-chat/support-chat.test.ts:197` | 4 | assert.match(styled.text.split('\n')[0], /^\*【要対応】ドヤAI｜お問い合わせ：/) |
| `src/app/(shell)/interview/pricing/page.tsx:23` | 2 | a: 'ドヤインタビューのプロ機能に加え、ドヤAIの全サービス（SEO・バナー・ペルソナなど）がプロプランとして解放されます。1つのご契約ですべてのサービスをプロ品質でご利用い… |
| `src/lib/system-watch/run.ts:60` | 2 | // 見出しの1行目は件名だけにする（共通の送り口が「【重さ】ドヤAI｜種類：件名」に整える） |
| `src/app/api/support-chat/ticket/route.ts:8` | 1 | // Slack の送り先は、今のドヤAIの通知と同じ SystemSetting の slack_webhook（postToSlackBlocks）。新しい送り先は作らない。 |
| `src/app/api/cron/system-watch-paid/route.ts:16` | 1 | // ドヤAIの常時確認（有料の API を使う分） |
| `src/app/api/cron/system-watch/route.ts:10` | 1 | // ドヤAIの常時確認（有料の API を使わない分・10分ごと） |
| `src/app/(shell)/interview/Lp.tsx:24` | 1 | eyebrow="ドヤAI" |
| `src/components/support-chat/SupportChat.tsx:251` | 1 | <span className={styles.eyebrow}>{toolName ? '${toolName}を表示中' : 'ドヤAI サポート'}</span> |
| `src/components/agent-router/useDoyaPrefill.ts:3` | 1 | // ツールの画面で、ドヤAIが渡した値を、最初に1回だけ入力欄へ入れる |
| `src/lib/support-chat/prompt.ts:12` | 1 | 'あなたは、中小企業向けの AI ツール「ドヤAI」のサポート担当です。利用者の質問に、日本語の丁寧な敬語で答えます。', |
| `src/lib/support-chat/ticket.ts:97` | 1 | return { app: 'ドヤAI', kind: 'inquiry', severity: severityOf(category) } |
| `src/lib/agent-router/router.ts:31` | 1 | 'あなたは、業務ツール群「ドヤAI」の受付です。利用者の依頼の文を読み、どのツールのどの操作で進めるかを1つ選びます。', |
| `src/lib/agent-router/catalog.test.ts:2` | 1 | // ドヤAIが選べる操作の一覧と、組織の入口が値を運ぶ部品の回帰テスト。 |
| `src/lib/agent-router/types.ts:2` | 1 | // 経営ホームの「ドヤAIに頼む」：依頼を読んで、ツールと操作を選ぶ仕組みの型 |
| `src/lib/agent-router/catalog.ts:2` | 1 | // ドヤAIが選べる「ツールの操作」の一覧（AI に渡す選択肢） |
| `src/lib/system-watch/types.ts:1` | 1 | // ドヤAIの常時確認（system-watch）の型。 |
| `src/lib/system-watch/checks.ts:1` | 1 | // ドヤAIの常時確認の一覧（有料の API を使わない分）。 |
| `src/lib/system-watch/agent-checks.ts:48` | 1 | { url: 'https://doya-ai.surisuta.jp/', note: 'ドヤAI（本文 約2,400字、UTF-8）' }, |
| `scripts/system-watch-dry.ts:4` | 1 | // ⚠️ 本番 DB を読む（読むだけ）。2026-10-26 にユーザーが許可した（Obsidian のドヤAI_03）。作成・変更・削除はしない。 |

## D. public の静的ファイル（6ファイル・10件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `public/renewal-comparison/capture-info.json:16` | 4 | "aio": "ドヤAIO", |
| `public/renewal-comparison/cinematic.html:13` | 2 | <div class="controls"><label>サービス<select id="service"><option value="banner">ドヤバナーAI</op… |
| `public/resources/doya-ai/checklist.html:1` | 1 | <!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content… |
| `public/resources/doya-ai/overview.html:1` | 1 | <!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content… |
| `public/resources/doya-ai/getting-started.html:1` | 1 | <!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content… |
| `public/renewal-comparison/index.html:1` | 1 | <!doctype html><html lang="ja"><head><script>if(location.protocol==="file:")location.rep… |

## E. lib の定数・文言（54ファイル・76件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `src/lib/services.ts:3` | 8 | // ドヤAIポータル サービス定義 |
| `src/lib/spend-report.ts:19` | 6 | // ドヤAI は Generation（サービス別）、ゲーム3本は Supabase の PostgREST。 |
| `src/lib/alert.ts:172` | 3 | text: { type: 'plain_text', text: '【${opts.systemName \|\| 'ドヤAI'}・${label}】${title}'.sl… |
| `src/lib/service-usage.ts:183` | 3 | : 'なし（ドヤAIで初めて触ったサービス）' |
| `src/lib/runtime-alert.ts:217` | 2 | '【要対応・エラー】ドヤAI', |
| `src/lib/quote/market.ts:4` | 2 | // ⚠️ この数字の出所は、ドヤAIのメディアで公開している施策別の相場記事。 |
| `src/lib/pricing.ts:905` | 2 | 'mailto:info@surisuta.jp?subject=' + encodeURIComponent('ドヤAI 機能拡張のご相談') |
| `src/lib/aio/engines.ts:2` | 2 | // ドヤAIO エンジンアダプタ |
| `src/lib/tools.ts:1` | 2 | // ドヤAI ツール一覧 |
| `src/lib/tenjikai/engine.ts:112` | 2 | brand: 'ドヤAI', |
| `src/lib/billing-report-delivery.ts:35` | 1 | send: (text: string) => Promise<void> = (text) => postPlainToSlack(text, { app: 'ドヤAI', … |
| `src/lib/unified-plan.ts:45` | 1 | proNote: 'プロプランを1つ契約すると、ドヤAIの全サービスでプロ機能（上限アップ）が使えるようになります。', |
| `src/lib/analytics-report.ts:216` | 1 | body: JSON.stringify(voicePayload({ text }, { app: 'ドヤAI', kind: 'report', severity: 'in… |
| `src/lib/aishodan/useRealtimeMeeting.ts:4` | 1 | // ドヤAI商談 Realtime接続フック（クライアント） |
| `src/lib/aishodan/knowledge.ts:2` | 1 | // ドヤAI商談 ナレッジ取り込み＋検索（RAG） |
| `src/lib/aishodan/evaluate.ts:2` | 1 | // ドヤAI商談 商談後の要約・フィットスコア算出 |
| `src/lib/aishodan/scheduling.ts:2` | 1 | // ドヤAI商談 日程調整リンク |
| `src/lib/aishodan/defaults.ts:2` | 1 | // ドヤAI商談 シナリオの既定値 |
| `src/lib/aishodan/nav.ts:2` | 1 | // ドヤAI商談 ツール内ナビ（データ） |
| `src/lib/aishodan/engine.ts:2` | 1 | // ドヤAI商談 進行エンジン（フェーズ・ステートマシン） |
| `src/lib/aishodan/types.ts:2` | 1 | // ドヤAI商談（aishodan）型定義 |
| `src/lib/aishodan/session.ts:2` | 1 | // ドヤAI商談 セッションの解決（ゲスト向けAPI共通） |
| `src/lib/aishodan/access.ts:2` | 1 | // ドヤAI商談（aishodan）認証・組織スコープ（mensetsu / sfa 準拠） |
| `src/lib/aishodan/public.ts:2` | 1 | // ドヤAI商談 ゲスト向け公開境界 |
| `src/lib/aio/analyze.ts:2` | 1 | // ドヤAIO 回答パーサー |
| `src/lib/aio/scan.ts:2` | 1 | // ドヤAIO スキャン中核 |
| `src/lib/aio/nav.ts:2` | 1 | // ドヤAIO ツール内ナビ（データ） |
| `src/lib/aio/types.ts:2` | 1 | // ドヤAIO（AI可視性・AEO）型定義 |
| `src/lib/aio/access.ts:2` | 1 | // ドヤAIO（AI可視性・AEO）認証・組織スコープ（SFA準拠） |
| `src/lib/aio/client.ts:2` | 1 | // ドヤAIO（AI可視性・AEO）クライアント側 fetch ヘルパー |
| `src/lib/aio/suggest.ts:2` | 1 | // ドヤAIO クイックスタート補助 |
| `src/lib/aio/run.ts:2` | 1 | // ドヤAIO スキャン永続化の共通ロジック |
| `src/lib/attribution.ts:58` | 1 | aio: 'ドヤAIO', |
| `src/lib/promane/limits.ts:4` | 1 | // ドヤAI 統一プラン方式に準拠 |
| `src/lib/realtime/hallucination.ts:8` | 1 | //    2026-08-09 の実機テスト（ドヤAI商談）で実際に発生し、 |
| `src/lib/agent-orchestration/tools.ts:215` | 1 | const doc = await deps.call('quote.create', { title: labeled(deps, '${a.offerLabel}のお見積り… |
| `src/lib/doyalist/limits.ts:4` | 1 | // 統一プラン方式: ドヤAI課金で全サービスPRO利用可 |
| `src/lib/adimage/brand.ts:71` | 1 | *    他社サイトを読んでもドヤAIの青が使われていた（2026-09-02）。 |
| `src/lib/tenjikai/design-kit.ts:108` | 1 | if (!isHex(src.primary)) prov.primary = { from: 'default', note: '色を読み取れなかったため、ドヤAIの青' } |
| `src/lib/annual-report/report.ts:2` | 1 | // ドヤAI 年間レポート（共有できる画像）の集計 |
| `src/lib/annual-report/render.server.ts:157` | 1 | text('ドヤAI 年間レポート ${r.year}', { fontSize: 24, fontWeight: 700, color: C.ink }), |
| `src/lib/service-operations-data.ts:4` | 1 | { key: 'doya', name: 'ドヤAI', webhook: '', path: 'https://doya-ai.surisuta.jp/' }, |
| `src/lib/mitsuboshi/_shared/constants.ts:5` | 1 | * ドヤAI（B向けSaaS）とは完全に独立したブランドとして扱う。 |
| `src/lib/asklink/banner.ts:2` | 1 | // ドヤAI質問リンク ポップアップ用バナー（4-3） |
| `src/lib/asklink/dto.ts:1` | 1 | // ドヤAI質問リンク 画面へ返す形への変換（署名URLは都度発行し、DBには保存しない） |
| `src/lib/asklink/nav.ts:2` | 1 | // ドヤAI質問リンク ツール内ナビ（データ） |
| `src/lib/asklink/site.ts:2` | 1 | // ドヤAI質問リンク サイトの読み取り（4-1） |
| `src/lib/asklink/types.ts:1` | 1 | // ドヤAI質問リンク 型定義（仕様: reference/services/asklink.md） |
| `src/lib/asklink/access.ts:2` | 1 | // ドヤAI質問リンク 認証・利用枠 |
| `src/lib/asklink/generate.ts:2` | 1 | // ドヤAI質問リンク 質問文とバナー文言の生成（4-2 / 4-3） |
| `src/lib/asklink/link.ts:2` | 1 | // ドヤAI質問リンク: URLの組み立てと機械チェック |
| `src/lib/service-operations-daily.ts:51` | 1 | if (unresolved.length && !dry) await sendOps('doya', '【ドヤAI・要確認】対応管理に未完了の問い合わせがあります\n未完了… |
| `src/lib/totp.ts:3` | 1 | const ISSUER = 'ドヤAI Admin' |
| `src/lib/service-operations-cost.ts:24` | 1 | if (warnings.length) await sendOps('doya', ['【ドヤAI・要確認】費用の増え方を確認してください', ...warnings, no… |

## F. scripts（検証・運用。表示には出ない）（12ファイル・15件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `scripts/wire-round3-diagrams.mjs:7` | 2 | shodan: ['src/app/(shell)/shodan/Lp.tsx', 'ドヤ商談準備', '#ffd400'], aio: ['src/app/(shell)/a… |
| `scripts/recordings/doyamarke-services.json:25` | 2 | { "order": 13, "id": "aio", "name": "ドヤAIO", "tier": "public", "route": "/aio", "capture… |
| `scripts/build-doyamarke-ui-demo-videos.mjs:24` | 2 | { id: 'aio', name: 'ドヤAIO', scope: 'public' }, |
| `scripts/aio-scan-test.ts:1` | 1 | // ドヤAIO 実スキャン検証スクリプト（DB/認証を介さず executeScan を直接実行） |
| `scripts/build-doyamarke-service-banner-specs.mjs:97` | 1 | id: 'aio', name: 'ドヤAIO', category: 'AEO / AI visibility analytics', colors: ['#8B5CF6',… |
| `scripts/adbanner-pipeline-test.ts:9` | 1 | serviceName: 'ドヤAIO', |
| `scripts/health-check-readonly.ts:3` | 1 | // ⚠️ 本番 DB を読む（読むだけ）。2026-10-26 にユーザーが許可した（Obsidian のドヤAI_03）。作成・変更・削除はしない。 |
| `scripts/security-regression/verify-unified-pricing-org.cjs:16` | 1 | const service = { id: 'aio', name: 'ドヤAIO', order: 1, dashboardHref: '/aio', |
| `scripts/security-regression/verify-aio-plan-cta.cjs:1` | 1 | // ドヤAIO のプランの案内（2026-10-24 に古いサイドバー AioSidebar を消したあと）。 |
| `scripts/security-regression/verify-cunning-beta-hidden.cjs:127` | 1 | const seo = { SITE_CONFIG: { url: 'https://example.invalid', name: 'ドヤAI' } } |
| `scripts/finalize-doyamarke-full-imagegen-banners.mjs:29` | 1 | ["aio", "ドヤAIO"], |
| `scripts/adbanner-sample.ts:22` | 1 | serviceName: 'ドヤAIO', appeal: 'AIに選ばれる', appealAxis: 'ベネフィット訴求', |

## G. 画面の文言（コンポーネント・ページ）（161ファイル・238件）

| ファイル | 件数 | 代表の1行 |
|---|---|---|
| `src/components/home-agent/HomeAgent.tsx:260` | 9 | // 「ドヤAIに頼む」: AI が依頼を読み、ツールと操作を選ぶ（/api/agent/route）。読んでいる間・画面を開いている間の表示 |
| `src/components/shell-next/DeptShellSample.tsx:7` | 8 | // ⚠️ 色・書体・ドヤくんの部品は今のドヤAI（ds のトークンと DoyaKun）。動きは位置と透明度だけ。 |
| `src/app/campaign/case-study/page.tsx:8` | 5 | title: { absolute: '活用事例・ロゴ掲載キャンペーン｜6ヶ月無料 \| ドヤAI' }, |
| `src/app/(shell)/aishodan/Lp.tsx:3` | 4 | // ドヤAI商談 ランディングページ（未ログインの方に見せる面） |
| `src/app/(shell)/promane/pricing/page.tsx:15` | 4 | 'プロプラン（¥9,980／月）では各種上限が大幅に緩和され、ドヤプロマネのすべての機能をご利用いただけます。さらに、ドヤAIの他サービスもすべてプロ機能として解放されます。', |
| `src/app/all-in-one/page.tsx:14` | 4 | 'プロプランを1つ契約するだけで、ドヤAIの全サービスのプロ機能をプラン別の上限内で利用できます。記事・バナー・営業リスト・人事・勤怠・SFAなど、B2Bに必要なAIツールが月… |
| `src/components/lp/renewal/Renewal.tsx:153` | 4 | {props.eyebrow && props.eyebrow !== "ドヤAI" |
| `src/app/adsim/pricing/page.tsx:107` | 3 | ドヤAI は全サービス共通の統一課金。1つ Pro 契約すれば他サービスも Pro 枠で利用可能 |
| `src/app/(shell)/aio/pricing/page.tsx:19` | 3 | <Link href="/aio" className="mt-4 inline-block text-sm font-bold underline">ドヤAIOに戻る</Li… |
| `src/app/(shell)/persona/pricing/page.tsx:7` | 3 | a: 'ペルソナ生成・文章変更を1日30回、追加画像・再生成を1日15枚までご利用いただけます。付属画像はペルソナ1件につき最大16枚まで含まれ、追加枠を消費しません。さらに、… |
| `src/app/(shell)/asklink/Tool.tsx:3` | 3 | // ドヤAI質問リンク 作成画面（ログイン後） |
| `src/components/sidebar/themes.ts:265` | 3 | // ドヤAIO（AI可視性・AEO / ブランド紫 #7f19e6 → fuchsia 系） |
| `src/components/expense/SettingsSections.tsx:219` | 3 | // 応答は、相手がドヤAIに登録しているかどうかで変わらない |
| `src/components/brand/DoyaLogo.tsx:2` | 3 | // ドヤAI のロゴ（記号＋文字） |
| `src/components/aio/ui.tsx:3` | 3 | // ドヤAIO 共通UIパーツ（ドヤAIデザイン言語：ブランド紫 #0066ff・ドヤくん・浮遊ドット） |
| `src/app/tokushoho/page.tsx:7` | 2 | description: '株式会社スリスタが運営するドヤAIの特定商取引法に基づく表記', |
| `src/app/privacy/page.tsx:5` | 2 | description: '株式会社スリスタが運営するドヤAI（ドヤバナーAI・ドヤ記事作成 等の各サービス）共通のプライバシーポリシー', |
| `src/app/terms/page.tsx:7` | 2 | description: '株式会社スリスタが運営するドヤAI（ドヤバナーAI・ドヤ記事作成 等の各サービス）共通の利用規約', |
| `src/app/api/aishodan/members/route.ts:113` | 2 | subject: '【ドヤAI商談】${c.organizationName} に招待されました', |
| `src/app/api/aio/members/route.ts:94` | 2 | subject: '【ドヤAIO】${esc(org?.name \|\| '組織')}からの招待', |
| `src/app/api/agent/route/route.ts:6` | 2 | // POST /api/agent/route — 依頼を読んで、どのツールのどの操作で進めるかを返す（経営ホームの「ドヤAIに頼む」） |
| `src/app/(shell)/expense/page.tsx:11` | 2 | /** ドヤAIの「頼む」から来たときに、組織の中で開いてよい画面（?to=） */ |
| `src/app/(shell)/aishodan/Tool.tsx:4` | 2 | // ドヤAI商談 ダッシュボード（ホスト向け） |
| `src/app/(shell)/aishodan/preview/page.tsx:4` | 2 | // ドヤAI商談 練習モード（ホスト向け） |
| `src/app/(shell)/aishodan/pricing/page.tsx:18` | 2 | ドヤAI商談に戻る |
| `src/app/(shell)/income/Lp.tsx:42` | 2 | eyebrow="ドヤAI" |
| `src/app/(shell)/aio/Lp.tsx:47` | 2 | <LpShell serviceName="ドヤAIO" icon="query_stats" ctaHref={CTA} loginHref="/auth/signin?ca… |
| `src/app/(shell)/promane/PromaneLp.tsx:38` | 2 | { q: '無料で使えますか？', a: '無料プランでは${SVC.pricing.free.limit}ご利用いただけます。プロプラン（月額9,980円）にすると案件数が無… |
| `src/app/(shell)/doyalist/pricing/page.tsx:84` | 2 | <Faq q="他のドヤAIサービスも使えますか?" a="PROに加入いただくと、ドヤリスト・ドヤ勤怠・ドヤバナーAI・ドヤ記事作成・ドヤインタビュー等、すべてのドヤAIサー… |
| `src/app/(shell)/shanai/Lp.tsx:69` | 2 | eyebrow="ドヤAI" |
| `src/app/(shell)/asklink/Lp.tsx:3` | 2 | // ドヤAI質問リンク ランディングページ（未ログインの方に見せる面） |
| `src/app/(shell)/asklink/pricing/page.tsx:19` | 2 | ドヤAI質問リンクに戻る |
| `src/app/og/[...slug]/route.tsx:33` | 2 | const title = svc?.name \|\| 'ドヤAI' |
| `src/app/page.tsx:19` | 2 | serviceName="ドヤAI" |
| `src/app/not-found.tsx:4` | 2 | // 新しい見た目（ドヤAI の青）にそろえる。古いブランドの紫のグラデーションと、 |
| `src/components/expense/next.tsx:50` | 2 | <p className="mt-1 text-[14px] leading-[1.7] text-[var(--sub)]">ドヤAIは、1つのアカウントで1つの会社を扱いま… |
| `src/components/expense/ContractForm.tsx:105` | 2 | // ドヤAIの「頼む」から来たときは、読み取った名称・金額（円）・開始日を入れた状態にする（保存は本人が押す） |
| `src/components/shell-next/model.ts:136` | 2 | { toolId: 'aio', name: 'ドヤAIO', hint: 'AI検索での見え方を調べる' }, |
| `src/components/shell/AppShell.tsx:332` | 2 | <DoyaLogoMark size={28} className={styles.brandMark} />ドヤAI |
| `src/components/lp/LpShell.tsx:98` | 2 | aria-label="ドヤAI トップ" |
| `src/components/BetaServiceNotice.tsx:21` | 2 | いまは一部の方だけが使えます。<wbr />公開の準備ができしだい、<wbr />ドヤAIのツール一覧でお知らせします。 |
| `src/components/aio/AioShellFrame.tsx:3` | 2 | // 共通の枠（AppShell）の中に出すドヤAIOのナビ。AppShell では包まない（枠は (shell)/layout.tsx が出す） |
| `src/components/notice/ShellNotices.tsx:71` | 2 | { pose: 'hello', eyebrow: 'ようこそ', title: 'ドヤAI へようこそ。ドヤくんが案内します', body: '1つの契約で、すべてのツールを… |
| `src/components/tenjikai/Wizard.tsx:43` | 2 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/components/pricing/JoinInvite.tsx:33` | 2 | <p className={base.lead}>参加すると、会社のドヤパワーでドヤAIのツールを使えます。</p> |
| `src/app/slide/page.tsx:130` | 1 | &copy; {new Date().getFullYear()} ドヤスライド — ドヤAIシリーズ |
| `src/app/auth/signin/page.tsx:138` | 1 | ドヤAI |
| `src/app/lp/new/input/page.tsx:259` | 1 | placeholder="例: ドヤAI" |
| `src/app/shell-sample/page.tsx:8` | 1 | export const metadata = { title: '部署別の枠（見本）\| ドヤAI' } |
| `src/app/ds-preview/working/WorkingPreview.tsx:8` | 1 | { name: 'ドヤAI（青）', colors: { primary: '#0066ff', secondary: '#0a0f3c', accent: '#ffd400'… |
| `src/app/slashslide/page.tsx:130` | 1 | &copy; {new Date().getFullYear()} SlashSlide — ドヤAIシリーズ |
| `src/app/kantan/lp-data.ts:26` | 1 | { q: 'プロプランに切り替えるといくらですか？', a: 'プロプランは月額9,980円（税込）で、1日100回まで利用できます。ドヤAIの統一プランなので、他サービスのプ… |
| `src/app/api/expense/members/route.ts:36` | 1 | * ⚠️ そのメールの人がドヤAIに登録しているかどうかで、応答を変えない（システム点検 EXP-F05）。 |
| `src/app/api/kintai/employees/route.ts:197` | 1 | <p style="color: #cbd5e1; font-size: 11px; text-align: center;">ドヤ勤怠 by ドヤAI</p> |
| `src/app/api/kintai/employees/[id]/invite/route.ts:111` | 1 | <p style="color: #cbd5e1; font-size: 11px; text-align: center;">ドヤ勤怠 by ドヤAI</p> |
| `src/app/api/feedback/route.ts:163` | 1 | await postToSlackBlocks(title, blocks, undefined, { app: 'ドヤAI', kind: 'inquiry', severi… |
| `src/app/api/promane/usage/route.ts:21` | 1 | * ドヤAI 共通形式（doyalist/usage と同じレスポンス構造） |
| `src/app/api/promane/invite/route.ts:194` | 1 | <p style="color:#cbd5e1;font-size:10px;margin:12px 0 0;">© スリスタ株式会社 / ドヤAI</p> |
| `src/app/api/campaign/case-study/route.ts:97` | 1 | await postToSlackBlocks(title, blocks, undefined, { app: 'ドヤAI', kind: 'inquiry', severi… |
| `src/app/api/hr/billing/webhook/route.ts:9` | 1 | // HRの課金はドヤAI統一Webhook（/api/stripe/webhook）で処理されるようになりました。 |
| `src/app/api/cron/health-alert/route.ts:26` | 1 | name: 'ドヤAI', |
| `src/app/api/cron/aio-scan/route.ts:20` | 1 | // ドヤAIO 定期スキャン（各組織は7日以上空けて測定） |
| `src/app/api/cron/feedback-report/route.ts:86` | 1 | await postPlainToSlack(lines.join('\n'), { app: 'ドヤAI', kind: 'report', severity: 'info'… |
| `src/app/api/cron/billing-audit/route.ts:78` | 1 | await postPlainToSlack(report.text, { app: 'ドヤAI', kind: 'billing', severity: 'info' }) |
| `src/app/api/stripe/webhook/route.ts:185` | 1 | /** 同じStripeアカウントにある別アプリの請求を、ドヤAIの通知に混ぜない。 */ |
| `src/app/api/stripe/sync/route.ts:76` | 1 | return NextResponse.json({ error: 'この決済はドヤAIの契約ではありません。' }, { status: 403 }) |
| `src/app/copy/lp-data.ts:20` | 1 | { q: '無料で使えますか？', a: '無料プランで月10回まで生成をお試しいただけます。より多く生成したい場合はプロプラン（月額9,980円・税込／月200回）をご用意し… |
| `src/app/(shell)/mensetsu/Lp.tsx:46` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/mensetsu/Tool.tsx:138` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/mensetsu/pricing/page.tsx:22` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/home/HomeDashboard.tsx:252` | 1 | ドヤAIは、1つのアカウントで1つの会社を扱います。 |
| `src/app/(shell)/expense/Lp.tsx:23` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/expense/Entry.tsx:13` | 1 | /** ドヤAIの「頼む」から来たときの行き先と値を、組織の中の画面へ運ぶ（組織を作った直後も含む） */ |
| `src/app/(shell)/expense/pricing/page.tsx:24` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/popup/Lp.tsx:61` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/popup/Tool.tsx:72` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/popup/pricing/page.tsx:26` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/kun-preview/KunPreviewBody.tsx:46` | 1 | <RevealWords as="p" text="ドヤAIが、依頼を読んでいます。ツールと操作を選び、入力の直前まで進めます。" /> |
| `src/app/(shell)/quote/Lp.tsx:55` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/quote/Tool.tsx:158` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/quote/pricing/page.tsx:24` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/kintai/lp-data.ts:23` | 1 | { q: '料金プランを教えてください。', a: '無料プランとプロプラン（月額9,980円・税込）の2つです。プロプランはドヤAIの統一プランで、1契約で全サービスのプロ機… |
| `src/app/(shell)/aishodan/settings/page.tsx:4` | 1 | // ドヤAI商談 設定 |
| `src/app/(shell)/aishodan/mocks.tsx:1` | 1 | // ドヤAI商談 LP用 製品モック（サンプルデータ。実在の企業名は使わない） |
| `src/app/(shell)/aishodan/lp-data.ts:3` | 1 | // ドヤAI商談 LPコンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有） |
| `src/app/(shell)/aishodan/sessions/[id]/page.tsx:4` | 1 | // ドヤAI商談 商談詳細 |
| `src/app/(shell)/aishodan/sessions/page.tsx:4` | 1 | // ドヤAI商談 商談一覧 |
| `src/app/(shell)/aishodan/scenarios/[id]/page.tsx:4` | 1 | // ドヤAI商談 シナリオ編集 |
| `src/app/(shell)/aishodan/dev/states/MockFetch.tsx:4` | 1 | // ドヤAI商談: 画面の状態の見本で使う、見本の応答（開発時だけ） |
| `src/app/(shell)/aishodan/dev/states/page.tsx:2` | 1 | // ドヤAI商談: 画面の状態の見本（開発時だけ。本番では 404） |
| `src/app/(shell)/aishodan/diagram.tsx:4` | 1 | return <ServiceFlowDiagram serviceName="ドヤAI商談" steps={steps} accent="#00e0ff" mood="poi… |
| `src/app/(shell)/aishodan/page.tsx:2` | 1 | // ドヤAI商談 入口 |
| `src/app/(shell)/income/invoices/new/page.tsx:32` | 1 | // ドヤAIの「頼む」から来たときは、読み取った金額（1行目の単価）・件名・支払期日・取引先を入れた状態で開く（保存は本人が押す） |
| `src/app/(shell)/income/lp-data.ts:23` | 1 | { q: '料金はかかりますか？', a: '開発中のため、現在は無料でお使いいただけます。正式公開後はプロプラン（月額${UNIFIED_PRO_PRICE.toLocale… |
| `src/app/(shell)/income/pricing/page.tsx:25` | 1 | 無料で使いはじめて、必要になったらプロプランに切り替えられます。プロプラン1つで、ドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/aio/mocks.tsx:1` | 1 | // ドヤAIO LP 用 製品モック（AI可視性/AEOの様子を表す・サンプルデータ・実在ブランド名なし） |
| `src/app/(shell)/aio/lp-data.ts:3` | 1 | // ドヤAIO LP コンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有） |
| `src/app/(shell)/aio/invite/[token]/page.tsx:118` | 1 | <h1 className="text-xl font-black text-slate-900">ドヤAIOへの招待</h1> |
| `src/app/(shell)/aio/[orgSlug]/settings/page.tsx:171` | 1 | {field('別名・表記ゆれ', 'aliases', '例: ドヤAI, DoyaMarke', 'カンマ区切り、最大30件')} |
| `src/app/(shell)/aio/[orgSlug]/scan/page.tsx:40` | 1 | eyebrow="ドヤAIO" |
| `src/app/(shell)/aio/Entry.tsx:136` | 1 | <LpShell serviceName="ドヤAIO" icon="query_stats" ctaHref={CTA} loginHref="/auth/signin?ca… |
| `src/app/(shell)/aio/diagram.tsx:4` | 1 | return <ServiceFlowDiagram serviceName="ドヤAIO" steps={steps} accent="#00e0ff" mood="poin… |
| `src/app/(shell)/aio/page.tsx:2` | 1 | // ドヤAIO 入口 |
| `src/app/(shell)/promane/[workspaceSlug]/help/page.tsx:139` | 1 | <Faq q="他のドヤAIサービスとはどう違うの？" a="ドヤプロマネは案件管理・収支管理の専用ツールです。ドヤリスト（営業リスト）、ドヤSEO（記事生成）等のドヤAIサー… |
| `src/app/(shell)/doyalist/Lp.tsx:26` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/doyalist/Tool.tsx:124` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/adimage/Lp.tsx:45` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/adimage/Tool.tsx:97` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/adimage/pricing/page.tsx:14` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/hr/lp-data.ts:23` | 1 | { q: '料金プランを教えてください。', a: '無料プランとプロプラン（月額9,980円・税込）の2つです。プロプランはドヤAIの統一プランで、1契約で全サービスのプロ機… |
| `src/app/(shell)/hr/pricing/page.tsx:78` | 1 | ドヤHR は5名まで永久無料。プロプラン1つで、ドヤAIの全サービスのプロ機能をプラン別の上限内で利用できます。 |
| `src/app/(shell)/tenjikai/Lp.tsx:54` | 1 | eyebrow="ドヤAI（開発中）" |
| `src/app/(shell)/shanai/pricing/page.tsx:24` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/doyaslide/Lp.tsx:18` | 1 | <ProductHero eyebrow="ドヤAI" title="テーマを入れたら、" highlight="全ページができている。" subtitle="構成からビジュア… |
| `src/app/(shell)/doyaslide/pricing/page.tsx:43` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/persona/Lp.tsx:26` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/persona/Tool.tsx:267` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/sfa/pricing/page.tsx:51` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/cunning/Lp.tsx:26` | 1 | eyebrow="ドヤAI" |
| `src/app/(shell)/cunning/pricing/page.tsx:42` | 1 | 無料ではじめて、必要になったらプロへ。プロプラン1つでドヤAIの全サービスのプロ機能が使えます。 |
| `src/app/(shell)/asklink/mocks.tsx:1` | 1 | // ドヤAI質問リンク LP用の画面モック（画像が揃うまでの表示。実データは使わない） |
| `src/app/(shell)/asklink/lp-data.ts:3` | 1 | // ドヤAI質問リンク LPコンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有） |
| `src/app/(shell)/asklink/history/[id]/page.tsx:3` | 1 | // ドヤAI質問リンク 結果の詳細（開き直し）。他人のIDは API が 404 を返す |
| `src/app/(shell)/asklink/history/page.tsx:3` | 1 | // ドヤAI質問リンク これまでの結果（自分の分だけ。API側で userId スコープ） |
| `src/app/(shell)/asklink/dev/states/MockFetch.tsx:3` | 1 | // ドヤAI質問リンク 状態の見本: /api/asklink/* の見本の返事（開発時だけ） |
| `src/app/(shell)/asklink/dev/states/page.tsx:2` | 1 | // ドヤAI質問リンク: 画面の状態の見本（開発時だけ。本番では 404） |
| `src/app/(shell)/asklink/diagram.tsx:4` | 1 | return <ServiceFlowDiagram serviceName="ドヤAI質問リンク" steps={steps} accent="#0066ff" mood="… |
| `src/app/(shell)/asklink/page.tsx:2` | 1 | // ドヤAI質問リンク 入口 |
| `src/app/(shell)/shodan/[orgSlug]/new/page.tsx:62` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/(shell)/shodan/Entry.tsx:16` | 1 | /** ドヤAIの「頼む」から来たときの行き先（?to=new）と値（doya_*）を、組織の中の画面へ運ぶ */ |
| `src/app/(shell)/shodan/pricing/page.tsx:33` | 1 | 無料で毎月お試し。プロプラン1つで、ドヤAIの全サービスのプロ機能をプラン別の上限内で利用できます。 |
| `src/app/(shell)/banner/dashboard/create/page.tsx:860` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/app/m/[token]/page.tsx:4` | 1 | // ドヤAI商談 商談ルーム（見込み客向け・未ログイン） |
| `src/app/adbanner/pricing/page.tsx:20` | 1 | <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">無料でお試し。プロプラン1つで、ドヤAIの全サービス… |
| `src/components/mensetsu/Avatar.tsx:4` | 1 | // ドヤ面接官 アバター（ドヤAIのクマ） |
| `src/components/shell-next/demo-route.ts:2` | 1 | // 「ドヤAIに頼む」の結果の見本（パネルの中で確かめ、保存の直前まで進める形を見せるためだけの部品） |
| `src/components/ds/kun.test.ts:46` | 1 | const text = 'ドヤAIが、依頼を読んでいます。ツールと操作を選び、入力の直前まで進めます。' |
| `src/components/shell/DoyaWorking.tsx:35` | 1 | /** 塗る色（ブランドの色）。無いときはドヤAIの青 */ |
| `src/components/UnifiedPricingPlans.tsx:106` | 1 | ドヤAIの全ツールのプロ機能が、月々{UNIFIED_PRO_PRICE_LABEL}で。個別契約も、組み合わせも不要です。 |
| `src/components/AdminSidebar.tsx:93` | 1 | <span className="font-bold text-white block">ドヤAI</span> |
| `src/components/ServiceNav.tsx:71` | 1 | <p className="font-bold text-gray-900">ドヤAIポータル</p> |
| `src/components/lp/primitives.tsx:2` | 1 | // ドヤAI 共通LPデザインキット — プリミティブ |
| `src/components/lp/index.ts:1` | 1 | // ドヤAI 共通LPデザインキット — エクスポート集約 |
| `src/components/aishodan/AishodanShellSwitcher.tsx:3` | 1 | // ドヤAI商談 共通の枠に出す組織の切り替え |
| `src/components/aishodan/AishodanShellFrame.tsx:3` | 1 | // ドヤAI商談 共通の枠の中身（ToolFrame だけ） |
| `src/components/aishodan/failure.tsx:4` | 1 | // ドヤAI商談: 失敗したときの表示（UI 品質 S-20） |
| `src/components/aishodan/AishodanHeading.tsx:4` | 1 | // ドヤAI商談: ページの見出し |
| `src/components/UnifiedPlanPromo.tsx:138` | 1 | で、ドヤAIの |
| `src/components/OnboardingModal.tsx:14` | 1 | description: 'カンタンドヤAIへようこそ！\n文章作成が驚くほどカンタンになります。', |
| `src/components/annual-report/AnnualReportView.tsx:73` | 1 | <h1 className={styles.title}>{year}年のドヤAI</h1> |
| `src/components/doyaslide/NewDoyaSlideWizard.tsx:138` | 1 | // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人） |
| `src/components/OrganizationInvitePage.tsx:11` | 1 | aishodan: { name: 'ドヤAI商談', destination: '商談', access: 'この組織の商材・商談シナリオと商談ログ' }, |
| `src/components/mitsuboshi/layout/MitsuboshiHeader.tsx:5` | 1 | * ドヤAIのヘッダーやサイドバーは一切 import しない。 |
| `src/components/asklink/AskLinkShellFrame.tsx:3` | 1 | // ドヤAI質問リンク 共通の枠の中身（ToolFrame だけ。AppShell では包まない） |
| `src/components/asklink/errors.ts:1` | 1 | // ドヤAI質問リンク 失敗したときの案内（使う） |
| `src/components/asklink/RunResult.tsx:3` | 1 | // ドヤAI質問リンク 結果画面（4-4）。作成直後と履歴の詳細で共用する |
| `src/components/asklink/AskLinkErrorNotice.tsx:3` | 1 | // ドヤAI質問リンク 失敗したときの表示 |
| `src/components/pricing/PricingV2.tsx:261` | 1 | <p>ドヤAIを使う会社のメンバーの人数です。申し込みのときに人数を選び、あとから増やせます。増やした分は、その月の残りの日数で計算します。</p> |
| `src/components/pricing/PricingNext.tsx:205` | 1 | <p>要りません。プロプランを1つ契約すると、ドヤAIの全ツールでプロの上限になります。</p> |
| `src/components/shodan/ui.tsx:3` | 1 | // ドヤ商談準備 共通UIパーツ（ドヤAIデザイン言語：ブランド紫 #0066ff・ドヤくん・浮遊ドット） |
| `src/components/GoogleAnalytics.tsx:58` | 1 | // ドヤAIの「頼む」の鍵（doya_ で始まるもの）は、流入元の記録に入れない（2026-10-29 統括の監査 中1） |
