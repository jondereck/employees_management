export type OrgNodeType = "office" | "unit" | "person";

export type OrgMarkerType = "none" | "arrow" | "arrowClosed" | "diamond" | "circle";

export type OrgNodeData = {
  name: string;
  title?: string;
  employeeTypeName?: string;
  employeeTypeColor?: string;
  isHead?: boolean;
  officeId?: string;
  employeeId?: string;
  label?: string;
  headerColor?: string;
  outlineColor?: string;
  notes?: string;
  imageUrl?: string;
};

export type OrgChartNode = {
  id: string;
  type: OrgNodeType;
  position: { x: number; y: number };
  data: OrgNodeData;
  width?: number;
  height?: number;
};

export type OrgChartEdge = {
  id: string;
  source: string;
  target: string;
  type?: "orth" | "smoothstep" | "straight";
  label?: string;
  color?: string;
  sourceHandle?: string;
  targetHandle?: string;
  markerStartType?: OrgMarkerType;
  markerEndType?: OrgMarkerType;
  markerSize?: number;
  markerColor?: string;
};

export type OrgChartDocument = {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
  edgeType?: "orth" | "smoothstep";
};

export type OrgChartVersion = {
  id: string;
  departmentId: string;
  label: string;
  createdAt: string;
  data: OrgChartDocument;
  isDefault?: boolean;
};

export type OrgChartVersionSummary = Omit<OrgChartVersion, "data">;
