export type GuideBounds = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type SpacingGuide = {
  axis: "x" | "y";
  from: number;
  to: number;
  cross: number;
  gap: number;
};

export type DragGuidesResult = {
  vertical: number | null;
  horizontal: number | null;
  snapX: number | null;
  snapY: number | null;
  spacings: SpacingGuide[];
};

type Options = {
  alignThreshold?: number;
  equalSpacingThreshold?: number;
  measureMaxGap?: number;
};

type SideHit = { gap: number; edge: number; peerEdge: number; cross: number };

/**
 * Compute alignment + spacing guides while dragging a node.
 * Snap priority: equal spacing > center/edge align > free (measure labels only).
 */
export function computeDragGuides(
  dragged: GuideBounds,
  others: GuideBounds[],
  options: Options = {}
): DragGuidesResult {
  const alignThreshold = options.alignThreshold ?? 8;
  const equalSpacingThreshold = options.equalSpacingThreshold ?? 8;
  const measureMaxGap = options.measureMaxGap ?? 48;

  let vertical: number | null = null;
  let horizontal: number | null = null;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let bestV = alignThreshold;
  let bestH = alignThreshold;

  for (const target of others) {
    const verticalCandidates = [
      {
        guide: target.centerX,
        distance: Math.abs(dragged.centerX - target.centerX),
        snap: target.centerX - dragged.width / 2,
      },
      { guide: target.left, distance: Math.abs(dragged.left - target.left), snap: target.left },
      {
        guide: target.right,
        distance: Math.abs(dragged.right - target.right),
        snap: target.right - dragged.width,
      },
      {
        guide: target.left,
        distance: Math.abs(dragged.right - target.left),
        snap: target.left - dragged.width,
      },
      { guide: target.right, distance: Math.abs(dragged.left - target.right), snap: target.right },
    ];
    for (const candidate of verticalCandidates) {
      if (candidate.distance <= bestV) {
        bestV = candidate.distance;
        vertical = candidate.guide;
        snapX = candidate.snap;
      }
    }

    const horizontalCandidates = [
      {
        guide: target.centerY,
        distance: Math.abs(dragged.centerY - target.centerY),
        snap: target.centerY - dragged.height / 2,
      },
      { guide: target.top, distance: Math.abs(dragged.top - target.top), snap: target.top },
      {
        guide: target.bottom,
        distance: Math.abs(dragged.bottom - target.bottom),
        snap: target.bottom - dragged.height,
      },
      {
        guide: target.top,
        distance: Math.abs(dragged.bottom - target.top),
        snap: target.top - dragged.height,
      },
      {
        guide: target.bottom,
        distance: Math.abs(dragged.top - target.bottom),
        snap: target.bottom,
      },
    ];
    for (const candidate of horizontalCandidates) {
      if (candidate.distance <= bestH) {
        bestH = candidate.distance;
        horizontal = candidate.guide;
        snapY = candidate.snap;
      }
    }
  }

  let leftHit: SideHit | null = null;
  let rightHit: SideHit | null = null;
  let topHit: SideHit | null = null;
  let bottomHit: SideHit | null = null;

  for (const peer of others) {
    const overlapY = Math.min(dragged.bottom, peer.bottom) - Math.max(dragged.top, peer.top);
    const overlapX = Math.min(dragged.right, peer.right) - Math.max(dragged.left, peer.left);
    const crossY =
      overlapY > 0
        ? (Math.max(dragged.top, peer.top) + Math.min(dragged.bottom, peer.bottom)) / 2
        : dragged.centerY;
    const crossX =
      overlapX > 0
        ? (Math.max(dragged.left, peer.left) + Math.min(dragged.right, peer.right)) / 2
        : dragged.centerX;

    if (overlapY > 0) {
      const gapL = dragged.left - peer.right;
      if (gapL > 0 && (!leftHit || gapL < leftHit.gap)) {
        leftHit = { gap: gapL, edge: dragged.left, peerEdge: peer.right, cross: crossY };
      }
      const gapR = peer.left - dragged.right;
      if (gapR > 0 && (!rightHit || gapR < rightHit.gap)) {
        rightHit = { gap: gapR, edge: dragged.right, peerEdge: peer.left, cross: crossY };
      }
    }

    if (overlapX > 0) {
      const gapT = dragged.top - peer.bottom;
      if (gapT > 0 && (!topHit || gapT < topHit.gap)) {
        topHit = { gap: gapT, edge: dragged.top, peerEdge: peer.bottom, cross: crossX };
      }
      const gapB = peer.top - dragged.bottom;
      if (gapB > 0 && (!bottomHit || gapB < bottomHit.gap)) {
        bottomHit = { gap: gapB, edge: dragged.bottom, peerEdge: peer.top, cross: crossX };
      }
    }
  }

  const spacings: SpacingGuide[] = [];

  if (leftHit && rightHit && Math.abs(leftHit.gap - rightHit.gap) <= equalSpacingThreshold) {
    const available = rightHit.peerEdge - leftHit.peerEdge;
    const equalGap = (available - dragged.width) / 2;
    snapX = leftHit.peerEdge + equalGap;
    const gap = Math.round(equalGap);
    spacings.push(
      {
        axis: "x",
        from: leftHit.peerEdge,
        to: leftHit.peerEdge + equalGap,
        cross: leftHit.cross,
        gap,
      },
      {
        axis: "x",
        from: snapX + dragged.width,
        to: rightHit.peerEdge,
        cross: rightHit.cross,
        gap,
      }
    );
  } else {
    const nearestX = [leftHit, rightHit]
      .filter((hit): hit is SideHit => Boolean(hit))
      .sort((a, b) => a.gap - b.gap)[0];
    if (nearestX && nearestX.gap <= measureMaxGap) {
      spacings.push({
        axis: "x",
        from: Math.min(nearestX.edge, nearestX.peerEdge),
        to: Math.max(nearestX.edge, nearestX.peerEdge),
        cross: nearestX.cross,
        gap: Math.round(nearestX.gap),
      });
    }
  }

  if (topHit && bottomHit && Math.abs(topHit.gap - bottomHit.gap) <= equalSpacingThreshold) {
    const available = bottomHit.peerEdge - topHit.peerEdge;
    const equalGap = (available - dragged.height) / 2;
    snapY = topHit.peerEdge + equalGap;
    const gap = Math.round(equalGap);
    spacings.push(
      {
        axis: "y",
        from: topHit.peerEdge,
        to: topHit.peerEdge + equalGap,
        cross: topHit.cross,
        gap,
      },
      {
        axis: "y",
        from: snapY + dragged.height,
        to: bottomHit.peerEdge,
        cross: bottomHit.cross,
        gap,
      }
    );
  } else {
    const nearestY = [topHit, bottomHit]
      .filter((hit): hit is SideHit => Boolean(hit))
      .sort((a, b) => a.gap - b.gap)[0];
    if (nearestY && nearestY.gap <= measureMaxGap) {
      spacings.push({
        axis: "y",
        from: Math.min(nearestY.edge, nearestY.peerEdge),
        to: Math.max(nearestY.edge, nearestY.peerEdge),
        cross: nearestY.cross,
        gap: Math.round(nearestY.gap),
      });
    }
  }

  return { vertical, horizontal, snapX, snapY, spacings };
}
