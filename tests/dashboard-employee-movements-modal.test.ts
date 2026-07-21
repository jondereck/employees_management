import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);
const componentPath = "components/dashboard/dashboard-employee-movements-card.tsx";

function readComponentSource() {
  return readFileSync(componentPath, "utf8");
}

test("dashboard page renders DashboardEmployeeMovementsCard from summary", () => {
  assert.match(pageSource, /import \{ DashboardEmployeeMovementsCard \}/);
  assert.match(
    pageSource,
    /<DashboardEmployeeMovementsCard \{\.\.\.dashboardSummary\.employeeMovements\} \/>/,
  );
});

test("dashboard page does not import or render New Hires card", () => {
  assert.doesNotMatch(pageSource, /DashboardNewHiresMetricCard/);
  assert.doesNotMatch(pageSource, /dashboardSummary\.newHires/);
});

test("employee movements metric card is a client dialog component", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /"use client"/);
  assert.match(componentSource, /DialogTrigger asChild/);
  assert.match(componentSource, /type="button"/);
  assert.match(componentSource, /Employee Movements/);
});

test("card shows animated total and category breakdown counts", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /<AnimatedNumber value=\{total\} \/>/);
  assert.match(componentSource, /hired\.count/);
  assert.match(componentSource, /promoted\.count/);
  assert.match(componentSource, /separated\.count/);
});

test("modal uses accessible hired, promoted, and separated tabs", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /<Tabs[\s\S]*defaultValue="hired"/);
  assert.match(componentSource, /<TabsList/);
  assert.match(componentSource, /<TabsTrigger value="hired"/);
  assert.match(componentSource, /<TabsTrigger value="promoted"/);
  assert.match(componentSource, /<TabsTrigger value="separated"/);
  assert.match(componentSource, /<TabsContent value="hired"/);
  assert.match(componentSource, /<TabsContent value="promoted"/);
  assert.match(componentSource, /<TabsContent value="separated"/);
});

test("tab triggers show count badges and meet touch target height", () => {
  const componentSource = readComponentSource();
  assert.match(
    componentSource,
    /<TabsTrigger value="hired"[\s\S]*?\{hired\.count\}[\s\S]*?<\/TabsTrigger>/,
  );
  assert.match(
    componentSource,
    /<TabsTrigger value="promoted"[\s\S]*?\{promoted\.count\}[\s\S]*?<\/TabsTrigger>/,
  );
  assert.match(
    componentSource,
    /<TabsTrigger value="separated"[\s\S]*?\{separated\.count\}[\s\S]*?<\/TabsTrigger>/,
  );
  assert.match(componentSource, /min-h-11/);
});

test("empty states use exact category messages", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /No employees hired this month/);
  assert.match(componentSource, /No promotions this month/);
  assert.match(componentSource, /No separations this month/);
});

test("movement rows render profile fields, optional details, and href", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /employee\.name/);
  assert.match(componentSource, /employee\.office/);
  assert.match(componentSource, /employee\.position/);
  assert.match(componentSource, /employee\.dateLabel/);
  assert.match(componentSource, /employee\.details/);
  assert.match(componentSource, /href=\{employee\.href\}/);
  assert.doesNotMatch(
    componentSource,
    /employee\.details \? \([\s\S]*?<p className="[^"]*\btruncate\b[^"]*"/,
  );
});

test("movement list uses list semantics and capped scroll height", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /<ul[\s\S]*role="list"/);
  assert.match(componentSource, /max-h-\[55dvh\][\s\S]*overflow-y-auto/);
  assert.match(componentSource, /<li key=\{employee\.id\}>/);
});

test("card keeps indigo borders, equal-height trigger layout, and focus ring", () => {
  const componentSource = readComponentSource();
  assert.match(
    componentSource,
    /border-indigo-400\/80[\s\S]*dark:border-indigo-500\/50/,
  );
  assert.match(componentSource, /h-full w-full/);
  assert.match(componentSource, /Card[\s\S]*h-full/);
  assert.match(componentSource, /focus-visible:ring-indigo-500/);
});

test("dialog uses near-full mobile width and capped desktop height", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /w-\[calc\(100%_-_2rem\)\]/);
  assert.match(componentSource, /max-w-2xl/);
  assert.match(componentSource, /max-h-\[85dvh\]/);
  assert.match(componentSource, /sm:w-full/);
});

test("zero total still renders an active dialog trigger", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /DialogTrigger asChild/);
  assert.doesNotMatch(componentSource, /total === 0[\s\S]*disabled/);
});

test("movement list is built by a shared helper", () => {
  const componentSource = readComponentSource();
  assert.match(componentSource, /function MovementList/);
  assert.match(componentSource, /MovementList[\s\S]*rows/);
  assert.match(componentSource, /MovementList[\s\S]*emptyMessage/);
});
