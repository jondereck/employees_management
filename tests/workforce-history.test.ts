import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKFORCE_DEFAULT_INDICATORS,
  suggestWorkforceIndicator,
} from "../lib/workforce-history";

test("uses the fixed canonical workforce indicator labels", () => {
  assert.deepEqual(WORKFORCE_DEFAULT_INDICATORS, [
    "Clerical Services",
    "Health, Nutrition and Population Control",
    "IT Services",
    "Janitorial Services",
    "Security Services",
    "Social Services and Social Welfare",
    "Technical",
    "Trade and Crafts/Laborer",
    "Others",
  ]);
});

test("maps teacher and education roles into social services and social welfare", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Teacher I",
    officeName: "Day Care Center",
    employeeTypeName: "Permanent",
  });

  assert.equal(suggestion.indicatorName, "Social Services and Social Welfare");
});

test("maps trade roles into trade and crafts/laborer", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Driver II",
    officeName: "Engineering Office",
    employeeTypeName: "Casual",
  });

  assert.equal(suggestion.indicatorName, "Trade and Crafts/Laborer");
});

test("maps health roles into health, nutrition and population control", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Nurse II",
    officeName: "Rural Health Unit",
    employeeTypeName: "Permanent",
  });

  assert.equal(suggestion.indicatorName, "Health, Nutrition and Population Control");
});

test("falls back to others when no strong keyword matches", () => {
  const suggestion = suggestWorkforceIndicator({
    position: "Protocol Officer",
    officeName: "Mayor's Office",
    employeeTypeName: "Contract of Service",
  });

  assert.equal(suggestion.indicatorName, "Others");
  assert.equal(suggestion.confidence, "low");
});
