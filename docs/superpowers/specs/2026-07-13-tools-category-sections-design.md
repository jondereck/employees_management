# Tools landing page — category sections

**Date:** 2026-07-13  
**Status:** Approved  
**Approach:** Option A — single page with category sections

## Goal

Reorganize the Tools landing page so ~14 tools are easier to scan, without changing routes or access rules.

## Layout

- Keep existing card visual style and `ToolNavigationLink` behavior.
- Render tools under section headings (title + optional short subtitle).
- Within each section, use the same responsive card grid as today.
- Hide an entire section if the user has access to none of its tools.
- Preserve `extractToolAccess` filtering per card.
- Preserve SG Range cookie query string behavior.

## Sections (order)

1. **Attendance & Timekeeping** — Timekeeping Analyzer, Attendance Exception Registry, Event Attendance Import, Holidays  
2. **Workforce & Reports** — Workforce History, Workforce Pivot Table, SG Range Analytics, Org Chart Builder  
3. **Learning & Development** — Learning & Development  
4. **Communication & Approvals** — Text Blast, Approval Center  
5. **Settings & Utilities** — Covers, Copy Options, Backup & Restore  

## Out of scope

- Tabs, search, favorites/pins  
- Tool renames, new routes, permission model changes  

## Implementation

- Update `app/(dashboard)/[departmentId]/(routes)/tools/page.tsx` to map tools into sections and render sectioned UI.
- Changelog entry under Unreleased.
