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

# 依存関係をインストール
RUN npm ci --only=production

# TypeScriptをインストール（ビルド用）
RUN npm install -g typescript

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# ポート8080を公開（Cloud Runのデフォルト）
EXPOSE 8080

# アプリケーションを起動
CMD ["npm", "start"]

