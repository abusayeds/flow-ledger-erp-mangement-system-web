/**
 * Support Tickets — /api/v1/support/tickets
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchTickets,
  fetchTicket,
  fetchTicketRequestData,
  createTicket,
  deleteTicket,
  changeTicketStatus,
  storeTicketNote,
  addTicketReply,
  searchTicketCategories,
  TICKET_STATUSES,
  TICKET_ACCOUNT_TYPES,
  type TicketRow,
} from "@/services/supportApi";
import { Field, inputCls, selectCls, AsyncSearchSelect, IdSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Eye, Trash2 } from "lucide-react";

const STATUS_CHIP: Record<string, string> = {
  "In Progress": "bg-blue-100 text-blue-700",
  "On Hold": "bg-amber-100 text-amber-700",
  Closed: "bg-gray-100 text-gray-600",
};

const emptyCreate = () => ({
  accountType: "custom" as (typeof TICKET_ACCOUNT_TYPES)[number],
  ticketUserId: "",
  name: "",
  email: "",
  categoryId: "",
  categoryName: "",
  subject: "",
  description: "",
});

type RequestUser = { id: string; name: string; email?: string };

const Tickets: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [categoryFilterName, setCategoryFilterName] = useState("");
  const [accountFilter, setAccountFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreate());
  const [requestUsers, setRequestUsers] = useState<RequestUser[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<TicketRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("In Progress");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets", page, perPage, search, statusFilter, categoryFilterId, accountFilter, sortAsc],
    queryFn: () =>
      fetchTickets({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        category: categoryFilterId || undefined,
        account_type: accountFilter !== "All" ? accountFilter : undefined,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["support-tickets"] });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["support-ticket", detailId],
    queryFn: () => fetchTicket(detailId!),
    enabled: !!detailId,
  });

  useEffect(() => {
    if (!detail) return;
    setNoteDraft(String(detail.note ?? ""));
    setStatusDraft(String(detail.status ?? "In Progress"));
  }, [detail]);

  const userOptions = useMemo(
    () => requestUsers.map((u) => ({ id: u.id, name: u.email ? `${u.name} (${u.email})` : u.name })),
    [requestUsers],
  );

  const openCreate = () => {
    setCreateDraft(emptyCreate());
    setRequestUsers([]);
    setCreateOpen(true);
  };

  const mapRequestUsers = (list: unknown) => {
    const arr = Array.isArray(list) ? list : [];
    setRequestUsers(
      arr.map((u: any) => ({
        id: String(u._id ?? u.id),
        name: String(u.name ?? ""),
        email: u.email ? String(u.email) : "",
      })),
    );
  };

  const onAccountTypeChange = async (accountType: (typeof TICKET_ACCOUNT_TYPES)[number]) => {
    setCreateDraft((d) => ({
      ...d,
      accountType,
      ticketUserId: "",
      name: "",
      email: "",
    }));
    try {
      const rd = await fetchTicketRequestData();
      if (accountType === "staff") mapRequestUsers(rd?.staff);
      else if (accountType === "client") mapRequestUsers(rd?.client);
      else if (accountType === "vendor") mapRequestUsers(rd?.vendor);
      else setRequestUsers([]);
    } catch {
      setRequestUsers([]);
    }
  };

  const submitCreate = async () => {
    const d = createDraft;
    if (!d.subject.trim() || !d.description.trim() || !d.categoryId) {
      showToast("Subject, description, and category are required", "error");
      return;
    }
    if (d.accountType === "custom" && (!d.name.trim() || !d.email.trim())) {
      showToast("Name and email are required for custom account", "error");
      return;
    }
    if (d.accountType !== "custom" && !d.ticketUserId) {
      showToast("Please select a user", "error");
      return;
    }
    const body: Record<string, unknown> = {
      account_type: d.accountType,
      category: d.categoryId,
      subject: d.subject.trim(),
      description: d.description.trim(),
    };
    if (d.accountType === "custom") {
      body.name = d.name.trim();
      body.email = d.email.trim();
    } else {
      body.ticket_user_id = d.ticketUserId;
    }
    try {
      await createTicket(body);
      showToast("Ticket created", "success");
      setCreateOpen(false);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed to create ticket", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTicket(deleteTarget.id);
      showToast("Ticket deleted", "success");
      setDeleteTarget(null);
      if (detailId === deleteTarget.id) setDetailId(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const saveStatus = async () => {
    if (!detailId) return;
    try {
      await changeTicketStatus(detailId, statusDraft);
      showToast("Status updated", "success");
      await qc.invalidateQueries({ queryKey: ["support-ticket", detailId] });
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Status update failed", "error");
    }
  };

  const saveNote = async () => {
    if (!detailId) return;
    try {
      await storeTicketNote(detailId, noteDraft);
      showToast("Note saved", "success");
      await qc.invalidateQueries({ queryKey: ["support-ticket", detailId] });
    } catch (e: any) {
      showToast(e?.message || "Failed to save note", "error");
    }
  };

  const sendReply = async () => {
    if (!detailId || !replyDraft.trim()) return;
    try {
      await addTicketReply(detailId, { description: replyDraft.trim() });
      showToast("Reply sent", "success");
      setReplyDraft("");
      await qc.invalidateQueries({ queryKey: ["support-ticket", detailId] });
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Reply failed", "error");
    }
  };

  const conversations = Array.isArray(detail?.conversations) ? detail.conversations : [];

  return (
    <>
      <ListShell
        module="Support Ticket"
        current="Tickets"
        title="Manage Tickets"
        onCreate={() => void openCreate()}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search tickets…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...TICKET_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <div className="px-4 sm:px-6 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <div className="w-56">
            <AsyncSearchSelect
              value={categoryFilterId}
              displayName={categoryFilterName}
              onChange={(id, opt) => {
                setCategoryFilterId(id);
                setCategoryFilterName(opt?.name || "");
                  setPage(1);
                }}
              onSearch={searchTicketCategories}
              placeholder="Filter by category…"
              />
            </div>
          {categoryFilterId && (
              <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                setCategoryFilterId("");
                setCategoryFilterName("");
                setPage(1);
              }}
            >
              Clear category
              </button>
          )}
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
            className={`${selectCls} px-3 py-1.5 text-sm`}
          >
            <option value="All">All account types</option>
            {TICKET_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
              </select>
            </div>

        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Ticket ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Created <ArrowUpDown className="w-3 h-3" />
                </button>
                </th>
              {["Account", "Customer", "Subject", "Category", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
              </tr>
            </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-mono text-gray-800">{r.ticketId || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.createdAt || "—"}</td>
                <td className="px-4 py-3.5 capitalize text-gray-600">{r.accountType}</td>
                  <td className="px-4 py-3.5">
                  <div className="font-medium text-gray-900">{r.name || "—"}</div>
                  <div className="text-xs text-gray-500">{r.email || ""}</div>
                  </td>
                <td className="px-4 py-3.5 text-gray-900 max-w-[220px] truncate">{r.subject}</td>
                  <td className="px-4 py-3.5">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: r.categoryColor }}>
                    {r.categoryName}
                  </span>
                  </td>
                <td className="px-4 py-3.5">{chip(r.status, STATUS_CHIP[r.status] || "bg-gray-100 text-gray-600")}</td>
                  <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setDetailId(r.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50">
                        <Eye className="w-4 h-4" />
                      </button>
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No tickets found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
            </tbody>
          </table>
      </ListShell>

      {createOpen && (
        <ModalShell title="Create Ticket" onClose={() => setCreateOpen(false)} onSubmit={() => void submitCreate()} submitLabel="Create" wide>
          <div className="space-y-4">
            <Field label="Account type" required>
              <select
                value={createDraft.accountType}
                onChange={(e) => void onAccountTypeChange(e.target.value as (typeof TICKET_ACCOUNT_TYPES)[number])}
                className={selectCls}
              >
                {TICKET_ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </Field>
            {createDraft.accountType === "custom" ? (
              <>
                <Field label="Name" required>
                  <input value={createDraft.name} onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Email" required>
                  <input type="email" value={createDraft.email} onChange={(e) => setCreateDraft({ ...createDraft, email: e.target.value })} className={inputCls} />
                </Field>
              </>
            ) : (
              <Field label="User" required>
                <IdSearchSelect
                  value={createDraft.ticketUserId}
                  options={userOptions}
                  onChange={(id) => {
                    const u = requestUsers.find((x) => x.id === id);
                    setCreateDraft({
                      ...createDraft,
                      ticketUserId: id,
                      name: u?.name || "",
                      email: u?.email || "",
                    });
                  }}
                  placeholder="Search user…"
                />
              </Field>
            )}
            <Field label="Category" required>
              <AsyncSearchSelect
                value={createDraft.categoryId}
                displayName={createDraft.categoryName}
                onChange={(id, opt) => setCreateDraft({ ...createDraft, categoryId: id, categoryName: opt?.name || "" })}
                onSearch={searchTicketCategories}
                placeholder="Search categories…"
              />
            </Field>
            <Field label="Subject" required>
              <input value={createDraft.subject} onChange={(e) => setCreateDraft({ ...createDraft, subject: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Description" required>
              <textarea value={createDraft.description} onChange={(e) => setCreateDraft({ ...createDraft, description: e.target.value })} rows={5} className={inputCls} />
            </Field>
              </div>
        </ModalShell>
      )}

      {detailId && (
        <ModalShell
          title={detail?.subject ? `Ticket: ${detail.subject}` : "Ticket details"}
          onClose={() => setDetailId(null)}
          onSubmit={() => setDetailId(null)}
          submitLabel="Close"
          wide
        >
          {detailLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {!detailLoading && detail && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Ticket ID:</span> {detail.ticket_id}</div>
                <div><span className="text-gray-500">Customer:</span> {detail.name} ({detail.email})</div>
                <div className="col-span-2"><span className="text-gray-500">Description:</span><p className="mt-1 whitespace-pre-wrap text-gray-800">{detail.description}</p></div>
          </div>

              <Field label="Status">
                <div className="flex gap-2">
                  <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className={`${selectCls} flex-1`}>
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void saveStatus()} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Update</button>
          </div>
              </Field>

              <Field label="Internal note">
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} className={inputCls} />
                <button type="button" onClick={() => void saveNote()} className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save note</button>
              </Field>

                  <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Conversation</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                  {conversations.length === 0 && <p className="text-xs text-gray-500">No replies yet.</p>}
                  {conversations.map((c: any, i: number) => (
                    <div key={c._id || i} className="bg-white border border-gray-200 rounded-md p-3 text-sm">
                      <div className="text-xs text-gray-500 mb-1">{c.sender || "admin"} · {c.createdAt ? String(c.createdAt).slice(0, 16) : ""}</div>
                      <p className="text-gray-800 whitespace-pre-wrap">{c.description}</p>
                    </div>
                  ))}
                  </div>
                <textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} rows={3} className={`${inputCls} mt-3`} placeholder="Write a reply…" />
                <button type="button" onClick={() => void sendReply()} className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Send reply</button>
                    </div>
                </div>
              )}
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="ticket" name={deleteTarget.subject} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};

export default Tickets;
