/**
 * Shared list-sidebar footer: one line — prev | total · count | next.
 * Theme-aware via `.list-sidebar-footer` (dark bar by default, light in Light theme).
 */
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TPartyPagination } from "@/services/customerTypes";

export const LIST_PAGE_SIZE = 20;

export type ListSidebarFooterProps = {
  /** Amount / summary (e.g. "$1,200.00 Due") */
  total: React.ReactNode;
  /** Count line joined with total in the center (e.g. "12 Invoices") */
  countLabel: string;
  pagination?: Pick<TPartyPagination, "totalPage" | "currentPage" | "totalData"> | null;
  page?: number;
  onPageChange?: (page: number) => void;
};

export function ListSidebarFooter({
  total,
  countLabel,
  pagination,
  page,
  onPageChange,
}: ListSidebarFooterProps) {
  const current = page ?? pagination?.currentPage ?? 1;
  const totalPage = Math.max(1, pagination?.totalPage ?? 1);
  const canPrev = !!onPageChange && current > 1;
  const canNext = !!onPageChange && current < totalPage;

  const arrowBtn =
    "w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent hover:bg-black/10";

  return (
    <div className="list-sidebar-footer flex items-center gap-2 px-3 py-2.5 border-t">
      <button
        type="button"
        title="Previous page"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={() => canPrev && onPageChange!(current - 1)}
        className={arrowBtn}
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2} />
      </button>

      <div className="min-w-0 flex-1 text-center leading-tight">
        <div className="text-base font-semibold truncate">{total}</div>
        <div className="list-sidebar-footer-muted text-sm truncate opacity-90">{countLabel}</div>
      </div>

      <button
        type="button"
        title="Next page"
        aria-label="Next page"
        disabled={!canNext}
        onClick={() => canNext && onPageChange!(current + 1)}
        className={arrowBtn}
      >
        <ChevronRight className="w-5 h-5" strokeWidth={2} />
      </button>
    </div>
  );
}

export default ListSidebarFooter;
