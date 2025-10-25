import crypto from "node:crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import type { HeadsMode, SGRangePayload, SGRangeResult, SGBucket } from "@/types/sgRange";

const MIN_SG = 1;
const MAX_SG = 33;
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes

type TreeNode = { count: number; sum: number };

type CacheEntry = {
  expiresAt: number;
  tree: TreeNode[];
  size: number;
  length: number;
  perSGBuckets: SGBucket[];
  meta: Record<string, unknown>;
};

const cache = new Map<string, CacheEntry>();

const combine = (a: TreeNode, b: TreeNode): TreeNode => ({
  count: a.count + b.count,
  sum: a.sum + b.sum,
});

const emptyNode = (): TreeNode => ({ count: 0, sum: 0 });

function buildTree(values: TreeNode[]): { tree: TreeNode[]; size: number; length: number } {
  let size = 1;
  const n = values.length;
  while (size < n) size <<= 1;
  const tree = Array.from({ length: 2 * size }, () => emptyNode());
  for (let i = 0; i < n; i += 1) {
    tree[size + i] = { ...values[i] };
  }
  for (let i = size - 1; i > 0; i -= 1) {
    tree[i] = combine(tree[i << 1], tree[(i << 1) | 1]);
  }
  return { tree, size, length: n };
}

function queryTree(tree: TreeNode[], size: number, length: number, left: number, right: number): TreeNode {
  let l = Math.max(0, left) + size;
  const maxIndex = size + length - 1;
  let r = Math.min(maxIndex, right + size);
  let resLeft = emptyNode();
  let resRight = emptyNode();

  while (l <= r) {
    if (l & 1) {
      resLeft = combine(resLeft, tree[l]);
      l += 1;
    }
    if (!(r & 1)) {
      resRight = combine(tree[r], resRight);
      r -= 1;
    }
    l >>= 1;
    r >>= 1;
  }

  return combine(resLeft, resRight);
}

const normalizeStringArray = (values?: unknown[]): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      seen.add(value.trim());
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
};

const normalizeHeadsMode = (value: unknown): HeadsMode => (value === "headsOnly" ? "headsOnly" : "all");

const normalizeDate = (value?: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoCandidate = trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
  const date = new Date(isoCandidate);
  if (Number.isNaN(date.getTime())) return null;
  return isoCandidate;
};

const toDateRange = (from: string | null, to: string | null): { gte?: Date; lte?: Date } | undefined => {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    range.gte = start;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  if (range.gte && range.lte && range.gte > range.lte) {
    const tmp = range.gte;
    range.gte = range.lte;
    range.lte = tmp;
  }
  return range;
};

const createCacheKey = (departmentId: string, filters: Record<string, unknown>) => {
  const hash = crypto.createHash("sha1").update(JSON.stringify(filters)).digest("hex");
  return `${departmentId}:${hash}`;
};

const buildQueryString = (
  range: { L: number; R: number },
  filters: {
    officeIds: string[];
    headsMode: HeadsMode;
    employmentTypes: string[];
    dateFrom: string | null;
    dateTo: string | null;
    includeUnknownSG: boolean;
  }
) => {
  const params = new URLSearchParams();
  params.set("L", String(range.L));
  params.set("R", String(range.R));
  if (filters.headsMode === "headsOnly") {
    params.set("heads", "headsOnly");
  }
  for (const id of filters.officeIds) {
    params.append("offices", id);
  }
  for (const id of filters.employmentTypes) {
    params.append("employmentTypes", id);
  }
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  if (filters.includeUnknownSG) {
    params.set("includeUnknown", "1");
  }
  return params.toString();
};

export async function POST(
  req: Request,
  { params }: { params: { departmentId: string } }
) {
  try {
    const { departmentId } = params;
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 401 });
    }

    if (!departmentId) {
      return new NextResponse("Department Id is required", { status: 400 });
    }

    const payload = (await req.json()) as SGRangePayload | null;
    if (!payload || typeof payload !== "object") {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    let L = Number(payload.L);
    let R = Number(payload.R);
    if (!Number.isFinite(L) || !Number.isFinite(R)) {
      return new NextResponse("Invalid range", { status: 400 });
    }

    L = Math.floor(L);
    R = Math.floor(R);

    if (L < MIN_SG) L = MIN_SG;
    if (R < MIN_SG) R = MIN_SG;
    if (L > MAX_SG) L = MAX_SG;
    if (R > MAX_SG) R = MAX_SG;
    if (L > R) [L, R] = [R, L];

    const rawFilters = payload.filters ?? {};
    const officeIds = normalizeStringArray(rawFilters.officeIds);
    const employmentTypes = normalizeStringArray(rawFilters.employmentTypes);
    const headsMode = normalizeHeadsMode(rawFilters.headsMode);
    const dateFrom = normalizeDate(rawFilters.dateFrom);
    const dateTo = normalizeDate(rawFilters.dateTo);
    const includeUnknownSG = Boolean(rawFilters.includeUnknownSG);

    const filterKey = {
      officeIds,
      employmentTypes,
      headsMode,
      dateFrom,
      dateTo,
      includeUnknownSG,
    };

    const cacheKey = createCacheKey(departmentId, filterKey);
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      const node = queryTree(cached.tree, cached.size, cached.length, L, R);
      const result: SGRangeResult = {
        range: { L, R },
        count: node.count,
        sumSalary: node.sum,
        avgSalary: node.count ? node.sum / node.count : 0,
        perSG: cached.perSGBuckets.map((bucket) => ({ ...bucket })),
        meta: {
          ...cached.meta,
          source: "cache",
          servedAt: new Date().toISOString(),
        },
      };

      const response = NextResponse.json(result);
      const queryString = buildQueryString(result.range, {
        officeIds,
        employmentTypes,
        headsMode,
        dateFrom,
        dateTo,
        includeUnknownSG,
      });
      response.cookies.set(`sgRangeLast_${departmentId}`, queryString, {
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return response;
    }

    const dateRange = toDateRange(dateFrom, dateTo);

    const employees = await prismadb.employee.findMany({
      where: {
        departmentId,
        isArchived: false,
        ...(officeIds.length ? { officeId: { in: officeIds } } : {}),
        ...(employmentTypes.length ? { employeeTypeId: { in: employmentTypes } } : {}),
        ...(headsMode === "headsOnly" ? { isHead: true } : {}),
        ...(dateRange ? { dateHired: dateRange } : {}),
      },
      select: {
        salaryGrade: true,
        salary: true,
      },
    });

    const counts = Array<number>(MAX_SG + 1).fill(0);
    const sums = Array<number>(MAX_SG + 1).fill(0);
    let unknownCount = 0;
    let unknownSum = 0;

    for (const employee of employees) {
      const rawGrade = employee.salaryGrade ?? 0;
      const salary = typeof employee.salary === "number" && Number.isFinite(employee.salary)
        ? employee.salary
        : 0;
      const grade = Number.isFinite(rawGrade) ? Math.trunc(Number(rawGrade)) : 0;
      if (grade >= MIN_SG && grade <= MAX_SG) {
        counts[grade] += 1;
        sums[grade] += salary;
      } else if (includeUnknownSG) {
        unknownCount += 1;
        unknownSum += salary;
      }
    }

    if (includeUnknownSG) {
      counts[0] = unknownCount;
      sums[0] = unknownSum;
    }

    const treeValues: TreeNode[] = [];
    for (let sg = 0; sg <= MAX_SG; sg += 1) {
      treeValues.push({ count: counts[sg], sum: sums[sg] });
    }

    const { tree, size, length } = buildTree(treeValues);

    const perSGBuckets: SGBucket[] = [];
    for (let sg = 1; sg <= MAX_SG; sg += 1) {
      perSGBuckets.push({ sg, count: counts[sg], sumSalary: sums[sg] });
    }
    if (includeUnknownSG && (unknownCount > 0 || unknownSum > 0)) {
      perSGBuckets.unshift({ sg: 0, count: unknownCount, sumSalary: unknownSum });
    }

    const node = queryTree(tree, size, length, L, R);
    const meta = {
      filters: filterKey,
      totalEmployees: employees.length,
      generatedAt: new Date().toISOString(),
      unknownBucket: includeUnknownSG ? { count: unknownCount, sumSalary: unknownSum } : undefined,
      source: "fresh",
    };

    cache.set(cacheKey, {
      expiresAt: now + CACHE_TTL_MS,
      tree,
      size,
      length,
      perSGBuckets,
      meta,
    });

    const result: SGRangeResult = {
      range: { L, R },
      count: node.count,
      sumSalary: node.sum,
      avgSalary: node.count ? node.sum / node.count : 0,
      perSG: perSGBuckets.map((bucket) => ({ ...bucket })),
      meta,
    };

    const response = NextResponse.json(result);
    const queryString = buildQueryString(result.range, {
      officeIds,
      employmentTypes,
      headsMode,
      dateFrom,
      dateTo,
      includeUnknownSG,
    });
    response.cookies.set(`sgRangeLast_${departmentId}`, queryString, {
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[SG_RANGE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
