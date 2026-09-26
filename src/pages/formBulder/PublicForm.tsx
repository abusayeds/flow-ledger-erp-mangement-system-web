/**
 * Public form fill page — /f/:code (no auth)
 */
import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicForm, submitPublicForm } from "@/services/formBuilderApi";
import { showToast } from "@/utils/toast";
import { inputCls, selectCls } from "../hrm/hrmShared";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const PublicForm: React.FC = () => {
  const { code = "" } = useParams();
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: form, isLoading, isError, error } = useQuery({
    queryKey: ["public-form", code],
    queryFn: () => fetchPublicForm(code),
    enabled: Boolean(code),
    retry: false,
  });

  const fields = useMemo(
    () => [...(form?.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [form],
  );

  const setVal = (fieldId: string, v: string | string[]) =>
    setValues((prev) => ({ ...prev, [fieldId]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    for (const f of fields) {
      if (!f._id || !f.required) continue;
      const v = values[f._id];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && !v.trim()) ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        showToast(`${f.label} is required`, "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) payload[k] = v;
      await submitPublicForm(code, payload);
      setDone(true);
      showToast("Submitted successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Submit failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Loading form…
      </div>
    );
  }

  if (isError || !form?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900">Form unavailable</h1>
          <p className="text-sm text-gray-500 mt-2">
            {(error as any)?.message || "This form was not found or is no longer active."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900">Thank you</h1>
          <p className="text-sm text-gray-500 mt-2">Your response has been recorded.</p>
        </div>
      </div>
    );
  }

  const twoCol = form.defaultLayout === "two-column";

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold text-gray-900">{form.name}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Please fill out the form below.</p>

        <div className={twoCol ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-4"}>
          {fields.map((f) => {
            if (!f._id) return null;
            const fid = f._id;
            const commonLabel = (
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
            );

            if (f.type === "textarea") {
              return (
                <div key={fid} className={twoCol ? "sm:col-span-2" : ""}>
                  {commonLabel}
                  <textarea
                    value={String(values[fid] ?? "")}
                    onChange={(e) => setVal(fid, e.target.value)}
                    placeholder={f.placeholder}
                    rows={4}
                    className={inputCls}
                    required={f.required}
                  />
                </div>
              );
            }

            if (f.type === "select") {
              return (
                <div key={fid}>
                  {commonLabel}
                  <select
                    value={String(values[fid] ?? "")}
                    onChange={(e) => setVal(fid, e.target.value)}
                    className={selectCls}
                    required={f.required}
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === "radio") {
              return (
                <div key={fid} className={twoCol ? "sm:col-span-2" : ""}>
                  {commonLabel}
                  <div className="space-y-2">
                    {(f.options || []).map((o) => (
                      <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name={fid}
                          checked={values[fid] === o}
                          onChange={() => setVal(fid, o)}
                          required={f.required}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }

            if (f.type === "checkbox") {
              const selected = Array.isArray(values[fid]) ? (values[fid] as string[]) : [];
              const opts = f.options?.length ? f.options : ["Yes"];
              return (
                <div key={fid} className={twoCol ? "sm:col-span-2" : ""}>
                  {commonLabel}
                  <div className="space-y-2">
                    {opts.map((o) => {
                      const checked = selected.includes(o);
                      return (
                        <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setVal(
                                fid,
                                checked ? selected.filter((x) => x !== o) : [...selected, o],
                              )
                            }
                          />
                          {o}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const inputType =
              f.type === "tel"
                ? "tel"
                : f.type === "email"
                  ? "email"
                  : f.type === "number"
                    ? "number"
                    : f.type === "url"
                      ? "url"
                      : f.type === "password"
                        ? "password"
                        : f.type === "time"
                          ? "time"
                          : "text";

            if (f.type === "date") {
              return (
                <div key={fid}>
                  {commonLabel}
                  <AppDatePicker
                    value={String(values[fid] ?? "")}
                    onValueChange={(v) => setVal(fid, v)}
                    placeholder={f.placeholder}
                    className={inputCls}
                    required={f.required}
                  />
                </div>
              );
            }

            return (
              <div key={fid}>
                {commonLabel}
                <input
                  type={inputType}
                  value={String(values[fid] ?? "")}
                  onChange={(e) => setVal(fid, e.target.value)}
                  placeholder={f.placeholder}
                  className={inputCls}
                  required={f.required}
                />
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full sm:w-auto px-6 py-2.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default PublicForm;
