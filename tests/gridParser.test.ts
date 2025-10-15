import { strict as assert } from "node:assert";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  detectGridEmployeeBlocks,
  detectGridHeaderRow,
  extractGridTimes,
  mergeParsedWorkbooks,
  parseBioAttendance,
} from "../utils/parseBioAttendance";

const buildSampleRows = () => {
  const headerRow: unknown[] = new Array(10).fill("");
  for (let day = 1; day <= 20; day += 1) {
    headerRow.push(String(day));
  }

  const blockRow1: unknown[] = [
    "ID:",
    "2050025",
    "",
    "Name:",
    "RAMON REYES",
    "",
    "Dept:",
    "RHU 1",
  ];
  while (blockRow1.length < 10) blockRow1.push("");
  blockRow1.push("06:39", "17:05");
  while (blockRow1.length < headerRow.length) blockRow1.push("");

  const blockRow2: unknown[] = new Array(blockRow1.length).fill("");
  blockRow2[10] = "12:00";

  return [
    ["", "", "", "", "March 2024"],
    new Array(headerRow.length).fill(""),
    headerRow,
    blockRow1,
    blockRow2,
  ];
};

const buildWorkbook = () => {
  const rows = buildSampleRows();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance Record Report");
  return { workbook, rows };
};

test("detectGridHeaderRow finds grid header and blocks", () => {
  const { rows } = buildWorkbook();
  const detection = detectGridHeaderRow(rows);
  assert.ok(detection, "expected detection to succeed");
  assert.equal(detection.dayColumns.length, 20);
  const blocks = detectGridEmployeeBlocks(rows, detection.headerRowIndex);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.startRow, 3);
});

test("extractGridTimes handles compact strings", () => {
  const times = extractGridTimes("06:3912:0012:1617:01");
  assert.deepEqual(times, ["06:39", "12:00", "12:16", "17:01"]);
});

test("parseBioAttendance parses grid workbook", () => {
  const { workbook } = buildWorkbook();
  const parsed = parseBioAttendance(workbook, { fileName: "sample.xlsx" });
  assert.deepEqual(parsed.parserTypes, ["grid-report"]);
  assert.equal(parsed.employeeCount, 1);
  assert.equal(parsed.totalPunches, 3);
  const day1 = parsed.days.find((day) => day.day === 1);
  assert.ok(day1);
  assert.equal(day1?.employeeDept, "RHU 1");
  assert.equal(day1?.parserType, "grid-report");
  assert.deepEqual(
    day1?.punches.map((punch) => punch.time),
    ["06:39", "12:00"]
  );
});

test("mergeParsedWorkbooks deduplicates punches from grid reports", () => {
  const { workbook } = buildWorkbook();
  const first = parseBioAttendance(workbook, { fileName: "first.xlsx" });
  const second = parseBioAttendance(workbook, { fileName: "second.xlsx" });
  const merged = mergeParsedWorkbooks([first, second]);
  assert.equal(merged.mergedDuplicates > 0, true);
  const firstDay = merged.perDay[0];
  assert.ok(firstDay);
  assert.equal(firstDay.parserType, "grid-report");
  assert.deepEqual(firstDay.allTimes.slice(0, 2), ["06:39", "12:00"]);
});
