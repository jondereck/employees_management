import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

export type StoredBackupSummary = {
  id: string;
  filename: string;
  size: number;
  modifiedAt: string;
};

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

export class LocalBackupStorage {
  readonly root: string;

  constructor(root = resolveBackupDirectory()) {
    this.root = root;
  }

  async ensureRoot() {
    await mkdir(this.root, { recursive: true });
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

export function getLocalBackupDirectory() {
  return resolveBackupDirectory();
}
