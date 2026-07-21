import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSource = readFileSync(
  "components/dashboard/dashboard-workforce-composition.tsx",
  "utf8",
);
const pageSource = readFileSync(
  "app/(dashboard)/[departmentId]/(routes)/page.tsx",
  "utf8",
);

test("defaults active chart to appointment", () => {
  assert.match(
    componentSource,
    /useState<CompositionChart>\("appointment"\)/,
  );
});

test("exposes mobile chart toggles with appointment, gender, and eligibility labels", () => {
  assert.match(componentSource, /Appointment/);
  assert.match(componentSource, /Gender/);
  assert.match(componentSource, /Eligibility/);
  assert.match(componentSource, /lg:hidden/);
});

test("uses accessible toggle buttons with aria-pressed and aria-controls", () => {
  assert.match(componentSource, /id=\{`composition-tab-\$\{chart\.key\}`\}/);
  assert.match(
    componentSource,
    /aria-controls=\{`composition-panel-\$\{chart\.key\}`\}/,
  );
  assert.match(
    componentSource,
    /id=\{`composition-panel-\$\{chart\.key\}`\}/,
  );
  assert.match(
    componentSource,
    /aria-pressed=\{activeChart === chart\.key\}/,
  );
  assert.doesNotMatch(componentSource, /role="tablist"/);
  assert.doesNotMatch(componentSource, /role="tab"/);
  assert.doesNotMatch(componentSource, /role="tabpanel"/);
  assert.doesNotMatch(componentSource, /aria-selected=/);
  assert.doesNotMatch(componentSource, /aria-labelledby=/);
  assert.doesNotMatch(
    componentSource,
    /tabIndex=\{activeChart === chart\.key \? 0 : -1\}/,
  );
});

test("keeps desktop three-column layout", () => {
  assert.match(componentSource, /lg:grid-cols-3/);
  assert.match(
    componentSource,
    /className="mx-auto grid w-full gap-3 lg:grid-cols-3"/,
  );
});

test("toggles mobile chart visibility via activeChart and hidden lg:block", () => {
  assert.match(componentSource, /activeChart/);
  assert.match(componentSource, /hidden lg:block/);
});

test("collapses mobile detailed breakdown with accessible disclosure", () => {
  assert.match(componentSource, /useState\(false\)/);
  assert.match(componentSource, /aria-expanded=\{detailsOpen\}/);
  assert.match(componentSource, /aria-controls="workforce-gender-counts"/);
  assert.match(componentSource, /id="workforce-gender-counts"/);
  assert.match(componentSource, /View detailed breakdown/);
  assert.match(componentSource, /Hide detailed breakdown/);
  assert.match(componentSource, /detailsOpen && "rotate-180"/);
  assert.match(componentSource, /!detailsOpen && "hidden lg:block"/);
});

test("returns one internal spacing container", () => {
  assert.match(componentSource, /return \(\s*<div className="space-y-4">/);
});

test("page renders DashboardWorkforceComposition instead of direct chart components", () => {
  assert.match(pageSource, /<DashboardWorkforceComposition/);
  assert.doesNotMatch(pageSource, /<DashboardDonutChart/);
  assert.doesNotMatch(pageSource, /<DashboardGenderCounts/);
});
