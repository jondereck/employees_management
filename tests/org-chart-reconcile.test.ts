import assert from "node:assert/strict";
import test from "node:test";

import { reconcileOrgChartDocument } from "../lib/org-chart-reconcile";
import type { OrgChartDocument, OrgChartNode } from "../types/orgChart";

const office = (id: string, name = id): OrgChartNode => ({
  id: `office-${id}`,
  type: "office",
  position: { x: 0, y: 0 },
  data: { name, label: name, officeId: id },
});

const person = (
  employeeId: string,
  officeId: string,
  overrides: Partial<OrgChartNode["data"]> = {}
): OrgChartNode => ({
  id: `person-${employeeId}`,
  type: "person",
  position: { x: 20, y: 30 },
  data: {
    name: employeeId,
    title: "Old title",
    employeeId,
    officeId,
    ...overrides,
  },
});

const latestDocument = (...nodes: OrgChartNode[]): OrgChartDocument => ({
  nodes,
  edges: nodes
    .filter((node) => node.type === "person")
    .map((node) => ({
      id: `edge-${node.data.officeId}-${node.data.employeeId}`,
      source: `office-${node.data.officeId}`,
      target: node.id,
      type: "orth" as const,
    })),
  edgeType: "orth",
});

test("refreshes canonical employee fields while preserving coordinates", () => {
  const currentPerson = person("e1", "a", { name: "Old Name", notes: "Keep note" });
  currentPerson.position = { x: 111, y: 222 };
  const latestPerson = person("e1", "a", { name: "New Name", title: "New title" });

  const result = reconcileOrgChartDocument(
    latestDocument(office("a"), currentPerson),
    latestDocument(office("a"), latestPerson)
  );

  const refreshed = result.nodes.find((node) => node.data.employeeId === "e1");
  assert.deepEqual(refreshed?.position, { x: 111, y: 222 });
  assert.equal(refreshed?.data.name, "New Name");
  assert.equal(refreshed?.data.title, "New title");
  assert.equal(refreshed?.data.notes, "Keep note");
});

test("removes archived employees from latest draft without mutating historical input", () => {
  const historical = latestDocument(office("a"), person("e1", "a"));
  const result = reconcileOrgChartDocument(historical, latestDocument(office("a")));

  assert.equal(result.nodes.some((node) => node.data.employeeId === "e1"), false);
  assert.equal(result.edges.some((edge) => edge.target === "person-e1"), false);
  assert.equal(historical.nodes.some((node) => node.data.employeeId === "e1"), true);
});

test("moves an employee to the new office and replaces the old parent edge", () => {
  const result = reconcileOrgChartDocument(
    latestDocument(office("a"), office("b"), person("e1", "a")),
    latestDocument(office("a"), office("b"), person("e1", "b"))
  );

  const refreshed = result.nodes.find((node) => node.data.employeeId === "e1");
  assert.equal(refreshed?.data.officeId, "b");
  assert.equal(result.edges.some((edge) => edge.source === "office-a" && edge.target === "person-e1"), false);
  assert.equal(result.edges.some((edge) => edge.source === "office-b" && edge.target === "person-e1"), true);
});

test("adds newly active employees under their DB office", () => {
  const result = reconcileOrgChartDocument(
    latestDocument(office("a")),
    latestDocument(office("a"), person("e1", "a"))
  );

  assert.equal(result.nodes.some((node) => node.data.employeeId === "e1"), true);
  assert.equal(result.edges.some((edge) => edge.source === "office-a" && edge.target === "person-e1"), true);
});

test("keeps manual units, annotations, placeholders, and surviving connections", () => {
  const manualUnit: OrgChartNode = {
    id: "unit-manual",
    type: "unit",
    position: { x: 10, y: 10 },
    data: { name: "Custom unit", officeId: "a" },
  };
  const annotation: OrgChartNode = {
    id: "note-1",
    type: "annotation",
    position: { x: 40, y: 50 },
    data: { name: "Remember this" },
  };
  const placeholder = person("placeholder", "a");
  delete placeholder.data.employeeId;
  placeholder.id = "placeholder-1";

  const result = reconcileOrgChartDocument(
    {
      nodes: [office("a"), manualUnit, annotation, placeholder],
      edges: [{ id: "manual-edge", source: "office-a", target: "unit-manual" }],
    },
    latestDocument(office("a"))
  );

  assert.equal(result.nodes.some((node) => node.id === "unit-manual"), true);
  assert.equal(result.nodes.some((node) => node.id === "note-1"), true);
  assert.equal(result.nodes.some((node) => node.id === "placeholder-1"), true);
  assert.equal(result.edges.some((edge) => edge.id === "manual-edge"), true);
});

test("collapses duplicate linked employees and removes dangling edges", () => {
  const duplicate = person("e1", "a");
  duplicate.id = "person-e1-copy";
  const result = reconcileOrgChartDocument(
    {
      nodes: [office("a"), person("e1", "a"), duplicate],
      edges: [
        { id: "edge-primary", source: "office-a", target: "person-e1" },
        { id: "edge-copy", source: "office-a", target: "person-e1-copy" },
        { id: "edge-dangling", source: "office-a", target: "missing-node" },
      ],
    },
    latestDocument(office("a"), person("e1", "a"))
  );

  assert.equal(result.nodes.filter((node) => node.data.employeeId === "e1").length, 1);
  assert.equal(result.edges.some((edge) => edge.target === "missing-node"), false);
  assert.equal(result.edges.filter((edge) => edge.source === "office-a" && edge.target === "person-e1").length, 1);
});

test("scoped rebuild updates only selected office and leaves others unchanged", () => {
  const current = {
    nodes: [
      office("a", "Office A"),
      office("b", "Office B"),
      person("e1", "a", { name: "Old A" }),
      person("e2", "b", { name: "Old B" }),
    ],
    edges: [
      { id: "edge-a-e1", source: "office-a", target: "person-e1" },
      { id: "edge-b-e2", source: "office-b", target: "person-e2" },
    ],
    edgeType: "orth" as const,
  };
  const latest = {
    nodes: [
      office("a", "Office A New"),
      office("b", "Office B New"),
      person("e1", "a", { name: "New A" }),
      person("e2", "b", { name: "New B" }),
    ],
    edges: [
      { id: "edge-a-e1", source: "office-a", target: "person-e1", type: "orth" as const },
      { id: "edge-b-e2", source: "office-b", target: "person-e2", type: "orth" as const },
    ],
    edgeType: "orth" as const,
  };

  const result = reconcileOrgChartDocument(current, latest, { scopeOfficeId: "a" });
  const personA = result.nodes.find((node) => node.data.employeeId === "e1");
  const personB = result.nodes.find((node) => node.data.employeeId === "e2");
  const officeA = result.nodes.find((node) => node.id === "office-a");
  const officeB = result.nodes.find((node) => node.id === "office-b");

  assert.equal(personA?.data.name, "New A");
  assert.equal(personB?.data.name, "Old B");
  assert.equal(officeA?.data.name, "Office A New");
  assert.equal(officeB?.data.name, "Office B");
});

test("build refresh places a new employee near the existing cluster without adding a line", () => {
  const movedOffice = office("a", "Office A");
  movedOffice.position = { x: 1000, y: 700 };

  const latestOffice = office("a", "Office A");
  latestOffice.position = { x: 0, y: 0 };
  const incoming = person("e-new", "a", { name: "Incoming" });
  incoming.position = { x: 220, y: 340 };

  const result = reconcileOrgChartDocument(
    {
      nodes: [movedOffice],
      edges: [],
      edgeType: "orth",
    },
    {
      nodes: [latestOffice, incoming],
      edges: [{ id: "edge-a-e-new", source: "office-a", target: "person-e-new", type: "orth" }],
      edgeType: "orth",
    },
    {
      scopeOfficeId: "a",
      preserveConnections: true,
      placeNewEmployeesNearOfficeCluster: true,
    }
  );

  const newEmployee = result.nodes.find((node) => node.data.employeeId === "e-new");
  assert.ok(newEmployee);
  assert.deepEqual(newEmployee.position, { x: 1240, y: 700 });
  assert.equal(result.edges.length, 0);
});

test("build refresh leaves existing lines untouched for surviving employees", () => {
  const current = {
    nodes: [office("a"), office("b"), person("e1", "a")],
    edges: [{ id: "manual-line", source: "office-a", target: "person-e1", type: "straight" as const }],
    edgeType: "orth" as const,
  };
  const latest = latestDocument(office("a"), office("b"), person("e1", "a", { name: "Updated" }));

  const result = reconcileOrgChartDocument(current, latest, {
    scopeOfficeId: "a",
    preserveConnections: true,
    placeNewEmployeesNearOfficeCluster: true,
  });

  assert.deepEqual(result.edges, current.edges);
});

test("build refresh pulls an existing detached DB employee back near the office cluster", () => {
  const farEmployee = person("e-far", "a", { name: "Far employee" });
  farEmployee.position = { x: 2400, y: 1800 };

  const result = reconcileOrgChartDocument(
    {
      nodes: [office("a"), farEmployee],
      edges: [],
      edgeType: "orth",
    },
    latestDocument(office("a"), person("e-far", "a", { name: "Updated employee" })),
    {
      scopeOfficeId: "a",
      preserveConnections: true,
      placeNewEmployeesNearOfficeCluster: true,
    }
  );

  const employee = result.nodes.find((node) => node.data.employeeId === "e-far");
  assert.ok(employee);
  assert.deepEqual(employee.position, { x: 240, y: 0 });
  assert.equal(employee.data.name, "Updated employee");
  assert.equal(result.edges.length, 0);
});

test("build refresh does not reposition a connected employee even when far away", () => {
  const connectedEmployee = person("e-linked", "a");
  connectedEmployee.position = { x: 2400, y: 1800 };
  const current = {
    nodes: [office("a"), connectedEmployee],
    edges: [{ id: "manual-line", source: "office-a", target: "person-e-linked" }],
    edgeType: "orth" as const,
  };

  const result = reconcileOrgChartDocument(
    current,
    latestDocument(office("a"), person("e-linked", "a", { name: "Updated employee" })),
    {
      scopeOfficeId: "a",
      preserveConnections: true,
      placeNewEmployeesNearOfficeCluster: true,
    }
  );

  const employee = result.nodes.find((node) => node.data.employeeId === "e-linked");
  assert.ok(employee);
  assert.deepEqual(employee.position, { x: 2400, y: 1800 });
  assert.deepEqual(result.edges, current.edges);
});
