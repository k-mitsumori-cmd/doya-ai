# ドヤ部下 メディアワーカー（Cloud Run Jobs）
# ビルド:  cd worker && docker build -t doya-media-worker .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
# ffmpeg(ffprobe 同梱)のみ入れる
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
# Cloud Run Jobs が MEDIA_JOB_ID を渡して起動する。無いときは順番待ちを順に処理する
CMD ["node", "dist/main.js"]
