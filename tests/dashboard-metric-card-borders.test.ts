import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("MetricCard accepts borderTone string prop", () => {
  assert.match(pageSource, /borderTone: string/);
});

test("MetricCard Card className interpolates borderTone", () => {
  assert.match(pageSource, /\$\{borderTone\}/);
});

test("Total Employees links to employees with blue border", () => {
  const totalEmployeesBlock = pageSource.match(
    /title="Total Employees"[\s\S]*?<\/MetricCard>/,
  );
  assert.ok(totalEmployeesBlock, "expected Total Employees MetricCard block");
  const block = totalEmployeesBlock[0];
  assert.match(block, /href=\{`\/\$\{departmentId\}\/employees`\}/);
  assert.match(
    block,
    /borderTone="border-blue-400\/80 dark:border-blue-500\/50"/,
  );
});

test("Active This Month uses emerald border without link", () => {
  const activeBlock = pageSource.match(
    /title="Active This Month"[\s\S]*?<\/MetricCard>/,
  );
  assert.ok(activeBlock, "expected Active This Month MetricCard block");
  const block = activeBlock[0];
  assert.doesNotMatch(block, /href=/);
  assert.match(
    block,
    /borderTone="border-emerald-400\/80 dark:border-emerald-500\/50"/,
  );
});

test("Offices preserves link with cyan border", () => {
  const officesBlock = pageSource.match(
    /title="Offices"[\s\S]*?<\/MetricCard>/,
  );
  assert.ok(officesBlock, "expected Offices MetricCard block");
  const block = officesBlock[0];
  assert.match(block, /href=\{`\/\$\{departmentId\}\/offices`\}/);
  assert.match(
    block,
    /borderTone="border-cyan-400\/80 dark:border-cyan-500\/50"/,
  );
});

test("Plantilla keeps violet border", () => {
  assert.match(
    pageSource,
    /border-violet-400\/80 transition hover:bg-white\/60 dark:border-violet-500\/50/,
  );
});
