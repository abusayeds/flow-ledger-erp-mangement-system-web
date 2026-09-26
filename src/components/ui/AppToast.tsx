/**
 * File: src/components/ui/AppToast.tsx
 * The one and only notification format for the whole app — every success,
 * error, warning, and API error (backend or frontend) renders through this,
 * via `showAppToast()` (used internally by `src/utils/alert.ts`, which every
 * page already calls — nothing else needs to change).
 *
 * Appears top-left with a bottom progress border that depletes over a few
 * seconds.
 * - "success" toasts auto-dismiss the moment the border finishes depleting.
 * - Every other type (error/warning/info) does NOT auto-dismiss: once the
 *   border finishes, a close (X) button appears instead, and while any such
 *   toast is still open the rest of the app is blocked from interaction (a
 *   transparent overlay swallows clicks) — the user must close it first.
 */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type AppToastType = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  type: AppToastType;
  title?: string;
  message: string;
};

const COUNTDOWN_MS = 4500;

let toasts: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((l) => l(toasts));
}

/** Show one toast. Returns its id (usable with dismissAppToast, rarely needed). */
export function showAppToast(type: AppToastType, message: string, title?: string): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { id, type, message, title }];
  emit();
  return id;
}

export function dismissAppToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribeAppToasts(listener: (items: ToastItem[]) => void): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}

const TYPE_STYLES: Record<
  AppToastType,
  { icon: React.ElementType; color: string }
> = {
  success: { icon: CheckCircle2, color: "#22c55e" },
  error: { icon: XCircle, color: "#ef4444" },
  warning: { icon: AlertTriangle, color: "#f59e0b" },
  info: { icon: Info, color: "#3b82f6" },
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({
  item,
  onDismiss,
}) => {
  const [depleted, setDepleted] = useState(false);
  const [barWidth, setBarWidth] = useState(true); // true = full, false = empty (triggers transition)

  useEffect(() => {
    // Start the depletion on the next frame so the CSS transition actually animates.
    const raf = requestAnimationFrame(() => setBarWidth(false));
    const timer = setTimeout(() => {
      if (item.type === "success") {
        onDismiss(item.id); // success auto-closes once the countdown ends
      } else {
        setDepleted(true); // everything else waits for a manual close
      }
    }, COUNTDOWN_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { icon: Icon, color } = TYPE_STYLES[item.type];

  return (
    <div
      role="alert"
      className="pointer-events-auto relative w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border shadow-lg"
      style={{
        background: "var(--surface)",
        borderColor: "var(--color-gray-300)",
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3 pr-9">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color }} />
        <div className="min-w-0 flex-1">
          {item.title && (
            <p className="text-sm font-semibold" style={{ color: "var(--color-base-900)" }}>
              {item.title}
            </p>
          )}
          <p className="text-sm leading-snug" style={{ color: "var(--color-base-900)" }}>
            {item.message}
          </p>
        </div>
      </div>

      {depleted ? (
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label="Close"
          title="Close"
          className="absolute right-2 top-2 rounded p-1 hover:bg-black/10"
          style={{ color: "var(--color-base-500)" }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {/* Countdown border */}
      <div
        className="h-[3px] transition-[width] ease-linear"
        style={{
          width: barWidth ? "100%" : "0%",
          transitionDuration: `${COUNTDOWN_MS}ms`,
          background: color,
        }}
      />
    </div>
  );
};

/** Mount once at the app root. Renders every active toast, stacked top-left. */
export const AppToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeAppToasts(setItems), []);

  if (items.length === 0) return null;

  // Any non-success toast blocks the rest of the app until it's closed.
  const isBlocking = items.some((t) => t.type !== "success");

  return createPortal(
    <>
      {isBlocking && (
        <div
          className="fixed inset-0 z-[290]"
          style={{ background: "rgba(0,0,0,0.03)" }}
          onMouseDown={(e) => e.preventDefault()}
        />
      )}
      <div className="pointer-events-none fixed right-4 top-4 z-[300] flex flex-col items-start gap-2">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismissAppToast} />
        ))}
      </div>
    </>,
    document.body,
  );
};

export default AppToastContainer;
