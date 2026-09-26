/**
 * App-wide stopwatch shared by the navbar timer pill and Time Logs.
 * One tick source so both UIs stay in sync.
 */

import { useEffect, useState } from "react";

export type AppTimerState = {
  running: boolean;
  seconds: number;
  /** Optional Time Log row id the timer is attached to. */
  logId: number | null;
  label: string;
};

type Listener = () => void;

let state: AppTimerState = { running: false, seconds: 0, logId: null, label: "" };
let tickId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function ensureTick() {
  if (state.running && tickId == null) {
    tickId = setInterval(() => {
      state = { ...state, seconds: state.seconds + 1 };
      emit();
    }, 1000);
  } else if (!state.running && tickId != null) {
    clearInterval(tickId);
    tickId = null;
  }
}

export function getAppTimer(): AppTimerState {
  return state;
}

export function startAppTimer(opts?: { logId?: number | null; label?: string; reset?: boolean }) {
  state = {
    running: true,
    seconds: opts?.reset ? 0 : state.seconds,
    logId: opts?.logId !== undefined ? opts.logId : state.logId,
    label: opts?.label !== undefined ? opts.label : state.label,
  };
  ensureTick();
  emit();
}

export function pauseAppTimer() {
  if (!state.running) return;
  state = { ...state, running: false };
  ensureTick();
  emit();
}

export function toggleAppTimer() {
  if (state.running) pauseAppTimer();
  else startAppTimer();
}

export function stopAppTimer() {
  state = { running: false, seconds: 0, logId: null, label: "" };
  ensureTick();
  emit();
}

export function onAppTimerChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppTimer(): AppTimerState {
  const [snap, setSnap] = useState(getAppTimer);
  useEffect(() => onAppTimerChange(() => setSnap({ ...getAppTimer() })), []);
  return snap;
}

export function formatAppTimer(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
