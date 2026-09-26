/**
 * Notification Settings — GET/PATCH `/setting/app` with type=notification.
 * Timezone is also mirrored to currency_format.timezone so App Settings stays in sync.
 */
import { api } from "@/lib/api/client";

export type NotificationSettings = {
  timezone: string;
  notificationTime: string;
  recurring: {
    autoSendInvoice: boolean;
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  };
  paymentReminder: {
    autoSendPaymentReceipt: boolean;
    defaultForNewCustomer: boolean;
    daysBeforeDue3: boolean;
    onDueDate: boolean;
    daysAfterDue3: boolean;
    daysAfterDue7: boolean;
  };
};

/** Common IANA zones with live GMT offset labels. */
const ZONE_IDS = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

function gmtLabel(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
    // "GMT+6" / "GMT-7" / "GMT"
    const m = raw.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
    if (!m) return raw === "UTC" ? "GMT+0:00" : raw;
    const h = Number(m[1]);
    const mins = m[2] || "00";
    const sign = h >= 0 ? `+${Math.abs(h)}` : `-${Math.abs(h)}`;
    return `GMT${sign}:${mins}`;
  } catch {
    return "GMT";
  }
}

export function buildTimezoneOptions(): string[] {
  return ZONE_IDS.map((id) => `(${gmtLabel(id)}) ${id}`);
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  timezone: "(GMT-7:00) America/Los_Angeles",
  notificationTime: "07:00",
  recurring: {
    autoSendInvoice: true,
    daily: true,
    weekly: true,
    monthly: true,
  },
  paymentReminder: {
    autoSendPaymentReceipt: true,
    defaultForNewCustomer: true,
    daysBeforeDue3: true,
    onDueDate: true,
    daysAfterDue3: true,
    daysAfterDue7: true,
  },
};

const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;

const text = (v: unknown, fallback: string) =>
  typeof v === "string" && v.trim() ? v : fallback;

/** Prefer an option that matches the IANA id suffix when offsets differ. */
export function matchTimezoneOption(saved: string, options: string[]): string {
  if (!saved) return options[0] || DEFAULT_NOTIFICATION_SETTINGS.timezone;
  if (options.includes(saved)) return saved;
  const id = saved.includes(" ") ? saved.split(" ").pop() || saved : saved;
  const hit = options.find((o) => o.endsWith(` ${id}`) || o.endsWith(id));
  return hit || saved || options[0] || DEFAULT_NOTIFICATION_SETTINGS.timezone;
}

function mapApiToUi(raw: any, currencyTimezone?: string): NotificationSettings {
  const fb = DEFAULT_NOTIFICATION_SETTINGS;
  const r = raw?.recurring || {};
  const p = raw?.payment_reminder || {};
  return {
    timezone: text(raw?.timezone, text(currencyTimezone, fb.timezone)),
    notificationTime: text(raw?.notification_time, fb.notificationTime),
    recurring: {
      autoSendInvoice: bool(r.auto_send_invoice, fb.recurring.autoSendInvoice),
      daily: bool(r.daily, fb.recurring.daily),
      weekly: bool(r.weekly, fb.recurring.weekly),
      monthly: bool(r.monthly, fb.recurring.monthly),
    },
    paymentReminder: {
      autoSendPaymentReceipt: bool(
        p.auto_send_payment_receipt,
        fb.paymentReminder.autoSendPaymentReceipt,
      ),
      defaultForNewCustomer: bool(
        p.default_for_new_customer,
        fb.paymentReminder.defaultForNewCustomer,
      ),
      daysBeforeDue3: bool(p.days_before_due_3, fb.paymentReminder.daysBeforeDue3),
      onDueDate: bool(p.on_due_date, fb.paymentReminder.onDueDate),
      daysAfterDue3: bool(p.days_after_due_3, fb.paymentReminder.daysAfterDue3),
      daysAfterDue7: bool(p.days_after_due_7, fb.paymentReminder.daysAfterDue7),
    },
  };
}

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const [notif, currency] = await Promise.all([
    api.get<any>("/setting/app", { params: { type: "notification" } }).catch(() => null),
    api.get<any>("/setting/app", { params: { type: "currency_format" } }).catch(() => null),
  ]);
  return mapApiToUi(notif, currency?.timezone);
}

export async function saveNotificationSettings(
  value: NotificationSettings,
): Promise<NotificationSettings> {
  // Persist notification section
  await api.patch("/setting/app", {
    type: "notification",
    timezone: value.timezone,
    notification_time: value.notificationTime,
    "recurring.auto_send_invoice": value.recurring.autoSendInvoice,
    "recurring.daily": value.recurring.daily,
    "recurring.weekly": value.recurring.weekly,
    "recurring.monthly": value.recurring.monthly,
    "payment_reminder.auto_send_payment_receipt":
      value.paymentReminder.autoSendPaymentReceipt,
    "payment_reminder.default_for_new_customer":
      value.paymentReminder.defaultForNewCustomer,
    "payment_reminder.days_before_due_3": value.paymentReminder.daysBeforeDue3,
    "payment_reminder.on_due_date": value.paymentReminder.onDueDate,
    "payment_reminder.days_after_due_3": value.paymentReminder.daysAfterDue3,
    "payment_reminder.days_after_due_7": value.paymentReminder.daysAfterDue7,
  });

  // Keep App Settings → Currency & Format timezone in sync (additive write).
  try {
    const currency = await api.get<any>("/setting/app", {
      params: { type: "currency_format" },
    });
    await api.patch("/setting/app", {
      type: "currency_format",
      currency: currency?.currency,
      currency_symbol: currency?.currency_symbol,
      currency_code: currency?.currency_code,
      multi_currency_display: currency?.multi_currency_display,
      decimal_places: currency?.decimal_places,
      date_number_format: currency?.date_number_format,
      language: currency?.language,
      timezone: value.timezone,
    });
  } catch {
    /* notification save already succeeded */
  }

  return value;
}

export async function resetNotificationSettings(): Promise<NotificationSettings> {
  await api.patch("/setting/app/reset", { type: "notification" });
  return fetchNotificationSettings();
}
