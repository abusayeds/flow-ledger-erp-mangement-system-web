/**
 * Balance Sheet — list + detail from /double-entry/balance-sheets/*
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { money } from "@/lib/db";
import {
  fetchBalanceSheetList,
  fetchBalanceSheet,
  fetchLatestBalanceSheet,
  createBalanceSheet,
  finalizeBalanceSheet,
  addBalanceSheetNote,
  compareBalanceSheets,
  type BalanceSheetView,
  type BsLine,
  type BsSectionBlock,
} from "@/services/doubleEntry";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import { SummaryCard, ReportTitle, downloadTablePdf, deFieldCls } from "./deShared";
import { chip, ModalShell } from "../goal/goalShared";
import { showToast } from "../../utils/toast";
import { Plus, StickyNote, GitCompareArrows, Download, CheckCircle2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

function LineRow({ line, indent }: { line: BsLine; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${indent ? "pl-4" : ""}`}>
      <p className="text-sm text-blue-600">{line.name}</p>
      <div className="flex items-center gap-6">
        {line.code && <span className="text-sm text-gray-500 w-12 text-right">{line.code}</span>}
        <span className="text-sm text-blue-600 w-28 text-right">{money(line.amount)}</span>
      </div>
    </div>
  );
}

function TotalRow({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 border-t ${strong ? "border-gray-300" : "border-gray-200"}`}>
      <p className={`text-sm font-semibold text-gray-900 ${strong ? "text-base" : ""}`}>{label}</p>
      <p className={`text-sm font-semibold text-gray-900 ${strong ? "text-base" : ""}`}>{money(amount)}</p>
    </div>
  );
}

function SideBlocks({ blocks }: { blocks: BsSectionBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <div key={block.key} className="mb-6">
          {block.sub_sections.map((sub) => (
            <div key={sub.key}>
              <p className="text-sm font-semibold text-gray-900 mt-4 mb-1">{sub.label}</p>
              {sub.lines.map((l) => (
                <LineRow key={l.id || l.code} line={l} indent />
              ))}
              <TotalRow label={`Total ${sub.label}`} amount={sub.subtotal} />
            </div>
          ))}
          <TotalRow label={`Total for ${block.label}`} amount={block.total} strong />
        </div>
      ))}
    </>
  );
}

export const BalanceSheet: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [modal, setModal] = useState<"generate" | "note" | "compare" | null>(null);
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [compareId, setCompareId] = useState("");

  const { data: listData } = useQuery({
    queryKey: ["balance-sheets-list"],
    queryFn: () => fetchBalanceSheetList({ page: 1, limit: 100 }),
  });

  const sheets = listData?.rows ?? [];

  useEffect(() => {
    if (!selectedId && sheets[0]?.id) setSelectedId(sheets[0].id);
  }, [sheets, selectedId]);

  const { data: latest } = useQuery({
    queryKey: ["balance-sheet-latest"],
    queryFn: fetchLatestBalanceSheet,
    enabled: sheets.length === 0,
  });

  useEffect(() => {
    if (!selectedId && latest?.id) setSelectedId(latest.id);
  }, [latest, selectedId]);

  const activeId = selectedId || latest?.id || "";

  const { data: sheet, isLoading } = useQuery({
    queryKey: ["balance-sheet", activeId],
    queryFn: () => fetchBalanceSheet(activeId),
    enabled: !!activeId,
  });

  const view: BalanceSheetView | null = sheet ?? (latest && !activeId ? latest : null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["balance-sheets-list"] });
    qc.invalidateQueries({ queryKey: ["balance-sheet"] });
    qc.invalidateQueries({ queryKey: ["balance-sheet-latest"] });
  };

  const selectorOptions = useMemo(() => {
    if (view?.allSheets?.length) return view.allSheets;
    return sheets;
  }, [view, sheets]);

  const generate = async () => {
    if (!genDate || !genYear.trim()) {
      showToast("Balance sheet date and financial year are required", "error");
      return;
    }
    try {
      const created = await createBalanceSheet({
        balance_sheet_date: genDate,
        financial_year: genYear.trim(),
      });
      setSelectedId(created.id);
      setModal(null);
      await invalidate();
      showToast("Balance sheet generated successfully", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to generate", "error");
    }
  };

  const finalize = async () => {
    if (!view) return;
    try {
      await finalizeBalanceSheet(view.id);
      await invalidate();
      showToast("Balance sheet finalized", "success");
    } catch (e: any) {
      showToast(e?.message || "Finalize failed", "error");
    }
  };

  const saveNote = async () => {
    if (!view || !noteTitle.trim() || !noteText.trim()) {
      showToast("Note title and content required", "error");
      return;
    }
    try {
      await addBalanceSheetNote(view.id, { note_title: noteTitle.trim(), note_content: noteText.trim() });
      setModal(null);
      await invalidate();
      showToast("Note added", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to add note", "error");
    }
  };

  const runCompare = async () => {
    if (!view || !compareId) {
      showToast("Select a sheet to compare", "error");
      return;
    }
    try {
      await compareBalanceSheets(view.id, compareId);
      setModal(null);
      showToast("Comparison saved", "success");
    } catch (e: any) {
      showToast(e?.message || "Compare failed", "error");
    }
  };

  const downloadPdf = () => {
    if (!view) return;
    const rows: (string | number)[][] = [];
    for (const block of view.assets.sections) {
      for (const sub of block.sub_sections) {
        for (const l of sub.lines) rows.push([`Assets / ${sub.label}`, `${l.code} ${l.name}`, money(l.amount)]);
        rows.push([`Total ${sub.label}`, "", money(sub.subtotal)]);
      }
    }
    for (const block of view.liabilitiesAndEquity.sections) {
      for (const sub of block.sub_sections) {
        for (const l of sub.lines) rows.push([`${block.label} / ${sub.label}`, `${l.code} ${l.name}`, money(l.amount)]);
        rows.push([`Total ${sub.label}`, "", money(sub.subtotal)]);
      }
    }
    rows.push(["Total Assets", "", money(view.summary.assets)]);
    rows.push(["Total Liabilities", "", money(view.summary.liabilities)]);
    rows.push(["Total Equity", "", money(view.summary.equity)]);
    void downloadTablePdf(
      `balance-sheet-${view.date}.pdf`,
      `Balance Sheet - ${view.date}`,
      view.asOfLabel || `As of ${view.date} | Financial Year: ${view.year}`,
      ["Section", "Account", "Amount"],
      rows,
    );
  };

  if (!view && isLoading) {
    return <div className="module-page-shell flex items-center justify-center text-gray-500">Loading balance sheet…</div>;
  }

  if (!view) {
    return (
      <div className="module-page-shell overflow-y-auto">
        <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "Double Entry" }]} current="Balance Sheets" onNavigate={navigate} />
        <div className="module-title-bar px-4 sm:px-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Balance Sheets</h2>
          <button
            onClick={() => setModal("generate")}
            title="Generate balance sheet"
            className="w-9 h-9 flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="p-10 text-center text-gray-500">No balance sheets yet. Click + to generate one.</div>
        {modal === "generate" && (
          <ModalShell title="Generate Balance Sheet" onClose={() => setModal(null)} onSubmit={generate} submitLabel="Generate">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance Sheet Date *</label>
                <AppDatePicker value={genDate} onChange={(e) => setGenDate(e.target.value)} className={`${deFieldCls} w-full`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year *</label>
                <input value={genYear} onChange={(e) => setGenYear(e.target.value)} className={`${deFieldCls} w-full`} placeholder="2026" />
              </div>
            </div>
          </ModalShell>
        )}
      </div>
    );
  }

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb
        trail={[{ label: "Dashboard", to: "/" }, { label: "Double Entry" }, { label: "Balance Sheets" }]}
        current={`Balance Sheet - ${view.date}`}
        onNavigate={navigate}
      />
      <div className="module-title-bar px-4 sm:px-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Balance Sheet - {view.date}</h2>
        <button
          onClick={() => setModal("generate")}
          title="Generate balance sheet"
          className="w-9 h-9 flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-sm"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <ReportTitle title="Balance Sheet" subtitle={view.asOfLabel || `As of ${view.date} | Financial Year: ${view.year}`} />
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={view.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className={`${deFieldCls} min-w-[9rem]`}
              >
                {selectorOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} ({s.status})
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setNoteTitle("");
                  setNoteText("");
                  setModal("note");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50"
              >
                <StickyNote className="w-4 h-4" /> Add Note
              </button>
              <button
                onClick={() => {
                  setCompareId("");
                  setModal("compare");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50"
              >
                <GitCompareArrows className="w-4 h-4" /> Compare
              </button>
              <button onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50">
                <Download className="w-4 h-4" /> Download PDF
              </button>
              {view.status === "Draft" && (
                <button onClick={() => void finalize()} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                  <CheckCircle2 className="w-4 h-4" /> Finalize
                </button>
              )}
              {view.balanced && chip("Balanced", "bg-green-100 text-green-700")}
              {chip(view.status, view.status === "Draft" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700")}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Assets" value={money(view.summary.assets)} tone="green" />
            <SummaryCard label="Total Liabilities" value={money(view.summary.liabilities)} tone="red" />
            <SummaryCard label="Total Equity" value={money(view.summary.equity)} tone="blue" />
          </div>

          {view.notes.length > 0 && (
            <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-4 py-3 space-y-1">
              {view.notes.map((n) => (
                <p key={n.id} className="text-sm text-gray-700">
                  • <span className="font-medium">{n.title}:</span> {n.content}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Balance Sheet of {view.date}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">{view.liabilitiesAndEquity.title || "Liabilities & Equity"}</h4>
              <SideBlocks blocks={view.liabilitiesAndEquity.sections} />
              <TotalRow label="Total Liabilities & Equity" amount={view.summary.liabilitiesAndEquity} strong />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">{view.assets.title || "Assets"}</h4>
              <SideBlocks blocks={view.assets.sections} />
              <TotalRow label="Total Assets" amount={view.summary.assets} strong />
            </div>
          </div>
        </div>
      </div>

      {modal === "generate" && (
        <ModalShell title="Generate Balance Sheet" onClose={() => setModal(null)} onSubmit={generate} submitLabel="Generate">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Balance Sheet Date *</label>
              <AppDatePicker value={genDate} onChange={(e) => setGenDate(e.target.value)} className={`${deFieldCls} w-full`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year *</label>
              <input value={genYear} onChange={(e) => setGenYear(e.target.value)} className={`${deFieldCls} w-full`} />
            </div>
          </div>
        </ModalShell>
      )}

      {modal === "note" && (
        <ModalShell title="Add Note" onClose={() => setModal(null)} onSubmit={saveNote} submitLabel="Save Note">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className={`${deFieldCls} w-full`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} className={`${deFieldCls} w-full`} />
            </div>
          </div>
        </ModalShell>
      )}

      {modal === "compare" && (
        <ModalShell title="Compare Balance Sheets" onClose={() => setModal(null)} onSubmit={runCompare} submitLabel="Compare">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Previous period</label>
            <select value={compareId} onChange={(e) => setCompareId(e.target.value)} className={`${deFieldCls} w-full`}>
              <option value="">Select sheet</option>
              {selectorOptions
                .filter((s) => s.id !== view.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} — {s.year}
                  </option>
                ))}
            </select>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export default BalanceSheet;
