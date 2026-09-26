/**
 * Email Templates route — opens the real Email Templates modal (SS layout + backend).
 */
import React, { useState } from "react";
import { Mail } from "lucide-react";
import { EmailTemplatesModal } from "@/components/modals/EmailTemplatesModal";

export const EmailTemplates: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#FAFBFC]">
      {open && <EmailTemplatesModal onClose={() => setOpen(false)} initialNav="invoice" />}
      {!open && (
        <div className="text-center px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-600 mb-4">Email Templates closed.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            Open Email Templates
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailTemplates;
