"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/promane/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Building2,
  BarChart3,
  Clock,
  Settings,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { ToolSwitcherMenu } from "@/components/ToolSwitcherMenu";

const navItems = [
  { label: "ダッシュボード", href: "", icon: LayoutDashboard, color: "text-blue-600 bg-blue-50" },
  { label: "プロジェクト", href: "/projects", icon: FolderKanban, color: "text-violet-600 bg-violet-50" },
  { label: "顧客管理", href: "/clients", icon: Building2, color: "text-amber-600 bg-amber-50" },
  { label: "メンバー", href: "/members", icon: Users, color: "text-green-600 bg-green-50" },
  { label: "タイムシート", href: "/timesheet", icon: Clock, color: "text-cyan-600 bg-cyan-50" },
  { label: "レポート", href: "/reports", icon: BarChart3, color: "text-rose-600 bg-rose-50" },
  { label: "使い方", href: "/help", icon: HelpCircle, color: "text-emerald-600 bg-emerald-50" },
  { label: "設定", href: "/settings", icon: Settings, color: "text-gray-600 bg-gray-100" },
];

export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const basePath = `/promane/${workspaceSlug}`;

  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-gray-200 bg-white">
      {/* ロゴ */}
      <Link href={basePath} className="flex h-16 items-center gap-3 px-5 hover:bg-gray-50 transition-colors">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-violet-500 to-purple-600 text-lg font-black text-white shadow-md">
          P
        </div>
        <div>
          <span className="text-[16px] font-black tracking-tight text-gray-900">ドヤプロマネ</span>
          <p className="text-[11px] text-gray-400 font-semibold leading-none -mt-0.5">プロジェクト管理</p>
        </div>
      </Link>

      {/* ワークスペース切替 */}
      <Link
        href="/promane?select=1"
        className="mx-3 my-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-violet-50 hover:from-blue-100 hover:to-violet-100 border border-blue-100 text-[12px] font-bold text-gray-700 hover:text-blue-700 transition-all flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-base">🏢</span>
          ワークスペース切替
        </span>
        <span className="text-gray-400 group-hover:text-blue-500">→</span>
      </Link>

      <div className="h-px bg-gray-100 mx-4" />

      {/* ナビ */}
      <nav className="mt-2 flex-1 space-y-0.5 px-3">
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
                "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-all",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                isActive ? item.color : "text-gray-400 bg-transparent group-hover:bg-gray-100"
              )}>
                <item.icon className="h-[20px] w-[20px]" />
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 他のドヤAIサービスへ */}
      <div className="px-3 py-2">
        <ToolSwitcherMenu currentService="promane" showLabel={true} isCollapsed={false} />
      </div>

      {/* キャラクター */}
      <div className="px-4 py-2 flex justify-center">
        <Image
          src="/character/ramen.png"
          alt="休憩中"
          width={64}
          height={64}
          className="animate-float drop-shadow-md opacity-70 hover:opacity-100 transition-opacity"
          unoptimized
        />
      </div>

      <div className="border-t border-gray-100 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <LogOut className="h-[20px] w-[20px]" />
          </div>
          ログアウト
        </button>
      </div>
    </aside>
  );
}
