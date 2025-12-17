# ドヤシリーズ 統合管理ポータル

カンタンドヤAIとドヤバナーAIを一元管理するための管理者ポータルです。

## 機能

### 📊 統合ダッシュボード
- 全サービスの統計を一覧表示
- ユーザー数、生成数、収益の統合ビュー
- 最新アクティビティのリアルタイム表示

### 👥 ユーザー管理
- 全サービスのユーザーを統合管理
- サービス別・プラン別のフィルタリング
- 検索機能

### 💰 収益レポート
- サービス別収益の分析
- 月次推移グラフ
- ARPU、成長率の計算

### ⚙️ 設定
- 通知設定
- セキュリティ設定
- サービス接続状況の確認

## セットアップ

### 1. 依存関係のインストール

```bash
cd admin-portal
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成:

```env
# 管理者認証
ADMIN_PASSWORD=your-secure-password
ADMIN_JWT_SECRET=your-jwt-secret-key

# サービスAPI URL
KANTAN_DOYA_API_URL=http://localhost:3000
DOYA_BANNER_API_URL=http://localhost:3001

# または本番環境
# KANTAN_DOYA_API_URL=https://kantan-doya-ai.vercel.app
# DOYA_BANNER_API_URL=https://doya-banner.vercel.app
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ポート3100で起動します: http://localhost:3100

### 4. 本番ビルド

```bash
npm run build
npm start
```

## 管理対象サービス

### カンタンドヤAI (ポート3000)
- AI文章生成ツール
- 68種類のテンプレート
- ビジネス文書の自動生成

### ドヤバナーAI (ポート3001)
- AIバナー生成ツール
- プロ品質のバナーをワンボタンで生成
- A/Bテスト用3パターン生成

## デフォルト認証情報

開発環境のデフォルトパスワード:
- パスワード: `doya-admin-2024`

⚠️ **本番環境では必ず変更してください**

## 技術スタック

- Next.js 14
- TypeScript
- Tailwind CSS
- JWT認証
- react-hot-toast

## ディレクトリ構造

```
admin-portal/
├── src/
│   ├── app/
│   │   ├── (dashboard)/      # 認証後のページ
│   │   │   ├── page.tsx      # 統合ダッシュボード
│   │   │   ├── users/        # ユーザー管理
│   │   │   ├── revenue/      # 収益レポート
│   │   │   ├── settings/     # 設定
│   │   │   └── [serviceId]/  # サービス詳細
│   │   ├── login/            # ログインページ
│   │   └── api/              # API Routes
│   ├── components/           # 共通コンポーネント
│   └── lib/                  # ユーティリティ
└── README.md
```

