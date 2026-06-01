import type { OrgChartDocument, OrgChartEdge, OrgChartNode } from "@/types/orgChart";

const getOfficeKey = (node: OrgChartNode): string | null => {
  if (node.type !== "office") return null;
  return node.data.officeId ?? node.id;
};

const getEmployeeKey = (node: OrgChartNode): string | null => {
  if (node.type !== "person") return null;
  return node.data.employeeId ?? null;
};

const copyNode = (node: OrgChartNode): OrgChartNode => ({
  ...node,
  position: { ...node.position },
  data: { ...node.data },
});

const copyEdge = (edge: OrgChartEdge): OrgChartEdge => ({ ...edge });

const edgeKey = (edge: OrgChartEdge): string =>
  [
    edge.source,
    edge.target,
    edge.sourceHandle ?? "",
    edge.targetHandle ?? "",
  ].join("|");

const createUniqueEdgeId = (preferredId: string, usedIds: Set<string>): string => {
  if (!usedIds.has(preferredId)) return preferredId;
  let suffix = 2;
  while (usedIds.has(`${preferredId}-${suffix}`)) {
    suffix += 1;
  }
  return `${preferredId}-${suffix}`;
};

export function reconcileOrgChartDocument(
  current: OrgChartDocument,
  latest: OrgChartDocument,
  options?: {
    scopeOfficeId?: string | null;
    preserveConnections?: boolean;
    placeNewEmployeesNearOfficeCluster?: boolean;
  }
): OrgChartDocument {
  const scopeOfficeId = options?.scopeOfficeId ?? null;
  const preserveConnections = options?.preserveConnections ?? false;
  const placeNewEmployeesNearOfficeCluster = options?.placeNewEmployeesNearOfficeCluster ?? false;
  const currentConnectedNodeIds = new Set(
    current.edges.flatMap((edge) => [edge.source, edge.target])
  );
  const latestOffices = latest.nodes.filter((node) => node.type === "office");
  const latestEmployees = latest.nodes.filter((node) => getEmployeeKey(node));
  const scopedLatestEmployees = scopeOfficeId
    ? latestEmployees.filter((node) => node.data.officeId === scopeOfficeId)
    : latestEmployees;
  const scopedEmployeeKeys = new Set(
    scopedLatestEmployees.map((node) => getEmployeeKey(node) as string)
  );
  if (scopeOfficeId) {
    for (const node of current.nodes) {
      if (node.type !== "person") continue;
      const employeeKey = getEmployeeKey(node);
      if (!employeeKey) continue;
      if (node.data.officeId === scopeOfficeId) {
        scopedEmployeeKeys.add(employeeKey);
      }
    }
  }
  const latestOfficeByKey = new Map(
    latestOffices
      .map((node) => [getOfficeKey(node), node] as const)
      .filter((entry): entry is readonly [string, OrgChartNode] => Boolean(entry[0]))
  );
  const latestEmployeeByKey = new Map(
    scopedLatestEmployees.map((node) => [getEmployeeKey(node) as string, node])
  );

  const resultNodes: OrgChartNode[] = [];
  const replacementNodeIds = new Map<string, string>();
  const resultOfficeIdByKey = new Map<string, string>();
  const resultEmployeeIdByKey = new Map<string, string>();
  const movedEmployeeNodeIds = new Set<string>();

  for (const node of current.nodes) {
    const officeKey = getOfficeKey(node);
    if (officeKey) {
      if (scopeOfficeId && officeKey !== scopeOfficeId) {
        const preserved = copyNode(node);
        resultNodes.push(preserved);
        resultOfficeIdByKey.set(officeKey, preserved.id);
        continue;
      }
      const freshOffice = latestOfficeByKey.get(officeKey);
      const merged = freshOffice
        ? {
            ...copyNode(node),
            data: { ...node.data, ...freshOffice.data },
          }
        : copyNode(node);
      resultNodes.push(merged);
      resultOfficeIdByKey.set(officeKey, merged.id);
      continue;
    }

    const employeeKey = getEmployeeKey(node);
    if (!employeeKey) {
      resultNodes.push(copyNode(node));
      continue;
    }
    if (scopeOfficeId && !scopedEmployeeKeys.has(employeeKey)) {
      resultNodes.push(copyNode(node));
      resultEmployeeIdByKey.set(employeeKey, node.id);
      continue;
    }

    const freshEmployee = latestEmployeeByKey.get(employeeKey);
    if (!freshEmployee) {
      continue;
    }

    const retainedNodeId = resultEmployeeIdByKey.get(employeeKey);
    if (retainedNodeId) {
      replacementNodeIds.set(node.id, retainedNodeId);
      continue;
    }

    const merged = {
      ...copyNode(node),
      data: { ...node.data, ...freshEmployee.data },
    };
    if (node.data.officeId !== freshEmployee.data.officeId) {
      movedEmployeeNodeIds.add(merged.id);
    }
    resultNodes.push(merged);
    resultEmployeeIdByKey.set(employeeKey, merged.id);
  }

  for (const office of latestOffices) {
    const officeKey = getOfficeKey(office);
    if (scopeOfficeId && officeKey !== scopeOfficeId) continue;
    if (!officeKey || resultOfficeIdByKey.has(officeKey)) continue;
    const copied = copyNode(office);
    resultNodes.push(copied);
    resultOfficeIdByKey.set(officeKey, copied.id);
  }

  // Align newly added employees to the current office position if the office was manually moved.
  const officePositionDeltaByKey = new Map<string, { dx: number; dy: number }>();
  for (const [officeKey, latestOfficeNode] of latestOfficeByKey) {
    const resultOfficeId = resultOfficeIdByKey.get(officeKey);
    if (!resultOfficeId) continue;
    const resultOfficeNode = resultNodes.find((node) => node.id === resultOfficeId);
    if (!resultOfficeNode) continue;
    officePositionDeltaByKey.set(officeKey, {
      dx: resultOfficeNode.position.x - latestOfficeNode.position.x,
      dy: resultOfficeNode.position.y - latestOfficeNode.position.y,
    });
  }
  const existingNodePositionsByOffice = new Map<string, Array<{ x: number; y: number }>>();
  for (const node of resultNodes) {
    const officeId = node.data.officeId ?? (node.type === "office" ? getOfficeKey(node) : null);
    if (!officeId) continue;
    const isDetachedDbEmployee =
      node.type === "person" &&
      Boolean(node.data.employeeId) &&
      !currentConnectedNodeIds.has(node.id);
    if (isDetachedDbEmployee) continue;
    const positions = existingNodePositionsByOffice.get(officeId) ?? [];
    positions.push(node.position);
    existingNodePositionsByOffice.set(officeId, positions);
  }
  const addedEmployeeCountByOffice = new Map<string, number>();
  const getNextClusterPosition = (officeId: string): { x: number; y: number } | null => {
    const currentPositions = existingNodePositionsByOffice.get(officeId) ?? [];
    if (!currentPositions.length) return null;
    const addedCount = addedEmployeeCountByOffice.get(officeId) ?? 0;
    const maxX = Math.max(...currentPositions.map((position) => position.x));
    const minY = Math.min(...currentPositions.map((position) => position.y));
    addedEmployeeCountByOffice.set(officeId, addedCount + 1);
    return {
      x: maxX + 240,
      y: minY + addedCount * 110,
    };
  };

  if (placeNewEmployeesNearOfficeCluster) {
    for (const node of resultNodes) {
      if (node.type !== "person" || !node.data.employeeId) continue;
      if (currentConnectedNodeIds.has(node.id)) continue;
      const officeId = node.data.officeId ?? null;
      if (!officeId) continue;
      const currentPositions = existingNodePositionsByOffice.get(officeId) ?? [];
      if (!currentPositions.length) continue;
      const minX = Math.min(...currentPositions.map((position) => position.x));
      const maxX = Math.max(...currentPositions.map((position) => position.x));
      const minY = Math.min(...currentPositions.map((position) => position.y));
      const maxY = Math.max(...currentPositions.map((position) => position.y));
      const isClearlyFarAway =
        node.position.x < minX - 360 ||
        node.position.x > maxX + 360 ||
        node.position.y < minY - 360 ||
        node.position.y > maxY + 360;
      if (!isClearlyFarAway) continue;
      const nextPosition = getNextClusterPosition(officeId);
      if (nextPosition) {
        node.position = nextPosition;
      }
    }
  }

  for (const employee of scopedLatestEmployees) {
    const employeeKey = getEmployeeKey(employee);
    if (!employeeKey || resultEmployeeIdByKey.has(employeeKey)) continue;
    const copied = copyNode(employee);
    const employeeOfficeId = copied.data.officeId ?? null;
    if (employeeOfficeId) {
      const nextPosition = placeNewEmployeesNearOfficeCluster
        ? getNextClusterPosition(employeeOfficeId)
        : null;
      if (nextPosition) {
        copied.position = nextPosition;
      } else {
        const delta = officePositionDeltaByKey.get(employeeOfficeId);
        if (delta) {
          copied.position = {
            x: copied.position.x + delta.dx,
            y: copied.position.y + delta.dy,
          };
        }
      }
    }
    resultNodes.push(copied);
    resultEmployeeIdByKey.set(employeeKey, copied.id);
  }

  const nodeIds = new Set(resultNodes.map((node) => node.id));
  const usedEdgeIds = new Set<string>();
  const usedEdgeKeys = new Set<string>();
  const resultEdges: OrgChartEdge[] = [];

  const appendEdge = (edge: OrgChartEdge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    const key = edgeKey(edge);
    if (usedEdgeKeys.has(key)) return;
    const id = createUniqueEdgeId(edge.id, usedEdgeIds);
    usedEdgeIds.add(id);
    usedEdgeKeys.add(key);
    resultEdges.push({ ...edge, id });
  };

  for (const edge of current.edges) {
    const translated = {
      ...copyEdge(edge),
      source: replacementNodeIds.get(edge.source) ?? edge.source,
      target: replacementNodeIds.get(edge.target) ?? edge.target,
    };
    if (!preserveConnections && movedEmployeeNodeIds.has(translated.target)) continue;
    appendEdge(translated);
  }

  const latestNodeIdToResultId = new Map<string, string>();
  for (const office of latestOffices) {
    const officeKey = getOfficeKey(office);
    if (officeKey) {
      latestNodeIdToResultId.set(office.id, resultOfficeIdByKey.get(officeKey) ?? office.id);
    }
  }
  for (const employee of scopedLatestEmployees) {
    const employeeKey = getEmployeeKey(employee);
    if (employeeKey) {
      latestNodeIdToResultId.set(employee.id, resultEmployeeIdByKey.get(employeeKey) ?? employee.id);
    }
  }

  if (!preserveConnections) {
    const nodesWithIncomingEdges = new Set(resultEdges.map((edge) => edge.target));
    for (const edge of latest.edges) {
      const target = latestNodeIdToResultId.get(edge.target);
      if (!target || nodesWithIncomingEdges.has(target)) continue;
      const source = latestNodeIdToResultId.get(edge.source);
      if (!source) continue;
      appendEdge({ ...copyEdge(edge), source, target });
      nodesWithIncomingEdges.add(target);
    }
  }

  return {
    nodes: resultNodes,
    edges: resultEdges,
    edgeType: current.edgeType ?? latest.edgeType,
  };
}
