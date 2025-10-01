export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";

function drive() {
  const email = process.env.GDRIVE_CLIENT_EMAIL!;
  const key = (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

type LiteFile = { id: string; name?: string | null; modifiedTime?: string | null };

async function listTopFiles(drv: ReturnType<typeof drive>, folderId: string): Promise<LiteFile[]> {
  const res = await drv.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: "files(id,name,modifiedTime,mimeType,shortcutDetails/targetId)",
    orderBy: "modifiedTime desc",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  // resolve shortcut targets to get real modifiedTime
  const out: LiteFile[] = [];
  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.shortcut" && f.shortcutDetails?.targetId) {
      const t = await drv.files.get({
        fileId: f.shortcutDetails.targetId,
        fields: "id,name,modifiedTime",
        supportsAllDrives: true,
      });
      out.push({ id: t.data.id!, name: t.data.name, modifiedTime: t.data.modifiedTime });
    } else {
      out.push({ id: f.id!, name: f.name, modifiedTime: f.modifiedTime });
    }
  }
  return out;
}

async function listOneLevelSubfolders(drv: ReturnType<typeof drive>, folderId: string): Promise<string[]> {
  const res = await drv.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => f.id!);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    if (!folderId) return NextResponse.json({ ok: false, error: "Missing folderId" }, { status: 400 });

    const drv = drive();

    // 1) files directly in the folder
    let candidates: LiteFile[] = await listTopFiles(drv, folderId);

    // 2) plus files from first-level subfolders
    const subs = await listOneLevelSubfolders(drv, folderId);
    for (const subId of subs) {
      const subFiles = await listTopFiles(drv, subId);
      candidates = candidates.concat(subFiles);
    }

    if (!candidates.length) return NextResponse.json({ ok: true, lastUpdated: null, latestFile: null });

    // pick newest
    candidates.sort((a, b) => new Date(b.modifiedTime ?? 0).getTime() - new Date(a.modifiedTime ?? 0).getTime());
    const newest = candidates[0];

    return NextResponse.json({
      ok: true,
      lastUpdated: newest.modifiedTime ?? null,
      latestFile: newest,
      totalFilesChecked: candidates.length,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Drive error" }, { status: 500 });
  }
}
