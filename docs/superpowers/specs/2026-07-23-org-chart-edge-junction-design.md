# Org Chart Mid-line Junction + Handle Visibility Design

## Goal

Make node connection handles clearer (black dots like the canvas screenshot) and allow dragging a connection onto an existing edge to create a T-junction.

## Approved approach

1. Larger, darker node handles on Top/Right/Bottom/Left.
2. Drop a connection onto an existing line → insert a small **junction** node at the drop point, split the original edge into two, and attach the new connection to the junction.

## Behavior

- Junction node: tiny circular node with handles; saved in chart versions.
- Split: edge A→B becomes A→junction and junction→B (preserve style/color/markers where practical).
- Invalid cases (self-connect, duplicate, cross-office when disabled) keep existing rules.
- Node handles: black filled circles, easier to grab; still source+target per side.

## Out of scope

- Auto-layout after junction insert
- Merging junctions back when degree drops to 2
