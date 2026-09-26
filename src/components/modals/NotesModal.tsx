/**
 * Companies → Notes — load/save via `/setting/notes`.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import {
  EMPTY_NOTES,
  NOTES_DOC_TYPES,
  fetchNotesSettings,
  saveNotesSettings,
  type NotesDocKey,
  type NotesSettings,
} from "@/services/notesSettingsApi";

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const fieldClass =
  "ua-field keep-box w-full rounded-lg px-3 pt-6 pb-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-500";

interface NotesModalProps {
  onClose: () => void;
}

export const NotesModal: React.FC<NotesModalProps> = ({ onClose }) => {
  const [values, setValues] = useState<NotesSettings>({ ...EMPTY_NOTES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setValues(await fetchNotesSettings());
    } catch (err) {
      showToast(errMsg(err, "Couldn't load notes"), "error");
      setValues({ ...EMPTY_NOTES });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const patch = (key: NotesDocKey, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const onDone = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveNotesSettings(values);
      setValues(saved);
      showToast("Notes saved", "success");
      onClose();
    } catch (err) {
      showToast(errMsg(err, "Couldn't save notes"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto flex flex-col border border-gray-300"
        style={{ maxHeight: "85vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Notes</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onDone()}
              disabled={loading || saving}
              className="px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Done
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {loading ? (
            <div className="flex justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            NOTES_DOC_TYPES.map(({ key, label }) => (
              <div key={key} className="relative">
                <textarea
                  value={values[key]}
                  onChange={(e) => patch(key, e.target.value)}
                  rows={4}
                  placeholder=" "
                  className={fieldClass}
                />
                <label className="absolute top-2 left-3 text-xs text-gray-500 pointer-events-none">
                  {label}
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
