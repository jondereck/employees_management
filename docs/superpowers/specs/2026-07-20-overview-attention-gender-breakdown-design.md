# Overview: Needs Attention loader + Gender breakdown

**Date:** 2026-07-20  
**Status:** Approved (user chose option B; proceed with trust)

## Goals

1. Needs Attention (and Incomplete Records Review) use the same universal loader overlay as MainNav when navigating away from Overview.
2. Male / Female Counts gain a second **Break down by…** control beside **Group by**, for a nested mini-report without dropdown-inside-dropdown.

## 1. Needs Attention navigation loader

### Current

`app/(dashboard)/[departmentId]/(routes)/page.tsx` renders Needs Attention rows and Incomplete Records as plain Next.js `<Link>`s — no loading overlay.

### Design

- Add client component `components/dashboard/dashboard-nav-link.tsx` (or `dashboard-attention-nav.tsx`) that mirrors MainNav:
  - `useRouter` + `usePathname` + local `loading` state
  - on click: `setLoading(true)` then `router.push(href)` when href differs from current path (pathname + search)
  - clear loading on pathname change
  - frost overlay + `<Loading />` from `app/loading`
- Server page keeps computing `attentionItems`; pass props into the client list.
- Wire the Incomplete Records count/Review link through the same client nav helper so Overview clickable cards share one pattern.

### Out of scope

- Zustand public-view loading store
- Changing destinations or counts

## 2. Male / Female Counts — Break down by (option B)

### Current

`DashboardGenderCounts` has one Select (**Group by**): Employee Type | Eligibility | Supervisory. Table is flat.

### UI

Two Selects side by side (stack on mobile):

| Control | Options | Default |
|---------|---------|---------|
| Group by | Employee Type, Eligibility Type, Supervisory Level | Employee Type |
| Break down by | None, plus the other two dimensions | None |

Rules:

- If Break down by equals Group by → treat as None (or omit that option from the second select).
- When Break down by is None → current flat table.
- When set → each primary row is expandable (chevron); children show nested M/F/Total; footer totals remain department-wide sums of primary rows.

Example: Group by = Employee Type, Break down by = Eligibility → “Casual” expands to eligibility sub-rows with male/female/total.

### Data

Extend `DashboardGenderCountRow`:

```ts
export type DashboardGenderCountRow = {
  id: string;
  name: string;
  male: number;
  female: number;
  total: number;
  children?: DashboardGenderCountRow[];
};
```

In `getDashboardSummary`, build nested children from `activeEmployees` (already has `employeeTypeId`, `eligibilityId`, `salaryGrade`, `gender`) for each primary dimension × each allowed nested dimension. Prefer one in-memory pass over new Prisma groupBys.

Pass the same three top-level arrays to the client; each row may already include `children` keyed by the selected breakdown, **or** pass a structure that lets the client pick the nested dimension.

**Chosen shape (simpler for UI):** return for each primary group three variants is wasteful. Instead return:

```ts
genderBreakdownMatrix: {
  // primaryKey -> nestedKey -> rows with children for that nest
}
```

**Practical approach:** Keep the three flat arrays for “None” mode. Add one nested payload:

```ts
genderCountsNested: {
  employeeType: {
    byEligibility: DashboardGenderCountRow[]; // each row has children = eligibility breakdown
    bySupervisory: DashboardGenderCountRow[];
  };
  eligibility: {
    byEmployeeType: DashboardGenderCountRow[];
    bySupervisory: DashboardGenderCountRow[];
  };
  supervisory: {
    byEmployeeType: DashboardGenderCountRow[];
    byEligibility: DashboardGenderCountRow[];
  };
}
```

Client picks `genderCountsNested[groupBy][breakDownBy]` when breakDownBy ≠ none; otherwise uses existing flat arrays.

### Out of scope

- Filtering the rest of the Overview charts
- Persisting Select choices to localStorage (nice-to-have later)
- Linking rows to employee list filters

## Testing

- Manual: click Needs Attention → overlay appears → destination loads; overlay clears.
- Manual: Group by / Break down by combinations show correct expandable rows; totals match flat totals when collapsed.
- `tsc` / lint clean for touched files.

## Changelog

Add Unreleased line when implemented.
