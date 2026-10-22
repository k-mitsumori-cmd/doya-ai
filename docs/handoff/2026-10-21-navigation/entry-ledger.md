# サービス入口・ナビ監査表

current02f9a4eb catalogのgetActiveServices()で得る22サービスが対象。公開用hrefと作業用dashboardHrefを区別する。以下のguest/auth分岐はsource読取の分類であり、各サービスの認証・課金・組織操作を本番で実行した合格ではない。

| ID | 公開root | 作業入口 | source上の境界 |
|---|---|---|---|
| banner | `/banner` | `/banner/dashboard` | guestはLP。認証済legacyは作業UI、新UIはdashboardへredirect |
| seo | `/seo` | `/seo` | guest LP／認証後作業入口 |
| interview | `/interview` | `/interview` | guest LP／認証後作業入口 |
| persona | `/persona` | `/persona` | guest LP／認証後作業入口 |
| hr | `/hr` | `/hr/dashboard` | rootは紹介LP。作業はdashboard、既存override維持 |
| kintai | `/kintai` | `/kintai/dashboard` | rootは紹介LP。作業はdashboard、既存override維持 |
| doyalist | `/doyalist` | `/doyalist` | guest LP／認証後作業入口 |
| promane | `/promane` | `/promane` | guest LP／認証後workspace選択・既存redirect。自動作成契約は未変更/未実行 |
| doyaslide | `/doyaslide` | `/doyaslide/new` | rootは認証後もLP。newは既存Wizard。guest利用契約は未変更 |
| sfa | `/sfa` | `/sfa` | guest LP／認証後Entryまたは最新所属へ既存redirect |
| shodan | `/shodan` | `/shodan` | guest LP／認証後Entryまたは既存所属順のredirect |
| aio | `/aio` | `/aio` | guest LP／認証後Entryまたは最新所属のscanへ既存redirect |
| mensetsu | `/mensetsu` | `/mensetsu` | guest LP／認証後Tool |
| quote | `/quote` | `/quote` | guest LP／認証後作業入口 |
| aishodan | `/aishodan` | `/aishodan` | guest LP／認証後Tool |
| adimage | `/adimage` | `/adimage` | guest LP／認証後作業入口 |
| asklink | `/asklink` | `/asklink` | guest LP／認証後作業入口 |
| popup | `/popup` | `/popup` | guest LP／認証後サイトとPopup入口 |
| tenjikai | `/tenjikai` | `/tenjikai` | layoutでguest LP／認証後app。coming_soon+UNLISTED据置 |
| shanai | `/shanai` | `/shanai` | guest LP／認証後Tool。coming_soon+UNLISTED据置 |
| income | `/income` | `/income` | guest LP／認証後Dashboard。coming_soon+UNLISTED据置 |
| expense | `/expense` | `/expense` | guest LP／認証後Entryまたは既存org redirect。招待claim等既存契約は未変更/未実行 |

共通AppShellは新旧双方のsidebar・recent・drawer・mobile tabs・⌘KがALL_SHELL_TOOLSに依存する。ServiceNav・ToolSwitcherは既にdashboardHrefを使い、今回の実mountedで全22リンクを確認した。Home intentsのslide/new・banner/dashboard/createは既に正しい。組織補正shodan/aio/sfaは変更せず、actual context map付きpalette/sidebarで保持を検証。Home24 sourceへの編集は0。

全22サービスのnav.tsの実配列/動的org builderから113リンクを構築してroute存在と純LP誤誘導を照合した。ロール表示条件を変更・拡張していない。各legacy sidebarのlocal項目と共有ToolFrameナビも読取対象。root独立literal scan119件で見つかったAdmin /seo/dashboardは/seoへ修正、retired TenkaiSidebar /tenkai/helpは残件記録だけとし、新ページや公開設定を追加しない。

本番では認証済sidebar /doyaslide→LPを再現し、既存/new直接open→Wizardを確認。新sourceのsidebar本番反映・全22サービス実browser・スマホ実レイアウト・guest実ログアウトは未実施。現在本番のメニューには旧revision由来の差もあり、current sourceのbeta-hidden/公開flagを本番確認済みとは扱わない。
