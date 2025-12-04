# ラクラクWebinarマン - GitHub公開手順

## GitHub Pagesで公開する手順

### 1. GitHubリポジトリの作成

1. https://github.com/new にアクセス
2. リポジトリ名を入力（例: `rakuraku-webinar-man`）
3. **Public**を選択
4. 「Add a README file」はチェックしない
5. 「Create repository」をクリック

### 2. ファイルのアップロード

#### 方法A: GitHubのWebインターフェースでアップロード

1. 作成したリポジトリのページで「uploading an existing file」をクリック
2. 以下のファイルをドラッグ&ドロップでアップロード：
   - `webinar-generator.html`
3. 「Commit changes」をクリック

#### 方法B: GitHub Desktopを使用

1. GitHub Desktopを開く
2. 「File」→「Add Local Repository」
3. このフォルダを選択
4. 変更をコミット
5. 「Publish repository」をクリック

### 3. GitHub Pagesの有効化

1. リポジトリの「Settings」タブを開く
2. 左メニューから「Pages」を選択
3. 「Source」で「Deploy from a branch」を選択
4. 「Branch」で「main」または「master」を選択
5. 「/ (root)」を選択
6. 「Save」をクリック

### 4. 公開URLの確認

数分後、以下のURLでアクセスできます：
- `https://[ユーザー名].github.io/[リポジトリ名]/webinar-generator.html`

例：
- `https://yourusername.github.io/rakuraku-webinar-man/webinar-generator.html`

### 5. Studioへの埋め込み

公開URLを取得したら、Studioで以下のように埋め込みます：

```html
<iframe 
  src="https://[ユーザー名].github.io/[リポジトリ名]/webinar-generator.html" 
  width="100%" 
  height="800px" 
  frameborder="0">
</iframe>
```

## 注意事項

- GitHub Pagesは無料で利用できます
- 公開には数分かかる場合があります
- リポジトリはPublicにする必要があります（GitHub Pagesの無料版では）

