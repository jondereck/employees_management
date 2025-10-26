import { OrgChartVersion } from "@/types/orgChart";
import { randomUUID } from "crypto";

type VersionRecord = OrgChartVersion & {
  isDefault?: boolean;
};

type OrgChartStore = {
  versions: VersionRecord[];
};

declare global {
  // eslint-disable-next-line no-var
  var __ORG_CHART_STORE__: OrgChartStore | undefined;
}

const store: OrgChartStore = globalThis.__ORG_CHART_STORE__ ?? {
  versions: [],
};

if (!globalThis.__ORG_CHART_STORE__) {
  globalThis.__ORG_CHART_STORE__ = store;
}

export function listOrgChartVersions(departmentId: string): VersionRecord[] {
  return store.versions.filter((version) => version.departmentId === departmentId);
}

export function createOrgChartVersion(
  departmentId: string,
  label: string,
  data: OrgChartVersion["data"]
): VersionRecord {
  const now = new Date().toISOString();
  const version: VersionRecord = {
    id: randomUUID(),
    departmentId,
    label,
    createdAt: now,
    data,
  };
  store.versions.unshift(version);
  return version;
}

export function getOrgChartVersion(
  departmentId: string,
  versionId: string
): VersionRecord | null {
  const version = store.versions.find(
    (item) => item.departmentId === departmentId && item.id === versionId
  );
  return version ?? null;
}

export function setDefaultOrgChartVersion(
  departmentId: string,
  versionId: string
): VersionRecord | null {
  let target: VersionRecord | undefined;
  store.versions = store.versions.map((item) => {
    if (item.departmentId !== departmentId) return item;
    const next = {
      ...item,
      isDefault: item.id === versionId,
    };
    if (next.isDefault) target = next;
    return next;
  });
  return target ?? null;
}

export function getDefaultOrgChartVersion(
  departmentId: string
): VersionRecord | null {
  return (
    store.versions.find(
      (item) => item.departmentId === departmentId && item.isDefault
    ) ?? null
  );
}

