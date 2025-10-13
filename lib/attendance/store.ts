import { UploadSession } from "./types";

const uploads = new Map<string, UploadSession>();

export function saveUpload(session: UploadSession) {
  uploads.set(session.id, session);
}

export function getUpload(uploadId: string) {
  return uploads.get(uploadId) ?? null;
}

export function updateUpload(uploadId: string, data: Partial<UploadSession>) {
  const existing = uploads.get(uploadId);
  if (!existing) return null;
  const updated = { ...existing, ...data } as UploadSession;
  uploads.set(uploadId, updated);
  return updated;
}

export function deleteUpload(uploadId: string) {
  uploads.delete(uploadId);
}

export function cleanupUploads(maxAgeMs = 1000 * 60 * 60) {
  const now = Date.now();
  for (const [id, session] of uploads.entries()) {
    if (now - session.createdAt > maxAgeMs) {
      uploads.delete(id);
    }
  }
}
