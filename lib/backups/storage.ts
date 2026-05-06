import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

import prismadb from "@/lib/prismadb";

import type { DepartmentBackupManifest } from "./config";

export type StoredBackupSummary = {
  id: string;
  filename: string;
  size: number;
  modifiedAt: string;
  manifest?: DepartmentBackupManifest;
};

export type BackupStorageInfo =
  | {
      type: "database";
      label: string;
      directory: null;
    }
  | {
      type: "local";
      label: string;
      directory: string;
    };

export interface BackupStorage {
  info(): BackupStorageInfo;
  save(
    id: string,
    buffer: Buffer,
    options: {
      departmentId: string;
      manifest: DepartmentBackupManifest;
      createdBy: string;
    }
  ): Promise<StoredBackupSummary>;
  read(id: string): Promise<Buffer>;
  list(departmentId: string): Promise<StoredBackupSummary[]>;
}

function resolveBackupDirectory() {
  const configured = process.env.BACKUP_DIR?.trim();
  const target = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured)
    : path.join(process.cwd(), "backups", "local");

  return path.resolve(target);
}

function normalizeBackupId(id: string) {
  const trimmed = id.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed) || trimmed.includes("..")) {
    throw new Error("Invalid backup id.");
  }

  return trimmed.endsWith(".zip") ? trimmed.slice(0, -4) : trimmed;
}

export class LocalBackupStorage implements BackupStorage {
  readonly root: string;

  constructor(root = resolveBackupDirectory()) {
    this.root = root;
  }

  async ensureRoot() {
    await mkdir(this.root, { recursive: true });
  }

  info(): BackupStorageInfo {
    return {
      type: "local",
      label: "Local filesystem",
      directory: this.root,
    };
  }

  filenameFor(id: string) {
    return `${normalizeBackupId(id)}.zip`;
  }

  pathFor(id: string) {
    const filename = this.filenameFor(id);
    const resolved = path.resolve(this.root, filename);
    const rootWithSeparator = this.root.endsWith(path.sep)
      ? this.root
      : `${this.root}${path.sep}`;

    if (!resolved.startsWith(rootWithSeparator)) {
      throw new Error("Invalid backup path.");
    }

    return resolved;
  }

  async save(id: string, buffer: Buffer) {
    await this.ensureRoot();
    const filePath = this.pathFor(id);
    await writeFile(filePath, buffer, { flag: "wx" });
    const fileStat = await stat(filePath);

    return {
      id: normalizeBackupId(id),
      filename: path.basename(filePath),
      size: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
    } satisfies StoredBackupSummary;
  }

  async read(id: string) {
    return readFile(this.pathFor(id));
  }

  async list() {
    await this.ensureRoot();
    const entries = await readdir(this.root, { withFileTypes: true });
    const summaries: StoredBackupSummary[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".zip")) {
        continue;
      }

      const id = normalizeBackupId(entry.name);
      const filePath = this.pathFor(id);
      const fileStat = await stat(filePath);
      summaries.push({
        id,
        filename: entry.name,
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      });
    }

    return summaries.sort(
      (a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt)
    );
  }
}

function normalizeDatabaseManifest(value: unknown): DepartmentBackupManifest | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as DepartmentBackupManifest;
}

export class DatabaseBackupStorage implements BackupStorage {
  info(): BackupStorageInfo {
    return {
      type: "database",
      label: "Database snapshots",
      directory: null,
    };
  }

  filenameFor(id: string) {
    return `${normalizeBackupId(id)}.zip`;
  }

  async save(
    id: string,
    buffer: Buffer,
    options: {
      departmentId: string;
      manifest: DepartmentBackupManifest;
      createdBy: string;
    }
  ) {
    const normalizedId = normalizeBackupId(id);
    const filename = this.filenameFor(normalizedId);
    const row = await (prismadb as any).departmentBackup.create({
      data: {
        id: normalizedId,
        departmentId: options.departmentId,
        filename,
        size: buffer.byteLength,
        data: buffer,
        manifest: options.manifest,
        reason: options.manifest.reason,
        createdBy: options.createdBy,
      },
      select: {
        id: true,
        filename: true,
        size: true,
        updatedAt: true,
        manifest: true,
      },
    });

    return {
      id: row.id,
      filename: row.filename,
      size: row.size,
      modifiedAt: row.updatedAt.toISOString(),
      manifest: normalizeDatabaseManifest(row.manifest),
    } satisfies StoredBackupSummary;
  }

  async read(id: string) {
    const normalizedId = normalizeBackupId(id);
    const row = await (prismadb as any).departmentBackup.findUnique({
      where: { id: normalizedId },
      select: { data: true },
    });

    if (!row) {
      const error = new Error("Backup not found.") as Error & { code?: string };
      error.code = "ENOENT";
      throw error;
    }

    return Buffer.from(row.data);
  }

  async list(departmentId: string) {
    const rows = await (prismadb as any).departmentBackup.findMany({
      where: { departmentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        size: true,
        updatedAt: true,
        manifest: true,
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      size: row.size,
      modifiedAt: row.updatedAt.toISOString(),
      manifest: normalizeDatabaseManifest(row.manifest),
    })) satisfies StoredBackupSummary[];
  }
}

export function getBackupStorage(): BackupStorage {
  const configured = process.env.BACKUP_STORAGE?.trim().toLowerCase();

  if (configured === "local") {
    return new LocalBackupStorage();
  }

  if (configured === "database" || process.env.VERCEL || process.env.NODE_ENV === "production") {
    return new DatabaseBackupStorage();
  }

  return new LocalBackupStorage();
}

export function getBackupStorageInfo() {
  return getBackupStorage().info();
}
