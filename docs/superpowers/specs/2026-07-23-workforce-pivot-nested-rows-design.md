# Workforce Pivot Nested Rows Design

## Goal

Extend Matrix Pivot so users can build reports like **Office × Employee Type × Gender**: up to two nested row dimensions, one column dimension, with optional Office filtering. Counts only (no Matrix drilldown).

## Decisions

- Approach: extend the existing Matrix Pivot API and UI (not a new mode/endpoint).
- Flexible nested rows (up to 2 row fields + 1 column field).
- Optional Office multi-select filter (All offices by default).
- CSC Report mode unchanged.

## Pivot fields

`office` | `employeeType` | `eligibility` | `supervisory` | `gender`

`office` is derived from each employee’s current `officeId` / office name.

## API

**Endpoint:** `POST /api/[departmentId]/analytics/workforce-pivot`

### Request

| Field | Type | Notes |
| --- | --- | --- |
| `rowFields` | `string[]` | Length 1–2; valid pivot fields; all distinct |
| `colField` | `string` | Valid pivot field; must not appear in `rowFields` |
| `employeeTypeIds` | `string[]` | Optional filter (existing) |
| `eligibilityIds` | `string[]` | Optional filter (existing) |
| `officeIds` | `string[]` | Optional filter (new) |
| `rowField` | `string` | Legacy; if present and `rowFields` absent, treat as `rowFields: [rowField]` |

### Validation (400)

- Invalid or empty `rowFields` / `colField`
- `rowFields` length outside 1–2
- Duplicate fields within `rowFields`
- `colField` overlaps a row field

### Response

| Field | Notes |
| --- | --- |
| `rowFields` | Echo of resolved row fields |
| `colField` | Echo of column field |
| `rows` | Flat leaf rows (see shape below) |
| `cols` | Column tags |
| `matrix` | `number[][]` — counts per leaf row × col |
| `rowTotals` | Per leaf row |
| `colTotals` | Per column |
| `grandTotal` | Sum of all matched employees |
| `generatedAt` | ISO timestamp |

**Row shape**

- Always: `key`, `name`
- When 2 row fields: also `groupKey`, `groupLabel` (primary), `leafKey`, `leafLabel` (secondary)
- When 1 row field: no group fields; `key`/`name` are the single dimension (same UX as today)

**Counting rules**

- Include non-archived employees in the department.
- Apply optional filters before aggregation.
- Emit only combinations with count ≥ 1.
- Sort: office / employeeType / eligibility by name; supervisory and gender keep fixed order.
- Nested: sort by primary, then secondary within each group.

## UI (Matrix mode)

### Controls

- **Rows (primary)** — dropdown including Office.
- **Rows (secondary)** — optional; default **None**; cannot equal primary or column field.
- **Columns** — cannot equal either row field.
- **Office filter** — multi-select, same pattern as Employee Type / Eligibility; default All.
- Auto-run debounce and Reset include secondary row + office filter.

### Table

- **1 row field:** single label column (unchanged look).
- **2 row fields:** two label columns (e.g. Office | Employee Type | Male | Female | Total). Primary label shown once per group (rowspan or blank repeats); leaf values in the second column.
- Title reflects nesting, e.g. `Office + Employee Type × Gender`.

## Out of scope

- Matrix cell drilldown / employee name list
- More than 2 row fields or nested columns
- CSC report changes
- Export / print

## Testing

- Office as a single row field × gender
- Nested `office` + `employeeType` × `gender`
- Optional `officeIds` filter narrows results
- Legacy `rowField` still works
- Reject overlapping / invalid field combinations
