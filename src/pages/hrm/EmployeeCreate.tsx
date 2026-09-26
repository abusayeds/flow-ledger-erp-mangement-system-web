/**
 * File: src/pages/hrm/EmployeeCreate.tsx
 * Create / Edit Employee — full-page 6-step wizard matching the ERPGO
 * reference (references/hrm/employee/create employee step 1-5 + 6.png):
 * Personal → Employment → Contact → Banking → Hours & Rates → Documents.
 * Qayd blue theme; data persisted via the hrm meta store.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  useEmployees,
  saveEmployees,
  useHrmLookups,
  nextEmployeeId,
  newUid,
  DOCUMENT_TYPES,
  type HrmEmployee,
  type HrmDocument,
} from "@/lib/db/hrm";
import { employeeApi } from "@/services/hrm";
import {
  Field,
  inputCls,
  selectCls,
  SearchSelect,
  HrmBreadcrumb,
  uploadHrmFile,
  HrmDocumentLink,
} from "./hrmShared";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STEPS = ["Personal", "Employment", "Contact", "Banking", "Hours & Rates", "Documents"] as const;

const emptyForm = (id: number): HrmEmployee => ({
  id,
  employeeId: `EMP2026${String(id).padStart(4, "0")}`,
  name: "",
  dob: "",
  gender: "Male",
  shift: "",
  dateOfJoining: "",
  employmentType: "Full Time",
  branch: "",
  department: "",
  designation: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyNumber: "",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  bankCode: "",
  bankBranch: "",
  taxPayerId: "",
  basicSalary: 0,
  hoursPerDay: 8,
  daysPerWeek: 5,
  ratePerHour: 0,
  documents: [],
});

const EmployeeCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const employees = useEmployees();
  const lookups = useHrmLookups();
  useEffect(() => {
  }, [employees]);

  const list = employees || [];
  const editing = id != null ? list.find((e) => e.id === Number(id)) : undefined;
  const isEdit = id != null;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<HrmEmployee>(() => emptyForm(1));
  const [loaded, setLoaded] = useState(false);

  // hydrate once the store arrives
  useEffect(() => {
    if (loaded || employees === undefined) return;
    if (editing) {
      setForm(JSON.parse(JSON.stringify(editing)));
      setLoaded(true);
      return;
    }
    const base = emptyForm(nextEmployeeId(list));
    setForm(base);
    setLoaded(true);
    void employeeApi
      .generateId()
      .then((res) => {
        const idStr = res?.employee_id ? String(res.employee_id) : "";
        if (idStr) setForm((f) => (f.employeeId === base.employeeId ? { ...f, employeeId: idStr } : f));
      })
      .catch(() => {
        /* keep local EMP… suggestion */
      });
  }, [employees, editing, list, loaded]);

  const set = (patch: Partial<HrmEmployee>) => setForm((f) => ({ ...f, ...patch }));

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return form.employeeId.trim() !== "" && form.dob !== "";
      case 1:
        return form.name !== "" && form.shift !== "" && form.branch !== "" && form.department !== "" && form.designation !== "";
      case 2:
        return form.address1 !== "" && form.city !== "" && form.state !== "" && form.country !== "" && form.postalCode !== "" && form.emergencyName !== "" && form.emergencyRelation !== "" && form.emergencyNumber !== "";
      case 3:
        return form.bankName !== "" && form.accountHolder !== "" && form.accountNumber !== "" && form.bankCode !== "" && form.bankBranch !== "";
      case 4:
        return form.basicSalary > 0 && form.hoursPerDay > 0 && form.daysPerWeek > 0 && form.ratePerHour > 0;
      default:
        return true;
    }
  }, [step, form]);

  const submit = async () => {
    const current = employees || [];
    if (isEdit) {
      await saveEmployees(current.map((e) => (e.id === form.id ? form : e)));
      showToast("Employee updated successfully", "success");
    } else {
      await saveEmployees([...current, form]);
      showToast("Employee created successfully", "success");
    }
    navigate("/hrm/employees");
  };

  const addDocument = () =>
    set({ documents: [...form.documents, { id: newUid(), type: "", fileName: "" }] });
  const updateDocument = (docId: string, patch: Partial<HrmDocument>) =>
    set({ documents: form.documents.map((d) => (d.id === docId ? { ...d, ...patch } : d)) });
  const removeDocument = (docId: string) =>
    set({ documents: form.documents.filter((d) => d.id !== docId) });

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb
        trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }, { label: "Employees", to: "/hrm/employees" }]}
        current={isEdit ? "Edit" : "Create"}
        onNavigate={navigate}
      />

      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Employee" : "Create Employee"}</h2>
        <button
          onClick={() => navigate("/hrm/employees")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="px-4 sm:px-6 pb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          {/* step tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6 overflow-x-auto">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => i < step && setStep(i)}
                className={`flex-1 whitespace-nowrap px-4 py-2 text-sm rounded-md transition-colors ${
                  i === step
                    ? "bg-white shadow font-semibold text-gray-900"
                    : i < step
                      ? "text-blue-600 hover:text-blue-700"
                      : "text-gray-500 cursor-default"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* ── Personal ── */}
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Employee Id" required>
                <input
                  value={form.employeeId}
                  onChange={(e) => set({ employeeId: e.target.value })}
                  placeholder="e.g. EMP20260001"
                  className={inputCls}
                />
              </Field>
              <Field label="Date Of Birth" required>
                <AppDatePicker value={form.dob} onChange={(e) => set({ dob: e.target.value })} className={inputCls} />
              </Field>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <div className="flex items-center gap-6">
                  {(["Male", "Female", "Other"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        checked={form.gender === g}
                        onChange={() => set({ gender: g })}
                        className="w-4 h-4 accent-blue-600"
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Employment ── */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="User" required hint="Note: Company users will be applicable for create employee.">
                <SearchSelect
                  value={form.name}
                  onChange={(v) => set({ name: v, accountHolder: form.accountHolder || v })}
                  options={lookups.users.filter((u) => u === form.name || !list.some((e) => e.name === u && e.id !== form.id))}
                  placeholder="Select User"
                />
              </Field>
              <Field label="Shift" required>
                <SearchSelect value={form.shift} onChange={(v) => set({ shift: v })} options={lookups.shifts} placeholder="Select Shift" />
              </Field>
              <Field label="Date Of Joining">
                <AppDatePicker value={form.dateOfJoining} onChange={(e) => set({ dateOfJoining: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Employment Type" required>
                <select
                  value={form.employmentType}
                  onChange={(e) => set({ employmentType: e.target.value as HrmEmployee["employmentType"] })}
                  className={selectCls}
                >
                  {["Full Time", "Part Time", "Contract", "Temporary"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Branch" required>
                <SearchSelect
                  value={form.branch}
                  onChange={(v) => set({ branch: v, department: "", designation: "" })}
                  options={lookups.branches}
                  placeholder="Select Branch"
                  disabled={!form.name}
                  disabledPlaceholder="Select User first"
                />
              </Field>
              <Field label="Department" required>
                <SearchSelect
                  value={form.department}
                  onChange={(v) => set({ department: v, designation: "" })}
                  options={lookups.departments}
                  placeholder="Select Department"
                  disabled={!form.branch}
                  disabledPlaceholder="Select Branch first"
                />
              </Field>
              <Field label="Designation" required>
                <SearchSelect
                  value={form.designation}
                  onChange={(v) => set({ designation: v })}
                  options={lookups.designations}
                  placeholder="Select Designation"
                  disabled={!form.department}
                  disabledPlaceholder="Select Department first"
                />
              </Field>
            </div>
          )}

          {/* ── Contact ── */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Address Line 1" required>
                <input value={form.address1} onChange={(e) => set({ address1: e.target.value })} placeholder="Enter Address Line 1" className={inputCls} />
              </Field>
              <Field label="Address Line 2">
                <input value={form.address2} onChange={(e) => set({ address2: e.target.value })} placeholder="Enter Address Line 2" className={inputCls} />
              </Field>
              <Field label="City" required>
                <input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Enter City" className={inputCls} />
              </Field>
              <Field label="State" required>
                <input value={form.state} onChange={(e) => set({ state: e.target.value })} placeholder="Enter State" className={inputCls} />
              </Field>
              <Field label="Country" required>
                <input value={form.country} onChange={(e) => set({ country: e.target.value })} placeholder="Enter Country" className={inputCls} />
              </Field>
              <Field label="Postal Code" required>
                <input value={form.postalCode} onChange={(e) => set({ postalCode: e.target.value })} placeholder="Enter Postal Code" className={inputCls} />
              </Field>
              <Field label="Emergency Contact Name" required>
                <input value={form.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} placeholder="Enter Emergency Contact Name" className={inputCls} />
              </Field>
              <Field label="Emergency Contact Relationship" required>
                <input value={form.emergencyRelation} onChange={(e) => set({ emergencyRelation: e.target.value })} placeholder="Enter Emergency Contact Relationship" className={inputCls} />
              </Field>
              <Field label="Emergency Contact Number" required hint="Format: +[country code][phone number]" className="md:col-span-2">
                <input value={form.emergencyNumber} onChange={(e) => set({ emergencyNumber: e.target.value })} placeholder="+1234567890" className={inputCls} />
              </Field>
            </div>
          )}

          {/* ── Banking ── */}
          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Bank Name" required>
                <input value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="Enter Bank Name" className={inputCls} />
              </Field>
              <Field label="Account Holder Name" required>
                <input value={form.accountHolder} onChange={(e) => set({ accountHolder: e.target.value })} placeholder="Enter Account Holder Name" className={inputCls} />
              </Field>
              <Field label="Account Number" required>
                <input value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="Enter Account Number" className={inputCls} />
              </Field>
              <Field label="Bank Identifier Code" required>
                <input value={form.bankCode} onChange={(e) => set({ bankCode: e.target.value })} placeholder="Enter Bank Identifier Code" className={inputCls} />
              </Field>
              <Field label="Bank Branch" required>
                <input value={form.bankBranch} onChange={(e) => set({ bankBranch: e.target.value })} placeholder="Enter Bank Branch" className={inputCls} />
              </Field>
              <Field label="Tax Payer Id">
                <input value={form.taxPayerId} onChange={(e) => set({ taxPayerId: e.target.value })} placeholder="Enter Tax Payer Id" className={inputCls} />
              </Field>
            </div>
          )}

          {/* ── Hours & Rates ── */}
          {step === 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
              <Field label="Basic Salary" required>
                <input
                  type="number"
                  min={0}
                  value={form.basicSalary || ""}
                  onChange={(e) => set({ basicSalary: Number(e.target.value) })}
                  placeholder="Enter Basic Salary"
                  className={inputCls}
                />
              </Field>
              <Field label="Hours Per Day" required>
                <input
                  type="number"
                  min={0}
                  value={form.hoursPerDay || ""}
                  onChange={(e) => set({ hoursPerDay: Number(e.target.value) })}
                  placeholder="Enter Hours Per Day"
                  className={inputCls}
                />
              </Field>
              <Field label="Days Per Week" required>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={form.daysPerWeek || ""}
                  onChange={(e) => set({ daysPerWeek: Number(e.target.value) })}
                  placeholder="Enter Days Per Week"
                  className={inputCls}
                />
              </Field>
              <Field label="Rate Per Hour" required>
                <input
                  type="number"
                  min={0}
                  value={form.ratePerHour || ""}
                  onChange={(e) => set({ ratePerHour: Number(e.target.value) })}
                  placeholder="Enter Rate Per Hour"
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {/* ── Documents ── */}
          {step === 5 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Employee Documents</h3>
                <button
                  onClick={addDocument}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Document
                </button>
              </div>
              <div className="space-y-4">
                {form.documents.map((doc) => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <Field label="Document Type" required>
                        <SearchSelect
                          value={doc.type}
                          onChange={(v) => updateDocument(doc.id, { type: v })}
                          options={DOCUMENT_TYPES}
                          placeholder="Select Document Type"
                        />
                      </Field>
                      <Field label="Document File" required>
                        <label className={`${inputCls} flex items-center gap-2 cursor-pointer bg-white`}>
                          <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className={doc.fileName ? "text-gray-900 truncate" : "text-gray-400"}>
                            {doc.fileName || "Choose File — no file chosen"}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              void uploadHrmFile(file)
                                .then((up) =>
                                  updateDocument(doc.id, {
                                    fileName: up.name,
                                    path: up.path,
                                    url: up.url,
                                  }),
                                )
                                .catch((err: unknown) =>
                                  showToast(
                                    err instanceof Error ? err.message : "Upload failed",
                                    "error",
                                  ),
                                );
                            }}
                          />
                        </label>
                        {doc.path ? (
                          <div className="mt-2">
                            <HrmDocumentLink path={doc.path} />
                          </div>
                        ) : null}
                      </Field>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => removeDocument(doc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
                {form.documents.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-lg py-10 text-center text-sm text-gray-400">
                    No documents added yet — click "Add Document".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* footer buttons */}
          <div className="flex items-center justify-between mt-8">
            <div>
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Previous
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {step === STEPS.length - 1 ? (
                <>
                  <button
                    onClick={() => navigate("/hrm/employees")}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    {isEdit ? "Update" : "Create"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => stepValid && setStep(step + 1)}
                  disabled={!stepValid}
                  className={`px-5 py-2 rounded-md text-sm font-medium text-white ${
                    stepValid ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCreate;
