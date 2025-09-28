// lib/build-office-clusters.ts
import prismadb from "@/lib/prismadb";

// ---- Types you’ll consume in UI ----
export type OfficeLite = {
  id: string;
  name: string;
  bioIndexCode: string | null;
  employeeCount?: number; // attached later
};

export type OfficeCluster = {
  indexCodeKey: string;        // "__NO_CODE__" when missing
  bioIndexCode: string | null; // original value to show
  offices: OfficeLite[];
  employeeTotal?: number;      // attached later
};

// ---- Helpers ----
const NO_CODE_KEY = "__NO_CODE__";

function normalizeCode(code?: string | null) {
  const trimmed = (code ?? "").trim();
  return trimmed.length ? trimmed : NO_CODE_KEY;
}

function clusterSort(a: OfficeCluster, b: OfficeCluster) {
  // push the "no code" bucket to the end; otherwise lexicographic
  if (a.indexCodeKey === NO_CODE_KEY && b.indexCodeKey !== NO_CODE_KEY) return 1;
  if (b.indexCodeKey === NO_CODE_KEY && a.indexCodeKey !== NO_CODE_KEY) return -1;
  return a.indexCodeKey.localeCompare(b.indexCodeKey);
}

// ---- Core builders ----

/**
 * Build clusters of Offices grouped by bioIndexCode within the given department.
 * Includes singletons; filter at the API/UI layer if you want only merged groups.
 */

// lib/build-office-clusters.ts (additions)
import { DSU } from "@/lib/dsu";



export async function buildOfficeClustersDSU(departmentId: string) {
  // 1) load offices
  const offices = await prismadb.offices.findMany({
    where: { departmentId },
    select: { id: true, name: true, bioIndexCode: true },
    orderBy: [{ bioIndexCode: "asc" }, { name: "asc" }],
  });

  // 2) init DSU
  const dsu = new DSU();
  for (const o of offices) dsu.makeSet(o.id);

  // 3) UNION RULES
  // (a) same normalized bioIndexCode
  const byCode = new Map<string, string[]>();
  for (const o of offices) {
    const k = normalizeCode(o.bioIndexCode);
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k)!.push(o.id);
  }
  for (const ids of byCode.values()) {
    for (let i = 1; i < ids.length; i++) dsu.union(ids[0], ids[i]);
  }

  // (b) future extra edges (optional):
  // - union by known aliases/synonyms
  // - union by manual admin links from a table (e.g., OfficeLink { aId, bId })
  // - union by name regex, etc.

  // 4) materialize clusters from DSU
  const groups = dsu.groups(); // rootId -> officeIds[]
  // decide the display code for each group:
  // use the first non-null code among member offices (or null if none)
  const officeById = new Map(offices.map(o => [o.id, o]));
  const clusters = Object.values(groups).map(memberIds => {
    const members = memberIds.map(id => officeById.get(id)!);
    const firstCode = members.map(m => m.bioIndexCode?.trim()).find(c => c && c.length) ?? null;
    return {
      indexCodeKey: normalizeCode(firstCode),      // for sorting
      bioIndexCode: firstCode,                      // display
      offices: members,
    };
  });

  // push the no-code group(s) to the end; otherwise lexicographic
  clusters.sort((a, b) => {
    if (a.indexCodeKey === NO_CODE_KEY && b.indexCodeKey !== NO_CODE_KEY) return 1;
    if (b.indexCodeKey === NO_CODE_KEY && a.indexCodeKey !== NO_CODE_KEY) return -1;
    return a.indexCodeKey.localeCompare(b.indexCodeKey);
  });

  return clusters;
}

export async function buildOfficeClusters(departmentId: string): Promise<OfficeCluster[]> {
  const offices = await prismadb.offices.findMany({
    where: { departmentId },
    select: { id: true, name: true, bioIndexCode: true },
    orderBy: [{ bioIndexCode: "asc" }, { name: "asc" }],
  });

  const byCode = new Map<string, OfficeLite[]>();
  for (const o of offices) {
    const key = normalizeCode(o.bioIndexCode);
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key)!.push(o);
  }

  const clusters: OfficeCluster[] = [];
  for (const [key, list] of byCode) {
    clusters.push({
      indexCodeKey: key,
      bioIndexCode: key === NO_CODE_KEY ? null : key,
      offices: list,
    });
  }

  clusters.sort(clusterSort);
  return clusters;
}

/**
 * Attaches employee counts to each office and a per-cluster total.
 * This version uses Prisma groupBy on Employee.officeId (1:N in your schema).
 *
 * @param includeArchived - if false (default), excludes archived employees.
 */
export async function attachEmployeeCounts(
  clusters: OfficeCluster[],
  opts: { includeArchived?: boolean } = {}
) {
  const includeArchived = opts.includeArchived ?? false;

  const officeIds = clusters.flatMap(c => c.offices.map(o => o.id));
  if (officeIds.length === 0) return clusters.map(c => ({ ...c, employeeTotal: 0 }));

  // groupBy counts per officeId
  const counts = await prismadb.employee.groupBy({
    by: ["officeId"],
    where: {
      officeId: { in: officeIds },
      ...(includeArchived ? {} : { isArchived: false }),
    },
    _count: { _all: true },
  });

  const countMap = new Map<string, number>();
  for (const row of counts) {
    countMap.set(row.officeId, row._count._all);
  }

  return clusters.map(cluster => {
    const offices = cluster.offices.map(o => ({
      ...o,
      employeeCount: countMap.get(o.id) ?? 0,
    }));
    const employeeTotal = offices.reduce((sum, o) => sum + (o.employeeCount ?? 0), 0);
    return { ...cluster, offices, employeeTotal };
  });
}

