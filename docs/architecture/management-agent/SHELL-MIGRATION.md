# 既存ツールを共通の枠に載せ替える手順

- 作成: 2026-10-18（共通部品の担当）
- 対象: まだ共通の枠（AppShell）に載っていない16ツール。1ツールを1セッションで載せ替える
- 前提のブランチ: `feat/shell-shared-layout`（このブランチが main に入ってから始める。入る前に始めるなら、このブランチから切る）
- 変えないもの: ページ本体（`page.tsx` の中身）、API、DB。変えるのは置き場所・layout・ナビの書き方だけ

---

## 1. しくみ（先に読む）

- 枠（AppShell。左のツール一覧・下のタブ・⌘K・ログアウト）は、`src/app/(shell)/layout.tsx` に1つだけ置いてある。
- `(shell)` はルートグループ。URL には出ない。`src/app/(shell)/popup` の URL は `/popup` のまま。
- `(shell)` の下のツールどうしを移っても、この layout は作り直されない。だから枠も作り直されず、ちらつかない。
- 枠を出すかどうかは、`src/components/shell/registry.ts` の台帳と、今のパスで決める。次がすべてそろったときだけ出す。
  - ログインしている
  - 台帳にそのツールがある
  - `always: true` か、環境変数 `UI_SHELL_SERVICES` にそのツールの id がある
  - `inShell(パス)` が true（省略したときは、ツールの下のパスすべて）
  - 開発用の見本（`/<ツール>/dev/...`）でも、第三者が開く画面（`src/lib/ui/guest-path.ts`）でもない
- ツールの layout は、枠で包まない。ツール内のナビ（ToolFrame）だけを出す。

既に載っているもの: 経営ホーム（`home`）・収入管理・支出管理（いつも枠）、ポップアップ・展示会・社内インタビュー（設定で枠）。

---

## 2. 手順（1ツールにつき、この順で行う）

例は見積（`quote`）。`<id>` は `services.ts` の id、`<Tool>` はツールの部品の名前に読み替える。

### 2.1 フォルダを (shell) の下に移す

```bash
git mv src/app/quote "src/app/(shell)/quote"
```

`git mv` で移す（消して作り直さない）。移したら、次の参照を直す。

- `@/app/quote/...` を import しているところ（例: `src/components/lp/renewal/OperationDemo.tsx` の `@/app/quote/mocks`）を `@/app/(shell)/quote/...` に直す
- `scripts/` の中で `src/app/quote/` を読んでいるテスト（セキュリティテストに多い）を、`src/app/(shell)/quote/` に直す。直すのは**パスの文字列だけ**。確認の中身・件数は変えない

```bash
grep -rln "@/app/quote/\|src/app/quote/" src scripts seo
```

### 2.2 台帳に1行足す

`src/components/shell/registry.ts` の `SHELL_SERVICES` に足す。

```ts
{ id: 'quote', basePath: '/quote' },
```

- 公開の画面（共有閲覧など）や、組織を選ぶ前の入口のように、枠を出さないパスがあれば `inShell` で外す
  - 例: `inShell: (p) => !p.startsWith('/quote/share')`
- 第三者が開く画面（招待の受諾・面接・回答画面）は、`src/lib/ui/guest-path.ts` に足せば、枠もツールの旧レイアウトも出さなくなる
- `always` は付けない（既存ツールは環境変数で切り替える）

### 2.3 ナビを nav.ts に書く

`src/lib/quote/nav.ts` を作り、型 `ShellNavItem` の配列で書く。

```ts
import type { ShellNavItem } from '@/components/shell/nav'

export const QUOTE_NAV: ShellNavItem[] = [
  { label: '見積書をつくる', href: '/quote', icon: 'Receipt', exact: true },
  { label: '設定', href: '/quote/settings', icon: 'Settings' },
  { label: '料金プラン', href: '/quote/pricing', icon: 'CreditCard' },
]
```

- `icon` は**名前の文字列**で書く。lucide の部品（関数）を渡すと、サーバーの layout から渡したときに全画面が 500 になる
- 名前は `src/components/shell/icons.tsx` の対応表にあるもの。無ければ対応表に足す（共通部品の担当に知らせる）。無い名前は既定のアイコンになる
- 今のサイドバー（`QuoteSidebar` など）も、この配列を描くだけにする。描くときは `resolveShellIcon(item.icon)` で部品を引く
- 料金プランとログアウトは枠の下にあるので、ナビに入れなくてよい（入れてもよい）

### 2.4 layout を書き換える

ツールの `layout.tsx` は、ログインしていて、設定で枠が有効なときだけ `ToolFrame` で包む。それ以外は今のまま。

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isShellEnabled } from '@/lib/ui-shell'
import QuoteShellFrame from '@/components/quote/QuoteShellFrame'
import QuoteAppLayout from '@/components/quote/QuoteAppLayout'

export default async function QuoteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return <>{children}</>                       // LP（今のまま）
  if (isShellEnabled('quote')) return <QuoteShellFrame>{children}</QuoteShellFrame>  // 新しい枠
  return <QuoteAppLayout>{children}</QuoteAppLayout>                  // 今のレイアウト
}
```

`QuoteShellFrame` はクライアント部品にし、`ToolFrame` だけを返す。**`AppShell` で包まない**（枠は共通の layout が出す。包むと二重になる）。

```tsx
'use client'
import ToolFrame from '@/components/shell/ToolFrame'
import { QUOTE_NAV } from '@/lib/quote/nav'

export default function QuoteShellFrame({ children }: { children: React.ReactNode }) {
  return <ToolFrame serviceId="quote" nav={QUOTE_NAV}>{children}</ToolFrame>
}
```

- ゲストの画面を判定している旧レイアウト（`isGuestPath`）は、そのまま残す
- `isShellEnabled` と台帳の判定は、同じ条件（ログイン＋設定）になるようにする。食い違うと、枠だけ出てナビが無い、またはその逆になる

### 2.5 組織の切り替えを渡す

組織・ワークスペースを切り替える部品があるツール（見積・AI商談の `OrgSwitcher`、営業管理の membership リンク、HR の `<select>` など）は、今の部品を `ToolFrame` の `switcher` にそのまま渡す。パンくずの右に出る。

```tsx
<ToolFrame serviceId="quote" nav={QUOTE_NAV} switcher={<QuoteOrgSwitcher />}>
```

`QuoteOrgSwitcher` は例。今のサイドバーで使っている切り替え部品を、props を変えずにそのまま渡す。

- 切り替えの中身（localStorage・`?org=`・slug）は変えない。共通の会社の切り替えは別の作業（README §18.6 手順 2）
- 組織を選ぶまで画面が出せないツールは、`inShell` で入口のパスを外し、組織を選んだあとのパスだけ枠に入れる（支出管理の例: `/^\/expense\/[^/]+/`）

### 2.6 確かめる

```bash
npx tsc --noEmit
~/Code/tools/doya-build-slot/build-slot.sh --keep-next npm run build
UI_SHELL_SERVICES=quote,popup NEXTAUTH_SECRET=local-check-only npx next start -p 3479
```

| 確かめること | 合格の条件 |
|---|---|
| 設定で枠を無効にした状態（`UI_SHELL_SERVICES` に id が無い） | 今と同じ見た目。枠は出ない |
| 枠を有効にした状態 | 枠の中に、ツール内のナビ（タブ）と画面が出る。枠が二重にならない |
| ほかの枠のツールへ左のメニューで移る | 枠が作り直されない（ちらつかない）。引き出しや ⌘K の状態が残る |
| 未ログイン（LP）・公開の画面・招待の画面 | 枠が出ない |
| 375px と 1280px | 横スクロールが出ない。375px では下にタブが出る |
| テスト | `npm run build` の中のテストがすべて通る |

手元ではログインできないので、ログイン後の画面は本番か、ログインできる環境で確かめる。

確かめたら `.next` を消す（`--keep-next` を付けたとき）。

---

## 3. やってはいけないこと

| してはいけない | 理由 |
|---|---|
| ツールの layout や部品で `AppShell` を使う | 枠が二重になる。ツールを移るたびに枠が作り直される |
| nav に lucide の部品（関数）を入れる | サーバーから渡すと全画面が 500 になる |
| フォルダを消して作り直す | 履歴が切れる。`git mv` で移す |
| テストの確認の中身・件数を変える | パスの文字列だけを直す |
| ページ本体・API・DB を変える | 載せ替えは枠だけ。戻すときに環境変数を外すだけで済むようにする |

---

## 4. 戻し方

- 表示が崩れたら、`UI_SHELL_SERVICES` からそのツールの id を外して再デプロイする。今のレイアウトに戻る。データは変わらない
- コードを戻すときは、そのツールの載せ替えのコミットを revert する
