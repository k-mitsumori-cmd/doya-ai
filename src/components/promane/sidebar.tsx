"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/promane/utils";
import Image from "next/image";
import { Building2, LogOut } from "lucide-react";
import { resolveShellIcon } from "@/components/shell/icons";
import { PROMANE_NAV_ITEMS } from "@/lib/promane/nav";
import { ToolSwitcherMenu } from "@/components/ToolSwitcherMenu";

function NavIcon({ name }: { name: string }) {
  const Icon = resolveShellIcon(name);
  return <Icon size={18} className="w-5" aria-hidden />;
}

export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const basePath = `/promane/${workspaceSlug}`;
  const isLoading = status === 'loading';
  // ローディング中は「ゲスト」ではなく「読み込み中」、未ログインなら「未ログイン」
  const userName = isLoading ? '読み込み中...' : (session?.user?.name || '未ログイン');
  const userImage = session?.user?.image;

  return (
    <aside className="flex h-screen w-[240px] flex-col bg-white border-r border-gray-100">
      {/* ロゴ */}
      <Link href={basePath} className="block px-3 py-3 hover:bg-gray-50/50 transition-colors">
        <Image
          src="/promane/logo.png"
          alt="ドヤプロマネ"
          width={240}
          height={96}
          className="w-full h-auto"
          unoptimized
          priority
        />
      </Link>

      {/* ナビ */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {PROMANE_NAV_ITEMS.map((item) => {
          const href = `${basePath}${item.suffix}`;
          const isActive =
            item.suffix === ""
              ? pathname === basePath
              : pathname.startsWith(href);
          return (
            <Link
              key={item.suffix}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold transition-all",
                isActive
                  ? "bg-gradient-to-r from-blue-50 to-brand-50 text-blue-700 ring-1 ring-blue-100"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {isActive && <span className="ml-auto text-blue-500 text-xs">●</span>}
            </Link>
          );
        })}
      </nav>

      {/* 他のドヤAIサービスへ */}
      <div className="px-2 py-2 border-t border-gray-100">
        <ToolSwitcherMenu currentService="promane" showLabel={true} isCollapsed={false} />
      </div>

      {/* ワークスペース切替 */}
      <Link
        href="/promane?select=1"
        className="mx-2 my-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-brand-50 hover:from-blue-100 hover:to-brand-50 text-[12px] font-black text-gray-700 hover:text-blue-700 transition-all flex items-center gap-2"
      >
        <Building2 size={16} aria-hidden />
        <span className="flex-1">ワークスペース切替</span>
        <span className="text-gray-400">→</span>
      </Link>

      {/* キャラクター + ユーザー */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex justify-center mb-2">
          <Image
            src="/character/working.png"
            alt="プロマネくん"
            width={56}
            height={56}
            className="animate-float drop-shadow-md hover:scale-110 transition-transform"
            unoptimized
          />
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-gray-50">
          {isLoading ? (
            <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />
          ) : userImage ? (
            <Image src={userImage} alt={userName} width={28} height={28} className="rounded-full ring-1 ring-white shadow-sm" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-brand-400 flex items-center justify-center text-white text-xs font-black">
              {userName[0]}
            </div>
          )}
          <p className={`text-[12px] font-black truncate flex-1 ${isLoading ? 'text-gray-300' : 'text-gray-700'}`}>{userName}</p>
          {!isLoading && session?.user && (
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              title="ログアウト"
              className="text-gray-400 hover:text-rose-500 transition-colors text-[11px] font-bold"
            >
              <LogOut size={14} aria-hidden />
            </button>
          )}
        </div>
        {/* バージョン表示 (キャッシュ確認用) */}
        <p className="text-[9px] text-gray-300 font-bold text-center mt-1.5" title="ビルドバージョン">
          v.{process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev'}
        </p>
      </div>
    </aside>
  );
}
