# 02. アーキテクチャ

## 全体構成図

```
                    ┌─────────────┐
                    │   Vercel    │
                    │ (デプロイ)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │     Next.js 14 App      │
              │    (App Router)         │
              ├─────────────────────────┤
              │  Frontend (React 18)    │
              │  ├─ /banner             │
              │  ├─ /seo               │
              │  ├─ /interview          │
              │  ├─ /tenkai             │
              │  ├─ /persona            │
              │  ├─ /opening            │
              │  ├─ /shindan            │
              │  └─ /admin              │
              ├─────────────────────────┤
              │  API Routes (/api/*)    │
              │  (Server-side)          │
              └──────┬──────┬──────┬────┘
                     │      │      │
         ┌───────────┘      │      └───────────┐
         ▼                  ▼                  ▼
┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Supabase       │ │ Google AI    │ │ Stripe           │
│ (PostgreSQL +  │ │ (Gemini API) │ │ (決済・サブスク)    │
│  Storage)      │ │              │ │                  │
└────────────────┘ └──────────────┘ └──────────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌─────────┐ ┌──────────┐
        │ Gemini   │ │ OpenAI  │ │AssemblyAI│
        │ 2.0 Flash│ │ (備予)   │ │(文字起こし)│
        │ 1.5 Flash│ │ gpt-4o  │ │          │
        │ 3 Pro    │ │         │ │          │
        └──────────┘ └─────────┘ └──────────┘
```

## データフロー

### 1. ユーザー認証フロー
```
ユーザー → Google OAuth → NextAuth.js → Session
                                          ├─ user.id
                                          ├─ user.plan (FREE/PRO/ENTERPRISE)
                                          ├─ user.bannerPlan
                                          ├─ user.seoPlan
                                          ├─ user.interviewPlan
                                          └─ user.firstLoginAt
```

### 2. サービス利用フロー (共通)
```
ユーザーリクエスト
    │
    ▼
API Route (認証チェック)
    │
    ├─ ゲスト → Cookie (guest_id) で回数管理
    │
    ├─ ログインユーザー → UserServiceSubscription で回数管理
    │
    ▼
日次利用制限チェック (pricing.ts)
    │
    ├─ 初回ログイン1時間以内 → 制限緩和
    │
    ▼
AI API 呼出し (Gemini / OpenAI)
    │
    ▼
結果返却 (JSON or SSE ストリーミング)
```

### 3. 決済フロー
```
ユーザー → /pricing → Stripe Checkout → Webhook
                                           │
                                           ▼
                                    UserServiceSubscription 更新
                                    (plan: PRO/ENTERPRISE)
                                           │
                                           ▼
                                    次回セッション更新時に反映
                                    (session callback で DB 再取得)
```

### 4. ファイルアップロードフロー (インタビュー)
```
ブラウザ → POST /api/interview/materials/upload-url
              │ (署名付きURL取得)
              ▼
ブラウザ → PUT Supabase Storage (直接アップロード)
              │ (Vercel 4.5MB制限をバイパス)
              ▼
ブラウザ → POST /api/interview/materials/[id]/confirm
              │
              ▼
サーバー → AssemblyAI (URL渡しで文字起こし)
              │ (ポーリングで完了待ち)
              ▼
DB保存 (InterviewTranscription)
```

## ミドルウェア

`middleware.ts` はスライド専用ドメインのリライト処理のみ。
認証やアクセス制御はAPIルート内で個別に実装。

```typescript
// SLIDE_HOSTS 環境変数が設定された場合のみ有効
// / → /slide にリライト
export function middleware(req: NextRequest) { ... }
```

## セッション管理

- `maxAge`: 24時間
- `updateAge`: 1分ごとにDB再取得 → プラン変更即反映
- session callback で `UserServiceSubscription` を都度参照

## リダイレクト

```
/dashboard → /seo
/kantan    → /seo
```

## 運用・監視

### Cronジョブ (Vercel Cron)

```
vercel.json → Vercel Cron Scheduler
    │
    ├─ 毎日 0:00 UTC → /api/cron/daily-summary
    ├─ 毎週月曜 0:00 UTC → /api/cron/weekly-summary
    └─ 毎月1日 0:00 UTC → /api/cron/monthly-summary
                              │
                              ▼
                    src/lib/notifications.ts
                              │
                              ▼
                    Slack Incoming Webhook
                    (SystemSetting: slack_webhook)
```

- 認証: `Authorization: Bearer ${CRON_SECRET}` ヘッダーで検証
- レポート内容: 新規登録数、ログイン数、サービス別生成数、決済数
- 週次/月次: 期間集計 + 累計データ付き

### Slack通知

```
イベント発生
    ├─ ログイン/サインアップ → sendEventNotification() → Slack
    ├─ Stripe 決済完了/解約 → sendEventNotification() → Slack
    └─ Cron 実行 → sendDailySummary() etc. → Slack
```

- Webhook URL: DB `SystemSetting` テーブル (`key: 'slack_webhook'`)
- `postToSlack()`: レスポンスステータスチェック付き

### アナリティクス

```
ブラウザ
    ├─ Google Tag Manager (GTM-5B2PRCL7)
    │   └─ カスタムHTMLタグ → HubSpot Tracking Code (ID: 48309253)
    │   └─ HubSpot CTA ポップアップ (全ページ、5秒後トリガー)
    └─ GTMコンポーネント: src/components/GoogleTagManager.tsx
       ('use client', strategy="afterInteractive")
```

- `NEXT_PUBLIC_GTM_ID` 環境変数でGTM IDを管理
- GTMはクライアントサイドのみで読み込み（サーバーHTMLには含まれない）

## セキュリティヘッダー (next.config.js)

- `X-DNS-Prefetch-Control`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
