/**
 * File: src/components/ui/SignatureBlock.tsx
 * Renders the saved signature on a document detail panel (matches the reference:
 * a titled box with the drawn signature image on white and the date beneath).
 * Renders nothing when the record has no signature yet.
 */

import React from "react";
import { resolveMediaUrl } from "@/lib/env";

const resolveSignatureSrc = (value: unknown): string => resolveMediaUrl(value);

export const SignatureBlock: React.FC<{
  record: any;
  label?: string;
}> = ({ record, label = "Customer Signature" }) => {
  const signatureSrc = resolveSignatureSrc(record?.signature);
  if (!signatureSrc) return null;
  return (
    <div className="px-5 pb-5">
      <div className="relative inline-block w-full max-w-xs border border-gray-200 rounded-md p-3 pt-4">
        <span className="absolute -top-2 left-3 px-1 bg-white text-[11px] text-gray-500">{label}</span>
        <div className="bg-white rounded border border-gray-100 flex items-center justify-center overflow-hidden" style={{ height: 96 }}>
          <img src={signatureSrc} alt={label} className="max-h-full max-w-full object-contain" />
        </div>
        {(record.signatureName || record.signatureDate) && (
          <div className="mt-2 text-center text-xs text-gray-600">
            {record.signatureName && <span className="font-medium text-gray-800">{record.signatureName}</span>}
            {record.signatureName && record.signatureDate && <span> · </span>}
            {record.signatureDate}
          </div>
        )}
      </div>
    </div>
  );
};

export default SignatureBlock;
