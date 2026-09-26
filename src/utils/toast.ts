/**
 * File: src/utils/toast.ts
 * `showToast(message, type)` is used across ~150 files. It renders through
 * the one app-wide AppToast component (src/components/ui/AppToast.tsx) —
 * same as everything in src/utils/alert.ts — so there is a single
 * notification format everywhere in the app, not two parallel systems.
 */
import { showAppToast, type AppToastType } from "../components/ui/AppToast";

export type ToastType = AppToastType;

export const showToast = (message: string, type: ToastType = "info") => {
  showAppToast(type, message);
};
