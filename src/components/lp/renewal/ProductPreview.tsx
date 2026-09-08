"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Expand, X, ZoomIn, ZoomOut } from "lucide-react";

/** Static product illustrations can be inspected without behaving like app controls. */
export function ProductPreview({
  children,
  src,
  alt,
  className = "",
  expandedContent,
  onOpenChange,
}: {
  children: ReactNode;
  src?: string;
  alt: string;
  className?: string;
  expandedContent?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [actualSize, setActualSize] = useState(false);
  return (
    <div className={`doya-preview ${className}`}>
      {children}
      <div className="doya-preview-caption">
        <span>操作イメージ</span>
        {(src || expandedContent) && (
          <button
            type="button"
            onClick={() => {
              setActualSize(false);
              onOpenChange?.(true);
              dialog.current?.showModal();
            }}
            aria-label={`${alt}を拡大する`}
          >
            <Expand size={15} aria-hidden="true" /> 画面を拡大
          </button>
        )}
      </div>
      {(src || expandedContent) && (
        <dialog
          ref={dialog}
          onClose={() => onOpenChange?.(false)}
          className="doya-preview-dialog"
          aria-label={alt}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <div className="doya-preview-dialog-inner">
            <div className="doya-preview-toolbar">
              <p>
                {alt}
                <span>操作イメージ</span>
              </p>
              <button
                type="button"
                aria-label={actualSize ? "全体を表示" : "原寸で見る"}
                aria-pressed={actualSize}
                onClick={() => setActualSize(!actualSize)}
              >
                {actualSize ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
                <span>{actualSize ? "全体を表示" : "原寸で見る"}</span>
              </button>
              <button
                type="button"
                aria-label="拡大画面を閉じる"
                onClick={() => dialog.current?.close()}
              >
                <X size={22} />
              </button>
            </div>
            <div
              className={`doya-preview-canvas ${actualSize ? "is-actual-size" : ""}`}
              tabIndex={0}
              aria-label="操作画面。原寸表示ではスクロールできます。"
            >
              {expandedContent ||
                (src && (
                  <Image
                    src={src}
                    alt={alt}
                    width={1280}
                    height={800}
                    unoptimized
                  />
                ))}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
