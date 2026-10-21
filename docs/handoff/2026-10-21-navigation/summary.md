# サイドバーの作業入口 — 局所検証・凍結

共通shellがservices.href（紹介LP）を参照していたため、既存dashboardHref（作業入口）へ変更。ドヤスライドは認証後も/doyaslideが無条件LPなので、本番sidebarクリックでもLPへ出ることを再現した。新旧sidebar・recent・drawer・mobile tabs・⌘K・Homeの共通tool一覧は同じ正本を使う。公開LPのURL/SEO/公開状態は変えていない。Bannerは認証済rootでも作業UIで、今回のdashboard直結は入口の統一。

DoyaSlideSidebarのprofileリンクとログインcallbackを既存/newへ揃えた。AdminSidebarの/seo/dashboardは実page/redirectがなく、既存/seoへ修正。アプリ変更はこの3ファイルだけ。

既存登録済verify-active-service-navigation.cjsの元route存在検査を保持して意味検査を追加。15ケース（実mounted11＋静的契約4）は旧3source差替えで10失敗→修正後15合格。22サービス/49既存registry routes/113ツール内nav routesを照合。org補正・未公開4サービスのflag・retired/beta除外を保持。実server/APIへの遷移や権限処理を全件実行した検証ではない。

既存UI preview・beta-hidden・plan fallbackはexit0、Slide/Cunning layout実mounted33も合格。対象3roots＋transitive632filesの非incremental型検証0。lintエラー0、既存のimg警告1（SlideSidebar103行、今回未変更）を保持。React best practices複数TSX確認済。新hooks/effects/dependenciesは追加していない。

本番既存/newを直接開くと実Wizard「スライドを作る」が表示されることもCUAで確認。入力/生成/公開0。これは既存目的地の確認であり、今回修正したsidebarの本番反映ではない。全サービスの実認証/guest/組織/権限/モバイル表示、CLS、全体型/Next/remote/deployは後続。

source4入力のpath/hash・readonly物理copy・before/afterログはverification.json参照。Home24は全hash不変。commonrunner/CI/package/registry/public LP/認証policyを変更せず、既存runnerが登録済scriptを呼ぶ形を維持。Tenjikai c1は未着手のまま保留。
