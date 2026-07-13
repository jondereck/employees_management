# Changelog

Tracks changes made to this project. Newest entries go at the top of **Unreleased**.
**Last updated: 2026-07-13**

## Unreleased

- 2026-07-13 — feat: make Annex 3-E HR Planning counts clickable with employee list drilldowns
- 2026-07-13 — feat: add Annex 3-E HR Planning tab (workforce profile + retirement forecast from employee DB; Excel export)
- 2026-07-13 — feat: add Table/Graphics toggle to L&D Summary Monitoring (KPI cards, indicator donut, coverage bar)
- 2026-07-13 — feat: L&D drag-and-drop training upload; registry search, column sort, and Excel-like filters
- 2026-07-13 — feat: make L&D Technical / Core / Leadership / Mandatory training counts clickable with record list modals
- 2026-07-13 — fix: L&D exclude-types filter now uses explicit include IDs, shows still-included types, and lists employee type in coverage modals
- 2026-07-13 — feat: make L&D "with training" / "no training" counts clickable with employee list modals
- 2026-07-13 — fix: L&D "No Training Intervention" uses eligible employees only (exclude terminated; skip archived on training links) and shows Eligible Employees in summary
- 2026-07-07 — feat: add name-fallback matching for training import (rescues rows with blank/wrong bio numbers) and "All years" toggle for L&D reports
- 2026-07-07 — feat: add exclude-employee-type filter, year refetch, drilldown modals, and centered numbers to Learning & Development tool
- 2026-07-07 — feat: add Learning & Development tool (training import by BIO number, Annex 6-G registry, Annex 6-H dashboard, Excel exports)
- 2026-07-07 — feat: add gender filtering and salary grade range to employee filters; implement bio password modal for editing bio numbers

## History (seeded from git log)

- 2026-07-01 — feat: refactor employee components to use Q39 classification display and improve filtering functionality
- 2026-06-30 — feat: implement workforce pivot CSC drilldown and summary endpoints
- 2026-06-30 — feat: remove supervisory data from dashboard summary and related components
- 2026-06-30 — feat: implement workforce pivot table tool with supervisory and gender analytics
- 2026-06-30 — feat: add gender count functionality to dashboard and enhance employee archiving with admin notes
- 2026-06-08 — feat: add employee preview functionality in CsvAttendanceImport component
- 2026-06-04 — feat: update OrgChartTool unsaved changes notification and save button styling
- 2026-06-04 — feat: enhance OrgChartTool with employee photo management and version handling improvements
- 2026-06-04 — feat: implement formula query tool for employee analytics with various metrics and filters
- 2026-06-03 — feat: optimize employee ID queue update using raw SQL for improved performance
- 2026-06-03 — feat: add ID queue support for employees with sorting and bulk actions
- 2026-06-03 — feat: adjust table column widths for improved layout in BioLogUploader
- 2026-06-03 — feat: update SummaryColumnSelector to indicate saving through Global template
- 2026-06-03 — feat: add grace minutes support to work schedule and evaluation options
- 2026-06-01 — feat: enhance OrgChartTool with cut selection functionality and keyboard shortcuts
- 2026-06-01 — feat: add tests for employee repositioning and connection preservation in org chart reconciliation
- 2026-06-01 — feat: implement department access control for org chart routes and reconciliation
- 2026-06-01 — feat: add nickname field to employee export data
- 2026-06-01 — feat: add support for CSS module declarations in TypeScript definitions
- 2026-06-01 — feat: implement pagination for office search results in OrgChartTool
- 2026-06-01 — refactor: improve UI components and responsiveness across employee and birthday sections
- 2026-05-28 — feat: enhance Genio tool with additional filters for employee queries and improve follow-up context handling
- 2026-05-28 — feat: enhance Genio tool with improved stats extraction and visualization
- 2026-05-26 — feat: add new HR analytics tools and enhance front-desk prompt handling
- 2026-05-26 — feat: Enhance Genio tool functionalities and context handling
- 2026-05-26 — feat: update dashboard layout and enhance donut chart component for improved data visualization
- 2026-05-26 — feat: add incomplete records section to dashboard with employee data validation
- 2026-05-26 — feat: enhance dashboard functionality with new analytics and summary features
- 2026-05-26 — feat: update PopoverContent and Tabs layout in Notifications component for better responsiveness

*(Full history before this point: see `git log`.)*
