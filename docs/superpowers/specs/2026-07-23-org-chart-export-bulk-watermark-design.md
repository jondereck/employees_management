# Org Chart Export Polish + Bulk PDF Design

## Goal

Cleaner exports: hide editor handles/junction dots, add a subtle department logo watermark, and allow bulk multi-office PDF from the current open chart version.

## Approved decisions

- Approach: CSS export mode + client-side PDF merge (no offscreen renderer / no server PDF).
- Bulk source: **current open version**, filter nodes per selected office, one page per office.
- Hide on export: React Flow handles, edge midpoint dots, junction node visuals (keep connecting lines).
- Watermark: department `logoUrl` from settings (fallback `/logo.png`), low opacity, corner or center-back.

## Behavior

### Single export (PNG/PDF)
1. Enter `orgchart-exporting` class.
2. Hide handles / midpoint dots / junction nodes via CSS (+ export ignore attrs where needed).
3. Overlay subtle watermark using department logo.
4. Capture with existing `html-to-image` flow; PDF embeds PNG as today.

### Bulk PDF
1. Dialog lists offices present in the current chart; multi-select.
2. For each selected office: focus/filter that office (existing focus), fit view, capture page image with watermark, add PDF page.
3. Restore previous focus/viewport; download merged PDF.

## Files

- `components/tools/org-chart/OrgChartTool.tsx` (export CSS, watermark, bulk dialog)
- Possibly small dialog component under `components/tools/org-chart/dialogs/`
- Fetch logo via existing department API or page prop

## Out of scope

- Server-side rendering
- Bulk PNG zip
- Changing Sync/version logic
