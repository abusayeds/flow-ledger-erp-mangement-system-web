/**
 * File: src/components/ui/TabSlide.tsx
 * Directional tab push-transition (matches the reference video): when the
 * active tab changes, the outgoing content slides out while the incoming
 * content slides in from the opposite side — full panel width.
 *
 *   moving to a HIGHER tab  → new content enters from the RIGHT (dir="right")
 *   moving to a LOWER tab   → new content enters from the LEFT  (dir="left")
 *
 * Usage:
 *   const [dir, setDir] = useState<"" | "left" | "right">("");
 *   const switchTab = (t) => { setDir(idx(t) > idx(tab) ? "right" : "left"); setTab(t); };
 *   <TabSlide tabKey={tab} dir={dir}> {tab === "A" && <A />} {tab === "B" && <B />} </TabSlide>
 *
 * The wrapper stays static and clips ONLY while animating, so the translated
 * panels never produce a horizontal scrollbar. Keyframes live in index.css
 * (.tab-in-from-*, .tab-out-to-*) — keep SLIDE_MS in sync with their duration.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export const SLIDE_MS = 800; // keep in sync with the .tab-* animation duration in index.css

export const TabSlide: React.FC<{ tabKey: string; dir: "" | "left" | "right"; children: React.ReactNode }> = ({ tabKey, dir, children }) => {
  const [prev, setPrev] = useState<{ key: string; node: React.ReactNode } | null>(null);
  const last = useRef<{ key: string; node: React.ReactNode }>({ key: tabKey, node: children });
  // Timer lives in a ref: the effect runs on every render, so returning a
  // cleanup here would cancel the timer on the very re-render that setPrev
  // triggers, leaving the outgoing panel mounted forever.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLayoutEffect(() => {
    if (last.current.key !== tabKey) {
      const old = { ...last.current };
      last.current = { key: tabKey, node: children };
      if (dir) {
        setPrev(old);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setPrev(null), SLIDE_MS);
      }
    } else {
      last.current = { key: tabKey, node: children };
    }
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const animating = !!prev && !!dir;
  return (
    <div className={`relative ${animating ? "overflow-hidden" : ""}`}>
      {animating && (
        <div aria-hidden className={`absolute inset-0 pointer-events-none ${dir === "right" ? "tab-out-to-left" : "tab-out-to-right"}`}>
          {prev!.node}
        </div>
      )}
      <div className={animating ? (dir === "right" ? "tab-in-from-right" : "tab-in-from-left") : ""}>{children}</div>
    </div>
  );
};

export default TabSlide;
