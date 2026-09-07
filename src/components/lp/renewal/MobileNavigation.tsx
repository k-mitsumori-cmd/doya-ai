"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";

export function MobileNavigation({ loginHref }: { loginHref: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details
      className="doya-mobile-menu"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          close();
          ref.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="メニューを開閉する">
        <Menu className="doya-menu-open" size={22} />
        <X className="doya-menu-close" size={22} />
      </summary>
      <nav aria-label="モバイルナビゲーション" onClick={close}>
        <Link href="/#doya-services">
          サービス一覧
          <ArrowRight size={17} />
        </Link>
        <a href="#doya-how">
          使い方
          <ArrowRight size={17} />
        </a>
        <a href="#doya-resources">
          資料3点セット
          <ArrowRight size={17} />
        </a>
        <Link href="/pricing">
          料金・利用枠
          <ArrowRight size={17} />
        </Link>
        <Link href={loginHref}>
          ログイン
          <ArrowRight size={17} />
        </Link>
      </nav>
    </details>
  );
}
