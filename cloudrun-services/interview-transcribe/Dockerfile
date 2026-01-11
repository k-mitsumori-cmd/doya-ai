# Node.js 18を使用
FROM node:18-slim

# FFmpegをインストール（MP4から音声を抽出するため）
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# すべての依存関係をインストール（ビルドにdevDependenciesが必要）
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# 本番環境用の依存関係のみを再インストール（サイズを削減）
RUN rm -rf node_modules && npm ci --only=production

# ポート8080を公開（Cloud Runのデフォルト）
EXPOSE 8080

# アプリケーションを起動
CMD ["npm", "start"]

