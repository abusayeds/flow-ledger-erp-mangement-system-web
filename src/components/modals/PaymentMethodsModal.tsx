import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import { api } from "@/lib/api/client";
import {
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  updatePaymentMethod,
  type PaymentMethodOption,
} from "@/services/paymentMethodsApi";
import { resolveMediaUrl } from "@/lib/env";

type DraftState = {
  id: string | null;
  name: string;
  logo: string;
};

const EMPTY_DRAFT: DraftState = {
  id: null,
  name: "",
  logo: "",
};

const uploadLogo = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("files", file);
  const uploadRes = await api.raw.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return (
    uploadRes.data?.data?.file_path ||
    uploadRes.data?.data?.url ||
    uploadRes.data?.data?.path ||
    ""
  );
};

const invalidatePaymentMethodQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["payment-method-options"] }),
    queryClient.invalidateQueries({ queryKey: ["invoice-form-payment-methods"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-receipt-form-payment-methods"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-invoice-payment-methods"] }),
  ]);
};

export const PaymentMethodsModal: React.FC<{
  onClose: () => void;
  selectedNames?: string[];
  allowMultiple?: boolean;
  onSaveSelection?: (names: string[]) => void;
}> = ({ onClose, selectedNames, allowMultiple = true, onSaveSelection }) => {
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [manageMode, setManageMode] = useState(!onSaveSelection);
  const [selection, setSelection] = useState<string[]>(selectedNames ?? []);

  useEffect(() => {
    setSelection(selectedNames ?? []);
  }, [selectedNames]);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payment-method-options"],
    queryFn: fetchPaymentMethods,
    staleTime: 30_000,
  });

  const filteredMethods = useMemo(
    () => methods.filter((method) => method.name.toLowerCase().includes(search.trim().toLowerCase())),
    [methods, search],
  );

  const logoPreview = resolveMediaUrl(draft.logo);

  const onLogoPick = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "warning");
      return;
    }
    setUploadingLogo(true);
    try {
      const path = await uploadLogo(file);
      if (!path) throw new Error("upload-failed");
      setDraft((current) => ({ ...current, logo: path }));
    } catch {
      showToast("Could not upload logo", "error");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: draft.name.trim(), logo: draft.logo.trim() || undefined };
      if (!payload.name) throw new Error("name-required");
      if (draft.id) return updatePaymentMethod(draft.id, payload);
      return createPaymentMethod(payload);
    },
    onSuccess: async () => {
      await invalidatePaymentMethodQueries(queryClient);
      showToast(draft.id ? "Payment method updated" : "Payment method created", "success");
      setDraft(EMPTY_DRAFT);
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === "name-required") {
        showToast("Payment method name is required", "warning");
        return;
      }
      showToast("Could not save payment method", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: async () => {
      await invalidatePaymentMethodQueries(queryClient);
      showToast("Payment method deleted", "success");
      setDraft(EMPTY_DRAFT);
    },
    onError: () => showToast("Could not delete payment method", "error"),
  });

  const startEdit = (method: PaymentMethodOption) => {
    setManageMode(true);
    setDraft({
      id: method._id,
      name: method.name || "",
      logo: method.logo || "",
    });
  };

  const toggleSelection = (name: string) => {
    setSelection((current) => {
      if (!allowMultiple) return current.includes(name) ? [] : [name];
      return current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
    });
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ maxHeight: "85vh" }}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Payment Methods</h2>
            <p className="text-sm text-gray-500">
              {onSaveSelection && !manageMode
                ? "Select payment methods for this document, then Save."
                : "Manage the backend payment methods used across documents."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!manageMode && onSaveSelection && (
              <button onClick={() => setManageMode(true)} className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
                Edit
              </button>
            )}
            {manageMode && onSaveSelection && (
              <button
                onClick={() => {
                  setManageMode(false);
                  setDraft(EMPTY_DRAFT);
                }}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                Back
              </button>
            )}
            {onSaveSelection && (
              <button
                onClick={() => {
                  onSaveSelection(selection);
                  onClose();
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Save
              </button>
            )}
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`border-b border-gray-200 p-5 ${manageMode ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
          <div className="space-y-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment methods"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <div className="max-h-[48vh] overflow-y-auto rounded-md border border-gray-200 custom-scrollbar">
              {isLoading ? (
                <div className="px-4 py-6 text-sm text-gray-400">Loading payment methods...</div>
              ) : filteredMethods.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400">No payment methods found</div>
              ) : (
                filteredMethods.map((method) => (
                  <div
                    key={method._id}
                    role={!manageMode && onSaveSelection ? "button" : undefined}
                    tabIndex={!manageMode && onSaveSelection ? 0 : undefined}
                    onClick={() => {
                      if (!manageMode && onSaveSelection) toggleSelection(method.name);
                    }}
                    onKeyDown={(e) => {
                      if (!manageMode && onSaveSelection && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        toggleSelection(method.name);
                      }
                    }}
                    className={`flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 ${
                      !manageMode && onSaveSelection ? "cursor-pointer hover:bg-blue-50/60" : ""
                    } ${!manageMode && selection.includes(method.name) ? "bg-blue-50" : ""}`}
                  >
                    {!manageMode && onSaveSelection && (
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border ${
                          selection.includes(method.name)
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-400 bg-white text-transparent"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white">
                      {method.logo ? (
                        <img
                          src={resolveMediaUrl(method.logo)}
                          alt={method.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">No Logo</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{method.name}</div>
                    </div>
                    {manageMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(method);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {manageMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(method._id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {manageMode && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {draft.id ? "Edit Payment Method" : "Add Payment Method"}
                </h3>
                {draft.id && (
                  <button onClick={() => setDraft(EMPTY_DRAFT)} className="text-xs text-gray-500 hover:text-gray-700">
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Name</label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Payment method name"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">Logo</label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onLogoPick(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="relative mx-auto flex h-28 w-28 flex-col items-center justify-center gap-2 overflow-hidden rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 disabled:opacity-60"
                  >
                    {logoPreview ? (
                      <>
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="absolute inset-0 h-full w-full object-contain bg-white p-2"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[10px] text-white">
                          {uploadingLogo ? "Uploading…" : "Change Logo"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
                          {uploadingLogo ? (
                            <ImagePlus className="h-5 w-5 animate-pulse" />
                          ) : (
                            <Plus className="h-5 w-5" />
                          )}
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                          {uploadingLogo ? "Uploading…" : "Add Logo"}
                        </span>
                      </>
                    )}
                  </button>
                  {draft.logo ? (
                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, logo: "" }))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove logo
                      </button>
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || uploadingLogo}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {draft.id ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {draft.id ? "Update Payment Method" : "Add Payment Method"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          {!onSaveSelection && (
            <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsModal;
