/**
 * App-wide date input: typeable + calendar popover.
 * Value is always `yyyy-MM-dd` (API-safe) or "".
 */

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { isIsoDate, isoToLocalDate, localDateToIso, toIsoDate } from "@/lib/dateIso";

const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const DOW = ["S", "M", "T", "W", "T", "F", "S"] as const;

export type AppDateChangeEvent = {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
};

export type AppDatePickerProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onChange?: (e: AppDateChangeEvent) => void;
  onValueChange?: (iso: string) => void;
  /** Floating label (Customers / Vendors style). */
  floatingLabel?: string;
  /** Hide the blue calendar button (rare). */
  hideIcon?: boolean;
};

function emitChange(
  onChange: AppDatePickerProps["onChange"],
  onValueChange: AppDatePickerProps["onValueChange"],
  value: string,
  name?: string
) {
  onValueChange?.(value);
  if (onChange) {
    const payload = { value, name };
    onChange({ target: payload, currentTarget: payload });
  }
}

export const AppDatePicker = React.forwardRef<HTMLInputElement, AppDatePickerProps>(
  (
    {
      value,
      defaultValue = "",
      onChange,
      onValueChange,
      floatingLabel,
      hideIcon = false,
      className = "",
      disabled = false,
      readOnly = false,
      placeholder,
      name,
      id,
      min,
      max,
      onBlur,
      onFocus,
      onKeyDown,
      ...rest
    },
    ref
  ) => {
    const autoId = useId();
    const inputId = id || autoId;
    const controlled = value !== undefined;
    const [inner, setInner] = useState(() => toIsoDate(defaultValue) || (isIsoDate(String(defaultValue || "").slice(0, 10)) ? String(defaultValue).slice(0, 10) : ""));
    const isoValue = controlled ? toIsoDate(value) || (isIsoDate(String(value || "").slice(0, 10)) ? String(value).slice(0, 10) : "") : inner;

    const [text, setText] = useState(isoValue);
    const [open, setOpen] = useState(false);
    const [monthMenu, setMonthMenu] = useState(false);
    const [view, setView] = useState(() => {
      const d = isoToLocalDate(isoValue) || new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      setText(isoValue);
      const d = isoToLocalDate(isoValue);
      if (d) setView(new Date(d.getFullYear(), d.getMonth(), 1));
    }, [isoValue]);

    const minIso = min ? toIsoDate(min) || String(min).slice(0, 10) : "";
    const maxIso = max ? toIsoDate(max) || String(max).slice(0, 10) : "";

    const commit = (next: string) => {
      const normalized = next === "" ? "" : toIsoDate(next);
      if (next !== "" && !normalized) {
        setText(isoValue);
        return;
      }
      if (normalized && minIso && normalized < minIso) {
        setText(isoValue);
        return;
      }
      if (normalized && maxIso && normalized > maxIso) {
        setText(isoValue);
        return;
      }
      setText(normalized);
      if (!controlled) setInner(normalized);
      emitChange(onChange, onValueChange, normalized, name);
    };

    const placePanel = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 288;
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      let top = r.bottom + 6;
      if (top + 340 > window.innerHeight && r.top > 340) top = r.top - 6 - 320;
      setPanelPos({ top, left });
    };

    const openCalendar = () => {
      if (disabled || readOnly) return;
      const d = isoToLocalDate(isoValue) || new Date();
      setView(new Date(d.getFullYear(), d.getMonth(), 1));
      setMonthMenu(false);
      placePanel();
      setOpen(true);
    };

    const closeCalendar = () => {
      setOpen(false);
      setMonthMenu(false);
    };

    const toggleCalendar = () => {
      if (disabled || readOnly) return;
      if (open) closeCalendar();
      else openCalendar();
    };

    useEffect(() => {
      if (!open) return;
      const onDoc = (e: MouseEvent) => {
        const t = e.target as Node;
        if (rootRef.current?.contains(t)) return;
        if (panelRef.current?.contains(t)) return;
        setOpen(false);
        setMonthMenu(false);
      };
      const onScroll = () => placePanel();
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      return () => {
        document.removeEventListener("mousedown", onDoc);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
      };
    }, [open]);

    const cells = useMemo(() => {
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      const lead = first.getDay();
      return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[];
    }, [view]);

    const years = useMemo(() => {
      const y = view.getFullYear();
      return Array.from({ length: 21 }, (_, i) => y - 10 + i);
    }, [view]);

    const isSelected = (day: number) => {
      const d = isoToLocalDate(isoValue);
      if (!d) return false;
      return d.getDate() === day && d.getMonth() === view.getMonth() && d.getFullYear() === view.getFullYear();
    };

    const isDisabledDay = (day: number) => {
      const iso = localDateToIso(new Date(view.getFullYear(), view.getMonth(), day));
      if (minIso && iso < minIso) return true;
      if (maxIso && iso > maxIso) return true;
      return false;
    };

    const pickDay = (day: number) => {
      if (isDisabledDay(day)) return;
      const iso = localDateToIso(new Date(view.getFullYear(), view.getMonth(), day));
      commit(iso);
      setOpen(false);
      setMonthMenu(false);
    };

    const ph =
      floatingLabel
        ? placeholder && placeholder !== floatingLabel
          ? placeholder
          : " "
        : placeholder || "yyyy-mm-dd";

    const resolvedInputClass = [
      floatingLabel
        ? "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600"
        : "",
      className,
      !hideIcon && !/\bpr-\d+\b/.test(className) ? "pr-12" : "",
      disabled ? "opacity-60 cursor-not-allowed" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const iconActive = open;

    const panel = open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose date"
            className="app-date-panel fixed z-[9999] w-72 rounded-md border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl"
            style={{ top: panelPos.top, left: panelPos.left }}
            data-qayd-surface="date-picker"
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonthMenu((v) => !v)}
                className="flex items-center gap-1 text-[13px] font-semibold tracking-wide text-gray-900 hover:text-gray-700"
              >
                {MONTHS_SHORT[view.getMonth()]} {view.getFullYear()}
                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {monthMenu ? (
              <div className="max-h-64 space-y-3 overflow-y-auto">
                <div className="grid grid-cols-4 gap-1">
                  {MONTHS_SHORT.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setView((v) => new Date(v.getFullYear(), i, 1));
                        setMonthMenu(false);
                      }}
                      className={`rounded px-1 py-1.5 text-xs ${
                        i === view.getMonth()
                          ? "bg-gray-100 font-semibold text-gray-900"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setView((v) => new Date(y, v.getMonth(), 1));
                        setMonthMenu(false);
                      }}
                      className={`rounded px-1 py-1.5 text-xs ${
                        y === view.getFullYear()
                          ? "bg-gray-100 font-semibold text-gray-900"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-gray-500">
                  {DOW.map((d, i) => (
                    <span key={`${d}-${i}`} className="py-1">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="mb-1 text-[11px] font-medium tracking-wide text-gray-500">
                  {MONTHS_SHORT[view.getMonth()]}
                </div>
                <div className="grid grid-cols-7 text-center">
                  {cells.map((day, i) =>
                    day == null ? (
                      <span key={`e-${i}`} className="h-9" />
                    ) : (
                      <button
                        key={`d-${day}`}
                        type="button"
                        disabled={isDisabledDay(day)}
                        onClick={() => pickDay(day)}
                        className={[
                          "mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                          isDisabledDay(day)
                            ? "cursor-not-allowed text-gray-300"
                            : "text-gray-800 hover:bg-gray-100",
                          isSelected(day)
                            ? "border border-gray-400 font-semibold text-gray-900"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {day}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>,
          document.body
        )
      : null;

    return (
      <div ref={rootRef} className={floatingLabel ? "relative fl-wrap" : "relative"}>
        {floatingLabel && <label className="fl-label">{floatingLabel}</label>}
        <div className="relative">
          <input
            {...rest}
            ref={inputRef}
            id={inputId}
            name={name}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            readOnly={readOnly}
            placeholder={ph}
            value={text}
            min={min}
            max={max}
            aria-invalid={text !== "" && !isIsoDate(text) ? true : undefined}
            className={resolvedInputClass}
            onFocus={(e) => {
              onFocus?.(e);
            }}
            onClick={() => {
              toggleCalendar();
            }}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              if (open) closeCalendar();
              // Live-commit only when already a valid ISO so API state stays clean
              if (v === "" || isIsoDate(v)) {
                if (!controlled) setInner(v);
                emitChange(onChange, onValueChange, v, name);
              }
            }}
            onBlur={(e) => {
              if (text === "" || isIsoDate(text)) {
                // already fine
              } else {
                const n = toIsoDate(text);
                if (n) commit(n);
                else setText(isoValue);
              }
              onBlur?.(e);
            }}
            onKeyDown={(e) => {
              // Typing closes the calendar if open
              if (
                open &&
                e.key.length === 1 &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey
              ) {
                closeCalendar();
              }
              if (e.key === "ArrowDown" && !open) {
                e.preventDefault();
                openCalendar();
              }
              if (e.key === "Escape" && open) {
                e.preventDefault();
                closeCalendar();
              }
              onKeyDown?.(e);
            }}
          />
          {!hideIcon && (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || readOnly}
              aria-label="Open calendar"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                toggleCalendar();
              }}
              className={[
                "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                iconActive ? "text-gray-700" : "text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              <Calendar className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
        {panel}
      </div>
    );
  }
);

AppDatePicker.displayName = "AppDatePicker";

export default AppDatePicker;
