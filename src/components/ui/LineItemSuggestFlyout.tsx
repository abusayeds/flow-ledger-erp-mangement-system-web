/**
 * Product/service suggestion menu — portaled to document.body so it is never
 * clipped by table/panel overflow scrollbars on create/edit forms.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type LineItemSuggestOption = {
  key: string;
  name: string;
  rate: number;
  description?: string;
  stock?: number | string | null;
  code?: string;
};

type Props = {
  open: boolean;
  /** Anchor element (usually the item name cell / input wrapper). */
  anchorRef: React.RefObject<HTMLElement | null>;
  options: LineItemSuggestOption[];
  onPick: (key: string) => void;
  sortRecent: boolean;
  onSortRecentChange: (next: boolean) => void;
  emptyLabel?: string;
  showPrice?: boolean;
  formatPrice?: (rate: number) => string;
  showCode?: boolean;
  showDescription?: boolean;
  showStock?: boolean;
};

export const LineItemSuggestFlyout: React.FC<Props> = ({
  open,
  anchorRef,
  options,
  onPick,
  sortRecent,
  onSortRecentChange,
  emptyLabel = "No matching items",
  showPrice = true,
  formatPrice = (n) => String(n),
  showCode = false,
  showDescription = false,
  showStock = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const place = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 220), 280);
    let left = r.left;
    let top = r.bottom + 2;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    if (left < 8) left = 8;
    const panelH = panelRef.current?.offsetHeight || 180;
    if (top + panelH > window.innerHeight - 8 && r.top - panelH - 2 > 8) {
      top = r.top - panelH - 2;
    }
    setPos({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const sync = () => place();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      data-line-item-suggest=""
      className="fixed z-[100] bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden text-xs"
      style={
        pos
          ? { top: pos.top, left: pos.left, width: pos.width }
          : { top: -9999, left: -9999, visibility: "hidden" }
      }
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="max-h-40 overflow-y-auto py-0.5">
        {options.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            className="w-full flex items-start justify-between gap-3 px-2.5 py-1.5 hover:bg-gray-100 text-left"
          >
            <span className="text-gray-900 truncate min-w-0 leading-snug">
              <span className="font-medium text-[12px]">{c.name}</span>
              {showCode && c.code ? (
                <span className="text-gray-400 text-[10px] ml-1.5">{c.code}</span>
              ) : null}
              {showDescription && c.description ? (
                <span className="block text-[10px] text-gray-500 truncate">{c.description}</span>
              ) : null}
              {showStock && c.stock != null && c.stock !== "" ? (
                <span className="block text-[10px] text-gray-500">Stock: {c.stock}</span>
              ) : null}
            </span>
            {showPrice && (
              <span className="text-gray-700 flex-shrink-0 text-[11px] font-medium tabular-nums pt-0.5">
                {formatPrice(c.rate)}
              </span>
            )}
          </button>
        ))}
        {options.length === 0 && (
          <div className="px-2.5 py-2 text-[11px] text-gray-400">{emptyLabel}</div>
        )}
      </div>
      <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-600 border-t border-gray-200 cursor-pointer">
        <input
          type="checkbox"
          checked={sortRecent}
          onChange={() => onSortRecentChange(!sortRecent)}
          className="accent-blue-600 w-3 h-3"
        />
        Sort by Recent Used
      </label>
    </div>,
    document.body,
  );
};

export default LineItemSuggestFlyout;
