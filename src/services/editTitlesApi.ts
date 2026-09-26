/**
 * Edit Titles — company UI string overrides.
 * Backend (read-only for us):
 *   GET   /edit-titles/my
 *   GET   /edit-titles/single/:id
 *   PATCH /edit-titles/update   body: { _id, name } | { reset: true }
 */
import { api } from "@/lib/api/client";

export type EditTitleItem = {
  id: string;
  name: string;
};

const text = (v: unknown) =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";

function mapTitle(doc: any): EditTitleItem | null {
  const id = text(doc?._id ?? doc?.id);
  const name = text(doc?.name);
  if (!id) return null;
  return { id, name };
}

/** Flatten company EditTitle document(s) into a title list. */
export async function fetchMyEditTitles(): Promise<EditTitleItem[]> {
  const data = await api.get<any>("/edit-titles/my");
  const docs = Array.isArray(data) ? data : data ? [data] : [];
  const out: EditTitleItem[] = [];
  for (const doc of docs) {
    const titles = Array.isArray(doc?.titles) ? doc.titles : [];
    for (const t of titles) {
      const mapped = mapTitle(t);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

export async function fetchEditTitle(id: string): Promise<EditTitleItem | null> {
  const data = await api.get<any>(`/edit-titles/single/${id}`);
  return mapTitle(data);
}

/** Update one title by subdocument `_id`. */
export async function updateEditTitle(id: string, name: string): Promise<void> {
  await api.patch("/edit-titles/update", { _id: id, name: name.trim() });
}

/** Reset all titles to the server seed list. */
export async function resetEditTitles(): Promise<void> {
  await api.patch("/edit-titles/update", { reset: true });
}
