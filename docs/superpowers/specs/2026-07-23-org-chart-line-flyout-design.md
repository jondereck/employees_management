# Org Chart Connect Line Flyout Design

## Goal

Lucidchart-style flyout on the canvas icon-rail Connect button for picking line style.

## Approved

- Click Connect → flyout to the right with: Straight line, Elbow line, Bendy line
- Selection sets default style for new connections and enters Connect mode
- Does not rewrite all existing edges (top-bar Connector style still can)
- Available in normal + fullscreen (same rail)

## Mapping

| Flyout | App `edgeType` |
|--------|----------------|
| Straight line | `straight` |
| Elbow line | `orth` |
| Bendy line | `smoothstep` |
