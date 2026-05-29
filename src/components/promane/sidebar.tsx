"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/promane/utils";
import Image from "next/image";
import { ToolSwitcherMenu } from "@/components/ToolSwitcherMenu";

interface NavItem {
  label: string;
  href: string;
  emoji: string;
}

const navItems: NavItem[] = [
  { label: "ダッシュボード", href: "", emoji: "📊" },
  { label: "プロジェクト", href: "/projects", emoji: "📁" },
  { label: "顧客管理", href: "/clients", emoji: "🏢" },
  { label: "メンバー", href: "/members", emoji: "👥" },
  { label: "タイムシート", href: "/timesheet", emoji: "⏱" },
  { label: "レポート", href: "/reports", emoji: "📈" },
  { label: "使い方", href: "/help", emoji: "💡" },
  { label: "設定", href: "/settings", emoji: "⚙️" },
];

export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const basePath = `/promane/${workspaceSlug}`;
  const userName = session?.user?.name || 'ゲスト';
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
        {navItems.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold transition-all",
                isActive
                  ? "bg-gradient-to-r from-blue-50 to-violet-50 text-blue-700 ring-1 ring-blue-100"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <span className="text-[18px] leading-none w-5 text-center">{item.emoji}</span>
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
        className="mx-2 my-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-violet-50 hover:from-blue-100 hover:to-violet-100 text-[12px] font-black text-gray-700 hover:text-blue-700 transition-all flex items-center gap-2"
      >
        <span className="text-base">🏢</span>
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
          {userImage ? (
            <Image src={userImage} alt={userName} width={28} height={28} className="rounded-full ring-1 ring-white shadow-sm" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-black">
              {userName[0]}
            </div>
          )}
          <p className="text-[12px] font-black text-gray-700 truncate flex-1">{userName}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="ログアウト"
            className="text-gray-400 hover:text-rose-500 transition-colors text-[11px] font-bold"
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}
