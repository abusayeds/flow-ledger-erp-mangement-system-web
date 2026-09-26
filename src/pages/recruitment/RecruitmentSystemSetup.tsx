/**
 * Recruitment System Setup — job types / sources / interview types / checklists + settings
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchJobTypes,
  createJobType,
  updateJobType,
  deleteJobType,
  fetchCandidateSources,
  createCandidateSource,
  updateCandidateSource,
  deleteCandidateSource,
  fetchInterviewTypes,
  createInterviewType,
  updateInterviewType,
  deleteInterviewType,
  fetchOnboardingChecklists,
  createOnboardingChecklist,
  updateOnboardingChecklist,
  deleteOnboardingChecklist,
  getBrandSettings,
  saveBrandSettings,
  getAboutCompany,
  saveAboutCompany,
  getApplicationTips,
  saveApplicationTips,
  getWhatHappensNext,
  saveWhatHappensNext,
  getNeedHelp,
  saveNeedHelp,
  getTrackingFaq,
  saveTrackingFaq,
  getOfferLetterTemplate,
  saveOfferLetterTemplate,
  getOfferLetterPlaceholders,
  ACTIVE_INACTIVE,
  boolFilterValue,
  statusLabel,
  type JobTypeRow,
  type CandidateSourceRow,
  type InterviewTypeRow,
  type OnboardingChecklistRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Plus, Save } from "lucide-react";

type SetupTab =
  | "jobTypes"
  | "candidateSources"
  | "interviewTypes"
  | "onboardingChecklists"
  | "brandSettings"
  | "aboutCompany"
  | "applicationTips"
  | "whatHappensNext"
  | "needHelp"
  | "trackingFaq"
  | "offerLetterTemplate";

const CRUD_TABS: SetupTab[] = ["jobTypes", "candidateSources", "interviewTypes", "onboardingChecklists"];

const TABS: { id: SetupTab; label: string }[] = [
  { id: "jobTypes", label: "Job Types" },
  { id: "candidateSources", label: "Candidate Sources" },
  { id: "interviewTypes", label: "Interview Types" },
  { id: "onboardingChecklists", label: "Onboarding Checklists" },
  { id: "brandSettings", label: "Brand Settings" },
  { id: "aboutCompany", label: "About Company" },
  { id: "applicationTips", label: "Application Tips" },
  { id: "whatHappensNext", label: "What Happens Next" },
  { id: "needHelp", label: "Need Help" },
  { id: "trackingFaq", label: "Tracking FAQ" },
  { id: "offerLetterTemplate", label: "Offer Letter Template" },
];

const emptyNamed = () => ({ id: "", name: "", description: "", isActive: true, isDefault: false, status: true });

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const RecruitmentSystemSetup: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<SetupTab>("jobTypes");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyNamed());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Settings state
  const [brandForm, setBrandForm] = useState<Record<string, string>>({});
  const [aboutForm, setAboutForm] = useState<Record<string, string>>({});
  const [tips, setTips] = useState<{ id: string; text: string }[]>([]);
  const [steps, setSteps] = useState<{ id: string; title: string; icon: string; description: string }[]>([]);
  const [needHelpForm, setNeedHelpForm] = useState<Record<string, string>>({});
  const [faqs, setFaqs] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [offerTpl, setOfferTpl] = useState({ subject: "", content: "", signature: "" });
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
    setStatusFilter("All");
    setModal(null);
    setDeleteTarget(null);
  }, [tab]);

  const isCrud = CRUD_TABS.includes(tab);

  const jobTypesQ = useQuery({
    queryKey: ["recruitment-job-types", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchJobTypes({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        is_active: boolFilterValue(statusFilter),
      }),
    enabled: tab === "jobTypes",
    placeholderData: (prev) => prev,
  });

  const sourcesQ = useQuery({
    queryKey: ["recruitment-candidate-sources", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchCandidateSources({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        is_active: boolFilterValue(statusFilter),
      }),
    enabled: tab === "candidateSources",
    placeholderData: (prev) => prev,
  });

  const interviewTypesQ = useQuery({
    queryKey: ["recruitment-interview-types", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchInterviewTypes({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        is_active: boolFilterValue(statusFilter),
      }),
    enabled: tab === "interviewTypes",
    placeholderData: (prev) => prev,
  });

  const checklistsQ = useQuery({
    queryKey: ["recruitment-onboarding-checklists", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchOnboardingChecklists({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        status: boolFilterValue(statusFilter),
      }),
    enabled: tab === "onboardingChecklists",
    placeholderData: (prev) => prev,
  });

  const settingsQ = useQuery({
    queryKey: ["recruitment-settings", tab],
    queryFn: async () => {
      if (tab === "brandSettings") return getBrandSettings();
      if (tab === "aboutCompany") return getAboutCompany();
      if (tab === "applicationTips") return getApplicationTips();
      if (tab === "whatHappensNext") return getWhatHappensNext();
      if (tab === "needHelp") return getNeedHelp();
      if (tab === "trackingFaq") return getTrackingFaq();
      if (tab === "offerLetterTemplate") {
        const [tpl, ph] = await Promise.all([getOfferLetterTemplate(), getOfferLetterPlaceholders()]);
        return { tpl, ph };
      }
      return null;
    },
    enabled: !isCrud,
  });

  useEffect(() => {
    if (!settingsQ.data || isCrud) return;
    const d: any = settingsQ.data;
    if (tab === "brandSettings") {
      const obj = d && typeof d === "object" ? d : {};
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") flat[k] = String(v);
      }
      if (Object.keys(flat).length === 0) {
        flat.company_name = "";
        flat.primary_color = "#2563eb";
        flat.secondary_color = "#0f172a";
        flat.logo_url = "";
        flat.tagline = "";
      }
      setBrandForm(flat);
    } else if (tab === "aboutCompany") {
      const obj = d && typeof d === "object" ? d : {};
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" || typeof v === "number") flat[k] = String(v);
      }
      if (!flat.title && !flat.content && !flat.description) {
        flat.title = "";
        flat.content = "";
      }
      setAboutForm(flat);
    } else if (tab === "applicationTips") {
      const items = Array.isArray(d?.items) ? d.items : [];
      setTips(items.map((x: any) => ({ id: String(x.id || uid()), text: String(x.text || "") })));
    } else if (tab === "whatHappensNext") {
      const items = Array.isArray(d?.items) ? d.items : [];
      setSteps(
        items.map((x: any) => ({
          id: String(x.id || uid()),
          title: String(x.title || ""),
          icon: String(x.icon || ""),
          description: String(x.description || ""),
        })),
      );
    } else if (tab === "needHelp") {
      const obj = d && typeof d === "object" ? d : {};
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" || typeof v === "number") flat[k] = String(v);
      }
      if (Object.keys(flat).length === 0) {
        flat.title = "";
        flat.email = "";
        flat.phone = "";
        flat.description = "";
      }
      setNeedHelpForm(flat);
    } else if (tab === "trackingFaq") {
      const items = Array.isArray(d?.items) ? d.items : [];
      setFaqs(
        items.map((x: any) => ({
          id: String(x.id || uid()),
          question: String(x.question || ""),
          answer: String(x.answer || ""),
        })),
      );
    } else if (tab === "offerLetterTemplate") {
      const tpl = d?.tpl ?? {};
      setOfferTpl({
        subject: String(tpl.subject || ""),
        content: String(tpl.content || tpl.body || ""),
        signature: String(tpl.signature || ""),
      });
      setPlaceholders(d?.ph && typeof d.ph === "object" ? d.ph : {});
    }
  }, [settingsQ.data, tab, isCrud]);

  const activeQ =
    tab === "jobTypes"
      ? jobTypesQ
      : tab === "candidateSources"
        ? sourcesQ
        : tab === "interviewTypes"
          ? interviewTypesQ
          : checklistsQ;

  const rows = (isCrud ? activeQ.data?.rows ?? [] : []) as (
    | JobTypeRow
    | CandidateSourceRow
    | InterviewTypeRow
    | OnboardingChecklistRow
  )[];
  const total = isCrud ? activeQ.data?.pagination?.totalData ?? 0 : 0;
  const isLoading = isCrud && activeQ.isLoading;

  const title = useMemo(() => {
    const map: Record<SetupTab, string> = {
      jobTypes: "Manage Job Types",
      candidateSources: "Manage Candidate Sources",
      interviewTypes: "Manage Interview Types",
      onboardingChecklists: "Manage Onboarding Checklists",
      brandSettings: "Brand Settings",
      aboutCompany: "About Company",
      applicationTips: "Application Tips",
      whatHappensNext: "What Happens Next",
      needHelp: "Need Help",
      trackingFaq: "Tracking FAQ",
      offerLetterTemplate: "Offer Letter Template",
    };
    return map[tab];
  }, [tab]);

  const invalidate = () => {
    if (tab === "jobTypes") qc.invalidateQueries({ queryKey: ["recruitment-job-types"] });
    if (tab === "candidateSources") qc.invalidateQueries({ queryKey: ["recruitment-candidate-sources"] });
    if (tab === "interviewTypes") qc.invalidateQueries({ queryKey: ["recruitment-interview-types"] });
    if (tab === "onboardingChecklists") qc.invalidateQueries({ queryKey: ["recruitment-onboarding-checklists"] });
    if (!isCrud) qc.invalidateQueries({ queryKey: ["recruitment-settings", tab] });
  };

  const submitCrud = async () => {
    if (!draft.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    try {
      if (tab === "jobTypes") {
        const body = { name: draft.name.trim(), description: draft.description.trim() || undefined, is_active: draft.isActive };
        if (modal === "edit") await updateJobType(draft.id, body);
        else await createJobType(body);
      } else if (tab === "candidateSources") {
        const body = { name: draft.name.trim(), description: draft.description.trim() || undefined, is_active: draft.isActive };
        if (modal === "edit") await updateCandidateSource(draft.id, body);
        else await createCandidateSource(body);
      } else if (tab === "interviewTypes") {
        const body = { name: draft.name.trim(), description: draft.description.trim() || undefined, is_active: draft.isActive };
        if (modal === "edit") await updateInterviewType(draft.id, body);
        else await createInterviewType(body);
      } else if (tab === "onboardingChecklists") {
        const body = {
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          is_default: draft.isDefault,
          status: draft.status,
        };
        if (modal === "edit") await updateOnboardingChecklist(draft.id, body);
        else await createOnboardingChecklist(body);
      }
      showToast(modal === "edit" ? "Updated" : "Created", "success");
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (tab === "jobTypes") await deleteJobType(deleteTarget.id);
      else if (tab === "candidateSources") await deleteCandidateSource(deleteTarget.id);
      else if (tab === "interviewTypes") await deleteInterviewType(deleteTarget.id);
      else if (tab === "onboardingChecklists") await deleteOnboardingChecklist(deleteTarget.id);
      showToast("Deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const saveSettings = async () => {
    try {
      if (tab === "brandSettings") await saveBrandSettings(brandForm);
      else if (tab === "aboutCompany") await saveAboutCompany(aboutForm);
      else if (tab === "applicationTips") await saveApplicationTips({ items: tips });
      else if (tab === "whatHappensNext") await saveWhatHappensNext({ items: steps });
      else if (tab === "needHelp") await saveNeedHelp(needHelpForm);
      else if (tab === "trackingFaq") await saveTrackingFaq({ items: faqs });
      else if (tab === "offerLetterTemplate") {
        await saveOfferLetterTemplate({
          subject: offerTpl.subject,
          content: offerTpl.content,
          body: offerTpl.content,
          signature: offerTpl.signature,
        });
      }
      showToast("Settings saved", "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Save failed", "error");
    }
  };

  const rowActive = (r: any) =>
    tab === "onboardingChecklists" ? Boolean(r.status) : Boolean(r.isActive);

  return (
    <div className="space-y-0">
      <div className="bg-white border-b border-gray-200 px-4 pt-3 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
        <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm rounded-t-md border-b-2 ${
                tab === t.id
                  ? "border-blue-600 text-blue-700 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
        </button>
          ))}
      </div>
      </div>

      {isCrud ? (
        <>
          <ListShell
            module="Recruitment"
            current="System Setup"
            title={title}
            onCreate={() => {
              setDraft(emptyNamed());
              setModal("create");
            }}
            search={searchInput}
            setSearch={setSearchInput}
            searchPlaceholder="Search…"
            perPage={perPage}
            setPerPage={setPerPage}
            page={page}
            setPage={setPage}
            total={total}
            filterOptions={[...ACTIVE_INACTIVE]}
            filterValue={statusFilter}
            setFilterValue={setStatusFilter}
            filterLabel="Status"
          >
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    <button
                      type="button"
                      onClick={() => {
                        setSortAsc(!sortAsc);
                        setPage(1);
                      }}
                      className="flex items-center gap-1 hover:text-gray-900"
                    >
                      Name <ArrowUpDown className="w-3 h-3" />
                    </button>
              </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Description</th>
                  {tab === "onboardingChecklists" && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Default</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3.5 text-gray-600 max-w-[280px] truncate">{r.description || "—"}</td>
                    {tab === "onboardingChecklists" && (
                      <td className="px-4 py-3.5 text-gray-600">
                        {(r as OnboardingChecklistRow).isDefault ? "Yes" : "No"}
                </td>
                    )}
                    <td className="px-4 py-3.5">
                      {chip(statusLabel(rowActive(r)), STATUS_CHIP[statusLabel(rowActive(r))] || STATUS_CHIP.Active)}
                </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                    <button
                          type="button"
                          onClick={() => {
                            setDraft({
                              id: r.id,
                              name: r.name,
                              description: r.description,
                              isActive: "isActive" in r ? Boolean(r.isActive) : true,
                              isDefault: "isDefault" in r ? Boolean((r as OnboardingChecklistRow).isDefault) : false,
                              status: "status" in r ? Boolean((r as OnboardingChecklistRow).status) : true,
                            });
                            setModal("edit");
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: r.id, name: r.name })}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      No records found.
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
          </ListShell>

          {modal && (
            <ModalShell
              title={modal === "edit" ? "Edit" : "Create"}
              onClose={() => setModal(null)}
              onSubmit={submitCrud}
              submitLabel={modal === "edit" ? "Update" : "Create"}
            >
              <div className="space-y-4">
                <Field label="Name" required>
            <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Description">
            <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
                    className={inputCls}
                  />
                </Field>
                {tab === "onboardingChecklists" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Default">
                      <select
                        value={draft.isDefault ? "true" : "false"}
                        onChange={(e) => setDraft({ ...draft, isDefault: e.target.value === "true" })}
                        className={selectCls}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        value={draft.status ? "true" : "false"}
                        onChange={(e) => setDraft({ ...draft, status: e.target.value === "true" })}
                        className={selectCls}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </Field>
        </div>
                ) : (
                  <Field label="Status">
                    <select
                      value={draft.isActive ? "true" : "false"}
                      onChange={(e) => setDraft({ ...draft, isActive: e.target.value === "true" })}
                      className={selectCls}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </Field>
                )}
            </div>
            </ModalShell>
          )}

          {deleteTarget && (
            <DeleteConfirm
              what="record"
              name={deleteTarget.name}
              onConfirm={() => void confirmDelete()}
              onCancel={() => setDeleteTarget(null)}
            />
          )}
        </>
      ) : (
        <div className="p-4 sm:p-6 max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                          <button
              type="button"
              onClick={() => void saveSettings()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Save className="w-4 h-4" /> Save
                          </button>
                        </div>

          {settingsQ.isLoading && <p className="text-sm text-gray-500">Loading…</p>}

          {tab === "brandSettings" && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
              {Object.keys(brandForm).map((k) => (
                <Field key={k} label={k.replace(/_/g, " ")}>
              <input
                    value={brandForm[k]}
                    onChange={(e) => setBrandForm({ ...brandForm, [k]: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
          )}

          {tab === "aboutCompany" && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
              {Object.keys(aboutForm).map((k) => (
                <Field key={k} label={k.replace(/_/g, " ")}>
                  {k === "content" || k === "description" ? (
                    <textarea
                      value={aboutForm[k]}
                      onChange={(e) => setAboutForm({ ...aboutForm, [k]: e.target.value })}
                      rows={6}
                      className={inputCls}
                    />
                  ) : (
                  <input
                      value={aboutForm[k]}
                      onChange={(e) => setAboutForm({ ...aboutForm, [k]: e.target.value })}
                      className={inputCls}
                    />
                  )}
                </Field>
              ))}
                </div>
          )}

          {tab === "applicationTips" && (
            <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-4">
              {tips.map((tip, idx) => (
                <div key={tip.id} className="flex gap-2">
                  <input
                    value={tip.text}
                    onChange={(e) => {
                      const next = [...tips];
                      next[idx] = { ...tip, text: e.target.value };
                      setTips(next);
                    }}
                    className={inputCls}
                    placeholder="Tip text"
                  />
            <button
                    type="button"
                    onClick={() => setTips(tips.filter((t) => t.id !== tip.id))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
            </button>
              </div>
            ))}
            <button
                type="button"
                onClick={() => setTips([...tips, { id: uid(), text: "" }])}
                className="inline-flex items-center gap-1 text-sm text-blue-600"
              >
                <Plus className="w-4 h-4" /> Add tip
            </button>
          </div>
          )}

          {tab === "whatHappensNext" && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
              {steps.map((s, idx) => (
                <div key={s.id} className="border border-gray-100 rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                      value={s.title}
                      onChange={(e) => {
                        const next = [...steps];
                        next[idx] = { ...s, title: e.target.value };
                        setSteps(next);
                      }}
                      className={inputCls}
                      placeholder="Title"
                    />
                  <input
                      value={s.icon}
                      onChange={(e) => {
                        const next = [...steps];
                        next[idx] = { ...s, icon: e.target.value };
                        setSteps(next);
                      }}
                      className={inputCls}
                      placeholder="Icon name"
                  />
                </div>
                  <textarea
                    value={s.description}
                    onChange={(e) => {
                      const next = [...steps];
                      next[idx] = { ...s, description: e.target.value };
                      setSteps(next);
                    }}
                    rows={2}
                    className={inputCls}
                    placeholder="Description"
                  />
            <button
                    type="button"
                    onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}
                    className="text-xs text-red-500"
                  >
                    Remove
            </button>
                </div>
              ))}
            <button
                type="button"
                onClick={() => setSteps([...steps, { id: uid(), title: "", icon: "", description: "" }])}
                className="inline-flex items-center gap-1 text-sm text-blue-600"
              >
                <Plus className="w-4 h-4" /> Add step
            </button>
          </div>
          )}

          {tab === "needHelp" && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
              {Object.keys(needHelpForm).map((k) => (
                <Field key={k} label={k.replace(/_/g, " ")}>
              <input
                    value={needHelpForm[k]}
                    onChange={(e) => setNeedHelpForm({ ...needHelpForm, [k]: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
          )}

          {tab === "trackingFaq" && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
              {faqs.map((f, idx) => (
                <div key={f.id} className="border border-gray-100 rounded-md p-3 space-y-2">
              <input
                    value={f.question}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...f, question: e.target.value };
                      setFaqs(next);
                    }}
                    className={inputCls}
                    placeholder="Question"
                  />
                  <textarea
                    value={f.answer}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[idx] = { ...f, answer: e.target.value };
                      setFaqs(next);
                    }}
                    rows={3}
                    className={inputCls}
                    placeholder="Answer"
                  />
                  <button
                    type="button"
                    onClick={() => setFaqs(faqs.filter((x) => x.id !== f.id))}
                    className="text-xs text-red-500"
                  >
                    Remove
                  </button>
              </div>
            ))}
            <button
                type="button"
                onClick={() => setFaqs([...faqs, { id: uid(), question: "", answer: "" }])}
                className="inline-flex items-center gap-1 text-sm text-blue-600"
            >
              <Plus className="w-4 h-4" /> Add FAQ
            </button>
          </div>
          )}

          {tab === "offerLetterTemplate" && (
            <div className="space-y-4 bg-white border border-gray-200 rounded-lg p-4">
              <Field label="Subject">
                <input
                  value={offerTpl.subject}
                  onChange={(e) => setOfferTpl({ ...offerTpl, subject: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Content">
              <textarea
                  value={offerTpl.content}
                  onChange={(e) => setOfferTpl({ ...offerTpl, content: e.target.value })}
                  rows={12}
                  className={inputCls}
                />
              </Field>
              <Field label="Signature">
                <textarea
                  value={offerTpl.signature}
                  onChange={(e) => setOfferTpl({ ...offerTpl, signature: e.target.value })}
                  rows={3}
                  className={inputCls}
                />
              </Field>
              {Object.keys(placeholders).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Placeholders</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(placeholders).map(([k, v]) => (
                      <span key={k} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded" title={v}>
                        {k}
                      </span>
                    ))}
          </div>
        </div>
              )}
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecruitmentSystemSetup;
