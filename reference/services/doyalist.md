
All-project export repair (2026-09-23, local only): settings now requests a single authenticated streamed ZIP containing owned archived and zero-company projects; the per-project CSV serializer is shared. HTTP/content/ZIP preparation errors are shown without claiming OS download completion. Synthetic ZIP/owner/error/UI regression and full build passed. Very large historical exports and production authenticated flow are not yet verified. Evidence: docs/audits/2026-09-23-doyalist-export/report.md.

Production update 2026-09-23: the ZIP export code is live in `dpl_4VYkNiY94VqpJHtuJoSSY2NuTi18`; the unauthenticated endpoint returns 401. The 17-service public browser sweep passed. A signed-in export of real customer data and very large exports have not been run; local synthetic ZIP/ownership/error tests are the current behavioral evidence.


## プロジェクトのExcel出力（2026-11-01）

`GET /api/doyalist/export?projectId=&format=excel` は、実際のXLSXと対応するMIMEで`.xlsx`を返す。所有者確認と最初のページのDB取得は応答開始前に行う。既存の企業13列・アプローチ7列の2シート、文字列セル、200行単位の安定した取得順、シート名の禁止文字・31文字制限を維持する。

各シートのXMLを必要になった分だけZIPへ送り、HTTP側の待機量もバイト単位で制限する。要求・受信側の中断時はZIPとデータ取得を停止する。開始前のDBエラーは詳細を含まないJSONの500応答とし、出力途中の失敗は途中までのブックを完成扱いにせずダウンロードを失敗させる。文字コード表記に見える文字列、CR、DEL、式に見える文字列も文字として保持する。

CSVと全プロジェクトのCSV ZIPは変更しない。実Excelでの確認、本番公開、公開後の本人アカウント検証は、ローカルの合成データ検査と分けて記録する。
