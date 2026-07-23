# Org Chart Fixed Card + Auto-fit Text Design

## Goal

Make office/unit/person nodes visually even: one fixed size per type, full text visible (no ellipsis), font auto-shrinks to fit.

## Approved

- Option C: fixed card size; shrink typography to show full name/title/type.
- No ellipsis truncation.
- Icon + text vertically centered in the card.

## Spec

- Person card: 260×100px
- Office / unit card: 260×76px
- Text column autofits (step down font from max → min) until content fits width/height
- Min font floor so text stays readable (~9–10px)
- React Flow node `width`/`height` aligned to card size for connection math
- Annotations / junctions unchanged

## Out of scope

- Manual per-node resize
- Different sizes per office
