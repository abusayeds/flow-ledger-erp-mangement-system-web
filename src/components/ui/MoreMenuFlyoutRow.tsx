/**
 * Nested ▸ row for detail ⋮ menus — side flyout like Invoice Duplicate.
 */
import React, { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { MenuSideFlyout } from "@/components/ui/MenuSideFlyout";

type Props = {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export const MoreMenuFlyoutRow: React.FC<Props> = ({ label, children, className = "" }) => {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const openSub = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };

  const item =
    className ||
    "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap";

  return (
    <div
      ref={rowRef}
      className="relative"
      onMouseEnter={openSub}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={item}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (closeTimer.current) window.clearTimeout(closeTimer.current);
          setOpen((v) => !v);
        }}
      >
        {label}
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      <MenuSideFlyout
        open={open}
        anchorRef={rowRef}
        onHoverChange={(h) => (h ? openSub() : scheduleClose())}
      >
        {children}
      </MenuSideFlyout>
    </div>
  );
};

export default MoreMenuFlyoutRow;
