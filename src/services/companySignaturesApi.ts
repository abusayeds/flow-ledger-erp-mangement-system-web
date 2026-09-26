/**
 * Company signatures — `/setting/signatures` (Authorized Signatory on PDFs).
 * Used by Companies page; separate from per-document customer signatures.
 */
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/env";

export type CompanySignature = {
  id: string;
  name: string;
  image: string;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function resolveSignatureUrl(value: unknown): string {
  return resolveMediaUrl(value);
}

function mapOne(doc: any): CompanySignature | null {
  const id = text(doc?._id ?? doc?.id);
  if (!id) return null;
  return {
    id,
    name: text(doc?.name) || "Authorized Signatory",
    image: text(doc?.image),
  };
}

export async function fetchCompanySignatures(): Promise<CompanySignature[]> {
  const data = await api.get<any[]>("/setting/signatures/all");
  if (!Array.isArray(data)) return [];
  return data.map(mapOne).filter((x): x is CompanySignature => !!x);
}

/** Prefer the newest non-empty image signature. */
export async function fetchPrimaryCompanySignature(): Promise<CompanySignature | null> {
  const all = await fetchCompanySignatures();
  return all.find((s) => s.image) || all[0] || null;
}

export async function createCompanySignature(payload: {
  name: string;
  image?: string;
}): Promise<CompanySignature | null> {
  const data = await api.post<any>("/setting/signatures/create", payload);
  return mapOne(data);
}

export async function updateCompanySignature(
  id: string,
  payload: { name?: string; image?: string },
): Promise<CompanySignature | null> {
  const data = await api.patch<any>(`/setting/signatures/${id}`, payload);
  return mapOne(data);
}

export async function uploadSignatureImage(
  dataUrlOrBlob: string,
  filename: string,
): Promise<string> {
  if (!dataUrlOrBlob.startsWith("data:")) return dataUrlOrBlob;
  const res = await fetch(dataUrlOrBlob);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const formData = new FormData();
  formData.append("files", file);
  const uploadRes = await api.raw.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return (
    uploadRes.data?.data?.file_path ||
    uploadRes.data?.data?.path ||
    dataUrlOrBlob
  );
}
