# ローカル依存構成の説明を補足

以前の検証ではnode_modulesルートがsymlinkでないことを確認し、physicalNodeModules=true / sharedNodeModules=falseと記録しました。ルートは物理ディレクトリですが、個別packageには09_Cursolへの外部symlinkがありました。「依存全体が独立」という説明は正確でないため、ここで訂正します。既存の終了コード、検証対象ソースのhash、コミットblob対応は変更しません。

| 対象 | 実体 | package version / lock version |
|---|---|---|
| react | 09_Cursol/node_modules/react | 18.3.1 / 18.3.1 |
| react-dom | 09_Cursol/node_modules/react-dom | 18.3.1 / 18.3.1 |
| typescript | 09_Cursol/node_modules/typescript | 5.9.3 / 5.9.3 |
| prisma | 09_Cursol/node_modules/prisma | 5.22.0 / 5.22.0 |
| @prisma/client | 当worktree/node_modules/@prisma/client、外部symlinkではない | 5.22.0 / 5.22.0 |
| .prisma/client | 当worktree/node_modules/.prisma/client、外部symlinkではない | 生成client 5.22.0 |

@prisma/clientのpackage.json・index.jsと、.prisma/clientのschema・JS・型ファイルは、09_Cursol側と別のfilesystem objectでした。BILL-020ビルドの生成ログは当worktreeのclient出力を示し、生成ファイルのmtimeは2026-10-20 06:25Zです。09_Cursolの対応生成ファイルは2026-10-19 04:22Zのままでした。worktreeの生成schemaは正本とコメント・空白を除いて一致しています。

観測した出力先と実体からは、今回のPrisma generateが09_Cursolのclientを上書きした証拠はありません。共有CLIや共通キャッシュへの全書込みを過去に遡って証明するものではありません。

今回は所在・package/lock version・生成ログ・inodeと時刻を読み取りで確認しました。依存の削除・置換、Prismaの再生成、DB接続はしていません。詳細のrealpath、hash、mtimeはローカルのdependency-audit.jsonへ保存しています。Lunaは未使用です。
