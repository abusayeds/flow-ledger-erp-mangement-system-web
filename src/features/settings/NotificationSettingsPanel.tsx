/**
 * Settings → Notification Settings — backend-driven via `/setting/app` (type=notification).
 * Default timezone is editable; changes also sync to currency_format.timezone.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  buildTimezoneOptions,
  fetchNotificationSettings,
  matchTimezoneOption,
  resetNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/services/notificationSettingsApi";

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? "bg-blue-600" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

const fieldClass =
  "ua-field keep-box w-full px-3 py-2 text-sm focus:outline-none";

export const NotificationSettingsPanel: React.FC = () => {
  const timezoneOptions = useMemo(() => buildTimezoneOptions(), []);
  const [draft, setDraft] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotificationSettings();
      setDraft({
        ...data,
        timezone: matchTimezoneOption(data.timezone, timezoneOptions),
      });
    } catch (err) {
      showToast(errMsg(err, "Couldn't load notification settings"), "error");
      setDraft({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        timezone: matchTimezoneOption(
          DEFAULT_NOTIFICATION_SETTINGS.timezone,
          timezoneOptions,
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [timezoneOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (p: Partial<NotificationSettings>) =>
    setDraft((d) => ({ ...d, ...p }));

  const setRecurring = (key: keyof NotificationSettings["recurring"], v: boolean) =>
    setDraft((d) => ({ ...d, recurring: { ...d.recurring, [key]: v } }));

  const setReminder = (
    key: keyof NotificationSettings["paymentReminder"],
    v: boolean,
  ) =>
    setDraft((d) => ({
      ...d,
      paymentReminder: { ...d.paymentReminder, [key]: v },
    }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveNotificationSettings(draft);
      setDraft({
        ...saved,
        timezone: matchTimezoneOption(saved.timezone, timezoneOptions),
      });
      showToast("Notification settings saved", "success");
    } catch (err) {
      showToast(errMsg(err, "Couldn't save notification settings"), "error");
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    showToast("Refreshing…", "info");
    await load();
  };

  const reset = async () => {
    setSaving(true);
    try {
      const next = await resetNotificationSettings();
      setDraft({
        ...next,
        timezone: matchTimezoneOption(next.timezone, timezoneOptions),
      });
      showToast("Notification settings reset", "info");
    } catch (err) {
      showToast(errMsg(err, "Couldn't reset notification settings"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-600 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading notification settings…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
          <p className="text-sm text-gray-600 mt-0.5">Reminders and recurring alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="p-2 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={() => void reset()}
            disabled={saving}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            Default Time Zone
          </label>
          <select
            value={draft.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            className={fieldClass}
          >
            {/* Keep current value if not in list (legacy saved label) */}
            {!timezoneOptions.includes(draft.timezone) && draft.timezone && (
              <option value={draft.timezone}>{draft.timezone}</option>
            )}
            {timezoneOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            Notification Time
          </label>
          <input
            type="time"
            value={draft.notificationTime}
            onChange={(e) => patch({ notificationTime: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recurring</h3>
          <div className="space-y-3">
            {(
              [
                ["autoSendInvoice", "Auto Send Invoice"],
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-800">{label}</span>
                <Toggle
                  checked={draft.recurring[key]}
                  onChange={(v) => setRecurring(key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Reminder</h3>
          <div className="space-y-3">
            {(
              [
                ["autoSendPaymentReceipt", "Auto Send Payment Receipt"],
                ["defaultForNewCustomer", "Default for new Customer"],
                ["daysBeforeDue3", "3 days before due date"],
                ["onDueDate", "On due date"],
                ["daysAfterDue3", "3 days after due date"],
                ["daysAfterDue7", "7 days after due date"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-800">{label}</span>
                <Toggle
                  checked={draft.paymentReminder[key]}
                  onChange={(v) => setReminder(key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPanel;
