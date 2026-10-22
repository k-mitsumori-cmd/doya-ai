# 既発行Portalと退会finalizeの独立レビュー

2026-10-21。基準は7672cb8fの課金入口とinstalled stripe-node 14.25.0（API version 2023-10-16）。公式資料・SDK・ソースの読み取りだけで確認した。外部API、設定変更、Customer削除、支出は行っていない。R0は未接続coreであり、既存2競合を閉じた証拠ではない。

Portalは既存subscriptionの変更・取消を行うもので、完全な新subscription作成はできない、と[Stripe公式FAQ](https://support.stripe.com/questions/billing-customer-portal?locale=en-GB)は説明する。[即時Cancel API](https://docs.stripe.com/api/subscriptions/cancel)の結果はstatus=canceledで、以後の変更はほぼ制限される。一方、[期末取消予定は期限前に取り消せる](https://docs.stripe.com/billing/subscriptions/cancel#cancel-at-the-end-of-the-current-billing-period)。cancel_at_period_end=true、pause_collection、pausedを即時canceledと同じ終端にはしない。

したがって、厳密に特定した全対象subscriptionが即時canceledで、別の作成・再利用・再送・late settle・schedule等の新契約生成経路も閉じている場合に限り、既発行Portalによる「その契約の再開または完全な新契約」の余地を限定できる。Portal URLの失効や、全課金・全データ削除を証明したことにはならない。これは資料からの条件付き推論であり、実アカウントでの操作確認ではない。

| 能力・状態 | finalizeとの関係 |
|---|---|
| 既存の即時canceled subscription | 同一resourceの再開と、Portalだけによる完全な新契約作成は上記資料の範囲で区別できる。別resourceのcreateがないことは別途必要 |
| 取消予定・一時停止・可変状態のGET | 不可逆な終了証拠にならない。正確なdispatch/ack、または該当操作を無効にする不可逆なprovider終端が必要 |
| 既存invoiceの支払・履歴・支払方法/個人情報の表示 | Portalの別能力。既存債務や会計保持・privacy要件として分類し、新規契約競合と混同しない。存在だけを理由に永続退会拒否へ置き換えない |
| 未確認のCheckout/create/旧worker | 新しいpayable resourceを作れるか未確定ならUser/fenceを保持し、同一operationで証拠を集める。timeoutや一覧0から未実行を推測しない |

Portalの請求書支払・履歴等の能力と、未訪問5分・訪問後は最終activityから1時間という期限は[公式Customer management](https://docs.stripe.com/customer-management)に記載されている。活動で期限が延びるため、created+1時間を既発行Portalの一律drain期限にはできない。[公式Session API一覧](https://docs.stripe.com/api/customer_portal/sessions)とSDKの `cjs/resources/BillingPortal/Sessions.js` はcreateだけで、Sessionのlist/retrieve/expireはない。`types/BillingPortal/Sessions.d.ts` に検証可能なexpires_atもない。架空の失効APIや、共有Portal設定の無効化・Customer削除を解決策にしない。

ソースの発行元はstripe/portal GET・POST、portal/redirect GET、hr/billing/portal POSTの4handlerと共通helper。自動構成ではprice変更を有効にしているが、明示設定IDを使うgeneric経路はその機能を再照会しない。今回、本番の設定実値は取得していない。既発行Sessionをアプリに列挙・追跡する仕組みもないため、新規発行fenceだけで既発行URLが閉じたとは言えない。

旧経路のdrainは次の条件を別々に確認する。HR checkoutはreservation前にCustomerを明示作成する。統一checkoutはcustomer_emailを送り、Checkoutに伴うCustomer生成もあり得る。未使用のgetOrCreateCustomer定義も含め、create前のdurable admission/dispatch、厳密な結果resourceとの相関、旧deploymentの先行処理と今後の呼出し遮断を確認する。新コードへの切替だけでは旧in-flightを消せない。Customerの存在だけは新課金能力ではなく、Customerのみの残置を扱うprivacy/保持の方針は別要件とする。

stripe.tsのPortal configuration作成も外部writeだが、priceSignatureに結ぶ共有構成である。User固有の契約/Customer/Session操作と別分類にし、1人の退会を理由に共有設定を無効化・削除しない。共通helperに将来consumerが増えても無guardで通らない境界を置く。

[Checkoutのexpire](https://docs.stripe.com/api/checkout/sessions/expire)はopen sessionだけを閉じる。completeへ進んだ場合はその厳密なsubscriptionを台帳へ組み込む。expire/retrieveの対象ID・owner・mode・metadata・作成相関を照合し、ready URL再利用、creatingの不明結果、late settle、旧writerを含む全入口が閉じたことを最終Tx前に再確認する。既存請求書の合法な支払や会計保管の扱いを、この競合対策から無断で変更しない。

現R0のportal_create outcomeは正確なcreated ackとbps IDを受ける設計である。Session取得APIがないため、unknownを単なるGET一覧0でconfirmする実装は追加できない。R2では同一dispatchに対応するprovider事実の相関方法、または限定した不可逆終了証拠を明示してから接続する。証拠がない間はpending/needs_reviewを維持するが、既存債務・保管履歴の存在を自動的な永久拒否条件にはしない。

Astra追加6点への統合前チェックは次のとおり。

1. 既発行Portalの終端根拠は上記の限定条件を使い、設定無効化/Customer削除を代案にしない。
2. Customer明示/暗黙作成、UserへのID保存、共有Portal構成の作成まで外部write分類に含める。
3. v2以前のcancel/resume/Portal/workerの未記録実行もcutover対象にし、旧creatingだけの検査や固定waitで済ませない。
4. inventory候補ごとに接続helper・同Tx境界・除外理由・fixtureを残す。動的呼出し、raw SQL、nested createも分類し、探索件数を接続完了数としない。
5. User消失後もcustomer/subscription/checkoutから技術的なretirement recordへ到達できる最小索引を設け、email再関連やUser復元をしない。遅延・逆順・重複、新resourceとfinalize revisionの競合で再照合する。
6. adapterの文脈欠落はfail closed。statusは観測のみ、resumeは同一operation、abortは外部未開始だけ、terminal GC未定なら保持する。

DB-only R0を読み取った時点では、予約応答消失後のreserved claim回復と、expire中にcompleteしたCheckoutの正確なsubscriptionを同ledgerへ追加する経路は親からauthorへ補修依頼済みである。R0の未接続状態やDB内CASだけを、R1/R2の全writer・provider能力の閉鎖と扱わない。

Solによる独立read。Lunaは使用していない。認証後UI、実Stripe、実Storage、本番反映の合格は含めない。
