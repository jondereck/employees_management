import { EmployeeMatch, EmployeeLite, OfficeLite, RawRecord, UnmatchedBio, UploadMeta } from "./types";

type StoredUpload = {
  uploadId: string;
  departmentId: string;
  month: string;
  raw: RawRecord[];
  meta: UploadMeta;
  matched: EmployeeMatch[];
  unmatched: UnmatchedBio[];
  employees: EmployeeLite[];
  offices: OfficeLite[];
};

const store = new Map<string, StoredUpload>();

export function saveUpload(entry: StoredUpload) {
  store.set(entry.uploadId, entry);
  return entry;
}

export function getUpload(uploadId: string) {
  return store.get(uploadId);
}

export function updateUpload(uploadId: string, update: Partial<StoredUpload>) {
  const existing = store.get(uploadId);
  if (!existing) return undefined;
  const merged = { ...existing, ...update };
  store.set(uploadId, merged);
  return merged;
}

export function deleteUpload(uploadId: string) {
  store.delete(uploadId);
}

export function listUploadsByDepartment(departmentId: string) {
  return Array.from(store.values()).filter((entry) => entry.departmentId === departmentId);
}
