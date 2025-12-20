# プレスリリース ラクラク - 開発ナレッジ

このドキュメントは、プレスリリース自動生成ツールの開発を通じて得た実践的なナレッジをまとめたものです。

## 📋 目次

1. [レスポンシブデザインの実装](#レスポンシブデザインの実装)
2. [AI API統合の実装](#ai-api統合の実装)
3. [Vercelデプロイメント](#vercelデプロイメント)
4. [セキュリティ対策](#セキュリティ対策)
5. [UX改善のポイント](#ux改善のポイント)
6. [トラブルシューティング](#トラブルシューティング)

---

## レスポンシブデザインの実装

### 基本原則

1. **モバイルファーストアプローチ**
   - まずモバイル表示を最適化し、その後デスクトップ向けに拡張
   - `@media (max-width: 768px)` と `@media (max-width: 480px)` で段階的に調整

2. **フォントサイズの段階的縮小**
   ```css
   /* デスクトップ */
   .header-text h1 { font-size: 24px; }
   
   /* タブレット・スマホ (768px以下) */
   @media (max-width: 768px) {
       .header-text h1 { font-size: 18px; }
   }
   
   /* 小さいスマホ (480px以下) */
   @media (max-width: 480px) {
       .header-text h1 { font-size: 16px; }
   }
   ```

3. **パディングとマージンの最適化**
   - デスクトップ: `padding: 24px`
   - スマホ: `padding: 16px` → `padding: 12px` (480px以下)

4. **長いテキストの折り返し対応**
   ```css
   .article-body {
       word-wrap: break-word;
       overflow-wrap: break-word;
       word-break: break-word;
   }
   ```

### 実装のポイント

- **iOSでのズーム防止**: フォーム入力は `font-size: 16px` 以上に設定
- **ボタンの配置**: スマホでは縦並び（`flex-direction: column`）に変更
- **プログレスバー**: サイズを段階的に縮小（120px → 100px → 80px）

### 実装例

```css
/* プレビューアクションボタンのレスポンシブ対応 */
.preview-actions {
    display: flex;
    gap: 12px;
}

@media (max-width: 768px) {
    .preview-actions {
        width: 100%;
        flex-direction: column;
        gap: 8px;
    }
    
    .preview-actions button {
        width: 100%;
        flex: none;
    }
}
```

---

## AI API統合の実装

### アーキテクチャ

```
Frontend (HTML/CSS/JS)
    ↓ POST /api/generate
Backend (Vercel Serverless Function)
    ↓ OpenAI API
AI生成結果
```

### フロントエンド実装

```javascript
async function generateArticleWithAI(formData, variation = 0) {
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
    const API_URL = isLocalhost 
        ? 'http://localhost:3000/api/generate'  // ローカル開発
        : '/api/generate';  // Vercel本番環境
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: formData.title,
            purpose: formData.purpose,
            companyName: formData.companyName,
            companyUrl: formData.companyUrl,
            content: formData.content,
            variation: variation
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message);
    }
    
    return await response.json();
}
```

### バックエンド実装（Vercel Serverless Function）

**ファイル構造**: `api/generate.js`

```javascript
import OpenAI from 'openai';

export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { title, purpose, companyName, companyUrl, content, variation = 0 } = req.body;

        // バリデーション
        if (!title || !purpose || !companyName || !content) {
            return res.status(400).json({ 
                error: 'タイトル、目的、会社名、内容は必須です' 
            });
        }

        // OpenAI APIキーの確認
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ 
                error: 'OpenAI APIキーが設定されていません' 
            });
        }

        // プロンプト作成
        const prompt = `あなたはPR TIMES向けのプレスリリース記事を書く専門家です。
以下の情報を元に、プロフェッショナルで魅力的なプレスリリース記事を作成してください。

【タイトル】
${title}

【目的】
${purposeLabel}

【会社名】
${companyName}
${companyUrl ? `URL: ${companyUrl}` : ''}

【内容】
${content}

【要件】
- 記事の最初に「${companyName}${companyUrl ? `（${companyUrl}）` : ''}は、」で始める
- 以下のセクションを含める：
  ■ 概要
  ■ 背景・課題
  ■ 詳細
  ■ 主な特徴・メリット
  ■ 今後の展開・展望
- 各セクションを充実させ、具体的で魅力的な内容にする
- 文字数は800-1200文字程度`;

        // OpenAI API呼び出し
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'あなたはPR TIMES向けのプレスリリース記事を書く専門家です。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7 + (variation * 0.1),  // バリエーション調整
            max_tokens: 2000
        });

        const generatedText = completion.choices[0].message.content;

        res.json({
            title: title,
            body: generatedText,
            summary: summary,
            keywords: keywords
        });

    } catch (error) {
        console.error('記事生成エラー:', error);
        res.status(500).json({ 
            error: '記事の生成に失敗しました',
            message: error.message 
        });
    }
}
```

### プロンプト設計のポイント

1. **明確な指示**: システムロールで役割を定義
2. **構造化された入力**: セクションごとに情報を整理
3. **出力フォーマットの指定**: 必要なセクションを明示
4. **バリエーション対応**: `temperature`パラメータで調整

---

## Vercelデプロイメント

### ファイル構造

```
プロジェクトルート/
├── index.html
├── styles.css
├── app.js
├── api/
│   └── generate.js          # Vercel Serverless Function
├── package.json             # 依存関係（openai）
└── vercel.json              # Vercel設定
```

### vercel.json

```json
{
  "rewrites": [
    {
      "source": "/api/generate",
      "destination": "/api/generate"
    }
  ]
}
```

### package.json

```json
{
  "name": "prtimes-article-generator",
  "version": "1.0.0",
  "description": "PR TIMES風のリリース記事をAIで自動生成するツール",
  "main": "api/generate.js",
  "dependencies": {
    "openai": "^4.0.0"
  }
}
```

### 環境変数の設定

1. Vercelダッシュボード → プロジェクト → Settings → Environment Variables
2. `OPENAI_API_KEY` を追加
3. 値を設定（本番環境用）

### デプロイ手順

1. GitHubリポジトリにプッシュ
2. Vercelでリポジトリをインポート
3. 環境変数を設定
4. 自動デプロイ完了

---

## セキュリティ対策

### APIキーの管理

**❌ やってはいけないこと:**
- フロントエンドにAPIキーを直接記述
- GitHubにAPIキーをコミット
- クライアントサイドでAPIキーを扱う

**✅ 正しい実装:**
- バックエンド（Serverless Function）でのみAPIキーを使用
- 環境変数（`process.env.OPENAI_API_KEY`）で管理
- `.env`ファイルは`.gitignore`に追加

### .gitignore

```
.env
.env.local
node_modules/
.DS_Store
```

### エラーハンドリング

```javascript
try {
    // API呼び出し
} catch (error) {
    console.error('エラー:', error);
    // ユーザーには具体的なエラー情報を表示しない
    res.status(500).json({ 
        error: '記事の生成に失敗しました',
        message: error.message  // 開発環境のみ
    });
}
```

---

## UX改善のポイント

### 1. ローディング表示

**プログレスバーアニメーション**

```javascript
function startProgressAnimation(isRegenerating = false) {
    initializeProgress(isRegenerating);
    updateProgress(0, isRegenerating);
    
    let progress = 0;
    const targetProgress = 95;
    const duration = 25000;  // 25秒で95%まで
    const interval = 50;
    const increment = (targetProgress / duration) * interval;
    
    const progressInterval = setInterval(() => {
        progress += increment;
        if (progress < targetProgress) {
            updateProgress(progress, isRegenerating);
        } else {
            updateProgress(targetProgress, isRegenerating);
            clearInterval(progressInterval);
        }
    }, interval);
    
    return progressInterval;
}
```

**ポイント:**
- 0%から95%まで徐々に進行（実際の完了は100%）
- 完了時に100%に到達してから非表示
- 再生成時はプレビューセクション上にオーバーレイ表示

### 2. ボタンの状態管理

```javascript
// 生成中
generateBtn.disabled = true;
generateBtn.textContent = '✨ 生成中...';

// 完了後
generateBtn.disabled = false;
generateBtn.textContent = '✨ 記事を生成する';
```

### 3. サンプルデータのランダム化

```javascript
const SAMPLE_DATA_ARRAY = [
    { title: '...', purpose: '...', ... },
    { title: '...', purpose: '...', ... },
    // ... 複数パターン
];

function getRandomSampleData() {
    const randomIndex = Math.floor(Math.random() * SAMPLE_DATA_ARRAY.length);
    return SAMPLE_DATA_ARRAY[randomIndex];
}
```

### 4. エラーハンドリングとフォールバック

```javascript
try {
    article = await generateArticleWithAI(formData, variation);
} catch (apiError) {
    console.warn('バックエンドAPIエラー、テンプレートベースにフォールバック:', apiError);
    // テンプレートベースの生成にフォールバック
    article = generateArticle(formData, variation);
}
```

---

## トラブルシューティング

### 1. Vercel 404エラー

**原因**: Serverless Functionのパスが正しく設定されていない

**解決方法**:
- `api/generate.js` が正しい場所にあるか確認
- `vercel.json` の設定を確認
- `package.json` がルートにあるか確認

### 2. AI生成が動作しない

**原因**: 
- 環境変数が設定されていない
- `openai`パッケージがインストールされていない

**解決方法**:
- Vercelダッシュボードで環境変数を確認
- `package.json`に`openai`が含まれているか確認
- 再デプロイを実行

### 3. CORSエラー

**解決方法**:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

### 4. スマホで表示が崩れる

**解決方法**:
- `viewport`メタタグを確認: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- メディアクエリが正しく設定されているか確認
- フォントサイズが16px以上（iOSズーム防止）

---

## ベストプラクティス

### コード品質

1. **エラーハンドリング**: すべての非同期処理にtry-catch
2. **バリデーション**: フロントエンドとバックエンドの両方で実装
3. **ログ出力**: 開発環境でのみ詳細なエラー情報を表示

### パフォーマンス

1. **プログレスバー**: ユーザーに進捗を視覚的に表示
2. **非同期処理**: UIをブロックしない
3. **フォールバック**: APIエラー時も動作するように

### セキュリティ

1. **APIキー**: 絶対にフロントエンドに露出しない
2. **環境変数**: 本番環境では環境変数を使用
3. **入力検証**: XSS対策として入力値をサニタイズ

---

## 参考リソース

- [Vercel Serverless Functions Documentation](https://vercel.com/docs/functions)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [MDN Web Docs - Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)

---

## まとめ

このプロジェクトを通じて学んだ重要なポイント：

1. **レスポンシブデザイン**: 段階的なメディアクエリで、デザインを維持しながらモバイル対応
2. **AI統合**: バックエンドでAPIキーを管理し、セキュアにAI機能を実装
3. **UX改善**: ローディング表示、エラーハンドリング、フォールバック機能
4. **デプロイメント**: VercelのServerless Functionsを活用した簡単なデプロイ

今後の開発でも、これらのナレッジを活用して、高品質なWebアプリケーションを構築できます。

