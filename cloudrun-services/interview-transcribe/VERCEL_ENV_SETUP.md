# CLOUDRUN_TRANSCRIBE_SERVICE_URL 環境変数の設定方法

このドキュメントでは、Vercelで `CLOUDRUN_TRANSCRIBE_SERVICE_URL` 環境変数を設定する方法を説明します。

## 前提条件

- Google Cloud Runサービスがデプロイされていること
- Vercelアカウントにアクセスできること

## 手順

### ステップ1: Cloud RunサービスのURLを取得

まず、デプロイ済みのCloud RunサービスのURLを取得します。

```bash
# Google Cloud CLIでサービスURLを取得
gcloud run services describe interview-transcribe-service \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)'
```

出力例:
```
https://interview-transcribe-service-xxxxx-an.a.run.app
```

このURLをコピーしておきます。

### ステップ2: Vercelダッシュボードで環境変数を設定

#### 方法1: Vercelダッシュボードから設定（推奨）

1. **Vercelダッシュボードにアクセス**
   - https://vercel.com/dashboard にアクセス
   - プロジェクト「doya-ai」を選択

2. **Settings → Environment Variables に移動**
   - 左サイドバーから「Settings」をクリック
   - 「Environment Variables」をクリック

3. **新しい環境変数を追加**
   - 「Add New」ボタンをクリック
   - 以下の情報を入力:
     - **Name**: `CLOUDRUN_TRANSCRIBE_SERVICE_URL`
     - **Value**: Cloud RunサービスのURL（ステップ1で取得したURL）
       - 例: `https://interview-transcribe-service-xxxxx-an.a.run.app`
     - **Environment**: すべての環境に適用する場合
       - ✅ Production
       - ✅ Preview
       - ✅ Development
     - または、特定の環境のみに設定する場合は該当するものにチェック

4. **保存**
   - 「Save」ボタンをクリック

5. **再デプロイ**
   - 環境変数を追加した後、変更を反映するために再デプロイが必要です
   - 「Deployments」タブに移動
   - 最新のデプロイメントの「...」メニューから「Redeploy」を選択

#### 方法2: Vercel CLIで設定

```bash
# Vercel CLIがインストールされている場合
vercel env add CLOUDRUN_TRANSCRIBE_SERVICE_URL

# プロンプトで以下の情報を入力:
# Value: https://interview-transcribe-service-xxxxx-an.a.run.app
# Environment: Production, Preview, Development (すべて選択)
```

#### 方法3: vercel.jsonで設定（非推奨）

`vercel.json` に環境変数を直接書くことは推奨されません（セキュリティ上の理由）。ただし、開発環境でのみ使用する場合は可能です。

```json
{
  "env": {
    "CLOUDRUN_TRANSCRIBE_SERVICE_URL": "https://interview-transcribe-service-xxxxx-an.a.run.app"
  }
}
```

## 環境変数の確認

### Vercelダッシュボードで確認

1. Settings → Environment Variables に移動
2. `CLOUDRUN_TRANSCRIBE_SERVICE_URL` が表示されていることを確認

### アプリケーション内で確認

環境変数が正しく設定されているか確認するには、以下のAPIエンドポイントを作成できます：

```typescript
// src/app/api/interview/check-cloudrun-env/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const serviceUrl = process.env.CLOUDRUN_TRANSCRIBE_SERVICE_URL
  return NextResponse.json({
    hasServiceUrl: !!serviceUrl,
    serviceUrl: serviceUrl ? serviceUrl.substring(0, 50) + '...' : 'Not set',
  })
}
```

このエンドポイントにアクセスすると、環境変数が設定されているか確認できます。

## トラブルシューティング

### 環境変数が反映されない場合

1. **再デプロイを実行**
   - 環境変数を追加した後は、必ず再デプロイが必要です

2. **環境変数名の確認**
   - 大文字小文字が正確か確認（`CLOUDRUN_TRANSCRIBE_SERVICE_URL`）

3. **値の確認**
   - URLが正しいか確認（末尾にスラッシュ `/` がないことを確認）
   - HTTPSで始まるか確認

4. **環境の確認**
   - Production、Preview、Developmentのどの環境に設定したか確認
   - アクセスしている環境と一致しているか確認

### Cloud Runサービスに接続できない場合

1. **Cloud Runサービスの状態を確認**
   ```bash
   gcloud run services describe interview-transcribe-service \
     --platform managed \
     --region asia-northeast1
   ```

2. **認証の確認**
   - Cloud Runサービスが `--allow-unauthenticated` でデプロイされているか確認
   - または、認証が必要な場合は適切な認証情報を設定

3. **CORSの確認**
   - Cloud RunサービスがCORSを許可しているか確認（`index.ts`で設定済み）

## テスト方法

環境変数が正しく設定されているかテストするには：

1. **新しいMP4ファイルをアップロード**
   - インタビューAIで新しいプロジェクトを作成
   - MP4ファイルをアップロード
   - 文字起こしを実行

2. **ログを確認**
   - Vercelのログを確認して、Cloud Runサービスへのリクエストが成功しているか確認
   - エラーが発生している場合は、エラーメッセージを確認

## 注意事項

- **セキュリティ**: URLは公開しても問題ありませんが、Cloud Runサービスが適切にセキュアに設定されていることを確認してください
- **再デプロイ**: 環境変数を変更した後は、必ず再デプロイが必要です
- **URLの形式**: URLの末尾にスラッシュ `/` は付けないでください

