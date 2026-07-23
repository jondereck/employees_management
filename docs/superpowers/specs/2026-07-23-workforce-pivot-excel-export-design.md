# Workforce Pivot Excel Export Design

## Goal

Add a **Download Excel** button on Matrix Pivot that exports a formatted `.xlsx` matching the table currently on screen (including nested Office × Employee Type × Gender layouts).

## Decisions

- Client-side export from the current Matrix `result` (no re-query).
- Matrix mode only; CSC Report unchanged.
- Use `xlsx-js-style` (same stack as Office Workforce export).

## Behavior

- Button lives on the Matrix result card header/actions.
- Enabled only when Matrix mode has a non-empty `result`.
- Disabled while the matrix query is loading.
- Export uses the exact current `result` + selected row/column field labels (what the user sees after filters).

## Excel layout

1. Title row: e.g. `Office + Employee Type × Gender`
2. Meta row: `Generated: <locale timestamp>` and matched employee count
3. Header row: same columns as the UI
   - Nested: primary | secondary | each col | Total
   - Single: row field | each col | Total
4. Body rows: same values as the on-screen matrix
   - Nested: primary label blank-repeated after first row in a group (matches UI)
5. Footer Total row: column totals + grand total

## Formatting

- Bold title, headers, and Total row
- Thin borders on data cells
- Numeric columns right-aligned / tabular
- Reasonable column widths

## Filename

`Workforce_Pivot_<RowLabels>_x_<ColLabel>_YYYY-MM-DD.xlsx`  
(sanitize spaces to underscores; nested rows joined with `+`)

## Implementation shape

- Pure builder in e.g. `lib/workforce-pivot-export.ts` (AOA + style application + filename helper)
- Thin UI wiring in `WorkforcePivotTool.tsx`
- Unit tests for nested vs single-row sheet content and filename

## Out of scope

- CSC Excel export
- Server-side export endpoint
- PDF / print
