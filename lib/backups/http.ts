import { NextResponse } from "next/server";

import { BackupHttpError } from "./access";
import { BackupValidationError } from "./zip";

export function noStoreJson<T>(body: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

export function backupErrorResponse(error: unknown) {
  if (error instanceof BackupHttpError) {
    return noStoreJson(
      { error: error.message, details: error.details ?? [] },
      { status: error.status }
    );
  }

  if (error instanceof BackupValidationError) {
    return noStoreJson(
      { error: error.message, details: error.details },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Backup operation failed.";
  return noStoreJson({ error: message }, { status: 500 });
}

export async function readBackupInput(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const confirmation = form.get("confirmation");

    if (!(file instanceof File)) {
      return {
        confirmation: typeof confirmation === "string" ? confirmation : undefined,
        buffer: null,
        backupId: null,
      };
    }

    return {
      confirmation: typeof confirmation === "string" ? confirmation : undefined,
      buffer: Buffer.from(await file.arrayBuffer()),
      backupId: null,
    };
  }

  const body = (await req.json().catch(() => ({}))) as {
    backupId?: unknown;
    confirmation?: unknown;
  };

  return {
    confirmation: typeof body.confirmation === "string" ? body.confirmation : undefined,
    buffer: null,
    backupId: typeof body.backupId === "string" ? body.backupId : null,
  };
}
