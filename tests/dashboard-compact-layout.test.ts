import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("metrics wrapper uses compact two-column mobile grid and four columns at xl", () => {
  assert.match(
    pageSource,
    /grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4/,
  );
});

test("metric cards and linked wrappers fill their grid cells", () => {
  assert.match(
    pageSource,
    /<Card className=\{`\$\{glassCard\} group relative h-full overflow-hidden/,
  );
  assert.match(
    pageSource,
    /className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"/,
  );
  assert.match(
    pageSource,
    /className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"/,
  );
});

test("metric icons use compact mobile sizes and restore at sm", () => {
  assert.match(
    pageSource,
    /<Briefcase className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" \/>/,
  );
  assert.match(
    pageSource,
    /<Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" \/>/,
  );
});

test("right rail stacks Needs Attention and Incomplete Records", () => {
  assert.match(pageSource, /data-dashboard-right-rail/);
  const rightRailMatch = pageSource.match(
    /data-dashboard-right-rail[\s\S]*?<\/div>\s*<\/div>/,
  );
  assert.ok(rightRailMatch, "expected a data-dashboard-right-rail wrapper");
  const rightRailSource = rightRailMatch[0];
  assert.match(rightRailSource, /Needs Attention/);
  assert.match(rightRailSource, /Incomplete Records/);
});

test("incomplete employee preview is limited to six records", () => {
  assert.match(
    pageSource,
    /dashboardSummary\.incompleteRecords\.employees\.slice\(0, 6\)/,
  );
});

test("missing-data preview removes fixed-height scrollbar", () => {
  assert.doesNotMatch(pageSource, /max-h-\[320px\]/);
});

test("preview grid uses responsive two and three column layouts", () => {
  assert.match(pageSource, /sm:grid-cols-2 xl:grid-cols-3/);
});

test("missing-data header links to employees with view-all count", () => {
  assert.match(pageSource, /View all \{dashboardSummary\.incompleteRecords\.count\}/);
});

test("missing-data card describes a preview of incomplete records", () => {
  assert.match(
    pageSource,
    /Preview of records with missing key fields\./,
  );
});

test("mobile preview hides records after the fourth item", () => {
  assert.match(pageSource, /index >= 4/);
});

test("workforce analytics remains after missing-data card", () => {
  const missingDataIndex = pageSource.indexOf("Employees With Missing Data");
  const analyticsIndex = pageSource.indexOf("<DashboardAnalyticsTabs");
  assert.ok(missingDataIndex !== -1, "expected Missing Data card");
  assert.ok(analyticsIndex !== -1, "expected DashboardAnalyticsTabs");
  assert.ok(
    analyticsIndex > missingDataIndex,
    "expected analytics after Missing Data card",
  );
});
