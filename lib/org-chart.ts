import prismadb from "@/lib/prismadb";
import { OrgChartDocument, OrgChartEdge, OrgChartNode } from "@/types/orgChart";

const OFFICE_GAP_X = 420;
const LEVEL_GAP_Y = 170;
const PERSON_GAP_X = 200;

type BuildOptions = {
  includeStaffUnit?: boolean;
};

export async function buildInitialOrgDocument(
  departmentId: string,
  options: BuildOptions = {}
): Promise<OrgChartDocument> {
  const includeStaffUnit = options.includeStaffUnit ?? true;
  const offices = await prismadb.offices.findMany({
    where: { departmentId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employee: {
        where: { isArchived: false },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          position: true,
          isHead: true,
          employeeType: {
            select: { name: true },
          },
          images: {
            select: { url: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: [{ isHead: "desc" }, { lastName: "asc" }],
      },
    },
  });

  const nodes: OrgChartNode[] = [];
  const edges: OrgChartEdge[] = [];

  offices.forEach((office, officeIndex) => {
    const officeNodeId = `office-${office.id}`;
    const baseX = officeIndex * OFFICE_GAP_X;

    nodes.push({
      id: officeNodeId,
      type: "office",
      position: { x: baseX, y: 0 },
      data: {
        name: office.name,
        label: office.name,
        officeId: office.id,
        headerColor: "#1E88E5",
      },
    });

    const headEmployees = office.employee.filter((employee) => employee.isHead);
    const staffEmployees = office.employee.filter((employee) => !employee.isHead);

    headEmployees.forEach((employee, index) => {
      const nodeId = `person-${employee.id}`;
      const x = baseX + index * PERSON_GAP_X;
      const y = LEVEL_GAP_Y;
      nodes.push({
        id: nodeId,
        type: "person",
        position: { x, y },
        data: {
          name: formatEmployeeName(employee),
          title: employee.position || undefined,
          employeeTypeName: employee.employeeType?.name ?? undefined,
          isHead: true,
          officeId: office.id,
          employeeId: employee.id,
          label: employee.position || "Head",
          headerColor: "#3949AB",
          imageUrl: employee.images?.[0]?.url ?? undefined,
        },
      });
      edges.push({
        id: `${officeNodeId}-${nodeId}`,
        source: officeNodeId,
        target: nodeId,
        type: "orth",
      });
    });

    if (includeStaffUnit && staffEmployees.length) {
      const unitId = `unit-${office.id}-staff`;
      const unitY = headEmployees.length ? LEVEL_GAP_Y * 2 : LEVEL_GAP_Y;
      nodes.push({
        id: unitId,
        type: "unit",
        position: { x: baseX, y: unitY },
        data: {
          name: "Staff",
          label: "Staff",
          officeId: office.id,
          headerColor: "#FB8C00",
        },
      });
      edges.push({
        id: `${officeNodeId}-${unitId}`,
        source: officeNodeId,
        target: unitId,
        type: "orth",
      });

      staffEmployees.forEach((employee, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = baseX + column * PERSON_GAP_X;
        const y = unitY + LEVEL_GAP_Y + row * LEVEL_GAP_Y;
        const nodeId = `person-${employee.id}`;
        nodes.push({
          id: nodeId,
          type: "person",
          position: { x, y },
        data: {
          name: formatEmployeeName(employee),
          title: employee.position || undefined,
          employeeTypeName: employee.employeeType?.name ?? undefined,
          officeId: office.id,
          employeeId: employee.id,
          label: employee.position || employee.employeeType?.name || "Staff",
          headerColor: "#5E35B1",
          imageUrl: employee.images?.[0]?.url ?? undefined,
        },
      });
        edges.push({
          id: `${unitId}-${nodeId}`,
          source: unitId,
          target: nodeId,
          type: "orth",
        });
      });
    } else {
      staffEmployees.forEach((employee, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = baseX + column * PERSON_GAP_X;
        const y = (headEmployees.length ? LEVEL_GAP_Y * 2 : LEVEL_GAP_Y) + row * LEVEL_GAP_Y;
        const nodeId = `person-${employee.id}`;
        nodes.push({
          id: nodeId,
          type: "person",
          position: { x, y },
        data: {
          name: formatEmployeeName(employee),
          title: employee.position || undefined,
          employeeTypeName: employee.employeeType?.name ?? undefined,
          officeId: office.id,
          employeeId: employee.id,
          label: employee.position || employee.employeeType?.name || "Staff",
          headerColor: "#5E35B1",
          imageUrl: employee.images?.[0]?.url ?? undefined,
        },
      });
        edges.push({
          id: `${officeNodeId}-${nodeId}`,
          source: officeNodeId,
          target: nodeId,
          type: "orth",
        });
      });
    }
  });

  return {
    nodes,
    edges,
    edgeType: "orth",
  };
}

function formatEmployeeName(employee: {
  firstName: string;
  lastName: string;
  middleName: string;
}): string {
  const { firstName, middleName, lastName } = employee;
  const parts = [firstName, middleName ? `${middleName[0]}.` : "", lastName];
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}
