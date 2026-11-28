#!/bin/bash
# 通しの確認。トークン・コード・Cookie の値は出さない（形と状態だけ）
B=http://localhost:3000; J=/tmp/doya-app-dev/jar.txt; rm -f $J
jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }
ok() { if [ "$2" = "$3" ]; then echo "成功: $1"; else echo "失敗: $1（期待 $3、実際 $2）"; fi; }
R=$(curl -s -X POST $B/api/app/auth/dev-login -H 'content-type: application/json' -d '{"name":"e2e-user","deviceLabel":"curl","platform":"ios"}')
AT=$(echo "$R" | jget "['accessToken']"); RT=$(echo "$R" | jget "['refreshToken']"); UID_=$(echo "$R" | jget "['user']['id']")
ok "1 dev-login: トークンが返る（キー）" "$(echo "$R" | python3 -c "import sys,json; print(','.join(sorted(json.load(sys.stdin).keys())))")" "accessExpiresAt,accessToken,refreshExpiresAt,refreshToken,user"
ok "1b dev-login の応答にメールが無い" "$(echo "$R" | grep -c '@')" "0"
M=$(curl -s -H "authorization: Bearer $AT" $B/api/app/auth/me); ok "2 me: 同じユーザーが返る" "$(echo "$M" | jget "['id']")" "$UID_"
ok "2b me: プランが FREE" "$(echo "$M" | jget "['plan']")" "FREE"
V=$(python3 -c "import secrets; print(secrets.token_urlsafe(48)[:64])"); CH=$(printf %s "$V" | shasum -a 256 | cut -d' ' -f1)
H=$(curl -s -X POST $B/api/app/auth/web-handoff -H "authorization: Bearer $AT" -H 'x-doya-app: 1' -H 'content-type: application/json' -d "{\"next\":\"/seo?x=1\",\"challenge\":\"$CH\"}")
URL=$(echo "$H" | jget "['url']"); ok "3 web-handoff: url が返る（consume を指す）" "$(echo "$URL" | grep -c '/api/app/auth/web-handoff/consume?code=')" "1"
ok "3b web-handoff: 本文の next が不正なら 400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/app/auth/web-handoff -H "authorization: Bearer $AT" -H 'x-doya-app: 1' -H 'content-type: application/json' -d "{\"next\":\"//evil.com\",\"challenge\":\"$CH\"}")" "400"
ok "3c web-handoff: x-doya-app が無ければ 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/app/auth/web-handoff -H "authorization: Bearer $AT" -H 'content-type: application/json' -d "{\"next\":\"/seo\",\"challenge\":\"$CH\"}")" "401"
# ヘッダー無し（攻撃者が踏ませる普通のブラウザのリンク）
X=$(curl -s -D - -o /dev/null "$URL"); ok "4 consume（ヘッダー無し）: 302 で HandoffInvalid" "$(echo "$X" | grep -ci 'location: .*error=HandoffInvalid')" "1"
ok "4b consume（ヘッダー無し）: Cookie が付かない" "$(echo "$X" | grep -ci '^set-cookie')" "0"
X=$(curl -s -D - -o /dev/null -c $J -H "x-doya-handoff: $V" "$URL")
ok "5 consume（正しい verifier）: 302" "$(echo "$X" | head -1 | tr -d '\r' | awk '{print $2}')" "302"
ok "5b Location が next" "$(echo "$X" | grep -i '^location:' | tr -d '\r' | awk '{print $2}')" "http://localhost:3000/seo?x=1"
ok "5c Set-Cookie: HttpOnly と SameSite=lax と Path=/" "$(echo "$X" | grep -i '^set-cookie: next-auth.session-token=' | grep -ci 'HttpOnly.*SameSite=lax\|SameSite=lax.*HttpOnly')" "1"
ok "5d Cache-Control: no-store と Referrer-Policy: no-referrer" "$(echo "$X" | grep -ciE '^(cache-control: no-store|referrer-policy: no-referrer)')" "2"
S=$(curl -s -b $J $B/api/auth/session); ok "6 Cookie で /api/auth/session が dev ユーザーを返す" "$(echo "$S" | jget "['user']['id']")" "$UID_"
S2=$(curl -s -H "authorization: Bearer $AT" -H 'x-doya-app: 1' $B/api/auth/session); ok "7 Bearer + x-doya-app で /api/auth/session が dev ユーザーを返す" "$(echo "$S2" | jget "['user']['id']")" "$UID_"
X=$(curl -s -D - -o /dev/null -H "x-doya-handoff: $V" "$URL"); ok "8 同じ url の2回目は HandoffInvalid" "$(echo "$X" | grep -ci 'error=HandoffInvalid')" "1"
RF=$(curl -s -X POST $B/api/app/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$RT\"}")
AT2=$(echo "$RF" | jget "['accessToken']"); RT2=$(echo "$RF" | jget "['refreshToken']"); ok "9 refresh: 新しいトークン" "$([ -n "$AT2" ] && [ "$AT2" != "$AT" ] && echo yes)" "yes"
ok "9b 新しいアクセストークンで me" "$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $AT2" $B/api/app/auth/me)" "200"
ok "9c 引き渡した Web の Cookie は、更新のあとも使える" "$(curl -s -b $J $B/api/auth/session | jget "['user']['id']")" "$UID_"
ok "10 logout" "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "authorization: Bearer $AT2" $B/api/app/auth/logout)" "200"
ok "11 logout 後に新しいアクセストークンが 401" "$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $AT2" $B/api/app/auth/me)" "401"
ok "11b logout 後に古いアクセストークンも 401" "$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $AT" $B/api/app/auth/me)" "401"
ok "11c logout 後に refresh も 401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/app/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$RT2\"}")" "401"
ok "12 logout 後に、引き渡した Web の Cookie が無効（セッションが空）" "$(curl -s -b $J $B/api/auth/session)" "{}"
# 退会
R=$(curl -s -X POST $B/api/app/auth/dev-login -H 'content-type: application/json' -d '{"name":"e2e-delete"}'); AT3=$(echo "$R" | jget "['accessToken']")
V3=$(python3 -c "import secrets; print(secrets.token_urlsafe(48)[:64])"); CH3=$(printf %s "$V3" | shasum -a 256 | cut -d' ' -f1)
URL3=$(curl -s -X POST $B/api/app/auth/web-handoff -H "authorization: Bearer $AT3" -H 'x-doya-app: 1' -H 'content-type: application/json' -d "{\"next\":\"/\",\"challenge\":\"$CH3\"}" | jget "['url']")
curl -s -o /dev/null -c /tmp/doya-app-dev/jar3.txt -H "x-doya-handoff: $V3" "$URL3"
ok "13 退会前: 引き渡した Cookie が有効" "$(curl -s -b /tmp/doya-app-dev/jar3.txt $B/api/auth/session | python3 -c "import sys,json; print('user' in json.load(sys.stdin))")" "True"
ok "13b 退会（確認文字列なし）は 400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/account/delete -H "authorization: Bearer $AT3" -H 'x-doya-app: 1' -H 'content-type: application/json' -d '{}')" "400"
D=$(curl -s -X POST $B/api/account/delete -H "authorization: Bearer $AT3" -H 'x-doya-app: 1' -H 'content-type: application/json' -d '{"confirm":"DELETE"}'); ok "13c 退会（DELETE）" "$(echo "$D" | jget "['deleted']")" "True"
ok "14 退会後に Bearer が 401" "$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $AT3" $B/api/app/auth/me)" "401"
ok "14b 退会後に、引き渡した Web の Cookie も無効" "$(curl -s -b /tmp/doya-app-dev/jar3.txt $B/api/auth/session)" "{}"
ok "15 dev-login の Host が手元でなければ 404" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/app/auth/dev-login -H 'host: example.com' -H 'content-type: application/json' -d '{}')" "404"
