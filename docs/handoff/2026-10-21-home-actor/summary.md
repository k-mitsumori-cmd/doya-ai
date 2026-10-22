# Home actor boundary — local targeted verification

経営ホームの両default UIとserver pageを同じ認証境界へ接続。HomeSummaryにサーバー認証済actorIdを必須追加した。SDK未seed/loading・未認証・actor不一致は最初のrenderから子UIを隠し、古いprops/応答/agent操作を新actorへ持ち越さない。初期loading後も旧SSRseedを再採用せずfresh GETを行う。

refreshはactor/status/version/epoch/sequence/lifecycleと本文actorを照合。401/409・通信/不正本文はmaskして明示再確認へ進み、同actor HTTP500だけ前回取得時刻付きsnapshotを保持する。API expectedActorは実session認証に追加する条件で、全200/401/409/500はprivate,no-store + Vary: Cookie。合成read fixtureの書込・外部通信は0。

pagehideはflushSyncでdispatch終了前にmask。pageshow.persistedはsession.updateを要求し、cached SDK同値のみで復帰しない。更新中のSDK変化は旧確認promiseのownershipを失効し、旧proof/catch/finallyを拒否。新SDK actorへ結び付けたGETを実server sessionと照合するまで子UIは隠れる。旧props待ち/401/409からも再確認→新GETへ回復する。

開発previewは専用client wrapper内のsample callbacksに限定し、serverからserializable DTOだけを渡す。production404 guardは原位置に保持。本番default UIにbypass flagはない。

## 検証

- 新59受入（実両UI54 + API/page/preview5、Node60）合格。元主要6反例は修正前6失敗→同fixture6合格。確認promise ownership追加10件も旧Boundary単独差替え10失敗→修正後10合格。
- 同sourceでfinance28、Popup Home47（Node48）、保存展示会Home40（Node41）、実SSR→hydrate16（回復/警告0）、clock/today11、保存read23、Tenjikai32、Popup55が合格。
- 対象13TS roots + transitive 761 filesの非incremental型検証0、対象lint警告0。React best practices複数TSX確認を適用。全体型/Next gateの代替ではない。
- Popup/HomeSavedのnative input fixtureはreact-dom import時のNode内DOM feature detection順に依存。TSXより先に同script内JSDOMでclient runtimeを初期化しcleanupするadapterのみ追加。同final app sourceでbootstrap除去対照は再失敗し、復元で合格。実browser不具合とは扱わない。元のproduct assertions/native inputを維持。Saved URL assertion1件のみ新expectedActor query契約に強化した。finance120/hydration7/Popup89 assert callsは完全一致、Saved74の他73件も一致。

## 凍結・引継ぎ

全owned24: `fc92adaaacf1fbac3fdc7466f71dda101053ae5e55d9ba3cfc7212f03be1592b`。b15からactor delta14: `d02f9af8b4d4554959149578b6154eca04668ddf6c2c76d71059810f494d82e1`。path/hash一覧、02f9a4ebとの差分、変更前b15とfinal24のreadonly物理copyはverification.json記載のGit外manifestを参照。

`node scripts/security-regression/verify-home-actor.cjs`、env不要、timeout60秒。自身の独立Node processだけNODE_ENV=testとしproduction親へ漏らさない。共通runner/CI/package/schema/Providers/entry scopeは未変更。登録と統合gateは別owner。

認証後の実browser、実BFCache、CLS、全体型/Next、デプロイ/本番反映は未検証。現在02f9a4ebの既存統合合格を新unitへ流用しない。Tenjikai c1および保存/復元/CAS/storage/完全Home連携は後続未完で、今回開始していない。二重集計の性能改善も混ぜていない。
