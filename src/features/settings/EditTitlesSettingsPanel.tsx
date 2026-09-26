/**
 * Settings → Edit Titles — always-editable inputs, auto-save (no Save button).
 * Uses /edit-titles/my + /edit-titles/update (no backend changes).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Search } from "lucide-react";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import {
  fetchMyEditTitles,
  resetEditTitles,
  updateEditTitle,
  type EditTitleItem,
} from "@/services/editTitlesApi";

const SAVE_DEBOUNCE_MS = 650;

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

export const EditTitlesSettingsPanel: React.FC = () => {
  const [rows, setRows] = useState<EditTitleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  /** Last successfully saved name per id — skip PATCH if unchanged. */
  const savedNamesRef = useRef<Map<string, string>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const savedFlashRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    savedFlashRef.current.forEach((t) => clearTimeout(t));
    savedFlashRef.current.clear();
  };

  const load = useCallback(async () => {
    setLoading(true);
    clearTimers();
    try {
      const data = await fetchMyEditTitles();
      setRows(data);
      const map = new Map<string, string>();
      data.forEach((r) => map.set(r.id, r.name));
      savedNamesRef.current = map;
      setSavingIds(new Set());
      setSavedIds(new Set());
    } catch (err) {
      setRows([]);
      showToast(errMsg(err, "Couldn't load titles."), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => clearTimers();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const persist = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("Title cannot be empty", "info");
      // restore last saved
      const prev = savedNamesRef.current.get(id) ?? "";
      setRows((list) => list.map((r) => (r.id === id ? { ...r, name: prev } : r)));
      return;
    }
    if (savedNamesRef.current.get(id) === trimmed) return;

    setSavingIds((prev) => new Set(prev).add(id));
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    try {
      await updateEditTitle(id, trimmed);
      savedNamesRef.current.set(id, trimmed);
      setRows((list) => list.map((r) => (r.id === id ? { ...r, name: trimmed } : r)));
      setSavedIds((prev) => new Set(prev).add(id));
      const oldFlash = savedFlashRef.current.get(id);
      if (oldFlash) clearTimeout(oldFlash);
      savedFlashRef.current.set(
        id,
        setTimeout(() => {
          setSavedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          savedFlashRef.current.delete(id);
        }, 1500),
      );
    } catch (err) {
      showToast(errMsg(err, "Couldn't save title."), "error");
      const prev = savedNamesRef.current.get(id) ?? "";
      setRows((list) => list.map((r) => (r.id === id ? { ...r, name: prev } : r)));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const scheduleSave = useCallback(
    (id: string, name: string) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id);
          void persist(id, name);
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [persist],
  );

  const onChange = (id: string, name: string) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, name } : r)));
    scheduleSave(id, name);
  };

  const onBlur = (id: string, name: string) => {
    const pending = timersRef.current.get(id);
    if (pending) {
      clearTimeout(pending);
      timersRef.current.delete(id);
    }
    void persist(id, name);
  };

  const handleReset = async () => {
    if (!confirm("Reset all titles to the default list?")) return;
    setResetting(true);
    clearTimers();
    try {
      await resetEditTitles();
      showToast("Titles reset to defaults.", "success");
      await load();
    } catch (err) {
      showToast(errMsg(err, "Couldn't reset titles."), "error");
    } finally {
      setResetting(false);
    }
  };

  const busy = loading || resetting;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Edit Titles</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Edit any field — changes save automatically
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSearch((s) => !s)}
            className="p-2 hover:bg-gray-100 rounded"
            title="Search"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 hover:bg-gray-100 rounded"
            title="Refresh"
            disabled={busy}
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={busy}
            className="px-3 py-2 border border-gray-300 text-sm rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mb-4 max-w-md relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles…"
            autoFocus
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading titles…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg">
          {rows.length === 0
            ? "No titles yet. Try Reset to load the default list."
            : "No titles match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((row) => {
            const isSaving = savingIds.has(row.id);
            const justSaved = savedIds.has(row.id);
            return (
              <div key={row.id} className="relative">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => onChange(row.id, e.target.value)}
                  onBlur={(e) => onBlur(row.id, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-8 text-sm text-gray-900 shadow-none outline-none ring-0 focus:border-gray-300 focus:outline-none focus:ring-0 focus:shadow-none"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  ) : justSaved ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <p className="mt-4 text-xs text-gray-400">
          Showing {filtered.length} of {rows.length} titles · auto-saves while you type
        </p>
      )}
    </div>
  );
};

export default EditTitlesSettingsPanel;
