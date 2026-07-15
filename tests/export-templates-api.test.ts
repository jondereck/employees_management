import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  clearLocalUserTemplatesStorage,
  getUserTemplates,
  isLocalTemplatesMigrated,
  markLocalTemplatesMigrated,
  remapTemplateUsageIds,
  setUserTemplates,
} from "@/utils/export-templates";
import {
  importTemplatesViaApi,
  migrateLocalTemplatesIfNeeded,
  templatesToExportBlob,
} from "@/utils/export-templates-api";

const DEPT = "dept_test_1";

function mockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: ls,
    configurable: true,
  });
  return store;
}

describe("export-templates migrate helpers", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = mockLocalStorage();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("tracks per-department migrated flag", () => {
    assert.equal(isLocalTemplatesMigrated(DEPT), false);
    markLocalTemplatesMigrated(DEPT);
    assert.equal(isLocalTemplatesMigrated(DEPT), true);
    assert.equal(store.get(`hrps.userTemplates.migrated.${DEPT}`), "1");
  });

  it("clearLocalUserTemplatesStorage removes LS key", () => {
    setUserTemplates([
      {
        id: "local-1",
        name: "A",
        selectedKeys: ["employeeNo"],
      },
    ]);
    assert.equal(getUserTemplates().length, 1);
    clearLocalUserTemplatesStorage();
    assert.equal(store.has("hrps.userTemplates"), false);
    assert.equal(getUserTemplates().length, 0);
  });

  it("remapTemplateUsageIds remaps last-used and recent", () => {
    localStorage.setItem("hrps.export.template", "old-a");
    localStorage.setItem(
      "hrps.export.template.recent",
      JSON.stringify(["old-a", "old-b", "missing"])
    );
    remapTemplateUsageIds({ "old-a": "new-a", "old-b": "new-b" });
    assert.equal(localStorage.getItem("hrps.export.template"), "new-a");
    assert.deepEqual(
      JSON.parse(localStorage.getItem("hrps.export.template.recent")!),
      ["new-a", "new-b"]
    );
  });
});

describe("templatesToExportBlob", () => {
  it("uses hrps.export.templates kind", async () => {
    const blob = templatesToExportBlob([
      { id: "t1", name: "One", selectedKeys: ["employeeNo"] },
    ]);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    assert.equal(parsed.__kind__, "hrps.export.templates");
    assert.equal(parsed.__version__, 1);
    assert.equal(parsed.templates.length, 1);
    assert.equal(parsed.templates[0].id, "t1");
  });
});

describe("migrateLocalTemplatesIfNeeded", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("skips when already migrated", async () => {
    markLocalTemplatesMigrated(DEPT);
    const result = await migrateLocalTemplatesIfNeeded(DEPT);
    assert.deepEqual(result, { migrated: 0, skipped: true });
  });

  it("migrates LS templates when DB empty and remaps usage ids", async () => {
    setUserTemplates([
      {
        id: "local-1",
        name: "Payroll",
        description: "desc",
        selectedKeys: ["employeeNo", "fullName"],
        sheetMode: "plain",
      },
    ]);
    localStorage.setItem("hrps.export.template", "local-1");
    localStorage.setItem(
      "hrps.export.template.recent",
      JSON.stringify(["local-1"])
    );

    const fetchMock = mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!init?.method || init.method === "GET") {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (init.method === "POST" && url.includes("/export-templates")) {
        const body = JSON.parse(String(init.body));
        assert.equal(body.name, "Payroll");
        assert.equal(body.description, "desc");
        assert.deepEqual(body.config.selectedKeys, ["employeeNo", "fullName"]);
        assert.equal(body.config.sheetMode, "plain");
        assert.equal(body.id, undefined);
        return new Response(
          JSON.stringify({
            id: "db-1",
            name: body.name,
            description: body.description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...body.config,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected fetch ${init.method} ${url}`);
    });

    const result = await migrateLocalTemplatesIfNeeded(DEPT);
    assert.deepEqual(result, { migrated: 1, skipped: false });
    assert.equal(isLocalTemplatesMigrated(DEPT), true);
    assert.deepEqual(getUserTemplates(), []);
    assert.equal(localStorage.getItem("hrps.export.template"), "db-1");
    assert.equal(fetchMock.mock.callCount() >= 2, true);
  });

  it("sets flag and leaves LS when DB already has templates", async () => {
    setUserTemplates([
      { id: "local-1", name: "A", selectedKeys: ["employeeNo"] },
    ]);
    mock.method(globalThis, "fetch", async () => {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "db-existing",
              name: "Existing",
              description: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              selectedKeys: ["employeeNo"],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await migrateLocalTemplatesIfNeeded(DEPT);
    assert.deepEqual(result, { migrated: 0, skipped: true });
    assert.equal(isLocalTemplatesMigrated(DEPT), true);
    assert.equal(getUserTemplates().length, 1);
  });
});

describe("importTemplatesViaApi", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("POSTs each valid template ignoring old ids", async () => {
    const posted: unknown[] = [];
    mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      posted.push(body);
      return new Response(
        JSON.stringify({
          id: `new-${posted.length}`,
          name: body.name,
          description: body.description ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...body.config,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await importTemplatesViaApi(DEPT, {
      __kind__: "hrps.export.templates",
      templates: [
        { id: "old-1", name: "One", selectedKeys: ["employeeNo"] },
        { name: "bad" },
        { id: "old-2", name: "Two", selectedKeys: ["fullName"], sheetMode: "merged" },
      ],
    });

    assert.deepEqual(result, { added: 2, skipped: 1 });
    assert.equal(posted.length, 2);
    assert.equal((posted[0] as { id?: string }).id, undefined);
    assert.equal((posted[1] as { config: { sheetMode: string } }).config.sheetMode, "merged");
  });
});
