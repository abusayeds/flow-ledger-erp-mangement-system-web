/**
 * File: src/utils/alert.ts
 * Every success/error/warning message in the app — backend API errors and
 * frontend-only ones alike — goes through the one custom AppToast component
 * (see src/components/ui/AppToast.tsx). No other notification format is used.
 *
 * `Swal` (SweetAlert2) stays available as the default export for actual
 * interactive confirm dialogs elsewhere (e.g. "Delete this role?") — those
 * need a Promise-based yes/no decision, which is a different job from a
 * notification.
 *
 * Usage:
 *   import { alertError, alertSuccess } from "@/utils/alert";
 *   alertSuccess("Login complete!");
 *   try { ... } catch (e) { alertApiError(e); }
 */

import Swal from "sweetalert2";
import { ApiError } from "../lib/api/ApiError";
import { showAppToast } from "../components/ui/AppToast";

export function alertSuccess(message: string, title?: string) {
  showAppToast("success", message, title);
  return Promise.resolve();
}

export function alertError(message: string, title?: string) {
  showAppToast("error", message, title);
  return Promise.resolve();
}

export function alertWarning(message: string, title?: string) {
  showAppToast("warning", message, title);
  return Promise.resolve();
}

/** Same toast, just an explicit icon (kept for call sites that pick one). */
export function alertToast(
  message: string,
  icon: "success" | "error" | "warning" | "info" = "success",
) {
  showAppToast(icon, message);
  return Promise.resolve();
}

/**
 * Map an error thrown by the API client (ApiError) to a toast. Backend
 * errors carry a human message (e.g. "Wrong password!", "This account does
 * not exist."), which we surface directly.
 */
export function alertApiError(error: unknown, fallback = "Something went wrong.") {
  let title: string | undefined;
  let message = fallback;

  if (error instanceof ApiError) {
    message = error.message || fallback;
    if (error.isNetworkError) {
      title = "Connection error";
      message =
        "Couldn't reach the server. Check your connection and try again.";
    } else if (error.status === 401) {
      title = "Login failed";
    } else if (error.status === 404) {
      title = "Account not found";
    } else if (error.status === 403) {
      title = "Access denied";
    }
  } else if (error instanceof Error) {
    message = error.message || fallback;
  }

  return alertError(message, title);
}

export default Swal;
