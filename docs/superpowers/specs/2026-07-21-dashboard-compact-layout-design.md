# Dashboard Compact Layout Design

## Goal

Remove the large unused area beside Workforce Composition and shorten the dashboard page while preserving all current information and navigation.

## Approved layout

Use the approved **Option A — Stacked right rail**:

1. Keep the four top metric cards unchanged on desktop; display them as a compact two-column grid on mobile.
2. Keep Workforce Composition as the wide left column.
3. Stack Needs Attention and Incomplete Records in the narrower right column.
4. Move Employees With Missing Data below that two-column section as one full-width compact card.
5. Keep Workforce Analytics full-width at the bottom.

At desktop width, the primary section remains approximately two-thirds composition and one-third right rail. Below the desktop breakpoint, all cards stack in a clear reading order:

1. Workforce Composition
2. Needs Attention
3. Incomplete Records
4. Employees With Missing Data
5. Workforce Analytics

## Mobile composition

- Display the four metric cards in two columns so they occupy two rows instead of four.
- Show one Workforce Composition donut at a time using three visible tabs: Appointment, Gender, and Eligibility.
- Default to Appointment.
- Keep the detailed Male / Female Counts section collapsed on mobile behind a `View detailed breakdown` control.
- Preserve the current desktop presentation: all three donuts and the detailed counts table remain visible together.
- Keep the existing sticky top navbar and mobile sidebar. Do not add the bottom navigation shown in the conceptual phone frame because it would duplicate the application's global navigation.

## Missing-data card

- Remove the current fixed-height scroll area.
- Show at most six employee records on desktop and tablet in a responsive grid:
  - three columns on wide screens;
  - two columns on medium screens;
  - one column on mobile.
- Hide the last two preview records on small mobile screens, showing four records there.
- Add a visible `View all {count}` link to the Employees page.
- Each preview retains employee name, missing-field summary, missing count, hover state, focus state, and employee-detail link.
- If there are no incomplete records, keep the existing empty-state message.

This changes only the dashboard preview. It does not delete or truncate source data.

## Right rail

- Needs Attention keeps all five reminder rows.
- Incomplete Records keeps the total, Review link, and per-field counts.
- Use a vertical gap consistent with the dashboard's 4/8-point spacing system.
- Do not force either card to the full height of Workforce Composition individually. Their combined natural height forms the right rail and removes the current single-card dead area.

## Visual and accessibility requirements

- Preserve the current glass cards, rounded corners, borders, dark mode, typography, and semantic colors.
- Keep all links keyboard focusable with visible focus rings.
- Do not communicate missing-data severity through color alone; retain labels and numeric counts.
- Do not introduce nested scrolling in the dashboard content.
- Avoid horizontal scrolling at all supported breakpoints.

## Data and behavior

No API or database changes are required. Continue using `dashboardSummary.incompleteRecords.employees`, but derive the dashboard preview with `slice(0, 6)`. The `View all` destination is `/{departmentId}/employees`.

Create a focused client-side Workforce Composition component that receives the existing chart slices and gender-count props. It owns only the selected mobile chart tab and mobile details disclosure state. No data is fetched on the client.

## Tests and verification

- Add source-level layout contract tests confirming:
  - Needs Attention and Incomplete Records share the right-rail container;
  - the missing-data preview uses `slice(0, 6)`;
  - the old `max-h-[320px]` scroll container is removed;
  - the full count appears in the `View all` link;
  - Workforce Analytics remains after the compact missing-data card.
- Add component behavior tests or source contracts confirming:
  - the mobile metric grid has two columns;
  - Appointment, Gender, and Eligibility tabs are present;
  - Appointment is the default mobile chart;
  - the detailed breakdown is collapsed by default on mobile;
  - the desktop three-chart layout remains available.
- Run the feature tests, complete test suite, TypeScript, and lint.
- Visually verify desktop and mobile-width layouts against the approved Option A mockup.

## Out of scope

- Redesigning chart internals or dashboard metrics.
- Changing the global navbar or mobile sidebar.
- Filtering the Employees page automatically after `View all`.
- Adding pagination, client fetching, or new dashboard APIs.
- Removing any Needs Attention or incomplete-record data.
