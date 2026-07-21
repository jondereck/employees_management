# Position Summary Totals and Vacancy Highlight

## Scope

Improve the Office Workforce Position Summary tab and its Authorized Positions
Excel sheet without changing the underlying plantilla grouping.

## Table design

- Keep the existing Office, Authorized Position, Employment Status, Total
  Authorized, Filled, and Vacant columns.
- Give every data row whose Vacant count is greater than zero a light-green
  background and use darker green text for its Vacant count.
- Keep rows with zero vacancies in the default table style.
- Add a bold TOTAL row after all visible data rows.
- Calculate TOTAL from the currently filtered Position Summary rows so it stays
  consistent with the active workforce filter.

## Excel design

- Add a final TOTAL row to the Authorized Positions sheet.
- Sum Total Authorized, Filled, and Vacant across all exported rows.
- Style the TOTAL row distinctly and apply a light-green fill to exported rows
  with vacancies.

## Testing

- Unit-test aggregate total-row generation, including an empty data set.
- Verify focused Office Workforce tests, TypeScript, and lint.
