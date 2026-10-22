# 質問リンクUIの限定補修

375pxの「作成・履歴・料金」をすべて表示するため、AskLinkのnav文言を短くしました。href/icon/exactは維持しています。ヒーローは専用CSSで640px以下だけ画像と説明を寄せ、見出しを「URLから質問リンクを作成」としました。2本の質問リンクと3枚のバナーという説明は維持しています。

変更はTool.tsx、AskLinkのnav、専用Tool.module.cssの3ファイルです。共通DS ToolHero・ToolFrame・他サービスのnav/スタイル、公式artファイルは変更していません。公式artはHEADとSHA-256一致です。このUI補修だけではhook/作成body・料金・回数を変更していません。その後のASK1は、別範囲として作成hook/APIを補修しています。

対象Lintは警告/エラー0。実Tool/ToolHero/ToolFrame/navをSSRし、実Tailwind/CSSを適用したoffline Chromeの375/1280pxで、3タブの枠内表示・44px高さ・選択とリンク先・横はみ出し無しを確認しました。認証・会社情報・空の作成hook/queueは合成表示です。本番/認証後の全画面QAではありません。

事前の同等markupによる比較では375pxのヒーロー高が256pxから209px、入力欄は47px上へ移動。1280pxヒーロー高は不変でした。actual-results.jsonに実部品の補修後寸法を記録しています。画像はactual-375.pngとactual-1280.pngに保存しました。親の最終確認は、既存画像の静的読取で3タブ、見出し、余白、公式artを目視確認しています。CUAのfile:表示はプロトコル安全制約で拒否されたため、別ブラウザやHTTPへの置き換えは行っていません。candidate E2Eや認証後の全画面QAの合格とは扱いません。

Luna利用: 未使用。通常のCodexで実装・表示検証しました。
