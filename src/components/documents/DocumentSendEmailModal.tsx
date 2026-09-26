/**
 * Send-document email modal — matches the Create Invoice email screenshot.
 * Gear opens EmailTemplatesModal (same as SettingsDropdown).
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Settings,
  X,
  Pencil,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image,
  Link2,
  Paperclip,
  FileText,
} from "lucide-react";
import { EmailTemplatesModal } from "@/components/modals/EmailTemplatesModal";
import type { EmailNavKey } from "@/services/emailTemplatesApi";

export const DocumentSendEmailModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  toEmail: string;
  subject: string;
  fromEmail: string;
  bodyHtml?: string;
  bodyText?: string;
  attachmentLabel?: string;
  onSend?: () => void;
  emailNav?: EmailNavKey;
}> = ({
  open,
  onClose,
  title,
  toEmail: initialTo,
  subject: initialSubject,
  fromEmail: initialFrom,
  bodyHtml,
  bodyText,
  attachmentLabel,
  onSend,
  emailNav = "invoice",
}) => {
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [fromEmail, setFromEmail] = useState(initialFrom);
  const [editFrom, setEditFrom] = useState(false);
  const [poweredBy, setPoweredBy] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [attachLabel, setAttachLabel] = useState(attachmentLabel ?? "");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSubject(initialSubject);
    setFromEmail(initialFrom);
    setAttachLabel(attachmentLabel ?? "");
    const emails = initialTo
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setToRecipients(emails.length ? emails : initialTo ? [initialTo] : []);
  }, [open, initialSubject, initialFrom, initialTo, attachmentLabel]);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    if (bodyHtml) bodyRef.current.innerHTML = bodyHtml;
    else bodyRef.current.textContent = bodyText ?? "";
  }, [open, bodyHtml, bodyText]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !templatesOpen && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, templatesOpen]);

  if (!open) return null;

  const removeTo = (email: string) => setToRecipients((list) => list.filter((e) => e !== email));

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
        <div
          className="w-full max-w-3xl my-6 bg-white border border-gray-300 rounded-lg shadow-2xl overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 bg-gray-100">
            <h3 className="text-base font-medium text-gray-900 truncate pr-4">{title}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600"
                title="Email templates"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-md">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSend?.();
                  onClose();
                }}
                className="px-4 py-1.5 text-sm bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300 font-medium border border-gray-300"
              >
                Send
              </button>
            </div>
          </div>

          <div className="px-5 py-3 space-y-0 text-sm border-b border-gray-300">
            <div className="flex items-start gap-3 py-2 border-b border-gray-300">
              <span className="text-gray-500 w-16 pt-1">To:</span>
              <div className="flex-1 flex flex-wrap gap-2 min-h-[28px]">
                {toRecipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-200 text-gray-800 text-xs"
                  >
                    {email}
                    <button type="button" onClick={() => removeTo(email)} className="text-gray-500 hover:text-gray-800">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {!toRecipients.length && (
                  <input
                    placeholder="Add recipient"
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-gray-900"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v) {
                          setToRecipients((p) => [...p, v]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                )}
              </div>
              <button type="button" onClick={() => setShowCcBcc((v) => !v)} className="text-xs text-gray-500 hover:text-gray-800 whitespace-nowrap">
                Cc &amp; Bcc
              </button>
            </div>
            {showCcBcc && (
              <>
                <div className="flex items-center gap-3 py-2 border-b border-gray-300">
                  <span className="text-gray-500 w-16">Cc:</span>
                  <input value={cc} onChange={(e) => setCc(e.target.value)} className="flex-1 bg-transparent outline-none text-gray-900" />
                </div>
                <div className="flex items-center gap-3 py-2 border-b border-gray-300">
                  <span className="text-gray-500 w-16">Bcc:</span>
                  <input value={bcc} onChange={(e) => setBcc(e.target.value)} className="flex-1 bg-transparent outline-none text-gray-900" />
                </div>
              </>
            )}
            <div className="flex items-center gap-3 py-2 border-b border-gray-300">
              <span className="text-gray-500 w-16">Subject:</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 bg-transparent outline-none text-gray-900" />
            </div>
            <div className="flex items-center gap-3 py-2">
              <span className="text-gray-500 w-16">From:</span>
              {editFrom ? (
                <input
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  onBlur={() => setEditFrom(false)}
                  autoFocus
                  className="flex-1 keep-box ua-field px-2 py-1 border border-gray-300 rounded text-gray-900"
                />
              ) : (
                <span className="flex-1 text-gray-900">{fromEmail || "info@inovoic.com"}</span>
              )}
              <button type="button" className="text-gray-500">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setEditFrom(true)} className="text-gray-500 hover:text-gray-800">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b border-gray-300 bg-gray-50 text-gray-700">
            <select className="keep-box ua-field text-xs px-2 py-1 border border-gray-300 rounded mr-1">
              <option>Size</option>
            </select>
            <select className="keep-box ua-field text-xs px-2 py-1 border border-gray-300 rounded mr-2">
              <option>Font</option>
            </select>
            {(
              [
                { Icon: Bold, cmd: "bold" },
                { Icon: Italic, cmd: "italic" },
                { Icon: Underline, cmd: "underline" },
              ] as const
            ).map(({ Icon, cmd }) => (
              <button key={cmd} type="button" onClick={() => exec(cmd)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200">
                <Icon className="w-4 h-4" />
              </button>
            ))}
            <button type="button" className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-xs font-bold underline">
              A
            </button>
            {(
              [
                { Icon: AlignLeft, cmd: "justifyLeft" },
                { Icon: AlignCenter, cmd: "justifyCenter" },
                { Icon: AlignRight, cmd: "justifyRight" },
                { Icon: AlignJustify, cmd: "justifyFull" },
              ] as const
            ).map(({ Icon, cmd }) => (
              <button key={cmd} type="button" onClick={() => exec(cmd)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200">
                <Icon className="w-4 h-4" />
              </button>
            ))}
            <button type="button" onClick={() => exec("insertImage", prompt("Image URL") || undefined)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200">
              <Image className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => exec("createLink", prompt("Link URL") || undefined)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200">
              <Link2 className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[200px] px-5 py-4 text-sm text-gray-800 outline-none prose prose-sm max-w-none"
          />

          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-300 bg-gray-50">
            <div className="flex items-center gap-2 flex-wrap">
              {attachLabel && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-300 bg-white text-xs text-gray-800">
                  <FileText className="w-4 h-4 text-red-500" />
                  {attachLabel}
                  <button type="button" onClick={() => setAttachLabel("")} className="text-gray-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button type="button" className="w-9 h-9 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-600">
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          <label className="flex items-center gap-2 px-5 py-3 text-sm text-gray-700 border-t border-gray-300 cursor-pointer">
            <input type="checkbox" checked={poweredBy} onChange={() => setPoweredBy((v) => !v)} className="accent-blue-600" />
            Powered by Moon Invoice
          </label>
        </div>
      </div>
      {templatesOpen && <EmailTemplatesModal initialNav={emailNav} onClose={() => setTemplatesOpen(false)} />}
    </>
  );
};

export default DocumentSendEmailModal;
