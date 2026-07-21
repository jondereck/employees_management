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

test("Employee Movements uses indigo border in dedicated component", () => {
  const componentSource = readFileSync(
    "components/dashboard/dashboard-employee-movements-card.tsx",
    "utf8",
  );
  assert.match(
    componentSource,
    /border-indigo-400\/80[\s\S]*dark:border-indigo-500\/50/,
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
