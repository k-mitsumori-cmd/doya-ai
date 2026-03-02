# ドヤペルソナAI

## 概要
- **パス**: `/persona`
- **サービスID**: `persona`
- **説明**: WebサイトURLからターゲットペルソナ + クリエイティブを自動生成
- **ステータス**: active
- **カテゴリ**: text + image

## 機能
- URL入力 → HTML取得・解析 → Gemini でペルソナ生成
- ペルソナ: 日本式履歴書フォーマット (基本情報, 職歴, スキル, 行動パターン, 課題)
- ポートレート画像生成 (Gemini 3 Pro Image Preview)
- バナー画像生成 (6サイズプリセット + キャッチコピー選択)
- シーン画像生成 (日常シーンの可視化)
- LP構成案・広告コピー (Google/Meta)
- メールドラフト
- マーケティングチェックリスト (優先度付き)
- 生成履歴 (localStorage, 最大20件)

## 料金

| プラン | 日次上限 | 月額 |
|--------|---------|------|
| ゲスト | 2回/日 | ¥0 |
| 無料会員 | 5回/日 | ¥0 |
| PRO | 30回/日 | ¥9,980 |

## APIエンドポイント (4)

| メソッド | パス | 説明 | AIモデル |
|---------|------|------|---------|
| POST | `/api/persona/generate` | ペルソナ + クリエイティブ + チェックリスト | gemini-2.0-flash → 1.5-flash (fallback) |
| POST | `/api/persona/portrait` | ポートレート画像生成 | gemini-3-pro-image-preview |
| POST | `/api/persona/banner` | バナー画像生成 | gemini-3-pro-image-preview |
| POST | `/api/persona/scene` | シーン画像生成 + スケジュール・日記 | gemini-3-pro-image-preview |

## ペルソナ生成の流れ

```
1. ユーザーがURL入力
2. サーバーがHTML取得 (fetch)
3. HTML解析 (title, meta, headings, bodyテキスト抽出)
4. Gemini API でペルソナJSON生成:
   - 基本属性 (年齢, 性別, 職業, 年収, 居住地)
   - 行動パターン (情報収集, 購買行動)
   - 課題・ニーズ
   - クリエイティブ提案 (LP構成案, 広告コピー, メール)
   - チェックリスト
5. (自動) ポートレート画像を別APIで生成
6. (オプション) バナー画像生成
```

## ゲスト回数管理

- **Cookie名**: `doya_persona_guest_usage` / `_portrait` / `_banner`
- **制限**: ゲスト1日2回
- **ログインユーザー**: `UserServiceSubscription` テーブル (serviceId='persona')

## JSON修復ユーティリティ

Gemini の出力が不完全JSONの場合の修復処理を内蔵:
- コードブロック除去
- 閉じ括弧補完
- 末尾カンマ修正

## ファイル構成
```
src/app/persona/
  ├── layout.tsx           # PersonaAppLayout
  ├── page.tsx             # メイン (タブ: ペルソナ/クリエイティブ/チェックリスト)
  └── history/page.tsx     # 生成履歴

src/app/api/persona/
  ├── generate/route.ts    # ペルソナ生成 (Gemini 2.0/1.5 Flash)
  ├── portrait/route.ts    # ポートレート画像
  ├── banner/route.ts      # バナー画像
  └── scene/route.ts       # シーン画像

src/components/
  ├── PersonaAppLayout.tsx # レイアウトラッパー
  └── PersonaSidebar.tsx   # サイドバー
```

## デザイン
- **サイドバー**: `PersonaSidebar` コンポーネント
- サイドバーナビ: 「ペルソナ生成」(HOT)「生成履歴」
- **カラー**: purple
- **グラデーション**: サイドバー `from-[#7f19e6] to-purple-800`
- **アイコン**: `🎯`
