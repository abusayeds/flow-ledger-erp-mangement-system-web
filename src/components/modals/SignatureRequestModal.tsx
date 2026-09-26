/**
 * Signature Request email composer.
 * Gear opens EmailTemplatesModal; doc chip opens PDF preview;
 * Send uses /document-email prepare+send for the given document type.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings,
  X,
  FileText,
  Paperclip,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { EmailTemplatesModal } from "@/components/modals/EmailTemplatesModal";
import type { EmailNavKey } from "@/services/emailTemplatesApi";
import {
  prepareDocumentEmail,
  sendDocumentEmail,
  type DocumentEmailType,
} from "@/services/documentEmailApi";
import { PdfPreviewModal } from "@/lib/db/PdfPreviewModal";
import type { PdfDocType } from "@/lib/db/pdfSettings";
import { showToast } from "@/utils/toast";

const EMAIL_TO_PDF: Partial<Record<DocumentEmailType, PdfDocType>> = {
  invoice: "invoice",
  proforma_invoice: "proformaInvoice",
  estimate: "estimate",
  sales_receipt: "salesReceipt",
  delivery_challan: "deliveryChallan",
  credit_note: "creditNote",
  purchase_order: "purchaseOrder",
  bill: "bill",
  debit_note: "debitNote",
  payment_received: "paymentReceived",
  expense: "bill",
};

export const SignatureRequestModal: React.FC<{
  docLabel: string;
  number: string;
  customer: any;
  onClose: () => void;
  /** Optional legacy toast-only callback; prefer documentId + emailType. */
  onSend?: () => void;
  /** Backend document Mongo `_id` — required for real email send. */
  documentId?: string;
  emailType?: DocumentEmailType;
  emailNav?: EmailNavKey;
  /** Fields merged into the document after a successful send. */
  documentUpdate?: Record<string, unknown>;
  /** Local Dexie numeric id (optional — helps PDF when backend id alone is enough). */
  recordId?: number;
  /** Override PDF preview type; defaults from emailType. */
  pdfDocType?: PdfDocType;
}> = ({
  docLabel,
  number,
  customer,
  onClose,
  onSend,
  documentId,
  emailType = "invoice",
  emailNav,
  documentUpdate = { updatedAt: new Date().toISOString() },
  recordId,
  pdfDocType,
}) => {
  const resolvedPdfType = pdfDocType || EMAIL_TO_PDF[emailType] || "invoice";
  const resolvedNav: EmailNavKey = emailNav || (emailType as EmailNavKey) || "invoice";
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [toRecipients, setToRecipients] = useState<string[]>(() =>
    customer?.email ? [String(customer.email)] : [],
  );
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(
    `Signature Request for ${docLabel} #: ${String(number).replace(/^#/, "")} from info`,
  );
  const [fromEmail, setFromEmail] = useState("info@inovoic.com");
  const [poweredBy, setPoweredBy] = useState(true);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(!!documentId);
  const bodyRef = useRef<HTMLDivElement>(null);
  const n = String(number).replace(/^#/, "");

  const partyName = useMemo(
    () =>
      customer?.contact ||
      customer?.name ||
      customer?.company_name ||
      (typeof customer === "object" && customer?.businessProfile?.companyName) ||
      "Customer",
    [customer],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !templatesOpen && !pdfOpen && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, templatesOpen, pdfOpen]);

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      if (bodyRef.current) {
        bodyRef.current.innerHTML =
          `<p>Dear ${partyName},</p>` +
          `<p>Signature Request for ${docLabel} #: ${n}</p>` +
          `<p>Please review and sign the attached document.</p>`;
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    prepareDocumentEmail(emailType, documentId)
      .then((prep) => {
        if (cancelled) return;
        const emails = (prep.email?.to ?? []).map(String).filter(Boolean);
        if (emails.length) setToRecipients(emails);
        else if (customer?.email) setToRecipients([String(customer.email)]);
        setCc((prep.email?.cc ?? []).join(", "));
        setBcc((prep.email?.bcc ?? []).join(", "));
        if (prep.email?.from) setFromEmail(String(prep.email.from));
        setSubject(
          prep.email?.subject?.trim()
            ? `Signature Request — ${prep.email.subject}`
            : `Signature Request for ${docLabel} #: ${n}`,
        );
        if (bodyRef.current) {
          const party = prep.document?.party_name || partyName;
          const base =
            prep.email?.body ||
            `<p>Dear ${party},</p><p>Please find the attached ${docLabel} #${n} and provide your signature.</p>`;
          bodyRef.current.innerHTML = base;
        }
      })
      .catch(() => {
        if (!cancelled && bodyRef.current) {
          bodyRef.current.innerHTML =
            `<p>Dear ${partyName},</p>` +
            `<p>Signature Request for ${docLabel} #: ${n}</p>` +
            `<p>Please review and sign the attached document.</p>`;
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, emailType, docLabel, n, customer?.email, partyName]);

  const removeTo = (email: string) => setToRecipients((list) => list.filter((e) => e !== email));

  const exec = (cmd: string) => {
    document.execCommand(cmd, false);
    bodyRef.current?.focus();
  };

  const openDocPdf = () => {
    if (!documentId && !(typeof recordId === "number" && recordId > 0)) {
      showToast("Save the document first to preview PDF", "warning");
      return;
    }
    setPdfOpen(true);
  };

  const handleSend = async () => {
    if (sending) return;
    if (!toRecipients.length) {
      showToast("Add at least one recipient", "warning");
      return;
    }
    if (!documentId) {
      showToast("Save the document first to send a signature request", "warning");
      return;
    }
    setSending(true);
    try {
      const body = bodyRef.current?.innerHTML || "";
      await sendDocumentEmail({
        type: emailType,
        id: documentId,
        attach_pdf: true,
        document_update: documentUpdate,
        email: {
          to: toRecipients,
          cc: cc || undefined,
          bcc: bcc || undefined,
          from: fromEmail,
          subject,
          body: poweredBy
            ? `${body}<p style="color:#888;font-size:12px">Powered by Qayd</p>`
            : body,
        },
      });
      onSend?.();
      showToast("Signature request sent", "success");
      onClose();
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || "Could not send email", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
        onMouseDown={onClose}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full max-w-2xl my-10 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              Signature Request for {docLabel} #: {n} from info
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                title="Email templates"
                onClick={() => setTemplatesOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending || loading}
                onClick={() => void handleSend()}
                className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>

          <div className="px-5 py-3 space-y-2 text-sm">
            <div className="flex items-start justify-between border-b border-gray-200 pb-2 gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="text-gray-500 pt-0.5">To:</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {toRecipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-300 rounded-full pl-3 pr-1.5 py-0.5 text-gray-800"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeTo(email)}
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    placeholder="Add email"
                    className="min-w-[120px] flex-1 bg-transparent outline-none text-gray-800"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (!v) return;
                      if (toRecipients.some((x) => x.toLowerCase() === v.toLowerCase())) {
                        showToast("This email is already in the recipient list.", "warning");
                        return;
                      }
                      setToRecipients((list) => [...list, v]);
                      (e.target as HTMLInputElement).value = "";
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCcBcc((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
              >
                Cc &amp; Bcc
              </button>
            </div>

            {showCcBcc && (
              <div className="space-y-2 border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-10">Cc:</span>
                  <input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    className="flex-1 outline-none bg-transparent text-gray-800"
                    placeholder="cc@example.com"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-10">Bcc:</span>
                  <input
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    className="flex-1 outline-none bg-transparent text-gray-800"
                    placeholder="bcc@example.com"
                  />
                </div>
              </div>
            )}

            <div className="border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-gray-500">Subject:</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 outline-none bg-transparent text-gray-800"
              />
            </div>
            <div className="border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="text-gray-500">From:</span>
              <input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="flex-1 outline-none bg-transparent text-gray-800"
              />
            </div>
            <div className="flex items-center gap-1 border-b border-gray-200 pb-2 text-gray-500">
              {[Bold, Italic, Underline].map((Ic, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => exec(i === 0 ? "bold" : i === 1 ? "italic" : "underline")}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100"
                >
                  <Ic className="w-4 h-4" />
                </button>
              ))}
            </div>
            <div
              ref={bodyRef}
              contentEditable={!loading}
              suppressContentEditableWarning
              className="py-3 min-h-[140px] outline-none text-gray-800"
            />
            {loading && <div className="text-xs text-gray-400">Loading template…</div>}
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
            <button
              type="button"
              onClick={openDocPdf}
              title={`Open ${docLabel} #${n} PDF`}
              className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" /> {docLabel} #{n}
            </button>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              title="PDF attached on send"
              onClick={openDocPdf}
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 px-5 pb-4 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={poweredBy}
              onChange={(e) => setPoweredBy(e.target.checked)}
              className="accent-blue-600"
            />{" "}
            Powered by Qayd
          </label>
        </div>
      </div>

      {templatesOpen && (
        <EmailTemplatesModal initialNav={resolvedNav} onClose={() => setTemplatesOpen(false)} />
      )}

      {pdfOpen && (
        <PdfPreviewModal
          docType={resolvedPdfType}
          recordId={typeof recordId === "number" && recordId > 0 ? recordId : 0}
          backendId={documentId || undefined}
          title={`${docLabel} #${n}`}
          onClose={() => setPdfOpen(false)}
        />
      )}
    </>
  );
};

export default SignatureRequestModal;
