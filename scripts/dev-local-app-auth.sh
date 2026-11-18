#!/bin/bash
# アプリ（Expo の殻）を、手元の Simulator からつなぐための、使い捨ての開発環境を起動・停止する。
#
# 使い方（リポジトリのルートで）:
#   scripts/dev-local-app-auth.sh          # 使い捨ての PostgreSQL を起動 → スキーマを反映 → next dev を起動（start と同じ）
#   scripts/dev-local-app-auth.sh start
#   scripts/dev-local-app-auth.sh db-only  # PostgreSQL の起動とスキーマの反映だけ（next dev は起動しない）
#   scripts/dev-local-app-auth.sh status
#   scripts/dev-local-app-auth.sh stop     # next dev と PostgreSQL を止める（データは残る）
#
# 本番の値は一切使わない。接続先は、このスクリプトの中で固定した手元の PostgreSQL（127.0.0.1:54329）だけ。
# ~/Code/09_Cursol/.env* や、いまのシェルの環境変数（POSTGRES_*・STRIPE_* など）は、next dev に渡さない（env -i で空の環境から始める）。
# 起動したら、アプリは http://localhost:3000 につなぐ。開発用ログインは POST /api/app/auth/dev-login（手元の Host だけで動く）。
set -euo pipefail

PGBIN=/opt/homebrew/opt/postgresql@17/bin
PGDATA=/tmp/doya-app-dev-pg
PGPORT=54329
# macOS で、ロケールが未設定だと postmaster が起動できないので固定する
export LC_ALL=C
DBNAME=doya_app_dev
WORK=/tmp/doya-app-dev
WEBPORT=3000
# 接続文字列は固定。prisma.ts は、sslmode と pgbouncer が無いと足すので、先に入れておく（手元の PostgreSQL は SSL を使わない）
DB_URL="postgresql://postgres@127.0.0.1:${PGPORT}/${DBNAME}?sslmode=disable&pgbouncer=false&connection_limit=5"

# 守り: 接続先が、手元（127.0.0.1）の、この PostgreSQL 以外なら止める
case "$DB_URL" in
  postgresql://postgres@127.0.0.1:"${PGPORT}"/"${DBNAME}"\?*) ;;
  *) echo "接続先が手元の使い捨ての PostgreSQL ではないので止めます" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p "$WORK"

cmd="${1:-start}"

pg_running() { "$PGBIN/pg_isready" -q -h 127.0.0.1 -p "$PGPORT"; }

start_db() {
  if pg_running; then echo "PostgreSQL は起動済みです（127.0.0.1:${PGPORT}）"; else
    if [ ! -d "$PGDATA" ]; then
      echo "使い捨ての PostgreSQL を作ります（${PGDATA}）"
      "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
    fi
    "$PGBIN/pg_ctl" -D "$PGDATA" -l "$WORK/postgres.log" -w \
      -o "-p ${PGPORT} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${PGDATA}" start >/dev/null
    echo "PostgreSQL を起動しました（127.0.0.1:${PGPORT}）"
  fi
  if ! "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='${DBNAME}'" | grep -q 1; then
    "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U postgres "$DBNAME"
    echo "DB ${DBNAME} を作りました"
  fi
}

push_schema() {
  echo "スキーマを反映します（prisma db push。接続先は ${DBNAME} だけ）"
  env -i PATH="$PATH" HOME="$HOME" DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" POSTGRES_PRISMA_URL="$DB_URL" POSTGRES_URL_NON_POOLING="$DB_URL" \
    npx prisma db push --skip-generate >"$WORK/db-push.log" 2>&1 || { tail -20 "$WORK/db-push.log" >&2; echo "db push に失敗しました" >&2; exit 1; }
  tail -3 "$WORK/db-push.log"
}

web_pids() { lsof -ti "tcp:${WEBPORT}" -sTCP:LISTEN 2>/dev/null || true; }

start_web() {
  if [ -n "$(web_pids)" ]; then
    echo "ポート ${WEBPORT} がすでに使われています（next dev は起動済みか、別のものが使っています）。stop してからやり直してください" >&2
    exit 1
  fi
  echo "next dev を起動します（初回のコンパイルに数分かかります。ログ: ${WORK}/next-dev.log）"
  # 空の環境から始め、必要なものだけを渡す。本番の値は入らない
  nohup env -i PATH="$PATH" HOME="$HOME" TERM=dumb NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" POSTGRES_PRISMA_URL="$DB_URL" POSTGRES_URL_NON_POOLING="$DB_URL" \
    NEXTAUTH_URL="http://localhost:${WEBPORT}" NEXTAUTH_SECRET="dev-only-secret-not-for-production-0123456789" \
    APP_AUTH_ENABLED=1 APP_DEV_LOGIN=1 APP_MODE_ENABLED=1 APP_GOOGLE_CLIENT_IDS="" APP_APPLE_BUNDLE_IDS="" \
    node node_modules/next/dist/bin/next dev -p "$WEBPORT" >"$WORK/next-dev.log" 2>&1 &
  echo $! >"$WORK/next-dev.pid"
  # 準備ができるまで待つ（最大15分）。me は、トークンが無いので 401 が返れば、route が動いている
  for i in $(seq 1 180); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 120 "http://localhost:${WEBPORT}/api/app/auth/me" || true)
    if [ "$code" = "401" ]; then echo "next dev の準備ができました: http://localhost:${WEBPORT}"; return 0; fi
    if ! kill -0 "$(cat "$WORK/next-dev.pid")" 2>/dev/null; then echo "next dev が止まりました。ログ: ${WORK}/next-dev.log" >&2; tail -20 "$WORK/next-dev.log" >&2; exit 1; fi
    sleep 5
  done
  echo "15分待っても準備ができませんでした。ログ: ${WORK}/next-dev.log" >&2
  exit 1
}

stop_web() {
  local pid
  if [ -f "$WORK/next-dev.pid" ]; then
    pid=$(cat "$WORK/next-dev.pid")
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    rm -f "$WORK/next-dev.pid"
  fi
  # ポートを使っているもののうち、next のものだけを止める
  for p in $(web_pids); do
    if ps -o command= -p "$p" | grep -q next; then kill "$p" 2>/dev/null || true; fi
  done
  sleep 1
  if [ -n "$(web_pids)" ]; then echo "ポート ${WEBPORT} を、まだ何かが使っています" >&2; else echo "next dev を止めました"; fi
}

case "$cmd" in
  start) start_db; push_schema; start_web ;;
  db-only) start_db; push_schema ;;
  status)
    if pg_running; then echo "PostgreSQL: 起動中（127.0.0.1:${PGPORT}）"; else echo "PostgreSQL: 停止中"; fi
    if [ -n "$(web_pids)" ]; then echo "next dev: 起動中（http://localhost:${WEBPORT}）"; else echo "next dev: 停止中"; fi ;;
  stop)
    stop_web
    if pg_running; then "$PGBIN/pg_ctl" -D "$PGDATA" -w stop >/dev/null && echo "PostgreSQL を止めました（データは ${PGDATA} に残っています）"; fi ;;
  *) echo "使い方: $0 [start|db-only|status|stop]" >&2; exit 2 ;;
esac
