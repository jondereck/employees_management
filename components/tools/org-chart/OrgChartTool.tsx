"use client";

import "reactflow/dist/style.css";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import ReactFlow, {
  Background,
  BaseEdge,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  addEdge,
  Connection,
  ConnectionLineType,
  ConnectionMode,
  Edge,
  EdgeChange,
  EdgeProps,
  getSmoothStepPath,
  getStraightPath,
  Handle,
  MarkerType,
  Node,
  NodeChange,
  NodeProps,
  NodeToolbar,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  getRectOfNodes,
} from "reactflow";
import { AlertModal } from "@/components/modals/alert-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddOfficeDialog, type OfficeSearchResult } from "./dialogs/AddOfficeDialog";
import {
  AddPersonDialog,
  type AddPersonDialogSelection,
  type EmployeeSearchResult,
} from "./dialogs/AddPersonDialog";
import { BulkExportDialog } from "./dialogs/BulkExportDialog";
import LoadingWithProgress from "@/components/loading-with-progress";
import { cn } from "@/lib/utils";
import { flushSync } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AnnotationAlignment,
  AnnotationWeight,
  OrgChartDocument,
  OrgChartEdge,
  OrgChartNode,
  OrgChartVersion,
  OrgChartVersionSummary,
  OrgNodeData,
  OrgNodeType,
  OrgMarkerType,
} from "@/types/orgChart";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Building2,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Database,
  GitBranch,
  Hand,
  Image as ImageIcon,
  Layers,
  Link2,
  ListFilter,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Redo2,
  RefreshCw,
  Trash2,
  Type,
  Undo2,
  Unlock,
  User,
  Users,
  ChevronDown,
} from "lucide-react";
import * as htmlToImage from "html-to-image";
import { PDFDocument } from "pdf-lib";
import { reconcileOrgChartDocument } from "@/lib/org-chart-reconcile";
import {
  computeDragGuides,
  type GuideBounds,
  type SpacingGuide,
} from "@/lib/org-chart-guides";

const DEFAULT_NODE_COLORS: Record<OrgNodeType, string> = {
  office: "#1E88E5",
  unit: "#FB8C00",
  person: "#3949AB",
  annotation: "#111827",
  junction: "#0F172A",
  lineEndpoint: "#3b82f6",
};
const DEFAULT_EDGE_COLOR = "#0F172A";
const DEFAULT_EDGE_STROKE_WIDTH = 2;
const NEUTRAL_OUTLINE_COLOR = "#E2E8F0";
const HISTORY_LIMIT = 100;
const DEFAULT_CANVAS_ZOOM = 0.8;
const DEFAULT_TOOL_UI_SCALE = 0.9;

const DEFAULT_ANNOTATION_TEXT = "New text";
const DEFAULT_ANNOTATION_COLOR = "#111827";
const DEFAULT_ANNOTATION_FONT_SIZE = 18;
const MIN_ANNOTATION_FONT_SIZE = 12;
const MAX_ANNOTATION_FONT_SIZE = 64;
const MIN_ANNOTATION_ROTATION = -45;
const MAX_ANNOTATION_ROTATION = 45;

const EDGE_TYPE_OPTIONS: Array<{ label: string; value: "orth" | "smoothstep" | "straight" }> = [
  { label: "Orthogonal", value: "orth" },
  { label: "Smooth", value: "smoothstep" },
  { label: "Straight", value: "straight" },
];

const LINE_FLYOUT_OPTIONS: Array<{
  label: string;
  value: "straight" | "orth" | "smoothstep";
  hint?: string;
}> = [
  { label: "Straight line", value: "straight" },
  { label: "Elbow line", value: "orth", hint: "Orthogonal" },
  { label: "Bendy line", value: "smoothstep", hint: "Smooth" },
];

const MARKER_TYPE_OPTIONS: Array<{ label: string; value: OrgMarkerType; description: string }> = [
  { label: "None", value: "none", description: "No marker" },
  { label: "Arrow", value: "arrow", description: "Open arrow" },
  { label: "Arrow (closed)", value: "arrowClosed", description: "Closed arrow" },
  { label: "Diamond", value: "diamond", description: "Diamond marker" },
  { label: "Circle", value: "circle", description: "Circle marker" },
];

const DEFAULT_MARKER_START: OrgMarkerType = "none";
const DEFAULT_MARKER_END: OrgMarkerType = "none";
const DEFAULT_MARKER_SIZE = 18;
const MIN_MARKER_SIZE = 8;
const MAX_MARKER_SIZE = 28;

const VALID_HANDLE_IDS = new Set(["t", "r", "b", "l"]);
const LEGACY_HANDLE_MAP: Record<string, "t" | "r" | "b" | "l"> = {
  top: "t",
  "top-source": "t",
  "top-target": "t",
  "t-source": "t",
  "t-target": "t",
  bottom: "b",
  "bottom-source": "b",
  "bottom-target": "b",
  "b-source": "b",
  "b-target": "b",
  left: "l",
  "left-source": "l",
  "left-target": "l",
  "l-source": "l",
  "l-target": "l",
  right: "r",
  "right-source": "r",
  "right-target": "r",
  "r-source": "r",
  "r-target": "r",
};

const normalizeHandleId = (handle?: string | null): HandleOrientation | undefined => {
  if (!handle) return undefined;
  const normalized = LEGACY_HANDLE_MAP[handle] ?? handle;
  return VALID_HANDLE_IDS.has(normalized) ? (normalized as HandleOrientation) : undefined;
};

const getSourceHandleId = (orientation: HandleOrientation | undefined): string | undefined => {
  if (!orientation) return undefined;
  switch (orientation) {
    case "t":
      return "t-source";
    case "r":
      return "r-source";
    case "b":
      return "b-source";
    case "l":
      return "l-source";
    default:
      return undefined;
  }
};

const getTargetHandleId = (orientation: HandleOrientation | undefined): string | undefined => {
  if (!orientation) return undefined;
  switch (orientation) {
    case "t":
      return "t-target";
    case "r":
      return "r-target";
    case "b":
      return "b-target";
    case "l":
      return "l-target";
    default:
      return undefined;
  }
};

type GraphState = { nodes: FlowNode[]; edges: FlowEdge[] };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const componentToHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

const normalizeAnnotationFontSize = (value?: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_ANNOTATION_FONT_SIZE;
  }
  return clamp(value, MIN_ANNOTATION_FONT_SIZE, MAX_ANNOTATION_FONT_SIZE);
};

const normalizeAnnotationRotation = (value?: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return clamp(value, MIN_ANNOTATION_ROTATION, MAX_ANNOTATION_ROTATION);
};

const normalizeAnnotationAlignment = (value?: string | null): AnnotationAlignment => {
  if (value === "center" || value === "right") return value;
  return "left";
};

const normalizeAnnotationWeight = (value?: string | null): AnnotationWeight => {
  return value === "normal" ? "normal" : "bold";
};

const normalizeColor = (input?: string | null): string | null => {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  if (/^#([0-9a-f]{3})$/i.test(value)) {
    const [, hex] = value.match(/^#([0-9a-f]{3})$/i) ?? [];
    if (!hex) return null;
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }
  if (/^#([0-9a-f]{6})$/i.test(value)) {
    return value.toUpperCase();
  }
  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(",")
      .map((part) => part.trim())
      .map(Number)
      .filter((part, index) => !Number.isNaN(part) && (index < 3 || index === 3));
    if (parts.length >= 3) {
      const [r, g, b] = parts;
      return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase();
    }
  }
  return null;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const normalized = normalizeColor(hex);
  if (!normalized) return null;
  const value = normalized.replace("#", "");
  const bigint = parseInt(value, 16);
  if (Number.isNaN(bigint)) return null;
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const colorWithAlpha = (color: string | undefined, alpha: number): string => {
  const normalized = normalizeColor(color);
  if (!normalized) {
    const [r, g, b] = hexToRgb(NEUTRAL_OUTLINE_COLOR) ?? [226, 232, 240];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = hexToRgb(normalized) ?? hexToRgb(NEUTRAL_OUTLINE_COLOR) ?? [226, 232, 240];
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const snapValueToGrid = (value: number, grid = 16): number => Math.round(value / grid) * grid;

const snapPointToGrid = (point: { x: number; y: number }, grid = 16): { x: number; y: number } => ({
  x: snapValueToGrid(point.x, grid),
  y: snapValueToGrid(point.y, grid),
});

const darkenColor = (input: string | undefined, amount = 0.2): string => {
  const normalized = normalizeColor(input);
  if (!normalized) return DEFAULT_EDGE_COLOR;
  const rgb = hexToRgb(normalized);
  if (!rgb) return normalized;
  const factor = clamp(1 - amount, 0, 1);
  const [r, g, b] = rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor)))) as [
    number,
    number,
    number,
  ];
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase();
};

const formatFullName = (employee: Pick<EmployeeSearchResult, "firstName" | "middleName" | "lastName">): string => {
  const middle = employee.middleName ? `${employee.middleName.charAt(0)}.` : "";
  return [employee.firstName, middle, employee.lastName].filter(Boolean).join(" ");
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const determineColumnCount = (count: number): number => {
  if (count <= 1) return count || 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  const approx = Math.ceil(Math.sqrt(count));
  return Math.min(5, Math.max(3, approx));
};

const cloneGraphState = (graph: GraphState): GraphState => {
  if (typeof structuredClone === "function") {
    return structuredClone(graph);
  }
  return {
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
};

type MarkerPosition = "start" | "end";

type CustomMarkerDefinition = {
  id: string;
  type: Extract<OrgMarkerType, "diamond" | "circle">;
  size: number;
  color: string;
  position: MarkerPosition;
};

const sanitizeMarkerIdPart = (value: string): string => {
  if (!value) return "default";
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "default";
};

const getCustomMarkerId = (
  type: Extract<OrgMarkerType, "diamond" | "circle">,
  color: string,
  size: number,
  position: MarkerPosition
): string => `orgchart-marker-${type}-${position}-${size}-${sanitizeMarkerIdPart(color)}`;

const normalizeMarkerSizeValue = (size?: number): number => {
  if (typeof size !== "number" || Number.isNaN(size)) {
    return DEFAULT_MARKER_SIZE;
  }
  return clamp(Math.round(size), MIN_MARKER_SIZE, MAX_MARKER_SIZE);
};

const getMarkerReference = (
  type: OrgMarkerType,
  color: string,
  size: number,
  position: MarkerPosition
): Edge["markerStart"] => {
  if (type === "none") return undefined;
  if (type === "arrow") {
    return { type: MarkerType.Arrow, color, width: size, height: size };
  }
  if (type === "arrowClosed") {
    return { type: MarkerType.ArrowClosed, color, width: size, height: size };
  }
  const customId = getCustomMarkerId(type, color, size, position);
  return `url(#${customId})`;
};

type OrgChartToolProps = {
  departmentId: string;
  logoUrl?: string | null;
};

type FlowNodeData = OrgNodeData;
type FlowNode = Node<FlowNodeData>;
type FlowEdgeData = {
  color?: string;
  customType?: string;
  markerStartType?: OrgMarkerType;
  markerEndType?: OrgMarkerType;
  markerSize?: number;
  markerColor?: string;
};
type FlowEdge = Edge<FlowEdgeData>;

type HandleOrientation = "t" | "r" | "b" | "l";
type Tool = "select" | "hand" | "connect";

type NodeBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

const getFlowNodeBounds = (node: FlowNode): NodeBounds => {
  const width =
    node.width ??
    (node.type === "person"
      ? PERSON_CARD_WIDTH
      : node.type === "junction"
        ? JUNCTION_NODE_SIZE
        : node.type === "lineEndpoint"
          ? LINE_ENDPOINT_SIZE
        : node.type === "office" || node.type === "unit"
          ? GROUP_CARD_WIDTH
          : DEFAULT_NODE_WIDTH);
  const height =
    node.height ??
    (node.type === "person"
      ? PERSON_CARD_HEIGHT
      : node.type === "junction"
        ? JUNCTION_NODE_SIZE
        : node.type === "lineEndpoint"
          ? LINE_ENDPOINT_SIZE
        : node.type === "office" || node.type === "unit"
          ? GROUP_CARD_HEIGHT
          : DEFAULT_NODE_HEIGHT);
  return {
    left: node.position.x,
    right: node.position.x + width,
    top: node.position.y,
    bottom: node.position.y + height,
    centerX: node.position.x + width / 2,
    centerY: node.position.y + height / 2,
    width,
    height,
  };
};

const toGuideBounds = (node: FlowNode): GuideBounds => {
  const bounds = getFlowNodeBounds(node);
  return { id: node.id, ...bounds };
};

const isSpacingGuideTarget = (node: FlowNode): boolean => {
  if (node.hidden) return false;
  if (node.type === "annotation" || node.type === "junction" || node.type === "lineEndpoint") {
    return false;
  }
  return true;
};

const distanceToSegment = (
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): { distance: number; point: { x: number; y: number } } => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return {
      distance: Math.hypot(point.x - a.x, point.y - a.y),
      point: { ...a },
    };
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))
  );
  const closest = { x: a.x + t * dx, y: a.y + t * dy };
  return {
    distance: Math.hypot(point.x - closest.x, point.y - closest.y),
    point: closest,
  };
};

const findNearestEdgeForBranch = (
  flowPos: { x: number; y: number },
  edges: FlowEdge[],
  nodes: FlowNode[],
  excludeNodeId: string,
  maxDistance: number
): { edgeId: string; point: { x: number; y: number } } | null => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let best: { edgeId: string; point: { x: number; y: number }; distance: number } | null = null;

  for (const edge of edges) {
    if (edge.hidden) continue;
    if (edge.source === excludeNodeId || edge.target === excludeNodeId) continue;
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target || source.hidden || target.hidden) continue;
    if (source.type === "annotation" || target.type === "annotation") continue;

    const sourceBounds = getFlowNodeBounds(source);
    const targetBounds = getFlowNodeBounds(target);
    const segment = distanceToSegment(
      flowPos,
      { x: sourceBounds.centerX, y: sourceBounds.centerY },
      { x: targetBounds.centerX, y: targetBounds.centerY }
    );
    if (segment.distance > maxDistance) continue;
    if (!best || segment.distance < best.distance) {
      best = { edgeId: edge.id, point: segment.point, distance: segment.distance };
    }
  }

  return best ? { edgeId: best.edgeId, point: best.point } : null;
};

function AlignmentGuides({
  vertical,
  horizontal,
  spacings,
}: {
  vertical: number | null;
  horizontal: number | null;
  spacings: SpacingGuide[];
}) {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;

  if (vertical == null && horizontal == null && spacings.length === 0) return null;

  const toScreenX = (x: number) => x * zoom + tx;
  const toScreenY = (y: number) => y * zoom + ty;
  const tick = 6;

  return (
    <svg
      className="orgchart-align-guides pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
      aria-hidden
    >
      {vertical != null ? (
        <line
          x1={toScreenX(vertical)}
          y1={0}
          x2={toScreenX(vertical)}
          y2="100%"
          stroke="#3b82f6"
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
      ) : null}
      {horizontal != null ? (
        <line
          x1={0}
          y1={toScreenY(horizontal)}
          x2="100%"
          y2={toScreenY(horizontal)}
          stroke="#3b82f6"
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
      ) : null}
      {spacings.map((spacing, index) => {
        const gapLabel = String(spacing.gap);
        const labelW = Math.max(28, gapLabel.length * 8 + 10);
        if (spacing.axis === "x") {
          const x1 = toScreenX(spacing.from);
          const x2 = toScreenX(spacing.to);
          const y = toScreenY(spacing.cross);
          const midX = (x1 + x2) / 2;
          return (
            <g key={`spacing-x-${index}`}>
              <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} stroke="#ec4899" strokeWidth={1.5} />
              <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} stroke="#ec4899" strokeWidth={1.5} />
              <line x1={x1} y1={y} x2={x2} y2={y} stroke="#ec4899" strokeWidth={1.5} />
              <rect
                x={midX - labelW / 2}
                y={y - 10}
                width={labelW}
                height={18}
                rx={4}
                fill="#ffffff"
                stroke="#ec4899"
                strokeWidth={1}
              />
              <text
                x={midX}
                y={y + 3}
                textAnchor="middle"
                fontSize={11}
                fill="#ec4899"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {gapLabel}
              </text>
            </g>
          );
        }
        const y1 = toScreenY(spacing.from);
        const y2 = toScreenY(spacing.to);
        const x = toScreenX(spacing.cross);
        const midY = (y1 + y2) / 2;
        return (
          <g key={`spacing-y-${index}`}>
            <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} stroke="#ec4899" strokeWidth={1.5} />
            <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} stroke="#ec4899" strokeWidth={1.5} />
            <line x1={x} y1={y1} x2={x} y2={y2} stroke="#ec4899" strokeWidth={1.5} />
            <rect
              x={x - labelW / 2}
              y={midY - 10}
              width={labelW}
              height={18}
              rx={4}
              fill="#ffffff"
              stroke="#ec4899"
              strokeWidth={1}
            />
            <text
              x={x}
              y={midY + 3}
              textAnchor="middle"
              fontSize={11}
              fill="#ec4899"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {gapLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const markerEquals = (a: Edge["markerStart"], b: Edge["markerStart"]): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a === "string" || typeof b === "string") {
    return typeof a === "string" && typeof b === "string" && a === b;
  }
  return (
    a.type === b.type &&
    (a.color ?? undefined) === (b.color ?? undefined) &&
    (a.width ?? undefined) === (b.width ?? undefined) &&
    (a.height ?? undefined) === (b.height ?? undefined) &&
    (a.markerUnits ?? undefined) === (b.markerUnits ?? undefined) &&
    (a.orient ?? undefined) === (b.orient ?? undefined) &&
    (a.strokeWidth ?? undefined) === (b.strokeWidth ?? undefined)
  );
};

const applyEdgePresentation = (edge: FlowEdge): FlowEdge => {
  const normalizedColor = normalizeColor(edge.data?.color) ?? DEFAULT_EDGE_COLOR;
  const markerSize = normalizeMarkerSizeValue(edge.data?.markerSize);
  const markerColor = normalizeColor(edge.data?.markerColor ?? edge.data?.color) ?? normalizedColor;
  const markerStartType = edge.data?.markerStartType ?? DEFAULT_MARKER_START;
  const markerEndType = edge.data?.markerEndType ?? DEFAULT_MARKER_END;

  const nextData: FlowEdgeData = {
    ...edge.data,
    color: normalizedColor,
    markerColor,
    markerSize,
    markerStartType,
    markerEndType,
  };

  const markerStartRef = getMarkerReference(markerStartType, markerColor, markerSize, "start");
  const markerEndRef = getMarkerReference(markerEndType, markerColor, markerSize, "end");
  const nextStyle = {
    ...(edge.style ?? {}),
    stroke: normalizedColor,
    strokeWidth: DEFAULT_EDGE_STROKE_WIDTH,
  };

  const currentData = edge.data ?? {};
  const dataMatches =
    (normalizeColor(currentData.color) ?? DEFAULT_EDGE_COLOR) === normalizedColor &&
    normalizeMarkerSizeValue(currentData.markerSize) === markerSize &&
    (normalizeColor(currentData.markerColor ?? currentData.color) ?? normalizedColor) === markerColor &&
    (currentData.markerStartType ?? DEFAULT_MARKER_START) === markerStartType &&
    (currentData.markerEndType ?? DEFAULT_MARKER_END) === markerEndType;

const styleMatches =
  edge.style?.stroke === normalizedColor &&
  edge.style?.strokeWidth === DEFAULT_EDGE_STROKE_WIDTH;


  const startMatches = markerEquals(edge.markerStart, markerStartRef);
  const endMatches = markerEquals(edge.markerEnd, markerEndRef);

  if (dataMatches && styleMatches && startMatches && endMatches) {
    return edge;
  }

  return {
  ...edge,
  data: nextData,
  style: { ...(edge.style ?? {}), stroke: normalizedColor, strokeWidth: DEFAULT_EDGE_STROKE_WIDTH },
  markerStart: markerStartRef,
  markerEnd: markerEndRef,
};
};

const getCustomMarkerDefinitions = (edges: FlowEdge[]): CustomMarkerDefinition[] => {
  const definitionMap = new Map<string, CustomMarkerDefinition>();

  edges.forEach((edge) => {
    const data = edge.data;
    if (!data) return;
    const markerSize = normalizeMarkerSizeValue(data.markerSize);
    const markerColor = normalizeColor(data.markerColor ?? data.color) ?? DEFAULT_EDGE_COLOR;

    const register = (type: OrgMarkerType | undefined, position: MarkerPosition) => {
      if (type !== "diamond" && type !== "circle") return;
      const id = getCustomMarkerId(type, markerColor, markerSize, position);
      definitionMap.set(`${id}-${position}`, {
        id,
        type,
        size: markerSize,
        color: markerColor,
        position,
      });
    };

    register(data.markerStartType, "start");
    register(data.markerEndType, "end");
  });

  return Array.from(definitionMap.values());
};

const MarkerDefinitionsLayer = ({ definitions }: { definitions: CustomMarkerDefinition[] }): JSX.Element | null => {
  if (!definitions.length) {
    return null;
  }

  return (
    <svg className="pointer-events-none absolute h-0 w-0">
      <defs>
        {definitions.map(({ id, type, color, size, position }) => {
          const strokeWidth = Math.max(1, Math.round(size * 0.1));
          if (type === "circle") {
            const radius = size / 2;
            const ref = radius;
            return (
              <marker
                key={id}
                id={id}
                markerWidth={size}
                markerHeight={size}
                refX={ref}
                refY={radius}
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <circle cx={radius} cy={radius} r={radius} fill={color} stroke={color} strokeWidth={strokeWidth} />
              </marker>
            );
          }

          const refX = position === "end" ? size : 0;
          const half = size / 2;
          const path = `M0 ${half} L${half} ${size} L${size} ${half} L${half} 0 Z`;

          return (
            <marker
              key={id}
              id={id}
              markerWidth={size}
              markerHeight={size}
              refX={refX}
              refY={half}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d={path} fill={color} stroke={color} strokeWidth={strokeWidth} />
            </marker>
          );
        })}
      </defs>
    </svg>
  );
};

const MarkerPreview = ({ type, color, direction }: { type: OrgMarkerType; color: string; direction: MarkerPosition }) => {
  const normalizedColor = normalizeColor(color) ?? DEFAULT_EDGE_COLOR;

  if (type === "none") {
    return <div className="h-6 w-6 rounded border border-dashed border-muted-foreground/60" />;
  }

  const transform = direction === "start" ? "translate(24 0) scale(-1 1)" : undefined;

  let shape: ReactNode = null;
  switch (type) {
    case "arrow":
      shape = (
        <g>
          <line x1={4} y1={12} x2={18} y2={12} stroke={normalizedColor} strokeWidth={2} strokeLinecap="round" />
          <line x1={18} y1={12} x2={12} y2={6} stroke={normalizedColor} strokeWidth={2} strokeLinecap="round" />
          <line x1={18} y1={12} x2={12} y2={18} stroke={normalizedColor} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
      break;
    case "arrowClosed":
      shape = (
        <g>
          <line x1={4} y1={12} x2={14} y2={12} stroke={normalizedColor} strokeWidth={2} strokeLinecap="round" />
          <path d="M14 6 L20 12 L14 18 Z" fill={normalizedColor} />
        </g>
      );
      break;
    case "diamond":
      shape = (
        <g>
          <line x1={4} y1={12} x2={10} y2={12} stroke={normalizedColor} strokeWidth={2} strokeLinecap="round" />
          <path d="M10 12 L16 6 L22 12 L16 18 Z" fill={normalizedColor} />
        </g>
      );
      break;
    case "circle":
      shape = (
        <g>
          <line x1={4} y1={12} x2={10} y2={12} stroke={normalizedColor} strokeWidth={2} strokeLinecap="round" />
          <circle cx={16} cy={12} r={6} fill={normalizedColor} />
        </g>
      );
      break;
    default:
      shape = null;
  }

  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden>
      <g transform={transform}>{shape}</g>
    </svg>
  );
};

const EDGE_ALIGNMENT_TOLERANCE = 12;
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 160;
const JUNCTION_NODE_SIZE = 28;
const JUNCTION_VISUAL_SIZE = 12;
const LINE_ENDPOINT_SIZE = 16;
const LINE_ENDPOINT_VISUAL = 10;
const PERSON_CARD_WIDTH = 260;
const PERSON_CARD_HEIGHT = 100;
const GROUP_CARD_WIDTH = 260;
const GROUP_CARD_HEIGHT = 76;
const ALIGN_GUIDE_THRESHOLD = 8;

const getNodeCenter = (node: FlowNode | undefined): { x: number; y: number } | null => {
  if (!node) return null;
  const bounds = getFlowNodeBounds(node);
  return { x: bounds.centerX, y: bounds.centerY };
};

/** Keep T-junction stems/bars orthogonal after moves.
 * - Default / dragging a person: junction snaps under the stem and onto the bar.
 * - Dragging the junction hub: keep hub on the orthogonal T (stem X × bar Y) so
 *   the user can manually straighten a sagging V.
 */
const straightenJunctionNodes = (
  nodeList: FlowNode[],
  edgeList: FlowEdge[],
  preferNodeIds?: Set<string>
): FlowNode[] => {
  if (!nodeList.some((node) => node.type === "junction")) {
    return nodeList;
  }

  const byId = new Map(nodeList.map((node) => [node.id, node]));
  let changed = false;
  const nextPositions = new Map<string, { x: number; y: number }>();

  for (const junction of nodeList) {
    if (junction.type !== "junction") continue;

    const neighbors = edgeList
      .filter((edge) => edge.source === junction.id || edge.target === junction.id)
      .map((edge) => byId.get(edge.source === junction.id ? edge.target : edge.source))
      .filter((node): node is FlowNode => Boolean(node));

    if (neighbors.length < 2) continue;

    const junctionBounds = getFlowNodeBounds({
      ...junction,
      position: nextPositions.get(junction.id) ?? junction.position,
    });

    const horizontal: FlowNode[] = [];
    const vertical: FlowNode[] = [];
    for (const neighbor of neighbors) {
      const neighborPos = nextPositions.get(neighbor.id) ?? neighbor.position;
      const neighborBounds = getFlowNodeBounds({ ...neighbor, position: neighborPos });
      const dx = Math.abs(neighborBounds.centerX - junctionBounds.centerX);
      const dy = Math.abs(neighborBounds.centerY - junctionBounds.centerY);
      if (dx >= dy) {
        horizontal.push(neighbor);
      } else {
        vertical.push(neighbor);
      }
    }

    // Ideal T point: under stem(s), on the bar through side peers.
    let centerX = junctionBounds.centerX;
    let centerY = junctionBounds.centerY;

    if (vertical.length) {
      centerX =
        vertical.reduce((sum, node) => {
          const pos = nextPositions.get(node.id) ?? node.position;
          return sum + getFlowNodeBounds({ ...node, position: pos }).centerX;
        }, 0) / vertical.length;
    }

    if (horizontal.length) {
      centerY =
        horizontal.reduce((sum, node) => {
          const pos = nextPositions.get(node.id) ?? node.position;
          return sum + getFlowNodeBounds({ ...node, position: pos }).centerY;
        }, 0) / horizontal.length;
    }

    const half = JUNCTION_NODE_SIZE / 2;
    const nextJunctionPos = { x: centerX - half, y: centerY - half };
    const junctionDragged = preferNodeIds?.has(junction.id) ?? false;

    // Always snap hub to the orthogonal T (manual drag still ends on a straight cross).
    if (
      Math.abs(nextJunctionPos.x - junction.position.x) > 0.5 ||
      Math.abs(nextJunctionPos.y - junction.position.y) > 0.5
    ) {
      nextPositions.set(junction.id, nextJunctionPos);
      changed = true;
    }

    // Flatten horizontal bar partners onto the same Y (centered through the hub).
    for (const neighbor of horizontal) {
      if (junctionDragged && preferNodeIds?.has(neighbor.id)) continue;
      const bounds = getFlowNodeBounds(neighbor);
      const currentPos = nextPositions.get(neighbor.id) ?? neighbor.position;
      const alignedY = centerY - bounds.height / 2;
      if (Math.abs(currentPos.y - alignedY) > 0.5) {
        nextPositions.set(neighbor.id, { x: currentPos.x, y: alignedY });
        changed = true;
      }
    }
  }

  if (!changed) return nodeList;
  return nodeList.map((node) => {
    const position = nextPositions.get(node.id);
    return position ? { ...node, position } : node;
  });
};

/**
 * Level mostly-horizontal edges between non-junction nodes (no diagonal peer links).
 * If preferNodeIds is set, those nodes keep their Y and peers snap to them.
 */
const alignHorizontalPeerEdges = (
  nodeList: FlowNode[],
  edgeList: FlowEdge[],
  preferNodeIds?: Set<string>
): FlowNode[] => {
  if (!edgeList.length) return nodeList;

  const byId = new Map(nodeList.map((node) => [node.id, node]));
  const nextPositions = new Map<string, { x: number; y: number }>();
  let changed = false;

  const getPos = (node: FlowNode) => nextPositions.get(node.id) ?? node.position;
  const getBounds = (node: FlowNode) => getFlowNodeBounds({ ...node, position: getPos(node) });

  for (let pass = 0; pass < 4; pass += 1) {
    let passChanged = false;
    for (const edge of edgeList) {
      if (edge.hidden) continue;
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) continue;
      if (source.type === "junction" || target.type === "junction") continue;
      if (source.type === "annotation" || target.type === "annotation") continue;

      const sourceBounds = getBounds(source);
      const targetBounds = getBounds(target);
      const dx = Math.abs(targetBounds.centerX - sourceBounds.centerX);
      const dy = Math.abs(targetBounds.centerY - sourceBounds.centerY);
      if (dx < dy) continue;
      if (dy < 1) continue;

      const sourcePreferred = preferNodeIds?.has(source.id) ?? false;
      const targetPreferred = preferNodeIds?.has(target.id) ?? false;

      let lineY: number;
      if (preferNodeIds?.size) {
        if (sourcePreferred && !targetPreferred) {
          lineY = sourceBounds.centerY;
        } else if (targetPreferred && !sourcePreferred) {
          lineY = targetBounds.centerY;
        } else if (sourcePreferred || targetPreferred) {
          lineY = (sourceBounds.centerY + targetBounds.centerY) / 2;
        } else {
          continue;
        }
      } else {
        lineY = (sourceBounds.centerY + targetBounds.centerY) / 2;
      }

      const sourcePos = getPos(source);
      const targetPos = getPos(target);
      const nextSourceY = lineY - sourceBounds.height / 2;
      const nextTargetY = lineY - targetBounds.height / 2;

      if (!targetPreferred && Math.abs(targetPos.y - nextTargetY) > 0.5) {
        nextPositions.set(target.id, { x: targetPos.x, y: nextTargetY });
        passChanged = true;
      }
      if (!sourcePreferred && Math.abs(sourcePos.y - nextSourceY) > 0.5) {
        nextPositions.set(source.id, { x: sourcePos.x, y: nextSourceY });
        passChanged = true;
      }
      if (sourcePreferred && targetPreferred) {
        if (Math.abs(sourcePos.y - nextSourceY) > 0.5) {
          nextPositions.set(source.id, { x: sourcePos.x, y: nextSourceY });
          passChanged = true;
        }
        if (Math.abs(targetPos.y - nextTargetY) > 0.5) {
          nextPositions.set(target.id, { x: targetPos.x, y: nextTargetY });
          passChanged = true;
        }
      }
    }
    if (!passChanged) break;
    changed = true;
  }

  if (!changed) return nodeList;
  return nodeList.map((node) => {
    const position = nextPositions.get(node.id);
    return position ? { ...node, position } : node;
  });
};

const straightenChartGeometry = (
  nodeList: FlowNode[],
  edgeList: FlowEdge[],
  preferNodeIds?: Set<string>
): FlowNode[] => {
  const withJunctions = straightenJunctionNodes(nodeList, edgeList, preferNodeIds);
  return alignHorizontalPeerEdges(withJunctions, edgeList, preferNodeIds);
};

const resolveEdgeLayout = (
  sourceNode: FlowNode | undefined,
  targetNode: FlowNode | undefined,
  fallbackType: Edge["type"]
): { source: HandleOrientation; target: HandleOrientation; type: Edge["type"] } | null => {
  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);

  if (!sourceCenter || !targetCenter) {
    return fallbackType
      ? { source: "r", target: "l", type: fallbackType }
      : null;
  }

  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  if (absDeltaY >= absDeltaX) {
    const sourceAboveTarget = deltaY >= 0;
    const alignsX = absDeltaX <= EDGE_ALIGNMENT_TOLERANCE;
    return {
      source: sourceAboveTarget ? "b" : "t",
      target: sourceAboveTarget ? "t" : "b",
      type: fallbackType === "default" ? fallbackType : alignsX ? "straight" : "step",
    };
  }

  const sourceLeftOfTarget = deltaX <= 0;
  const alignsY = absDeltaY <= EDGE_ALIGNMENT_TOLERANCE;
  return {
    source: sourceLeftOfTarget ? "l" : "r",
    target: sourceLeftOfTarget ? "r" : "l",
    type: fallbackType === "default" ? fallbackType : alignsY ? "straight" : "step",
  };
};

// React Flow uses "step" as the built-in orthogonal connection/edge type.
// Use the enum instead of a string cast to avoid runtime/type issues.
const ORTHOGONAL_CONNECTION_LINE = ConnectionLineType.Step;
const SMOOTH_CONNECTION_LINE = ConnectionLineType.Bezier;
const STRAIGHT_CONNECTION_LINE = ConnectionLineType.Straight;

type EmployeeOption = {
  id: string;
  name: string;
  title: string;
  officeId: string | null;
  employeeTypeName: string;
  employeeTypeColor?: string;
  imageUrl: string;
};

type OfficeEmployeeRecord = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  positionTitle?: string;
  employeeType: string;
  employeeTypeColor?: string;
  employeeNo: string;
  photoUrl?: string;
  isHead: boolean;
};

type CanvasActions = {
  duplicateNode: (id: string) => void;
  addChildUnit: (id: string) => void;
  addChildPerson: (id: string) => void;
  updateNodeData: (id: string, updates: Partial<OrgNodeData>, options?: { pushHistory?: boolean }) => void;
};

const CanvasActionsContext = createContext<CanvasActions | null>(null);
const CanvasSettingsContext = createContext<{
  showPhotos: boolean;
  focusedOfficeId: string | null;
  employeePhotosById: Map<string, string>;
  employeePhotosByName: Map<string, string>;
}>({
  showPhotos: false,
  focusedOfficeId: null,
  employeePhotosById: new Map(),
  employeePhotosByName: new Map(),
});

const useCanvasActions = () => {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) {
    throw new Error("Canvas actions context not available");
  }
  return ctx;
};

const useCanvasSettings = () => useContext(CanvasSettingsContext);

const normalizePhotoLookupName = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

const OrgChartTool = ({ departmentId, logoUrl }: OrgChartToolProps) => (
  <div className="h-full min-h-0">
    <ReactFlowProvider>
      <OrgChartToolInner departmentId={departmentId} logoUrl={logoUrl} />
    </ReactFlowProvider>
  </div>
);

export default OrgChartTool;

const OrgChartToolInner = ({ departmentId, logoUrl }: OrgChartToolProps) => {
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const connectingStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const pendingFreeLineStartRef = useRef<{ x: number; y: number } | null>(null);
  const docRef = useRef<OrgChartDocument>({ nodes: [], edges: [], edgeType: "orth" });
  const latestDraftRef = useRef<OrgChartDocument>({ nodes: [], edges: [], edgeType: "orth" });
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(docRef.current));
  const saveTimer = useRef<number | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>([]);
  const [edgeType, setEdgeType] = useState<"orth" | "smoothstep" | "straight">("orth");
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [freeLineDraft, setFreeLineDraft] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const freeLineDrawingRef = useRef(false);
  const [allowCrossOfficeEdges, setAllowCrossOfficeEdges] = useState(true);
  const [versions, setVersions] = useState<OrgChartVersionSummary[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(DEFAULT_CANVAS_ZOOM);
  const [focusOfficeId, setFocusOfficeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [officeSearch, setOfficeSearch] = useState("");
  const [officePage, setOfficePage] = useState(1);
  const [draftSnapshot, setDraftSnapshot] = useState<string>(JSON.stringify(docRef.current));
  const [showPhotos, setShowPhotos] = useState(false);
    const [focusTrigger, setFocusTrigger] = useState(0);
    const [tool, setTool] = useState<Tool>("select");
    const [isFullscreenEdit, setIsFullscreenEdit] = useState(false);
    const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
    const [isAddOfficeOpen, setIsAddOfficeOpen] = useState(false);
    const [isDeleteVersionOpen, setIsDeleteVersionOpen] = useState(false);
    const [isDeletingVersion, setIsDeletingVersion] = useState(false);
    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
    const [watermarkSrc, setWatermarkSrc] = useState("/logo.png");
    const [helperLines, setHelperLines] = useState<{
      vertical: number | null;
      horizontal: number | null;
      spacings: SpacingGuide[];
    }>({
      vertical: null,
      horizontal: null,
      spacings: [],
    });
  const versionStorageKey = useMemo(
    () => `org-chart:current-version:${departmentId}`,
    [departmentId]
  );
  const officeFocusStorageKey = useMemo(
    () => `org-chart:last-office-focus:${departmentId}`,
    [departmentId]
  );
  const hasRestoredOfficeFocusRef = useRef(false);
  const hasInitializedOfficeFocusPersistenceRef = useRef(false);
  const persistCurrentVersionId = useCallback(
    (id: string | null) => {
      if (typeof window === "undefined") return;
      if (id) {
        window.localStorage.setItem(versionStorageKey, id);
      } else {
        window.localStorage.removeItem(versionStorageKey);
      }
    },
    [versionStorageKey]
  );
  const applyCurrentVersionId = useCallback(
    (id: string | null) => {
      setCurrentVersionId(id);
      persistCurrentVersionId(id);
    },
    [persistCurrentVersionId]
  );
  const clipboardRef = useRef<{
    nodes: FlowNode[];
    edges: FlowEdge[];
    sourceOfficeId: string | null;
    includePeople: boolean;
    copiedAt: number;
  } | null>(null);
  const [clipboardVersion, setClipboardVersion] = useState(0);
  const lastCopyPeopleRef = useRef(false);

  const defaultEdgeOptions = useMemo(
    () => ({ type: "step" as Edge["type"], interactionWidth: 28 }),
    []
  );
  const clipboardAvailable = useMemo(() => clipboardVersion > 0 && clipboardRef.current !== null, [clipboardVersion]);
  const employeePhotosById = useMemo(() => {
    const photos = new Map<string, string>();
    availableEmployees.forEach((employee) => {
      const imageUrl = employee.imageUrl?.trim();
      if (imageUrl) {
        photos.set(employee.id, imageUrl);
      }
    });
    return photos;
  }, [availableEmployees]);
  const employeePhotosByName = useMemo(() => {
    const photos = new Map<string, string>();
    const duplicateNames = new Set<string>();

    availableEmployees.forEach((employee) => {
      const imageUrl = employee.imageUrl?.trim();
      const lookupName = normalizePhotoLookupName(employee.name);
      if (!imageUrl || !lookupName) return;

      if (photos.has(lookupName)) {
        duplicateNames.add(lookupName);
        photos.delete(lookupName);
        return;
      }

      if (!duplicateNames.has(lookupName)) {
        photos.set(lookupName, imageUrl);
      }
    });

    return photos;
  }, [availableEmployees]);
  const reactFlowInstance = useReactFlow<FlowNodeData, FlowEdgeData>();
  const { fitView, project, getNode, setViewport, getNodes, getViewport, setCenter } = reactFlowInstance;

  const MIN_FOCUS_ZOOM = 0.25;
  const MAX_FOCUS_ZOOM = DEFAULT_CANVAS_ZOOM;

  const requestFocus = useCallback(() => {
    setFocusTrigger((prev) => prev + 1);
  }, []);

  const updatePointerPosition = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!reactFlowWrapper.current) {
        pointerPositionRef.current = null;
        return;
      }
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      pointerPositionRef.current = project({ x: localX, y: localY });
    },
    [project]
  );

  const clearPointerPosition = useCallback(() => {
    pointerPositionRef.current = null;
  }, []);

  const offices = useMemo(() => nodes.filter((node: FlowNode) => node.type === "office"), [nodes]);
  const officesSortedByName = useMemo(
    () => [...offices].sort((a, b) => a.data.name.localeCompare(b.data.name)),
    [offices]
  );
  const focusedOfficeSelectValue = useMemo(() => {
    if (!focusOfficeId) return undefined;
    const match = offices.find((office) => {
      const officeId = office.data.officeId ?? office.id;
      return officeId === focusOfficeId || office.id === focusOfficeId;
    });
    return match ? match.data.officeId ?? match.id : undefined;
  }, [focusOfficeId, offices]);
  const filteredOffices = useMemo(() => {
    const query = officeSearch.trim().toLowerCase();
    if (!query) return offices;
    return offices.filter((office) => office.data.name.toLowerCase().includes(query));
  }, [officeSearch, offices]);
  const officesPerPage = 5;
  const totalOfficePages = Math.max(1, Math.ceil(filteredOffices.length / officesPerPage));
  const paginatedOffices = useMemo(() => {
    const start = (officePage - 1) * officesPerPage;
    return filteredOffices.slice(start, start + officesPerPage);
  }, [filteredOffices, officePage]);

  useEffect(() => {
    setOfficePage(1);
  }, [officeSearch]);

  useEffect(() => {
    if (officePage > totalOfficePages) {
      setOfficePage(totalOfficePages);
    }
  }, [officePage, totalOfficePages]);

  useEffect(() => {
    hasRestoredOfficeFocusRef.current = false;
    hasInitializedOfficeFocusPersistenceRef.current = false;
  }, [departmentId]);

  useEffect(() => {
    if (!hasInitializedOfficeFocusPersistenceRef.current) return;
    if (typeof window === "undefined") return;
    if (focusOfficeId) {
      window.localStorage.setItem(officeFocusStorageKey, focusOfficeId);
    }
  }, [focusOfficeId, officeFocusStorageKey]);

  const isHand = tool === "hand";
  const customMarkerDefinitions = useMemo(() => getCustomMarkerDefinitions(edges), [edges]);
  const handleEdgeTypeChange = useCallback(
    (value: "orth" | "smoothstep" | "straight") => {
      setEdgeType(value);
      setEdges((currentEdges: FlowEdge[]) =>
        currentEdges.map((edge: FlowEdge) => ({
          ...edge,
          type: mapDocEdgeTypeToFlow(value),
          data: {
            ...edge.data,
            customType: value,
          },
        }))
      );
    },
    [setEdges]
  );

  const selectLineStyleFromFlyout = useCallback((value: "orth" | "smoothstep" | "straight") => {
    // Default for new connections only — do not rewrite the whole chart.
    setEdgeType(value);
    setTool("connect");
    setLineMenuOpen(false);
    pendingFreeLineStartRef.current = null;
    freeLineDrawingRef.current = false;
    setFreeLineDraft(null);
  }, []);
  const hideInterfaceForExport = useCallback(() => {
    const targets = [
      ".react-flow__controls",
      ".react-flow__minimap",
      ".react-flow__panel",
      ".react-flow__attribution",
      "[data-orgchart-export-ignore='true']",
    ];
    const restored: Array<{ element: HTMLElement; visibility: string }> = [];
    if (!reactFlowWrapper.current) return () => undefined;
    targets.forEach((selector) => {
      const elements = reactFlowWrapper.current?.querySelectorAll(selector);
      elements?.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        restored.push({ element: el, visibility: el.style.visibility });
        el.style.visibility = "hidden";
      });
    });
    return () => {
      restored.forEach(({ element, visibility }) => {
        element.style.visibility = visibility;
      });
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isEditable = (element: Element | null) =>
      Boolean(
        element &&
          (element.tagName === "INPUT" ||
            element.tagName === "TEXTAREA" ||
            element.tagName === "SELECT" ||
            (element as HTMLElement).isContentEditable)
      );

    const handleToolHotkeys = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (isEditable(activeElement)) return;

      // Ctrl/Cmd+F toggles fullscreen edit (overrides browser Find while on this tool).
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsFullscreenEdit((current) => !current);
        return;
      }

      if (event.key === "Escape" || event.key === "Esc") {
        // Esc always returns to Select — never exits fullscreen (Exit button / Ctrl+F only).
        event.preventDefault();
        setTool("select");
        return;
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setTool("hand");
      }
    };

    window.addEventListener("keydown", handleToolHotkeys);
    return () => {
      window.removeEventListener("keydown", handleToolHotkeys);
    };
  }, [setTool]);

  useEffect(() => {
    if (!isFullscreenEdit) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreenEdit]);

  useEffect(() => {
    const fallback = "/logo.png";
    const source = logoUrl?.trim();
    if (!source) {
      setWatermarkSrc(fallback);
      return;
    }
    if (source.startsWith("/") || source.startsWith("data:")) {
      setWatermarkSrc(source);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(source, { mode: "cors" });
        if (!response.ok) throw new Error("Failed to load logo");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setWatermarkSrc(objectUrl);
      } catch {
        if (!cancelled) setWatermarkSrc(fallback);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logoUrl]);

  const cloneFlowNode = useCallback((node: FlowNode): FlowNode => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
    style: node.style ? { ...node.style } : undefined,
    dragging: false,
    selected: false,
    positionAbsolute: node.positionAbsolute ? { ...node.positionAbsolute } : undefined,
    width: node.width,
    height: node.height,
  }), []);

  // clone edges safely: copy nested optionals too
  const cloneFlowEdge = useCallback(
    (edge: FlowEdge): FlowEdge => {
      const cloned: FlowEdge = { ...edge };
      if (edge.data) cloned.data = { ...edge.data };
      if (edge.style) cloned.style = { ...edge.style } as typeof edge.style;
      // markerEnd/markerStart can be boolean | object depending on reactflow types; copy only if object
      if (edge.markerEnd && typeof edge.markerEnd === "object") {
        cloned.markerEnd = { ...(edge.markerEnd as Record<string, unknown>) } as typeof edge.markerEnd;
      }
      if (edge.markerStart && typeof edge.markerStart === "object") {
        cloned.markerStart = { ...(edge.markerStart as Record<string, unknown>) } as typeof edge.markerStart;
      }
      return cloned;
    },
    []
  );

  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<FlowEdge[]>([]);
  const focusTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const draggedNodeIdsRef = useRef<Set<string>>(new Set());
  const pendingHistoryEntryRef = useRef<GraphState | null>(null);
  const historyRef = useRef<{ past: GraphState[]; future: GraphState[] }>({ past: [], future: [] });
  const [historyStatus, setHistoryStatus] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(
    () => () => {
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
      }
      pendingHistoryEntryRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!offices.length) return;
    if (typeof window === "undefined") return;

    const firstOffice = offices[0];
    const firstOfficeId = firstOffice.data.officeId ?? firstOffice.id;
    const storedOfficeId = window.localStorage.getItem(officeFocusStorageKey);

    let shouldRequestFocus = false;
    setFocusOfficeId((current) => {
      const currentOffice = offices.find((office) => {
        const officeId = office.data.officeId ?? office.id;
        return officeId === current || office.id === current;
      });
      if (currentOffice) return currentOffice.data.officeId ?? currentOffice.id;

      const storedOffice = offices.find((office) => {
        const officeId = office.data.officeId ?? office.id;
        return officeId === storedOfficeId || office.id === storedOfficeId;
      });
      shouldRequestFocus = true;
      return storedOffice ? storedOffice.data.officeId ?? storedOffice.id : firstOfficeId ?? current;
    });
    hasRestoredOfficeFocusRef.current = true;
    hasInitializedOfficeFocusPersistenceRef.current = true;
    if (shouldRequestFocus) {
      requestFocus();
    }
  }, [officeFocusStorageKey, offices, requestFocus]);

  const getCurrentGraphState = useCallback(
    (): GraphState =>
      cloneGraphState({
        nodes: nodesRef.current,
        edges: edgesRef.current,
      }),
    []
  );

  const updateHistoryStatus = useCallback(() => {
    const history = historyRef.current;
    setHistoryStatus({ canUndo: history.past.length > 0, canRedo: history.future.length > 0 });
  }, []);

  const pushHistoryEntry = useCallback(
    (entry: GraphState) => {
      const history = historyRef.current;
      history.past.push(entry);
      if (history.past.length > HISTORY_LIMIT) {
        history.past.shift();
      }
      history.future = [];
      pendingHistoryEntryRef.current = null;
      updateHistoryStatus();
    },
    [updateHistoryStatus]
  );

  const pushHistorySnapshot = useCallback(() => {
    const snapshot = getCurrentGraphState();
    pushHistoryEntry(snapshot);
  }, [getCurrentGraphState, pushHistoryEntry]);

    const runWithHistory = useCallback(
      (operation: () => void) => {
        pushHistorySnapshot();
        operation();
      },
      [pushHistorySnapshot]
    );

    const applyNodeUpdates = useCallback(
      (nodeId: string, updates: Partial<OrgNodeData>, options?: { pushHistory?: boolean }) => {
        const target = nodesRef.current.find((node) => node.id === nodeId);
        if (!target) return;

        const prepared: Partial<OrgNodeData> = { ...updates };

        if ("outlineColor" in updates && updates.outlineColor !== undefined) {
          const normalized =
            normalizeColor(updates.outlineColor) ??
            normalizeColor(target.data.outlineColor) ??
            NEUTRAL_OUTLINE_COLOR;
          prepared.outlineColor = normalized;
          prepared.headerColor = normalized;
        }

        if ("employeeTypeColor" in updates) {
          prepared.employeeTypeColor = normalizeColor(updates.employeeTypeColor) ?? undefined;
        }

        if ("color" in updates) {
          prepared.color = normalizeColor(updates.color) ?? undefined;
        }

        if ("bg" in updates) {
          prepared.bg = normalizeColor(updates.bg) ?? undefined;
        }

        if ("fontSize" in updates) {
          prepared.fontSize = normalizeAnnotationFontSize(updates.fontSize);
        }

        if ("weight" in updates) {
          prepared.weight = normalizeAnnotationWeight(updates.weight);
        }

        if ("align" in updates) {
          prepared.align = normalizeAnnotationAlignment(updates.align);
        }

        if ("rotate" in updates) {
          prepared.rotate = normalizeAnnotationRotation(updates.rotate);
        }

        if ("z" in updates) {
          prepared.z = typeof updates.z === "number" && !Number.isNaN(updates.z) ? updates.z : target.data.z;
        }

        if ("lock" in updates) {
          prepared.lock = Boolean(updates.lock);
        }

        const hasChanges = Object.entries(prepared).some(([key, value]) => {
          const current = (target.data as Record<string, unknown>)[key];
          return current !== value;
        });

        if (!hasChanges) {
          return;
        }

        const apply = () => {
          setNodes((nds: FlowNode[]) =>
            nds.map((node: FlowNode) => {
              if (node.id !== nodeId) return node;
              const updatedData = {
                ...node.data,
                ...prepared,
              };
              const lockValue =
                node.type === "annotation"
                  ? ("lock" in prepared ? Boolean(prepared.lock) : Boolean(updatedData.lock))
                  : undefined;
              return {
                ...node,
                data: updatedData,
                ...(node.type === "annotation" ? { draggable: !lockValue } : {}),
              };
            })
          );
        };

        if (options?.pushHistory === false) {
          apply();
        } else {
          runWithHistory(apply);
        }
      },
      [runWithHistory, setNodes]
    );

  const resetHistory = useCallback(() => {
    historyRef.current = { past: [], future: [] };
    pendingHistoryEntryRef.current = null;
    updateHistoryStatus();
  }, [updateHistoryStatus]);

  const copySelection = useCallback(
    (includePeople: boolean) => {
      const nodeIdSet = new Set<string>();
      if (selectedNodeIds.length) {
        selectedNodeIds.forEach((id) => nodeIdSet.add(id));
      } else if (focusOfficeId) {
        nodes.forEach((node) => {
          if (node.data.officeId === focusOfficeId && node.type !== "office") {
            nodeIdSet.add(node.id);
          }
        });
      }

      if (!nodeIdSet.size) {
        toast({
          title: "Nothing to copy",
          description: "Select nodes or choose an office first.",
        });
        return;
      }

      const nodesToCopy = nodes
        .filter((node) => nodeIdSet.has(node.id))
        .map((node) => {
          const cloned = cloneFlowNode(node);
          if (!includePeople && cloned.type === "person") {
            cloned.data = {
              ...cloned.data,
              employeeId: undefined,
              employeeTypeName: undefined,
              employeeTypeColor: undefined,
              imageUrl: undefined,
              notes: undefined,
            };
          }
          return cloned;
        });

      if (!nodesToCopy.length) {
        toast({
          title: "Nothing to copy",
          description: "No eligible nodes found for copying.",
        });
        return;
      }

      const nodeIdsCopied = new Set(nodesToCopy.map((node) => node.id));
      const edgesToCopy = edges
        .filter((edge) => nodeIdsCopied.has(edge.source) && nodeIdsCopied.has(edge.target))
        .map((edge) => cloneFlowEdge(edge));

      const sourceOfficeId =
        focusOfficeId ?? nodesToCopy.find((node) => node.data.officeId)?.data.officeId ?? null;

      clipboardRef.current = {
        nodes: nodesToCopy,
        edges: edgesToCopy,
        sourceOfficeId,
        includePeople,
        copiedAt: Date.now(),
      };
      lastCopyPeopleRef.current = includePeople;
      setClipboardVersion((prev) => prev + 1);
      toast({
        title: "Copied to clipboard",
        description: `Copied ${nodesToCopy.length} ${nodesToCopy.length === 1 ? "node" : "nodes"} and ${edgesToCopy.length} ${edgesToCopy.length === 1 ? "edge" : "edges"}.`,
      });
    },
    [cloneFlowNode, cloneFlowEdge, edges, focusOfficeId, nodes, selectedNodeIds, toast]
  );

  const cutSelection = useCallback(() => {
    if (!selectedNodeIds.length && !selectedEdgeIds.length) {
      toast({
        title: "Nothing to cut",
        description: "Select nodes or edges first.",
      });
      return;
    }

    copySelection(lastCopyPeopleRef.current);

    const selectedNodeIdSet = new Set(selectedNodeIds);
    const selectedEdgeIdSet = new Set(selectedEdgeIds);

    runWithHistory(() => {
      setEdges((existing) =>
        existing.filter(
          (edge) =>
            !selectedEdgeIdSet.has(edge.id) &&
            !selectedNodeIdSet.has(edge.source) &&
            !selectedNodeIdSet.has(edge.target)
        )
      );
      setNodes((existing) => existing.filter((node) => !selectedNodeIdSet.has(node.id)));
    });

    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    requestFocus();
    toast({
      title: "Cut to clipboard",
      description: "Selection removed and ready to paste.",
    });
  }, [
    copySelection,
    requestFocus,
    runWithHistory,
    selectedEdgeIds,
    selectedNodeIds,
    setEdges,
    setNodes,
    setSelectedEdgeIds,
    setSelectedNodeIds,
    toast,
  ]);

  const pasteIntoOffice = useCallback(
    (options?: { targetOfficeId?: string | null; centerOnViewport?: boolean }) => {
      const clipboard = clipboardRef.current;
      if (!clipboard) {
        toast({
          title: "Clipboard is empty",
          description: "Copy nodes before pasting.",
          variant: "destructive",
        });
        return;
      }

      const targetOfficeId =
        options?.targetOfficeId ??
        focusOfficeId ??
        clipboard.sourceOfficeId ??
        (offices[0]?.data.officeId ?? offices[0]?.id ?? null);

      if (!targetOfficeId) {
        toast({
          title: "No target office",
          description: "Select an office to paste into.",
          variant: "destructive",
        });
        return;
      }

      const idMap = new Map<string, string>();
      const clonedNodes = clipboard.nodes.map((node) => cloneFlowNode(node));
      const clonedEdges = clipboard.edges.map((edge) => cloneFlowEdge(edge));

      clonedNodes.forEach((node) => {
        const newId = crypto.randomUUID();
        idMap.set(node.id, newId);
        node.id = newId;
        node.data = {
          ...node.data,
          officeId: targetOfficeId,
        };
        node.selected = false;
        node.dragging = false;
      });

      const bbox = clonedNodes.reduce(
        (acc, node) => ({
          minX: Math.min(acc.minX, node.position.x),
          minY: Math.min(acc.minY, node.position.y),
          maxX: Math.max(acc.maxX, node.position.x),
          maxY: Math.max(acc.maxY, node.position.y),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );

      const width = bbox.maxX === -Infinity ? 0 : bbox.maxX - bbox.minX;
      const height = bbox.maxY === -Infinity ? 0 : bbox.maxY - bbox.minY;

      let offset = { x: 80, y: 80 };

      if (options?.centerOnViewport && reactFlowWrapper.current) {
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const projectedCenter = project({
          x: bounds.width / 2,
          y: bounds.height / 2,
        });
        const sourceCenter = {
          x: bbox.minX + width / 2,
          y: bbox.minY + height / 2,
        };
        offset = {
          x: projectedCenter.x - sourceCenter.x,
          y: projectedCenter.y - sourceCenter.y,
        };
      } else if (pointerPositionRef.current) {
        const sourceCenter = {
          x: bbox.minX + width / 2,
          y: bbox.minY + height / 2,
        };
        offset = {
          x: pointerPositionRef.current.x - sourceCenter.x,
          y: pointerPositionRef.current.y - sourceCenter.y,
        };
      }

      if (targetOfficeId === clipboard.sourceOfficeId && !options?.centerOnViewport) {
        offset = pointerPositionRef.current ? offset : { x: 120, y: 120 };
      }

      const pastedNodeIds: string[] = [];
      const newNodes = clonedNodes.map((node) => {
        pastedNodeIds.push(node.id);
        return {
          ...node,
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
        };
      });

      const newEdges: FlowEdge[] = [];
      clonedEdges.forEach((edge) => {
        const newSource = idMap.get(edge.source);
        const newTarget = idMap.get(edge.target);
        if (!newSource || !newTarget) {
          return;
        }
        const orientationSource = normalizeHandleId(edge.sourceHandle);
        const orientationTarget = normalizeHandleId(edge.targetHandle);
        const color = edge.data?.color ?? DEFAULT_EDGE_COLOR;
        let customType: "orth" | "smoothstep" | "straight" | undefined;
        switch (edge.data?.customType) {
          case "orth":
          case "smoothstep":
          case "straight":
            customType = edge.data.customType;
            break;
          default:
            customType = undefined;
        }

        const mergedData: FlowEdgeData = { ...(edge.data ?? {}), color };
        const newEdgeBase: FlowEdge = {
          ...edge,
          id: `edge-${crypto.randomUUID()}`,
          source: newSource,
          target: newTarget,
          sourceHandle: getSourceHandleId(orientationSource),
          targetHandle: getTargetHandleId(orientationTarget),
          data: mergedData,
        };
        if (customType) {
          mergedData.customType = customType;
        } else {
          delete mergedData.customType;
        }

        newEdges.push(applyEdgePresentation(newEdgeBase));
      });

      runWithHistory(() => {
        setNodes((existing) => [...existing, ...newNodes]);
        setEdges((existing) => [...existing, ...newEdges]);
      });
      setSelectedNodeIds(pastedNodeIds);
      setFocusOfficeId(targetOfficeId);
      requestFocus();
      toast({
        title: "Pasted nodes",
        description: `Added ${newNodes.length} ${newNodes.length === 1 ? "node" : "nodes"} to the office.`,
      });
    },
    [cloneFlowEdge, cloneFlowNode, focusOfficeId, offices, project, requestFocus, runWithHistory, setEdges, setNodes, setSelectedNodeIds, toast]
  );

  const undo = useCallback((): boolean => {
    const history = historyRef.current;
    if (!history.past.length) {
      return false;
    }
    const previous = history.past.pop();
    if (!previous) return false;
    const current = getCurrentGraphState();
    history.future.unshift(cloneGraphState(current));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    updateHistoryStatus();
    requestFocus();
    return true;
  }, [getCurrentGraphState, requestFocus, setEdges, setNodes, updateHistoryStatus]);

  const redo = useCallback((): boolean => {
    const history = historyRef.current;
    if (!history.future.length) {
      return false;
    }
    const next = history.future.shift();
    if (!next) return false;
    history.past.push(getCurrentGraphState());
    setNodes(next.nodes);
    setEdges(next.edges);
    updateHistoryStatus();
    requestFocus();
    return true;
  }, [getCurrentGraphState, requestFocus, setEdges, setNodes, updateHistoryStatus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      const isMac = navigator.platform.toLowerCase().includes("mac");
      const primaryKey = isMac ? event.metaKey : event.ctrlKey;
      if (!primaryKey) return;

      const key = event.key.toLowerCase();
      if (key === "z") {
        if (event.shiftKey) {
          if (redo()) {
            event.preventDefault();
          }
          return;
        }
        if (undo()) {
          event.preventDefault();
        }
        return;
      }
      if (key === "y") {
        if (redo()) {
          event.preventDefault();
        }
        return;
      }
      if (key === "c") {
        if (event.shiftKey) return;
        copySelection(lastCopyPeopleRef.current);
        event.preventDefault();
        return;
      }
      if (key === "x") {
        if (event.shiftKey) return;
        cutSelection();
        event.preventDefault();
        return;
      }
      if (key === "v") {
        if (event.shiftKey) {
          pasteIntoOffice({ centerOnViewport: true });
          event.preventDefault();
          return;
        }
        pasteIntoOffice();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [copySelection, cutSelection, pasteIntoOffice, redo, undo]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeIds.length) return null;
    return nodes.find((node: FlowNode) => node.id === selectedNodeIds[0]) ?? null;
  }, [nodes, selectedNodeIds]);

  const canConnectToSelectedParent = useMemo(() => {
    if (selectedNodeIds.length !== 1) return false;
    if (!selectedNode) return false;
    return selectedNode.type === "office" || selectedNode.type === "unit" || selectedNode.type === "person";
  }, [selectedNode, selectedNodeIds]);

  const defaultDropNearCursor = useMemo(() => !canConnectToSelectedParent, [canConnectToSelectedParent]);

  const selectedNodeOutlineColor = useMemo(() => {
    if (!selectedNode) return NEUTRAL_OUTLINE_COLOR;
    return (
      normalizeColor(selectedNode.data.outlineColor) ??
      normalizeColor(selectedNode.data.headerColor) ??
      (selectedNode.type === "person" ? normalizeColor(selectedNode.data.employeeTypeColor) : null) ??
      normalizeColor(DEFAULT_NODE_COLORS[selectedNode.type as OrgNodeType]) ??
      NEUTRAL_OUTLINE_COLOR
    );
  }, [selectedNode]);

  const selectedAnnotationText =
    selectedNode?.type === "annotation"
      ? selectedNode.data.text ?? selectedNode.data.name ?? ""
      : "";
  const selectedAnnotationFontSize =
    selectedNode?.type === "annotation"
      ? normalizeAnnotationFontSize(selectedNode.data.fontSize)
      : DEFAULT_ANNOTATION_FONT_SIZE;
  const selectedAnnotationColor =
    selectedNode?.type === "annotation"
      ? normalizeColor(selectedNode.data.color) ?? DEFAULT_ANNOTATION_COLOR
      : DEFAULT_ANNOTATION_COLOR;
  const selectedAnnotationBg =
    selectedNode?.type === "annotation"
      ? normalizeColor(selectedNode.data.bg) ?? undefined
      : undefined;
  const selectedAnnotationWeight =
    selectedNode?.type === "annotation"
      ? normalizeAnnotationWeight(selectedNode.data.weight)
      : "bold";
  const selectedAnnotationAlign =
    selectedNode?.type === "annotation"
      ? normalizeAnnotationAlignment(selectedNode.data.align)
      : "left";
  const selectedAnnotationRotation =
    selectedNode?.type === "annotation"
      ? normalizeAnnotationRotation(selectedNode.data.rotate)
      : 0;
  const selectedAnnotationLocked = selectedNode?.type === "annotation" ? Boolean(selectedNode.data.lock) : false;

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeIds.length) return null;
    return edges.find((edge: FlowEdge) => edge.id === selectedEdgeIds[0]) ?? null;
  }, [edges, selectedEdgeIds]);

  const selectedEdgeMarkerConfig = useMemo(() => {
    if (!selectedEdge) {
      return {
        start: DEFAULT_MARKER_START,
        end: DEFAULT_MARKER_END,
        color: DEFAULT_EDGE_COLOR,
        size: DEFAULT_MARKER_SIZE,
      };
    }
    const data = selectedEdge.data ?? {};
    const color = normalizeColor(data.markerColor ?? data.color) ?? DEFAULT_EDGE_COLOR;
    return {
      start: data.markerStartType ?? DEFAULT_MARKER_START,
      end: data.markerEndType ?? DEFAULT_MARKER_END,
      color,
      size: normalizeMarkerSizeValue(data.markerSize),
    };
  }, [selectedEdge]);

  const highlightNode = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId);
      if (!node) return;
      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
      const center = getNodeCenter(node);
      if (!center) return;
      const viewport = getViewport();
      const zoom = clamp(viewport?.zoom ?? 1, MIN_FOCUS_ZOOM, MAX_FOCUS_ZOOM);
      requestAnimationFrame(() => {
        try {
          setCenter(center.x, center.y, { zoom, duration: 400 });
        } catch {
          // ignore center errors
        }
      });
    },
    [MIN_FOCUS_ZOOM, MAX_FOCUS_ZOOM, getNode, getViewport, setCenter, setSelectedEdgeIds, setSelectedNodeIds]
  );

  const collectNodesForOffice = useCallback((officeId: string | null, sourceNodes: FlowNode[]): FlowNode[] => {
    if (!sourceNodes.length) {
      return [];
    }

    const visibleNodes = sourceNodes.filter((node) => !node.hidden);
    if (!officeId) {
      return visibleNodes.length ? visibleNodes : sourceNodes;
    }

    const officeNodesVisible = visibleNodes.filter((node) => {
      if (node.type === "office") {
        return (node.data.officeId ?? node.id) === officeId || node.id === officeId;
      }
      return node.data.officeId === officeId;
    });

    if (officeNodesVisible.length) {
      return officeNodesVisible;
    }

    const officeNodesAll = sourceNodes.filter((node) => {
      if (node.type === "office") {
        return (node.data.officeId ?? node.id) === officeId || node.id === officeId;
      }
      return node.data.officeId === officeId;
    });

    if (officeNodesAll.length) {
      return officeNodesAll;
    }

    return visibleNodes.length ? visibleNodes : sourceNodes;
  }, []);

  const focusOffice = useCallback(
    (officeId: string | null, delay = 0) => {
      if (isDraggingRef.current || isPanningRef.current) {
        return;
      }

      if (!nodesRef.current.length) {
        return;
      }

      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
      }

      focusTimeoutRef.current = window.setTimeout(() => {
        const targets = collectNodesForOffice(officeId, nodesRef.current);
        if (!targets.length) {
          return;
        }

        try {
          fitView({
            nodes: targets,
            padding: 0.2,
            duration: 500,
            minZoom: MIN_FOCUS_ZOOM,
            maxZoom: MAX_FOCUS_ZOOM,
            includeHiddenNodes: true,
          });
        } catch {
          // ignore focus errors
        } finally {
          focusTimeoutRef.current = null;
        }
      }, delay);
    },
    [collectNodesForOffice, fitView, MAX_FOCUS_ZOOM, MIN_FOCUS_ZOOM]
  );

  const zoomToOfficeContent = useCallback(
    (nextZoom: number) => {
      const targetZoom = clamp(nextZoom, 0.2, 3);
      const targets = collectNodesForOffice(focusOfficeId, nodesRef.current);
      if (!targets.length) {
        const vp = getViewport();
        setViewport({ ...vp, zoom: targetZoom }, { duration: 150 });
        setCanvasZoom(targetZoom);
        return;
      }
      const bounds = getRectOfNodes(targets);
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      setCenter(centerX, centerY, { zoom: targetZoom, duration: 150 });
      setCanvasZoom(targetZoom);
    },
    [collectNodesForOffice, focusOfficeId, getViewport, setCenter, setViewport]
  );

  const handleNodeDragStart = useCallback(
    (_event: unknown, dragged: FlowNode) => {
      isDraggingRef.current = true;
      pendingHistoryEntryRef.current = getCurrentGraphState();
      const preferred = new Set<string>([dragged.id]);
      for (const id of selectedNodeIds) preferred.add(id);
      draggedNodeIdsRef.current = preferred;
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    },
    [getCurrentGraphState, selectedNodeIds]
  );

  const handleNodeDrag = useCallback(
    (_event: unknown, dragged: FlowNode) => {
      const peers = nodesRef.current.filter(
        (node) => node.id !== dragged.id && isSpacingGuideTarget(node)
      );
      const alignment = computeDragGuides(
        toGuideBounds(dragged),
        peers.map(toGuideBounds),
        { alignThreshold: ALIGN_GUIDE_THRESHOLD }
      );
      setHelperLines({
        vertical: alignment.vertical,
        horizontal: alignment.horizontal,
        spacings: alignment.spacings,
      });

      setNodes((nds) => {
        let next = nds.map((node) => {
          if (node.id !== dragged.id) return node;
          return {
            ...node,
            position: {
              x: alignment.snapX ?? node.position.x,
              y: alignment.snapY ?? node.position.y,
            },
          };
        });

        // While dragging a person/unit, keep connected junction hubs under/on the T.
        // While dragging the hub itself, allow free move — snap on drag stop.
        if (dragged.type !== "junction") {
          const touchesJunction = edgesRef.current.some((edge) => {
            if (edge.source !== dragged.id && edge.target !== dragged.id) return false;
            const otherId = edge.source === dragged.id ? edge.target : edge.source;
            return next.find((n) => n.id === otherId)?.type === "junction";
          });
          if (touchesJunction) {
            next = straightenJunctionNodes(next, edgesRef.current, new Set([dragged.id]));
          }
        }
        return next;
      });
    },
    [setNodes]
  );

  const handleNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    setHelperLines({ vertical: null, horizontal: null, spacings: [] });
    const preferred = draggedNodeIdsRef.current;
    const straightened = straightenChartGeometry(nodesRef.current, edgesRef.current, preferred);
    draggedNodeIdsRef.current = new Set();
    if (straightened !== nodesRef.current) {
      setNodes(straightened);
      nodesRef.current = straightened;
    }
    if (pendingHistoryEntryRef.current) {
      const pending = pendingHistoryEntryRef.current;
      const hasMoved = pending.nodes.some((node) => {
        const current = nodesRef.current.find((item) => item.id === node.id);
        if (!current) return true;
        return current.position.x !== node.position.x || current.position.y !== node.position.y;
      });
      if (hasMoved) {
        pushHistoryEntry(pending);
      } else {
        pendingHistoryEntryRef.current = null;
      }
    }
  }, [pushHistoryEntry, setNodes]);

  const handleMoveStart = useCallback(() => {
    isPanningRef.current = true;
    if (focusTimeoutRef.current) {
      window.clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
  }, []);

  const handleMoveEnd = useCallback(() => {
    isPanningRef.current = false;
  }, []);

    const serializeDocument = useCallback(
      (flowNodes: FlowNode[], flowEdges: FlowEdge[], currentEdgeType: "orth" | "smoothstep" | "straight"): OrgChartDocument => ({
        nodes: flowNodes.map((node: FlowNode) => ({
          id: node.id,
          type: node.type as OrgNodeType,
          position: node.position,
          data:
            node.type === "annotation"
              ? {
                  name: node.data.name ?? node.data.text ?? DEFAULT_ANNOTATION_TEXT,
                  text: node.data.text ?? node.data.name ?? DEFAULT_ANNOTATION_TEXT,
                  color: normalizeColor(node.data.color) ?? DEFAULT_ANNOTATION_COLOR,
                  bg: normalizeColor(node.data.bg) ?? undefined,
                  fontSize: normalizeAnnotationFontSize(node.data.fontSize),
                  weight: normalizeAnnotationWeight(node.data.weight),
                  align: normalizeAnnotationAlignment(node.data.align),
                  rotate: normalizeAnnotationRotation(node.data.rotate),
                  z: typeof node.data.z === "number" && !Number.isNaN(node.data.z) ? node.data.z : undefined,
                  lock: Boolean(node.data.lock),
                }
              : {
                  name: node.data.name,
                  title: node.data.title,
                  employeeTypeName: node.data.employeeTypeName,
                  employeeTypeColor: node.data.employeeTypeColor,
                  isHead: node.data.isHead,
                  officeId: node.data.officeId,
                  employeeId: node.data.employeeId,
                  label: node.data.label,
                  outlineColor:
                    normalizeColor(node.data.outlineColor) ?? normalizeColor(node.data.headerColor) ?? undefined,
                  headerColor:
                    normalizeColor(node.data.outlineColor) ?? normalizeColor(node.data.headerColor) ?? undefined,
                  notes: node.data.notes,
                  imageUrl: node.data.imageUrl,
                },
          width: node.width ?? undefined,
          height: node.height ?? undefined,
        })),
      edges: flowEdges.map((edge: FlowEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: mapFlowEdgeTypeToDoc(edge.data?.customType ?? (edge.type as string | undefined)),
        label: typeof edge.label === "string" ? edge.label : undefined,
        color: edge.data?.color ?? DEFAULT_EDGE_COLOR,
        sourceHandle: normalizeHandleId(edge.sourceHandle) ?? undefined,
        targetHandle: normalizeHandleId(edge.targetHandle) ?? undefined,
        markerStartType: edge.data?.markerStartType ?? DEFAULT_MARKER_START,
        markerEndType: edge.data?.markerEndType ?? DEFAULT_MARKER_END,
        markerSize: normalizeMarkerSizeValue(edge.data?.markerSize),
        markerColor: edge.data?.markerColor ?? edge.data?.color ?? DEFAULT_EDGE_COLOR,
      })),
      edgeType: currentEdgeType,
    }),
    []
  );

    const applyNodeDefaults = useCallback(
      (docNodes: OrgChartNode[]): FlowNode[] =>
        docNodes.map((node: OrgChartNode) => {
          if (node.type === "junction") {
            return {
              id: node.id,
              type: "junction",
              position: node.position,
              data: {
                name: node.data.name || "Junction",
                officeId: node.data.officeId,
              },
              width: node.width ?? JUNCTION_NODE_SIZE,
              height: node.height ?? JUNCTION_NODE_SIZE,
              style: {
                width: node.width ?? JUNCTION_NODE_SIZE,
                height: node.height ?? JUNCTION_NODE_SIZE,
              },
            };
          }
          if (node.type === "lineEndpoint") {
            return {
              id: node.id,
              type: "lineEndpoint",
              position: node.position,
              data: {
                name: node.data.name || "Endpoint",
                officeId: node.data.officeId,
              },
              width: node.width ?? LINE_ENDPOINT_SIZE,
              height: node.height ?? LINE_ENDPOINT_SIZE,
              style: {
                width: node.width ?? LINE_ENDPOINT_SIZE,
                height: node.height ?? LINE_ENDPOINT_SIZE,
              },
            };
          }
          if (node.type === "annotation") {
            const text = node.data.text ?? node.data.name ?? DEFAULT_ANNOTATION_TEXT;
            const color = normalizeColor(node.data.color) ?? DEFAULT_ANNOTATION_COLOR;
            const bg = normalizeColor(node.data.bg) ?? undefined;
            const fontSize = normalizeAnnotationFontSize(node.data.fontSize);
            const weight = normalizeAnnotationWeight(node.data.weight);
            const align = normalizeAnnotationAlignment(node.data.align);
            const rotate = normalizeAnnotationRotation(node.data.rotate);
            const zValue = typeof node.data.z === "number" && !Number.isNaN(node.data.z) ? node.data.z : 0;
            const lock = Boolean(node.data.lock);
            return {
              id: node.id,
              type: node.type,
              position: node.position,
              data: {
                name: node.data.name ?? text,
                text,
                color,
                bg,
                fontSize,
                weight,
                align,
                rotate,
                z: zValue,
                lock,
              },
              width: node.width,
              height: node.height,
              draggable: !lock,
              connectable: false,
            };
          }

          const outlineColor =
            normalizeColor(node.data.outlineColor) ??
            normalizeColor(node.data.headerColor) ??
            (node.type === "person" ? normalizeColor(node.data.employeeTypeColor) : null) ??
            normalizeColor(DEFAULT_NODE_COLORS[node.type]) ??
            NEUTRAL_OUTLINE_COLOR;
          const cardWidth =
            node.type === "person" ? PERSON_CARD_WIDTH : GROUP_CARD_WIDTH;
          const cardHeight =
            node.type === "person" ? PERSON_CARD_HEIGHT : GROUP_CARD_HEIGHT;
          const baseNode: FlowNode = {
            id: node.id,
            type: node.type,
            position: node.position,
            data: {
              name: node.data.name,
              title: node.data.title,
              employeeTypeName: node.data.employeeTypeName,
              employeeTypeColor: normalizeColor(node.data.employeeTypeColor) ?? undefined,
              isHead: node.data.isHead,
              officeId: node.data.officeId,
              employeeId: node.data.employeeId,
              label: node.data.label ?? (node.type === "person" ? node.data.title ?? node.data.name : node.data.name),
              outlineColor,
              headerColor: outlineColor,
              notes: node.data.notes,
              imageUrl: node.data.imageUrl,
            },
            width: cardWidth,
            height: cardHeight,
            style: {
              width: cardWidth,
              height: cardHeight,
            },
          };
          if (node.type === "person") {
            baseNode.sourcePosition = Position.Right;
            baseNode.targetPosition = Position.Left;
          }
          return baseNode;
        }),
      []
    );

  const applyEdgeDefaults = useCallback(
    (docEdges: OrgChartEdge[]): FlowEdge[] =>
      docEdges.map((edge: OrgChartEdge) => {
        const normalizedColor = normalizeColor(edge.color) ?? DEFAULT_EDGE_COLOR;
        const markerSize = normalizeMarkerSizeValue(edge.markerSize);
        const markerColor = normalizeColor(edge.markerColor ?? normalizedColor) ?? normalizedColor;

        const baseEdge: FlowEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: getSourceHandleId(normalizeHandleId(edge.sourceHandle)),
          targetHandle: getTargetHandleId(normalizeHandleId(edge.targetHandle)),
          type: mapDocEdgeTypeToFlow(edge.type),
          label: edge.label,
          data: {
            color: normalizedColor,
            customType: edge.type,
            markerStartType: edge.markerStartType ?? DEFAULT_MARKER_START,
            markerEndType: edge.markerEndType ?? DEFAULT_MARKER_END,
            markerSize,
            markerColor,
          },
        };

        return applyEdgePresentation(baseEdge);
      }),
    []
  );

  const normalizeEdges = useCallback((edgeList: FlowEdge[], nodeList: FlowNode[]): FlowEdge[] => {
    const nodeLookup = new Map(nodeList.map((node) => [node.id, node]));
    let changed = false;

    const normalizedEdges = edgeList.map((edge) => {
      const sourceNode = nodeLookup.get(edge.source);
      const targetNode = nodeLookup.get(edge.target);
      const currentCustomType = edge.data?.customType;
      // Preserve intentionally straight edges (e.g. T-junction stems) so auto-layout
      // does not rewrite them into stepped/bent orthogonal paths.
      const lockStraight = currentCustomType === "straight";
      const fallbackType =
        currentCustomType === "smoothstep"
          ? mapDocEdgeTypeToFlow("smoothstep")
          : currentCustomType === "straight"
          ? "straight"
          : mapDocEdgeTypeToFlow(edgeType);
      const layout = lockStraight ? null : resolveEdgeLayout(sourceNode, targetNode, fallbackType);

      let desiredSourceHandle =
        edge.sourceHandle ??
        getSourceHandleId(normalizeHandleId(edge.sourceHandle)) ??
        getSourceHandleId("r");
      let desiredTargetHandle =
        edge.targetHandle ??
        getTargetHandleId(normalizeHandleId(edge.targetHandle)) ??
        getTargetHandleId("l");
      let desiredType: Edge["type"] = lockStraight ? "straight" : edge.type;

      let dataChanged = false;
      let edgeChanged = false;

      let nextData: FlowEdgeData | undefined;

      const ensureData = () => {
        if (!nextData) {
          nextData = edge.data ? { ...edge.data } : {};
        }
      };

      if (layout) {
        const resolvedSource = getSourceHandleId(layout.source) ?? desiredSourceHandle;
        const resolvedTarget = getTargetHandleId(layout.target) ?? desiredTargetHandle;

        if (resolvedSource !== edge.sourceHandle) {
          desiredSourceHandle = resolvedSource;
          edgeChanged = true;
        }
        if (resolvedTarget !== edge.targetHandle) {
          desiredTargetHandle = resolvedTarget;
          edgeChanged = true;
        }

        if (layout.type !== edge.type) {
          desiredType = layout.type;
          edgeChanged = true;
        }

        const desiredCustomType: FlowEdgeData["customType"] =
          layout.type === "straight"
            ? "straight"
            : layout.type === "smoothstep" || layout.type === "default"
            ? "smoothstep"
            : "orth";

        if (edge.data?.customType !== desiredCustomType) {
          ensureData();
          if (nextData) {
            nextData.customType = desiredCustomType;
            dataChanged = true;
          }
        }
      } else {
        const normalizedSourceHandle = getSourceHandleId(normalizeHandleId(edge.sourceHandle));
        if (normalizedSourceHandle && normalizedSourceHandle !== edge.sourceHandle) {
          desiredSourceHandle = normalizedSourceHandle;
          edgeChanged = true;
        }
        const normalizedTargetHandle = getTargetHandleId(normalizeHandleId(edge.targetHandle));
        if (normalizedTargetHandle && normalizedTargetHandle !== edge.targetHandle) {
          desiredTargetHandle = normalizedTargetHandle;
          edgeChanged = true;
        }
        if (lockStraight && edge.type !== "straight") {
          desiredType = "straight";
          edgeChanged = true;
        }
      }

      if (!edge.data?.color) {
        ensureData();
        if (nextData && !nextData.color) {
          nextData.color = DEFAULT_EDGE_COLOR;
          dataChanged = true;
        }
      }

      let updatedEdge = edge;

      if (edgeChanged) {
        updatedEdge = {
          ...edge,
          sourceHandle: desiredSourceHandle,
          targetHandle: desiredTargetHandle,
          type: desiredType,
          data: dataChanged ? nextData : edge.data,
        } as FlowEdge;
      } else if (dataChanged && nextData) {
        updatedEdge = { ...edge, data: nextData };
      }

      const presentedEdge = applyEdgePresentation(updatedEdge);

      if (presentedEdge !== edge) {
        changed = true;
      }

      return presentedEdge;
    });

    return changed ? normalizedEdges : edgeList;
  }, [edgeType]);

  const setDocument = useCallback(
    (document: OrgChartDocument, markSaved = true, shouldRefocus = false) => {
      const flowNodes = applyNodeDefaults(document.nodes);
      const flowEdges = normalizeEdges(applyEdgeDefaults(document.edges), flowNodes);
      const alignedNodes = straightenChartGeometry(flowNodes, flowEdges);
      setNodes(alignedNodes);
      setEdges(flowEdges);
      setEdgeType(document.edgeType ?? "orth");
      const normalizedDocument = serializeDocument(alignedNodes, flowEdges, document.edgeType ?? "orth");
      docRef.current = normalizedDocument;
      const snapshot = JSON.stringify(normalizedDocument);
      setDraftSnapshot(snapshot);
      if (markSaved) {
        lastSavedSnapshotRef.current = snapshot;
      }
      resetHistory();
      if (shouldRefocus) {
        requestFocus();
      }
    },
    [applyEdgeDefaults, applyNodeDefaults, normalizeEdges, requestFocus, resetHistory, serializeDocument, setEdges, setNodes]
  );

  const loadVersionById = useCallback(
    async (
      versionId: string
    ): Promise<
      | { status: "success"; record: OrgChartVersion }
      | { status: "not_found" }
      | { status: "error"; message: string }
    > => {
      try {
        const response = await fetch(
          `/api/${departmentId}/org-chart/versions/${versionId}`
        );
        if (response.status === 404) {
          return { status: "not_found" };
        }
        if (!response.ok) {
          const message = await response.text();
          return {
            status: "error",
            message: message || "Failed to load version",
          };
        }
        const record = (await response.json()) as OrgChartVersion;
        setVersions((prev) => {
          const summary: OrgChartVersionSummary = {
            id: record.id,
            departmentId: record.departmentId,
            label: record.label,
            createdAt: record.createdAt,
            isDefault: record.isDefault,
          };
          const existingIndex = prev.findIndex((item) => item.id === record.id);
          if (existingIndex === -1) {
            return [summary, ...prev];
          }
          const clone = [...prev];
          clone[existingIndex] = summary;
          return clone;
        });
        setDocument(record.data, true, true);
        applyCurrentVersionId(record.id);
        return { status: "success", record };
      } catch (error) {
        return {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load version",
        };
      }
    },
    [applyCurrentVersionId, departmentId, setDocument]
  );

  const fetchLatestDbDraft = useCallback(async (): Promise<{
    document: OrgChartDocument;
    employees: EmployeeOption[];
  }> => {
    const [previewRes, employeesRes] = await Promise.all([
      fetch(`/api/${departmentId}/org-chart/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeStaffUnit: false }),
      }),
      fetch(`/api/${departmentId}/employees/simple`),
    ]);

    if (!previewRes.ok) throw new Error(await previewRes.text());
    if (!employeesRes.ok) throw new Error(await employeesRes.text());

    const previewData = (await previewRes.json()) as { document: OrgChartDocument };
    const employees = (await employeesRes.json()) as EmployeeOption[];
    return { document: previewData.document, employees };
  }, [departmentId]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setIsChartLoading(true);
      const [latestDraft, versionsRes] = await Promise.all([
        fetchLatestDbDraft(),
        fetch(`/api/${departmentId}/org-chart/versions`),
      ]);

      latestDraftRef.current = latestDraft.document;
      setAvailableEmployees(latestDraft.employees);

      let versionList: OrgChartVersionSummary[] = [];
      if (versionsRes.ok) {
        versionList = (await versionsRes.json()) as OrgChartVersionSummary[];
      }
      setVersions(versionList);
      const latestVersion = versionList[0];
      if (latestVersion) {
        const result = await loadVersionById(latestVersion.id);
        if (result.status === "success") {
          return;
        }
      }

      setDocument(latestDraft.document, true, true);
      applyCurrentVersionId(null);
    } catch (error) {
      toast({
        title: "Failed to load org chart",
        description: error instanceof Error ? error.message : "Unable to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsChartLoading(false);
    }
  }, [applyCurrentVersionId, departmentId, fetchLatestDbDraft, loadVersionById, setDocument, toast]);

  const handleBuildFromDb = useCallback(async () => {
    try {
      setIsSyncing(true);
      const latestDraft = await fetchLatestDbDraft();
      const currentDocument = serializeDocument(nodesRef.current, edgesRef.current, edgeType);
      const selectedOfficeId =
        focusOfficeId &&
        offices.some((office) => {
          const officeId = office.data.officeId ?? office.id;
          return officeId === focusOfficeId || office.id === focusOfficeId;
        })
          ? focusOfficeId
          : null;
      const reconciledDocument = reconcileOrgChartDocument(
        currentDocument,
        latestDraft.document,
        {
          scopeOfficeId: selectedOfficeId,
          preserveConnections: true,
          placeNewEmployeesNearOfficeCluster: true,
        }
      );
      latestDraftRef.current = latestDraft.document;
      setAvailableEmployees(latestDraft.employees);
      // Keep current office focus — do not treat sync as office navigation.
      setDocument(reconciledDocument, false, false);
      toast({
        title: "Synced from DB",
        description: selectedOfficeId
          ? "Selected office synced: inactive/removed people dropped; new active employees added. Layout kept."
          : "Chart synced from DB. Layout kept.",
      });
    } catch (error) {
      toast({
        title: "Failed to sync from DB",
        description: error instanceof Error ? error.message : "Unable to load data",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [
    edgeType,
    fetchLatestDbDraft,
    focusOfficeId,
    offices,
    serializeDocument,
    setDocument,
    toast,
  ]);

  useEffect(() => {
    // Only reload when department changes — not when edgeType / helpers recreate loadInitialData.
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remount flash on line-style edits
  }, [departmentId]);

  useEffect(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    const snapshotDocument = serializeDocument(nodes, edges, edgeType);
    saveTimer.current = window.setTimeout(() => {
      docRef.current = snapshotDocument;
      setDraftSnapshot(JSON.stringify(snapshotDocument));
      if (!currentVersionId) {
        latestDraftRef.current = snapshotDocument;
      }
    }, 800);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [currentVersionId, edgeType, edges, nodes, serializeDocument]);

  useEffect(() => {
    setEdges((eds: FlowEdge[]) =>
      eds.map((edge: FlowEdge) => {
        if (edge.data?.customType) return edge;
        return {
          ...edge,
          type: mapDocEdgeTypeToFlow(edgeType),
        };
      })
    );
  }, [edgeType, setEdges]);

  useEffect(() => {
    setEdges((eds: FlowEdge[]) => normalizeEdges(eds, nodesRef.current));
  }, [normalizeEdges, setEdges, nodes]);

  useLayoutEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const isNodeVisible = (node: FlowNode) => {
      const officeMatch =
        !focusOfficeId ||
        (node.type === "office"
          ? (node.data.officeId ?? node.id) === focusOfficeId || node.id === focusOfficeId
          : node.data.officeId === focusOfficeId);

      const searchMatch =
        !normalizedSearch ||
        node.data.name.toLowerCase().includes(normalizedSearch) ||
        (node.data.title ?? "").toLowerCase().includes(normalizedSearch) ||
        (node.data.employeeTypeName ?? "").toLowerCase().includes(normalizedSearch);

      return officeMatch && searchMatch;
    };

    const visibleNodeIds = new Set(nodes.filter(isNodeVisible).map((node) => node.id));

    setNodes((nds: FlowNode[]) => {
      let changed = false;
      const nextNodes = nds.map((node: FlowNode) => {
        const hidden = !isNodeVisible(node);
        if (node.hidden === hidden) return node;
        changed = true;
        return { ...node, hidden };
      });
      return changed ? nextNodes : nds;
    });

    setEdges((eds: FlowEdge[]) => {
      let changed = false;
      const nextEdges = eds.map((edge: FlowEdge) => {
        const hidden = !(visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
        if (edge.hidden === hidden) return edge;
        changed = true;
        return { ...edge, hidden };
      });
      return changed ? nextEdges : eds;
    });
  }, [focusOfficeId, focusTrigger, nodes, searchTerm, setEdges, setNodes]);

  useEffect(() => {
    if (!nodesRef.current.length) return;
    focusOffice(focusOfficeId, 0);
  }, [focusOffice, focusOfficeId, focusTrigger]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removals = changes.filter((change) => change.type === "remove");
      if (removals.length) {
        const shouldCancel = removals.some((removal) => {
          const outgoing = edges.filter((edge: FlowEdge) => edge.source === removal.id);
          if (outgoing.length > 0) {
            return !window.confirm("Removing this node will also remove its connections. Continue?");
          }
          return false;
        });
        if (shouldCancel) {
          return;
        }
      }
      if (changes.some((change) => change.type === "remove")) {
        pushHistorySnapshot();
      }
      onNodesChange(changes);
    },
    [edges, onNodesChange, pushHistorySnapshot]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((change) => change.type === "remove")) {
        pushHistorySnapshot();
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, pushHistorySnapshot]
  );

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    setSelectedNodeIds(selectedNodes.map((node: FlowNode) => node.id));
    setSelectedEdgeIds(selectedEdges.map((edge: FlowEdge) => edge.id));
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        toast({
          title: "Invalid connection",
          description: "Cannot connect a node to itself.",
          variant: "destructive",
        });
        return;
      }

      const exists = edges.some(
        (edge: FlowEdge) => edge.source === connection.source && edge.target === connection.target
      );
      if (exists) {
        toast({
          title: "Duplicate connection",
          description: "These nodes are already connected.",
          variant: "destructive",
        });
        return;
      }

      const sourceNode = getNode(connection.source);
      const targetNode = getNode(connection.target);

      if (!allowCrossOfficeEdges) {
        const sourceOffice = sourceNode?.data?.officeId ?? sourceNode?.id;
        const targetOffice = targetNode?.data?.officeId ?? targetNode?.id;
        if (sourceOffice && targetOffice && sourceOffice !== targetOffice) {
          toast({
            title: "Connection blocked",
            description: "Cross-office connections are disabled.",
            variant: "destructive",
          });
          return;
        }
      }

      const defaultType = mapDocEdgeTypeToFlow(edgeType);
      const layout = resolveEdgeLayout(sourceNode, targetNode, defaultType);

      const fallbackSourceOrientation: HandleOrientation =
        layout?.source ?? normalizeHandleId(connection.sourceHandle) ?? "r";
      const fallbackTargetOrientation: HandleOrientation =
        layout?.target ?? normalizeHandleId(connection.targetHandle) ?? "l";

      const resolvedSourceHandle =
        getSourceHandleId(fallbackSourceOrientation) ?? getSourceHandleId("r") ?? "r-source";
      const resolvedTargetHandle =
        getTargetHandleId(fallbackTargetOrientation) ?? getTargetHandleId("l") ?? "l-target";

      const resolvedType: Edge["type"] = layout?.type ?? defaultType;
      const resolvedCustomType: FlowEdgeData["customType"] =
        resolvedType === "straight"
          ? "straight"
          : resolvedType === "smoothstep" || resolvedType === "default"
          ? "smoothstep"
          : "orth";

      const color = DEFAULT_EDGE_COLOR;

      const baseEdge: FlowEdge = {
        id: `edge-${crypto.randomUUID()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: resolvedSourceHandle,
        targetHandle: resolvedTargetHandle,
        type: resolvedType,
        label: "",
        data: {
          color,
          ...(resolvedCustomType ? { customType: resolvedCustomType } : {}),
          markerStartType: DEFAULT_MARKER_START,
          markerEndType: DEFAULT_MARKER_END,
          markerSize: DEFAULT_MARKER_SIZE,
          markerColor: color,
        },
      };

      const newEdge = applyEdgePresentation(baseEdge);

      runWithHistory(() => {
        setNodes((nds) => {
          const nextEdges = [...edgesRef.current, newEdge];
          return alignHorizontalPeerEdges(nds, nextEdges);
        });
        setEdges((eds: FlowEdge[]) => addEdge(newEdge, eds));
      });
    },
    [allowCrossOfficeEdges, edgeType, edges, getNode, runWithHistory, setEdges, setNodes, toast]
  );

  const handleConnectStart = useCallback(
    (
      _: unknown,
      params: { nodeId: string | null; handleId: string | null }
    ) => {
      if (!params.nodeId) {
        connectingStartRef.current = null;
        return;
      }
      connectingStartRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
      };
    },
    []
  );

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectingStartRef.current;
      connectingStartRef.current = null;
      if (!start?.nodeId || isHand) return;

      const clientX = "clientX" in event ? event.clientX : event.changedTouches?.[0]?.clientX;
      const clientY = "clientY" in event ? event.clientY : event.changedTouches?.[0]?.clientY;
      if (clientX == null || clientY == null || !reactFlowWrapper.current) return;

      const targetEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (targetEl?.closest(".react-flow__handle") || targetEl?.closest(".react-flow__node")) {
        return;
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const dropPosition = project({
        x: clientX - bounds.left,
        y: clientY - bounds.top,
      });

      const edgeAttrHost = targetEl?.closest("[data-orgchart-edge-id]") as HTMLElement | null;
      const edgeDom = targetEl?.closest(".react-flow__edge") as HTMLElement | null;
      let edgeId =
        edgeAttrHost?.getAttribute("data-orgchart-edge-id") ??
        edgeDom?.getAttribute("data-testid")?.replace(/^rf__edge-/, "") ??
        edgeDom?.dataset?.id ??
        null;

      let junctionAt = dropPosition;
      if (!edgeId) {
        const nearest = findNearestEdgeForBranch(
          dropPosition,
          edgesRef.current,
          nodesRef.current,
          start.nodeId,
          36
        );
        if (!nearest) return;
        edgeId = nearest.edgeId;
        junctionAt = nearest.point;
      }

      const targetEdge = edgesRef.current.find((edge) => edge.id === edgeId);
      if (!targetEdge) return;
      if (targetEdge.source === start.nodeId || targetEdge.target === start.nodeId) {
        toast({
          title: "Invalid connection",
          description: "That line is already connected to this node.",
          variant: "destructive",
        });
        return;
      }

      const junctionId = `junction-${crypto.randomUUID()}`;
      const sourceNode = getNode(start.nodeId);
      const edgeSourceNode = getNode(targetEdge.source);
      const edgeTargetNode = getNode(targetEdge.target);
      if (!edgeSourceNode || !edgeTargetNode) return;

      const officeId =
        sourceNode?.data.officeId ??
        edgeSourceNode.data.officeId ??
        edgeTargetNode.data.officeId ??
        (edgeSourceNode.type === "office" ? edgeSourceNode.id : undefined);

      if (!allowCrossOfficeEdges && officeId && sourceNode?.data.officeId && sourceNode.data.officeId !== officeId) {
        toast({
          title: "Connection blocked",
          description: "Cross-office connections are disabled.",
          variant: "destructive",
        });
        return;
      }

      const sourceBounds = getFlowNodeBounds(edgeSourceNode);
      const targetBounds = getFlowNodeBounds(edgeTargetNode);
      const branchSourceBounds = sourceNode ? getFlowNodeBounds(sourceNode) : null;
      const isHorizontalMain =
        Math.abs(targetBounds.centerX - sourceBounds.centerX) >=
        Math.abs(targetBounds.centerY - sourceBounds.centerY);

      const half = JUNCTION_NODE_SIZE / 2;
      let junctionCenter = { x: junctionAt.x, y: junctionAt.y };
      let nextSourcePosition = edgeSourceNode.position;
      let nextTargetPosition = edgeTargetNode.position;

      if (isHorizontalMain) {
        // Flatten the horizontal pair and put the junction on the true T point.
        // Anchor X to the branch node — never move the branch (keeps parent stem straight).
        const lineY = (sourceBounds.centerY + targetBounds.centerY) / 2;
        const junctionX =
          branchSourceBounds?.centerX ?? (sourceBounds.centerX + targetBounds.centerX) / 2;
        junctionCenter = { x: junctionX, y: lineY };

        nextSourcePosition = {
          x: edgeSourceNode.position.x,
          y: lineY - sourceBounds.height / 2,
        };
        nextTargetPosition = {
          x: edgeTargetNode.position.x,
          y: lineY - targetBounds.height / 2,
        };
      } else {
        const lineX = (sourceBounds.centerX + targetBounds.centerX) / 2;
        const junctionY =
          branchSourceBounds?.centerY ?? (sourceBounds.centerY + targetBounds.centerY) / 2;
        junctionCenter = { x: lineX, y: junctionY };

        nextSourcePosition = {
          x: lineX - sourceBounds.width / 2,
          y: edgeSourceNode.position.y,
        };
        nextTargetPosition = {
          x: lineX - targetBounds.width / 2,
          y: edgeTargetNode.position.y,
        };
      }

      const junctionNode: FlowNode = {
        id: junctionId,
        type: "junction",
        // Exact center — do not grid-snap or the stem becomes diagonal.
        position: {
          x: junctionCenter.x - half,
          y: junctionCenter.y - half,
        },
        data: {
          name: "Junction",
          officeId,
        },
        width: JUNCTION_NODE_SIZE,
        height: JUNCTION_NODE_SIZE,
        style: { width: JUNCTION_NODE_SIZE, height: JUNCTION_NODE_SIZE },
      };

      const leftIsSource = sourceBounds.centerX <= targetBounds.centerX;
      const topIsSource = sourceBounds.centerY <= targetBounds.centerY;
      const firstId = isHorizontalMain
        ? leftIsSource
          ? targetEdge.source
          : targetEdge.target
        : topIsSource
          ? targetEdge.source
          : targetEdge.target;
      const secondId = firstId === targetEdge.source ? targetEdge.target : targetEdge.source;

      const edgeStyleData = {
        ...(targetEdge.data ? { ...targetEdge.data } : {}),
        customType: "straight" as const,
      };
      const sharedEdgeProps = {
        type: "straight" as Edge["type"],
        label: typeof targetEdge.label === "string" ? targetEdge.label : "",
        data: edgeStyleData,
      };

      const edgeToJunction: FlowEdge = applyEdgePresentation({
        ...sharedEdgeProps,
        id: `edge-${crypto.randomUUID()}`,
        source: firstId,
        target: junctionId,
        sourceHandle: isHorizontalMain ? "r-source" : "b-source",
        targetHandle: isHorizontalMain ? "l-target" : "t-target",
      });
      const edgeFromJunction: FlowEdge = applyEdgePresentation({
        ...sharedEdgeProps,
        id: `edge-${crypto.randomUUID()}`,
        source: junctionId,
        target: secondId,
        sourceHandle: isHorizontalMain ? "r-source" : "b-source",
        targetHandle: isHorizontalMain ? "l-target" : "t-target",
        label: "",
      });

      const branchEdge: FlowEdge = applyEdgePresentation({
        id: `edge-${crypto.randomUUID()}`,
        source: start.nodeId,
        target: junctionId,
        sourceHandle: isHorizontalMain ? "b-source" : "r-source",
        targetHandle: isHorizontalMain ? "t-target" : "l-target",
        type: "straight",
        label: "",
        data: {
          color: DEFAULT_EDGE_COLOR,
          customType: "straight",
          markerStartType: DEFAULT_MARKER_START,
          markerEndType: DEFAULT_MARKER_END,
          markerSize: DEFAULT_MARKER_SIZE,
          markerColor: DEFAULT_EDGE_COLOR,
        },
      });

      runWithHistory(() => {
        setNodes((nds) => {
          const withAligned = nds.map((node) => {
            if (node.id === edgeSourceNode.id) {
              return { ...node, position: nextSourcePosition };
            }
            if (node.id === edgeTargetNode.id) {
              return { ...node, position: nextTargetPosition };
            }
            return node;
          });
          return straightenChartGeometry([...withAligned, junctionNode], [
            ...edgesRef.current.filter((edge) => edge.id !== targetEdge.id),
            edgeToJunction,
            edgeFromJunction,
            branchEdge,
          ]);
        });
        setEdges((eds) => [
          ...eds.filter((edge) => edge.id !== targetEdge.id),
          edgeToJunction,
          edgeFromJunction,
          branchEdge,
        ]);
        setSelectedNodeIds([junctionId]);
        setSelectedEdgeIds([]);
      });

      toast({
        title: "Branch connected",
        description: "Nodes auto-aligned for a straight T-junction.",
      });
    },
    [
      allowCrossOfficeEdges,
      getNode,
      isHand,
      project,
      runWithHistory,
      setEdges,
      setNodes,
      toast,
    ]
  );

  useEffect(() => {
    if (tool !== "connect") {
      pendingFreeLineStartRef.current = null;
      freeLineDrawingRef.current = false;
      setFreeLineDraft(null);
    }
  }, [tool]);

  const clientToFlowPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!reactFlowWrapper.current) return null;
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      return project({
        x: clientX - bounds.left,
        y: clientY - bounds.top,
      });
    },
    [project]
  );

  const isFreeLinePaneTarget = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.closest(".react-flow__node") || el.closest(".react-flow__edge") || el.closest(".react-flow__handle")) {
      return false;
    }
    if (el.closest("[data-orgchart-edge-id]") || el.closest("[role='toolbar']")) {
      return false;
    }
    return Boolean(el.classList.contains("react-flow__pane") || el.closest(".react-flow__pane"));
  }, []);

  const commitFreeLine = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      if (Math.hypot(end.x - start.x, end.y - start.y) < 12) {
        return;
      }

      const half = LINE_ENDPOINT_SIZE / 2;
      const startId = `lineEndpoint-${crypto.randomUUID()}`;
      const endId = `lineEndpoint-${crypto.randomUUID()}`;
      const officeId = focusOfficeId ?? undefined;

      const startNode: FlowNode = {
        id: startId,
        type: "lineEndpoint",
        position: { x: start.x - half, y: start.y - half },
        data: { name: "Endpoint", officeId },
        width: LINE_ENDPOINT_SIZE,
        height: LINE_ENDPOINT_SIZE,
        style: { width: LINE_ENDPOINT_SIZE, height: LINE_ENDPOINT_SIZE },
      };
      const endNode: FlowNode = {
        id: endId,
        type: "lineEndpoint",
        position: { x: end.x - half, y: end.y - half },
        data: { name: "Endpoint", officeId },
        width: LINE_ENDPOINT_SIZE,
        height: LINE_ENDPOINT_SIZE,
        style: { width: LINE_ENDPOINT_SIZE, height: LINE_ENDPOINT_SIZE },
      };

      const flowType = mapDocEdgeTypeToFlow(edgeType);
      const lineEdge = applyEdgePresentation({
        id: `edge-${crypto.randomUUID()}`,
        source: startId,
        target: endId,
        sourceHandle: "r-source",
        targetHandle: "l-target",
        type: flowType,
        label: "",
        data: {
          color: DEFAULT_EDGE_COLOR,
          customType: edgeType,
          markerStartType: DEFAULT_MARKER_START,
          markerEndType: DEFAULT_MARKER_END,
          markerSize: DEFAULT_MARKER_SIZE,
          markerColor: DEFAULT_EDGE_COLOR,
        },
      });

      runWithHistory(() => {
        setNodes((nds) => [...nds, startNode, endNode]);
        setEdges((eds) => [...eds, lineEdge]);
        setSelectedNodeIds([]);
        setSelectedEdgeIds([lineEdge.id]);
      });
    },
    [edgeType, focusOfficeId, runWithHistory, setEdges, setNodes, setSelectedEdgeIds, setSelectedNodeIds]
  );

  const handleFreeLinePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (tool !== "connect" || isHand) return;
      if (event.button !== 0) return;
      if (!isFreeLinePaneTarget(event.target)) return;

      const position = clientToFlowPosition(event.clientX, event.clientY);
      if (!position) return;

      event.preventDefault();
      event.stopPropagation();
      freeLineDrawingRef.current = true;
      pendingFreeLineStartRef.current = position;
      setFreeLineDraft({ start: position, end: position });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [clientToFlowPosition, isFreeLinePaneTarget, isHand, tool]
  );

  const handleFreeLinePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!freeLineDrawingRef.current || !pendingFreeLineStartRef.current) return;
      const position = clientToFlowPosition(event.clientX, event.clientY);
      if (!position) return;
      setFreeLineDraft({ start: pendingFreeLineStartRef.current, end: position });
    },
    [clientToFlowPosition]
  );

  const handleFreeLinePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!freeLineDrawingRef.current) return;
      freeLineDrawingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if capture already released
      }

      const start = pendingFreeLineStartRef.current;
      pendingFreeLineStartRef.current = null;
      setFreeLineDraft(null);
      if (!start) return;

      const end = clientToFlowPosition(event.clientX, event.clientY);
      if (!end) return;
      commitFreeLine(start, end);
    },
    [clientToFlowPosition, commitFreeLine]
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
        runWithHistory(() => {
          setNodes((nds: FlowNode[]) => {
            const node = nds.find((n) => n.id === nodeId);
            if (!node) return nds;
            const newId = `${node.type}-${crypto.randomUUID()}`;
            const newNode: FlowNode = {
              ...node,
              id: newId,
              position: {
                x: node.position.x + 40,
                y: node.position.y + 40,
              },
              data: {
                ...node.data,
                name:
                  node.type === "annotation"
                    ? `${node.data.name ?? node.data.text ?? DEFAULT_ANNOTATION_TEXT} copy`
                    : `${node.data.name} copy`,
                employeeId: node.type === "annotation" ? node.data.employeeId : undefined,
                text:
                  node.type === "annotation"
                    ? node.data.text ?? node.data.name ?? DEFAULT_ANNOTATION_TEXT
                    : node.data.text,
              },
            };
            return [...nds, newNode];
          });
        });
    },
    [runWithHistory, setNodes]
  );

  const getOfficeIdForNode = useCallback(
    (node: FlowNode | null | undefined): string | undefined => {
      if (!node) return undefined;
      if (node.type === "office") return node.data.officeId ?? node.id;
      if (node.data.officeId) return node.data.officeId;
      const incoming = edges.find((edge: FlowEdge) => edge.target === node.id);
      if (incoming) {
        const parent = getNode(incoming.source);
        return getOfficeIdForNode(parent);
      }
      return undefined;
    },
    [edges, getNode]
  );

  const createChildNode = useCallback(
    (parentId: string, type: OrgNodeType) => {
      const parent = getNode(parentId);
      if (!parent) return;
      const parentOfficeId = getOfficeIdForNode(parent);
      const basePosition = parent.position;
      const newId = `${type}-${crypto.randomUUID()}`;
      const parentOutlineColor =
        normalizeColor(parent.data.outlineColor) ?? normalizeColor(parent.data.headerColor) ?? null;
      const parentEmployeeTypeColor = normalizeColor(parent.data.employeeTypeColor) ?? undefined;
      const defaultOutlineForType =
        normalizeColor(DEFAULT_NODE_COLORS[type]) ?? normalizeColor(DEFAULT_NODE_COLORS.office) ?? NEUTRAL_OUTLINE_COLOR;
      const outlineColor =
        (type === "person"
          ? parentEmployeeTypeColor ?? parentOutlineColor
          : parentOutlineColor ?? defaultOutlineForType) ?? defaultOutlineForType;
      const newNode: FlowNode = {
        id: newId,
        type,
        position: {
          x: basePosition.x + (type === "person" ? 160 : 120),
          y: basePosition.y + 150,
        },
        data: {
          name: type === "person" ? "New Person" : type === "unit" ? "New Unit" : "New Office",
          label: type === "person" ? "New Role" : type === "unit" ? "Unit" : "Office",
          title: type === "person" ? "" : parent.data.title,
          employeeTypeColor: type === "person" ? parentEmployeeTypeColor ?? undefined : undefined,
          outlineColor,
          headerColor: outlineColor,
          officeId: type === "office" ? undefined : parentOfficeId,
        },
        ...(type === "person"
          ? { sourcePosition: Position.Right, targetPosition: Position.Left }
          : {}),
      };

      runWithHistory(() => {
        setNodes((nds: FlowNode[]) => [...nds, newNode]);
        setEdges((eds: FlowEdge[]) => [
          ...eds,
          applyEdgePresentation({
            id: `edge-${crypto.randomUUID()}`,
            source: parent.id,
            target: newId,
            type: mapDocEdgeTypeToFlow(edgeType),
            label: "",
            data: {
              color: DEFAULT_EDGE_COLOR,
              markerStartType: DEFAULT_MARKER_START,
              markerEndType: DEFAULT_MARKER_END,
              markerSize: DEFAULT_MARKER_SIZE,
              markerColor: DEFAULT_EDGE_COLOR,
            },
          }),
        ]);
      });
    },
    [edgeType, getNode, getOfficeIdForNode, runWithHistory, setEdges, setNodes]
  );

  const addChildUnit = useCallback((nodeId: string) => createChildNode(nodeId, "unit"), [createChildNode]);
  const addChildPerson = useCallback((nodeId: string) => createChildNode(nodeId, "person"), [createChildNode]);

    const addStandaloneNode = useCallback(
      (type: OrgNodeType) => {
        if (type === "annotation") {
          const viewport = reactFlowWrapper.current?.getBoundingClientRect();
          const center = viewport
            ? { x: viewport.width / 2, y: viewport.height / 2 }
            : { x: 400, y: 200 };
          const projected = project({ x: center.x + 24, y: center.y + 24 });
          const maxZ = nodesRef.current.reduce((acc, node) => {
            if (node.type !== "annotation") return acc;
            const value = typeof node.data.z === "number" && !Number.isNaN(node.data.z) ? node.data.z : 0;
            return Math.max(acc, value);
          }, 0);
          const newId = `annotation-${crypto.randomUUID()}`;
          const newNode: FlowNode = {
            id: newId,
            type: "annotation",
            position: { x: projected.x, y: projected.y },
            data: {
              name: DEFAULT_ANNOTATION_TEXT,
              text: DEFAULT_ANNOTATION_TEXT,
              color: DEFAULT_ANNOTATION_COLOR,
              fontSize: DEFAULT_ANNOTATION_FONT_SIZE,
              weight: "bold",
              align: "left",
              z: maxZ + 1,
              lock: false,
            },
            draggable: true,
            connectable: false,
          };

          runWithHistory(() => {
            setNodes((nds: FlowNode[]) => [...nds, newNode]);
          });
          setSelectedNodeIds([newId]);
          setSelectedEdgeIds([]);
          return;
        }

        const viewport = reactFlowWrapper.current?.getBoundingClientRect();
        const center = viewport
          ? { x: viewport.width / 2, y: viewport.height / 2 }
          : { x: 400, y: 200 };
        const projected = project({ x: center.x, y: center.y });
      const officeId =
        type === "office"
          ? undefined
          : selectedNode?.type === "office"
            ? selectedNode.data.officeId ?? selectedNode.id
            : focusOfficeId ?? offices[0]?.data.officeId ?? offices[0]?.id;

      if (type !== "office" && !officeId) {
        toast({
          title: "No office selected",
          description: "Select an office first or create an office node.",
          variant: "destructive",
        });
        return;
      }

      const defaultOutline =
        normalizeColor(
          type === "person"
            ? selectedNode?.data.employeeTypeColor ??
              selectedNode?.data.outlineColor ??
              DEFAULT_NODE_COLORS.person
            : selectedNode?.data.outlineColor ?? DEFAULT_NODE_COLORS[type]
        ) ?? NEUTRAL_OUTLINE_COLOR;

      const newNode: FlowNode = {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        position: { x: projected.x, y: projected.y },
        data: {
          name: type === "person" ? "New Person" : type === "unit" ? "New Unit" : "New Office",
          label: type === "person" ? "New Role" : type === "unit" ? "Unit" : "Office",
          title: type === "person" ? "" : undefined,
          outlineColor: defaultOutline,
          headerColor: defaultOutline,
          officeId: type === "office" ? undefined : officeId,
        },
        ...(type === "person"
          ? { sourcePosition: Position.Right, targetPosition: Position.Left }
          : {}),
      };

        runWithHistory(() => {
          setNodes((nds: FlowNode[]) => [...nds, newNode]);
        });
        setSelectedNodeIds([newNode.id]);
        setSelectedEdgeIds([]);
      },
      [focusOfficeId, offices, project, runWithHistory, selectedNode, setNodes, setSelectedEdgeIds, setSelectedNodeIds, toast]
    );

  const handleAddPersonSelection = useCallback(
    ({ employee, connectToParent, dropNearCursor, alignToGrid }: AddPersonDialogSelection) => {
      const employeeHasOffice = Boolean(employee.officeId);
      const shouldConnect = connectToParent && canConnectToSelectedParent && employeeHasOffice;
      const parentCandidateId = shouldConnect && selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
      const parentNode = parentCandidateId
        ? nodesRef.current.find((node) => node.id === parentCandidateId) ?? null
        : null;
      const resolveOfficeId = (node: FlowNode | null): string | undefined => {
        if (!node) return undefined;
        if (node.type === "office") return node.data.officeId ?? node.id;
        if (node.data.officeId) return node.data.officeId;
        const incoming = edgesRef.current.find((edge) => edge.target === node.id);
        if (!incoming) return undefined;
        const parent = nodesRef.current.find((candidate) => candidate.id === incoming.source) ?? null;
        return resolveOfficeId(parent);
      };
      const parentOfficeId = resolveOfficeId(parentNode);
      const resolvedOfficeId =
        parentOfficeId ??
        focusOfficeId ??
        employee.officeId ??
        resolveOfficeId(nodesRef.current.find((node) => node.type === "office") ?? null) ??
        null;

      if (!resolvedOfficeId) {
        toast({
          title: "Select an office",
          description: "Choose or create an office before adding a person.",
          variant: "destructive",
        });
        return;
      }

      const duplicate = nodesRef.current.find(
        (node) =>
          node.type === "person" &&
          node.data.employeeId === employee.id &&
          (node.data.officeId ?? null) === resolvedOfficeId
      );

      if (duplicate) {
        toast({ title: "Already on chart", description: "This person is already in the selected office." });
        highlightNode(duplicate.id);
        setIsAddPersonOpen(false);
        return;
      }

      const outlineCandidate =
        normalizeColor(employee.employeeTypeColor) ??
        (parentNode?.type === "person" ? normalizeColor(parentNode.data.employeeTypeColor) : null) ??
        normalizeColor(parentNode?.data.outlineColor) ??
        NEUTRAL_OUTLINE_COLOR;

      const outlineColor = outlineCandidate ?? NEUTRAL_OUTLINE_COLOR;
      const edgeColor = darkenColor(outlineColor, 0.25);

      let position: { x: number; y: number };

      const shouldDropNearCursor = dropNearCursor || !shouldConnect;

      if (shouldConnect && parentNode) {
        const siblingEdges = edgesRef.current.filter((edge) => edge.source === parentNode.id);
        const siblingCount = siblingEdges.length;
        const horizontalStep = DEFAULT_NODE_WIDTH + 40;
        const verticalStep = DEFAULT_NODE_HEIGHT + 80;
        position = {
          x: parentNode.position.x + siblingCount * horizontalStep,
          y: parentNode.position.y + verticalStep,
        };
      } else if (shouldDropNearCursor && pointerPositionRef.current) {
        position = { ...pointerPositionRef.current };
      } else {
        const viewport = reactFlowWrapper.current?.getBoundingClientRect();
        if (viewport) {
          position = project({ x: viewport.width / 2, y: viewport.height / 2 });
        } else {
          const currentViewport = getViewport();
          position = { x: -currentViewport.x + 200, y: -currentViewport.y + 200 };
        }
      }

      if (alignToGrid) {
        position = snapPointToGrid(position);
      }

      const nodeId = `person-${employee.id}-${crypto.randomUUID()}`;
      const name = formatFullName(employee);
      const newNode: FlowNode = {
        id: nodeId,
        type: "person",
        position,
        data: {
          name,
          title: employee.positionTitle ?? "",
          employeeTypeName: employee.employeeType,
          employeeTypeColor: normalizeColor(employee.employeeTypeColor) ?? undefined,
          employeeId: employee.id,
          officeId: resolvedOfficeId,
          label: employee.positionTitle ?? employee.employeeType ?? name,
          outlineColor,
          headerColor: outlineColor,
          imageUrl: employee.photoUrl ?? undefined,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };

      runWithHistory(() => {
        setNodes((nds: FlowNode[]) => [...nds, newNode]);
        if (shouldConnect && parentNode) {
          const defaultType = mapDocEdgeTypeToFlow(edgeType);
          const layout = resolveEdgeLayout(parentNode, newNode, defaultType);
          const sourceHandle = getSourceHandleId(layout?.source ?? "b") ?? "b-source";
          const targetHandle = getTargetHandleId(layout?.target ?? "t") ?? "t-target";
          const edge = applyEdgePresentation({
            id: `edge-${crypto.randomUUID()}`,
            source: parentNode.id,
            target: nodeId,
            sourceHandle,
            targetHandle,
            type: layout?.type ?? defaultType,
            label: "",
            data: {
              color: edgeColor,
              markerColor: edgeColor,
              markerStartType: DEFAULT_MARKER_START,
              markerEndType: DEFAULT_MARKER_END,
              markerSize: DEFAULT_MARKER_SIZE,
            },
          });
          setEdges((eds: FlowEdge[]) => [...eds, edge]);
        }
      });

      setSelectedNodeIds([nodeId]);
      setSelectedEdgeIds([]);
      setFocusOfficeId(resolvedOfficeId);
      requestFocus();
      setIsAddPersonOpen(false);
      toast({ title: "Person added", description: `${name} added to the chart.` });
    },
    [
      canConnectToSelectedParent,
      edgeType,
      focusOfficeId,
      getViewport,
      highlightNode,
      project,
      requestFocus,
      runWithHistory,
      selectedNodeIds,
      setEdges,
      setFocusOfficeId,
      setNodes,
      setSelectedEdgeIds,
      setSelectedNodeIds,
      toast,
    ]
  );

  const fetchOfficeEmployees = useCallback(
    async (officeId: string): Promise<OfficeEmployeeRecord[]> => {
      const fetchWithLimit = async (limit?: string) => {
        const params = new URLSearchParams();
        if (limit) params.set("limit", limit);
        const response = await fetch(
          `/api/${departmentId}/offices/${officeId}/employees?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return (await response.json()) as {
          items: OfficeEmployeeRecord[];
          totalCount: number;
          limit: number | null;
        };
      };

      const initial = await fetchWithLimit();
      let items = initial.items;

      const effectiveLimit = initial.limit ?? initial.items.length;
      if (initial.totalCount > effectiveLimit) {
        const loadRecommended = window.confirm(
          `Load the first ${effectiveLimit} employees now? (Recommended)\nPress Cancel to load all ${initial.totalCount}.`
        );
        if (!loadRecommended) {
          const all = await fetchWithLimit("all");
          items = all.items;
        }
      }

      return items;
    },
    [departmentId]
  );

  const handleAddOfficeSelection = useCallback(
    async (
      office: OfficeSearchResult,
      { includePeople, includeStaffUnit }: { includePeople: boolean; includeStaffUnit: boolean }
    ) => {
      try {
        const nodesToAdd: FlowNode[] = [];
        const edgesToAdd: FlowEdge[] = [];

        const existingOffice = nodesRef.current.find(
          (node) =>
            node.type === "office" &&
            ((node.data.officeId ?? node.id) === office.id || node.id === `office-${office.id}`)
        );

        let officeNode: FlowNode;
        let renameOffice = false;

        if (existingOffice) {
          officeNode = existingOffice;
          if (existingOffice.data.name !== office.name) {
            renameOffice = true;
          }
        } else {
          const viewport = reactFlowWrapper.current?.getBoundingClientRect();
          let position = viewport ? project({ x: viewport.width / 2, y: viewport.height / 2 }) : { x: 0, y: 0 };
          position = snapPointToGrid(position);
          const outline = normalizeColor(DEFAULT_NODE_COLORS.office) ?? DEFAULT_NODE_COLORS.office;
          officeNode = {
            id: `office-${office.id}`,
            type: "office",
            position,
            data: {
              name: office.name,
              label: office.name,
              officeId: office.id,
              outlineColor: outline,
              headerColor: outline,
            },
          };
          nodesToAdd.push(officeNode);
        }

        let staffNode: FlowNode | null = null;
        let staffNodeId: string | null = null;

        if (includePeople && includeStaffUnit) {
          staffNode =
            nodesRef.current.find(
              (node) =>
                node.type === "unit" &&
                node.data.officeId === office.id &&
                node.data.name.toLowerCase() === "staff"
            ) ?? null;
          if (staffNode) {
            staffNodeId = staffNode.id;
          } else {
            const baseY = officeNode.position.y + DEFAULT_NODE_HEIGHT + 80;
            const staffPosition = snapPointToGrid({ x: officeNode.position.x, y: baseY });
            const outline = normalizeColor(DEFAULT_NODE_COLORS.unit) ?? DEFAULT_NODE_COLORS.unit;
            staffNodeId = `unit-${office.id}-staff`;
            staffNode = {
              id: staffNodeId,
              type: "unit",
              position: staffPosition,
              data: {
                name: "Staff",
                label: "Staff",
                officeId: office.id,
                outlineColor: outline,
                headerColor: outline,
              },
            };
            nodesToAdd.push(staffNode);
            const staffEdge = applyEdgePresentation({
              id: `edge-${crypto.randomUUID()}`,
              source: officeNode.id,
              target: staffNodeId,
              sourceHandle: getSourceHandleId("b") ?? "b-source",
              targetHandle: getTargetHandleId("t") ?? "t-target",
              type: mapDocEdgeTypeToFlow(edgeType),
              label: "",
              data: {
                color: darkenColor(outline, 0.25),
                markerColor: darkenColor(outline, 0.25),
                markerStartType: DEFAULT_MARKER_START,
                markerEndType: DEFAULT_MARKER_END,
                markerSize: DEFAULT_MARKER_SIZE,
              },
            });
            edgesToAdd.push(staffEdge);
          }
        }

        const parentNodeForPeople = includePeople
          ? includeStaffUnit && staffNode
            ? staffNode
            : officeNode
          : null;

        const personNodes: FlowNode[] = [];
        const personEdges: FlowEdge[] = [];
        const duplicates: string[] = [];

        if (includePeople) {
          let employees: OfficeEmployeeRecord[] = [];
          try {
            employees = await fetchOfficeEmployees(office.id);
          } catch (error) {
            toast({
              title: "Unable to load employees",
              description: (error as Error).message || "",
              variant: "destructive",
            });
            return;
          }

          if (employees.length === 0) {
            toast({ title: "No employees", description: `${office.name} has no employees to add yet.` });
          }

          const parentPosition = parentNodeForPeople?.position ?? officeNode.position;
          const parentId = parentNodeForPeople?.id ?? officeNode.id;
          const columns = determineColumnCount(employees.length);
          const columnWidth = DEFAULT_NODE_WIDTH + 40;
          const rowHeight = DEFAULT_NODE_HEIGHT + 80;
          const startX = parentPosition.x - ((columns - 1) * columnWidth) / 2;
          const baseY = parentPosition.y + DEFAULT_NODE_HEIGHT + 80;

          employees.forEach((employee, index) => {
            const existsInChart = nodesRef.current.some(
              (node) =>
                node.type === "person" &&
                node.data.employeeId === employee.id &&
                (node.data.officeId ?? null) === office.id
            );
            const existsInBatch = personNodes.some((node) => node.data.employeeId === employee.id);
            if (existsInChart || existsInBatch) {
              duplicates.push(employee.id);
              return;
            }

            const row = columns ? Math.floor(index / columns) : 0;
            const col = columns ? index % columns : 0;
            let position = {
              x: startX + col * columnWidth,
              y: baseY + row * rowHeight,
            };
            position = snapPointToGrid(position);

            const outline = normalizeColor(employee.employeeTypeColor) ?? NEUTRAL_OUTLINE_COLOR;
            const personId = `person-${employee.id}-${crypto.randomUUID()}`;
            const name = formatFullName(employee);
            const personNode: FlowNode = {
              id: personId,
              type: "person",
              position,
              data: {
                name,
                title: employee.positionTitle ?? "",
                employeeTypeName: employee.employeeType,
                employeeTypeColor: normalizeColor(employee.employeeTypeColor) ?? undefined,
                employeeId: employee.id,
                officeId: office.id,
                label:
                  employee.positionTitle ??
                  employee.employeeType ??
                  (employee.isHead ? "Head" : "Staff"),
                outlineColor: outline,
                headerColor: outline,
                imageUrl: employee.photoUrl ?? undefined,
              },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            };
            personNodes.push(personNode);

            const defaultType = mapDocEdgeTypeToFlow(edgeType);
            const layout = resolveEdgeLayout(parentNodeForPeople ?? officeNode, personNode, defaultType);
            const personEdge = applyEdgePresentation({
              id: `edge-${crypto.randomUUID()}`,
              source: parentId,
              target: personId,
              sourceHandle: getSourceHandleId(layout?.source ?? "b") ?? "b-source",
              targetHandle: getTargetHandleId(layout?.target ?? "t") ?? "t-target",
              type: layout?.type ?? defaultType,
              label: "",
              data: {
                color: darkenColor(outline, 0.25),
                markerColor: darkenColor(outline, 0.25),
                markerStartType: DEFAULT_MARKER_START,
                markerEndType: DEFAULT_MARKER_END,
                markerSize: DEFAULT_MARKER_SIZE,
              },
            });
            personEdges.push(personEdge);
          });
        }

        const allNodes = [...nodesToAdd, ...personNodes];
        const allEdges = [...edgesToAdd, ...personEdges];
        const nodeBatches = chunkArray(allNodes, 50);
        const edgeBatches = chunkArray(allEdges, 50);
        const maxBatches = Math.max(nodeBatches.length, edgeBatches.length);

        if (renameOffice || maxBatches) {
          runWithHistory(() => {
            if (renameOffice) {
              setNodes((nds: FlowNode[]) =>
                nds.map((node) =>
                  node.id === officeNode.id
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          name: office.name,
                          label: office.name,
                        },
                      }
                    : node
                )
              );
            }

            if (!maxBatches) {
              return;
            }

            const applyBatch = (index: number) => {
              if (index >= maxBatches) return;
              const nodeBatch = nodeBatches[index] ?? [];
              const edgeBatch = edgeBatches[index] ?? [];
              if (nodeBatch.length) {
                setNodes((nds: FlowNode[]) => [...nds, ...nodeBatch]);
              }
              if (edgeBatch.length) {
                setEdges((eds: FlowEdge[]) => [...eds, ...edgeBatch]);
              }
              if (index + 1 < maxBatches) {
                requestAnimationFrame(() => applyBatch(index + 1));
              }
            };

            applyBatch(0);
          });
        }

        setSelectedNodeIds([officeNode.id]);
        setSelectedEdgeIds([]);
        setFocusOfficeId(office.id);
        requestFocus();
        setIsAddOfficeOpen(false);

        let description: string;
        if (includePeople) {
          description = `Added ${personNodes.length} ${personNodes.length === 1 ? "person" : "people"} to ${office.name}.`;
          if (duplicates.length) {
            description += ` Skipped ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"}.`;
          }
        } else {
          description = `${office.name} added to the chart.`;
        }

        toast({ title: "Office updated", description });
      } catch (error) {
        toast({
          title: "Unable to add office",
          description: (error as Error).message || "",
          variant: "destructive",
        });
      }
    },
    [
      edgeType,
      fetchOfficeEmployees,
      project,
      requestFocus,
      runWithHistory,
      setEdges,
      setFocusOfficeId,
      setNodes,
      setSelectedEdgeIds,
      setSelectedNodeIds,
      toast,
    ]
  );

  const unsavedChanges = useMemo(() => draftSnapshot !== lastSavedSnapshotRef.current, [draftSnapshot]);

  const handleSaveVersion = useCallback(async () => {
    const label = window.prompt("Version name", new Date().toLocaleString());
    if (!label) return;
    try {
      setIsSaving(true);
      const latestDocument = serializeDocument(nodes, edges, edgeType);
      docRef.current = latestDocument;
      const snapshot = JSON.stringify(latestDocument);
      setDraftSnapshot(snapshot);
      const response = await fetch(`/api/${departmentId}/org-chart/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, data: latestDocument }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const record = (await response.json()) as OrgChartVersionSummary;
      setVersions((prev) => {
        const deduped = prev.filter((item) => item.id !== record.id);
        return [record, ...deduped];
      });
      applyCurrentVersionId(record.id);
      lastSavedSnapshotRef.current = snapshot;
      toast({ title: "Version saved", description: record.label });
    } catch (error) {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Unable to save version",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [applyCurrentVersionId, departmentId, edgeType, edges, nodes, serializeDocument, toast]);

    const handleDeleteVersion = useCallback(() => {
      if (!currentVersionId) return;
      setIsDeleteVersionOpen(true);
    }, [currentVersionId]);

    const confirmDeleteVersion = useCallback(async () => {
      if (!currentVersionId) return;
      setIsDeletingVersion(true);
      try {
        const remainingVersions = versions.filter((item) => item.id !== currentVersionId);
        const response = await fetch(
          `/api/${departmentId}/org-chart/versions/${currentVersionId}`,
          { method: "DELETE" }
        );
        if (!response.ok && response.status !== 204) {
          throw new Error(await response.text());
        }

        setVersions(remainingVersions);
        const nextVersion = remainingVersions[0];
        if (nextVersion) {
          await loadVersionById(nextVersion.id);
        } else {
          applyCurrentVersionId(null);
          setDocument(latestDraftRef.current, true, true);
        }
        toast({ title: "Version deleted" });
      } catch (error) {
        toast({
          title: "Failed to delete version",
          description: error instanceof Error ? error.message : "Unable to delete version",
          variant: "destructive",
        });
      } finally {
        setIsDeletingVersion(false);
        setIsDeleteVersionOpen(false);
      }
    }, [applyCurrentVersionId, currentVersionId, departmentId, loadVersionById, setDocument, setVersions, toast, versions]);

  const handleVersionChange = useCallback(
    async (value: string) => {
      setIsChartLoading(true);
      if (value === "__unsaved__") {
        setIsChartLoading(false);
        return;
      }

      const result = await loadVersionById(value);
      if (result.status === "success") {
        toast({ title: "Version loaded", description: result.record.label });
        setIsChartLoading(false);
        return;
      }

      if (result.status === "not_found") {
        applyCurrentVersionId(null);
        toast({
          title: "Version not found",
          description: "The requested version is unavailable.",
          variant: "destructive",
        });
        setIsChartLoading(false);
        return;
      }

      if (result.status === "error") {
        toast({
          title: "Failed to load version",
          description: result.message ?? "Unable to load version",
          variant: "destructive",
        });
      }
      setIsChartLoading(false);
    },
    [applyCurrentVersionId, loadVersionById, toast]
  );

  const waitAnimationFrames = useCallback(async (frames = 2) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, []);

  const captureChartPng = useCallback(async (): Promise<string> => {
    if (!reactFlowWrapper.current) {
      throw new Error("Chart canvas is not ready");
    }
    const nodesForExport = getNodes().filter(
      (node) => !node.hidden && node.type !== "junction" && node.type !== "lineEndpoint"
    );
    if (!nodesForExport.length) {
      throw new Error("Nothing visible to export");
    }

    const wrapper = reactFlowWrapper.current;
    const exportWidth = Math.max(wrapper.clientWidth, 1);
    const exportHeight = Math.max(wrapper.clientHeight, 1);
    const originalViewport = getViewport();
    const exportStrokeWidth = Math.max(4, 4 / Math.max(originalViewport.zoom, 0.5));
    const restoreInterface = hideInterfaceForExport();

    wrapper.classList.add("orgchart-exporting");
    wrapper.style.setProperty("--orgchart-export-stroke", `${exportStrokeWidth}px`);

    try {
      await fitView({
        nodes: nodesForExport,
        padding: 0.2,
        duration: 0,
        includeHiddenNodes: false,
        minZoom: 0.1,
        maxZoom: 2,
      });
      await waitAnimationFrames(2);

      return await htmlToImage.toPng(wrapper, {
        backgroundColor: "#ffffff",
        pixelRatio: 3,
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.orgchartExportIgnore === "true"),
        width: exportWidth,
        height: exportHeight,
        canvasWidth: exportWidth * 3,
        canvasHeight: exportHeight * 3,
        style: {
          transform: "none",
          transformOrigin: "top left",
        },
      });
    } finally {
      wrapper.classList.remove("orgchart-exporting");
      wrapper.style.removeProperty("--orgchart-export-stroke");
      setViewport(originalViewport, { duration: 0 });
      restoreInterface();
    }
  }, [fitView, getNodes, getViewport, hideInterfaceForExport, setViewport, waitAnimationFrames]);

  const downloadPdfFromPngPages = useCallback(async (pages: Array<{ dataUrl: string; label?: string }>) => {
    const pdf = await PDFDocument.create();
    for (const pageImage of pages) {
      const page = pdf.addPage([1122, 793]);
      const image = await pdf.embedPng(pageImage.dataUrl);
      const { width, height } = image.scaleToFit(page.getWidth() - 40, page.getHeight() - 40);
      page.drawImage(image, {
        x: (page.getWidth() - width) / 2,
        y: (page.getHeight() - height) / 2,
        width,
        height,
      });
    }
    const bytes = await pdf.save();
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `org-chart-${new Date().toISOString()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExport = useCallback(
    async (format: "png" | "pdf") => {
      try {
        setIsExporting(true);
        const dataUrl = await captureChartPng();

        if (format === "png") {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = `org-chart-${new Date().toISOString()}.png`;
          link.click();
          toast({ title: "PNG exported" });
          return;
        }

        await downloadPdfFromPngPages([{ dataUrl }]);
        toast({ title: "PDF exported" });
      } catch (error) {
        toast({
          title: "Export failed",
          description: error instanceof Error ? error.message : "Unable to export",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    },
    [captureChartPng, downloadPdfFromPngPages, toast]
  );

  const bulkExportOffices = useMemo(
    () =>
      offices.map((office) => ({
        id: office.data.officeId ?? office.id,
        name: office.data.name,
      })),
    [offices]
  );

  const handleBulkExport = useCallback(
    async (officeIds: string[]) => {
      if (!officeIds.length) return;
      const previousFocus = focusOfficeId;
      try {
        setIsExporting(true);
        const pages: Array<{ dataUrl: string; label?: string }> = [];

        for (const officeId of officeIds) {
          flushSync(() => {
            setFocusOfficeId(officeId);
          });
          await waitAnimationFrames(3);
          focusOffice(officeId, 0);
          await waitAnimationFrames(3);
          const dataUrl = await captureChartPng();
          const label =
            bulkExportOffices.find((office) => office.id === officeId)?.name ?? officeId;
          pages.push({ dataUrl, label });
        }

        await downloadPdfFromPngPages(pages);
        setIsBulkExportOpen(false);
        toast({
          title: "Bulk PDF exported",
          description: `${pages.length} office page${pages.length === 1 ? "" : "s"} merged.`,
        });
      } catch (error) {
        toast({
          title: "Bulk export failed",
          description: error instanceof Error ? error.message : "Unable to export",
          variant: "destructive",
        });
      } finally {
        flushSync(() => {
          setFocusOfficeId(previousFocus);
        });
        await waitAnimationFrames(2);
        focusOffice(previousFocus, 0);
        setIsExporting(false);
      }
    },
    [
      bulkExportOffices,
      captureChartPng,
      downloadPdfFromPngPages,
      focusOffice,
      focusOfficeId,
      toast,
      waitAnimationFrames,
    ]
  );

    const updateSelectedNode = useCallback(
      (updates: Partial<OrgNodeData>, options?: { pushHistory?: boolean }) => {
        if (!selectedNode) return;
        applyNodeUpdates(selectedNode.id, updates, options);
      },
      [applyNodeUpdates, selectedNode]
    );

    const updateSelectedEdge = useCallback(
      (updates: Partial<FlowEdge>) => {
        if (!selectedEdge) return;
        runWithHistory(() => {
          setEdges((eds: FlowEdge[]) =>
            eds.map((edge: FlowEdge) =>
              edge.id === selectedEdge.id
                ? applyEdgePresentation({
                    ...edge,
                    ...updates,
                    data: {
                      ...edge.data,
                      ...(updates.data ?? {}),
                    },
                    style: updates.style ? { ...(edge.style ?? {}), ...updates.style } : edge.style,
                    markerStart: updates.markerStart ?? edge.markerStart,
                    markerEnd: updates.markerEnd ?? edge.markerEnd,
                  })
                : edge
            )
          );
        });
      },
      [runWithHistory, selectedEdge, setEdges]
    );

    const updateNodeData = useCallback(
      (nodeId: string, updates: Partial<OrgNodeData>, options?: { pushHistory?: boolean }) => {
        applyNodeUpdates(nodeId, updates, options);
      },
      [applyNodeUpdates]
    );

  const removeSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const outgoing = edges.filter((edge: FlowEdge) => edge.source === selectedNode.id);
    if (outgoing.length && !window.confirm("Remove node and its connections?")) {
      return;
    }
    runWithHistory(() => {
      setNodes((nds: FlowNode[]) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds: FlowEdge[]) =>
        eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
      );
    });
    setSelectedNodeIds([]);
  }, [edges, runWithHistory, selectedNode, setEdges, setNodes]);

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    runWithHistory(() => {
      setEdges((eds: FlowEdge[]) => eds.filter((edge) => edge.id !== selectedEdge.id));
    });
    setSelectedEdgeIds([]);
  }, [runWithHistory, selectedEdge, setEdges]);

    const bringToFront = useCallback(() => {
      if (!selectedNode) return;
      if (selectedNode.type === "annotation") {
        const maxZ = nodesRef.current.reduce((max, node) => {
          if (node.type !== "annotation") return max;
          const value = typeof node.data.z === "number" ? node.data.z : 0;
          return Math.max(max, value);
        }, 0);
        applyNodeUpdates(selectedNode.id, { z: maxZ + 1 });
        return;
      }
      runWithHistory(() => {
        setNodes((nds: FlowNode[]) => {
          const index = nds.findIndex((node) => node.id === selectedNode.id);
          if (index === -1) return nds;
          const clone = [...nds];
          const [node] = clone.splice(index, 1);
          clone.push(node);
          return clone;
        });
      });
    }, [applyNodeUpdates, runWithHistory, selectedNode, setNodes]);

    const sendToBack = useCallback(() => {
      if (!selectedNode) return;
      if (selectedNode.type === "annotation") {
        const minZ = nodesRef.current.reduce((min, node) => {
          if (node.type !== "annotation") return min;
          const value = typeof node.data.z === "number" ? node.data.z : 0;
          return Math.min(min, value);
        }, 0);
        applyNodeUpdates(selectedNode.id, { z: minZ - 1 });
        return;
      }
      runWithHistory(() => {
        setNodes((nds: FlowNode[]) => {
          const index = nds.findIndex((node) => node.id === selectedNode.id);
          if (index === -1) return nds;
          const clone = [...nds];
          const [node] = clone.splice(index, 1);
          clone.unshift(node);
          return clone;
        });
      });
    }, [applyNodeUpdates, runWithHistory, selectedNode, setNodes]);

    const actionsContextValue = useMemo(
      () => ({ duplicateNode, addChildUnit, addChildPerson, updateNodeData }),
      [addChildPerson, addChildUnit, duplicateNode, updateNodeData]
    );

  if (loading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">Preparing org chart...</p>
      </div>
    );
  }

  const showFullscreenInspector = isFullscreenEdit && Boolean(selectedNode || selectedEdge);

  return (
    <>
      <style jsx global>{`
        .orgchart-exporting .react-flow__edge-path {
          stroke-width: var(--orgchart-export-stroke, 2.25px) !important;
          stroke: #1f2937 !important;
          opacity: 1 !important;
          stroke-opacity: 1 !important;
          shape-rendering: geometricPrecision !important;
        }
        .orgchart-exporting .react-flow__edge .react-flow__edge-interaction {
          display: none !important;
        }
        .orgchart-exporting .react-flow__handle,
        .orgchart-exporting [data-orgchart-edge-id],
        .orgchart-exporting .react-flow__node-junction,
        .orgchart-exporting .react-flow__node-lineEndpoint,
        .orgchart-exporting .orgchart-align-guides {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        .orgchart-exporting .react-flow__node.selected,
        .orgchart-exporting .react-flow__edge.selected {
          box-shadow: none !important;
        }
        .orgchart-watermark {
          display: none;
        }
        .orgchart-exporting .orgchart-watermark {
          display: flex;
        }
        /* Lucidchart-like: handles hidden until hover/select/connecting */
        .react-flow__handle {
          width: 10px !important;
          height: 10px !important;
          min-width: 10px !important;
          min-height: 10px !important;
          background: #3b82f6 !important;
          border: 2px solid #ffffff !important;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.25);
          opacity: 0;
          pointer-events: auto;
          /* Do not transition transform — it fights handle centering and misaligns edges. */
          transition: opacity 140ms ease, width 140ms ease, height 140ms ease;
        }
        .react-flow__node:hover .react-flow__handle,
        .react-flow__node.selected .react-flow__handle,
        .react-flow__handle.connecting,
        .react-flow__handle-connecting,
        .react-flow__handle-valid,
        .react-flow.connecting .react-flow__handle {
          opacity: 1;
        }
        /* Scale via size, not transform — transform would override handle centering translates. */
        .react-flow__node:hover .react-flow__handle,
        .react-flow__node.selected .react-flow__handle {
          width: 12px !important;
          height: 12px !important;
        }
        [data-orgchart-edge-id] {
          background: #3b82f6 !important;
          transition: opacity 140ms ease, transform 140ms ease;
        }
        .react-flow.connecting [data-orgchart-edge-id] {
          opacity: 1 !important;
          transform: translate(-50%, -50%) scale(1.35);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }
        .react-flow__node-junction {
          opacity: 0.55;
          transition: opacity 140ms ease;
          cursor: grab;
        }
        .react-flow__node-junction:hover,
        .react-flow__node-junction.selected,
        .react-flow.connecting .react-flow__node-junction {
          opacity: 1;
        }
        .react-flow__node-junction:active {
          cursor: grabbing;
        }
        /* Handles must NOT steal drag — only accept connections while connecting. */
        .react-flow__node-junction .react-flow__handle {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .react-flow.connecting .react-flow__node-junction .react-flow__handle,
        .orgchart-connect-mode .react-flow__node-junction .react-flow__handle {
          pointer-events: all !important;
        }
        .react-flow__node-lineEndpoint {
          cursor: grab;
        }
        .react-flow__node-lineEndpoint:active {
          cursor: grabbing;
        }
        .react-flow__node-lineEndpoint .react-flow__handle {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .react-flow.connecting .react-flow__node-lineEndpoint .react-flow__handle,
        .orgchart-connect-mode .react-flow__node-lineEndpoint .react-flow__handle {
          pointer-events: all !important;
        }
        .orgchart-connect-mode .react-flow__handle {
          opacity: 1 !important;
        }
      `}</style>
      <CanvasSettingsContext.Provider
        value={{ showPhotos, focusedOfficeId: focusOfficeId, employeePhotosById, employeePhotosByName }}
      >
        <CanvasActionsContext.Provider value={actionsContextValue}>
          <div
            className={cn(
              "relative flex min-h-0 flex-col gap-3 overflow-hidden origin-top-left",
              isFullscreenEdit
                ? "fixed inset-0 z-[200] gap-2 bg-background p-3"
                : "h-full",
              tool === "connect" && "orgchart-connect-mode"
            )}
            style={
              isFullscreenEdit
                ? { width: "100%", height: "100dvh" }
                : {
                    transform: `scale(${DEFAULT_TOOL_UI_SCALE})`,
                    width: `${100 / DEFAULT_TOOL_UI_SCALE}%`,
                    height: `calc(100% / ${DEFAULT_TOOL_UI_SCALE})`,
                  }
            }
          >
            {isFullscreenEdit ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm">
                <Button
                  variant="default"
                  size="sm"
                  className="h-9"
                  onClick={() => setIsFullscreenEdit(false)}
                  title="Exit fullscreen (Ctrl+F)"
                >
                  <Minimize2 className="mr-2 h-4 w-4" /> Exit
                </Button>
                {unsavedChanges ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                  >
                    Unsaved - save to keep this version
                  </Badge>
                ) : null}
                <div className="rounded-md border px-2 py-1">
                  <p className="text-[10px] leading-none text-muted-foreground">Version</p>
                  <Select value={currentVersionId ?? "__unsaved__"} onValueChange={handleVersionChange}>
                    <SelectTrigger className="h-7 w-[160px] border-0 p-0 shadow-none">
                      <SelectValue placeholder="Latest version" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {!currentVersionId ? (
                        <SelectItem value="__unsaved__" disabled>
                          {versions.length ? "Unsaved changes" : "No saved version"}
                        </SelectItem>
                      ) : null}
                      {versions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <p className="text-[10px] leading-none text-muted-foreground">Office</p>
                  <Select
                    value={focusedOfficeSelectValue}
                    onValueChange={(value) => setFocusOfficeId(value)}
                  >
                    <SelectTrigger className="h-7 w-[200px] max-w-[40vw] border-0 p-0 shadow-none">
                      <div className="flex min-w-0 items-center gap-1.5 truncate">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <SelectValue placeholder="Select office" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {officesSortedByName.map((office) => {
                        const officeIdentifier = office.data.officeId ?? office.id;
                        return (
                          <SelectItem key={office.id} value={officeIdentifier}>
                            {office.data.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBuildFromDb}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={isSyncing}
                  title="Sync active employees from DB. If an office is selected, only that office is updated."
                >
                  <Database className="mr-2 h-4 w-4" /> Sync
                </Button>
                <Button
                  onClick={handleSaveVersion}
                  size="sm"
                  disabled={isSaving}
                  className={cn(
                    "h-9",
                    unsavedChanges
                      ? "bg-amber-600 text-white hover:bg-amber-500"
                      : "bg-indigo-600 text-white hover:bg-indigo-500"
                  )}
                >
                  <Plus className="mr-2 h-4 w-4" /> {unsavedChanges ? "Save" : "Save version"}
                </Button>
                <div className="mx-1 hidden h-7 w-px bg-border sm:block" />
                <div className="flex items-center gap-2 rounded-md border px-2.5 py-1">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label htmlFor="fullscreen-show-photos" className="cursor-pointer text-xs font-medium">
                    Show photos
                  </Label>
                  <Switch
                    id="fullscreen-show-photos"
                    checked={showPhotos}
                    onCheckedChange={(state) => setShowPhotos(Boolean(state))}
                  />
                </div>
                <div className="mx-1 hidden h-7 w-px bg-border sm:block" />
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => undo()}
                    disabled={!historyStatus.canUndo}
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => redo()}
                    disabled={!historyStatus.canRedo}
                    title="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      const vp = getViewport();
                      zoomToOfficeContent(vp.zoom - 0.1);
                    }}
                    title="Zoom out"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 min-w-[56px]"
                    onClick={() => {
                      setViewport({ x: 0, y: 0, zoom: DEFAULT_CANVAS_ZOOM }, { duration: 200 });
                      setCanvasZoom(DEFAULT_CANVAS_ZOOM);
                    }}
                  >
                    {`${Math.round(canvasZoom * 100)}%`}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      const vp = getViewport();
                      zoomToOfficeContent(vp.zoom + 0.1);
                    }}
                    title="Zoom in"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => focusOffice(focusOfficeId, 0)}
                  >
                    Fit
                  </Button>
                </div>
              </div>
            ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-6 py-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-4 font-semibold leading-tight">Org Chart Builder</h2>
                  <p className="text-sm text-muted-foreground">Build, edit, and export per-office organizational charts.</p>
                  {unsavedChanges ? (
                    <Badge
                      variant="outline"
                      className="mt-2 border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                    >
                      Unsaved - save to keep this version
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-lg border bg-background px-3 py-1.5">
                  <p className="text-[11px] leading-none text-muted-foreground">Version</p>
                  <Select value={currentVersionId ?? "__unsaved__"} onValueChange={handleVersionChange}>
                    <SelectTrigger className="h-7 w-[190px] border-0 p-0 shadow-none">
                    <SelectValue placeholder="Latest version" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {!currentVersionId ? (
                        <SelectItem value="__unsaved__" disabled>
                          {versions.length ? "Unsaved changes" : "No saved version"}
                        </SelectItem>
                      ) : null}
                      {versions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBuildFromDb}
                  variant="outline"
                  size="sm"
                  className="h-11 px-5"
                  disabled={isSyncing}
                  title="Sync active employees from DB. If an office is selected, only that office is updated."
                >
                  <Database className="mr-2 h-4 w-4" /> Sync from DB
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isExporting} className="h-11 px-5">
                      <Download className="mr-2 h-4 w-4" /> Export
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void handleExport("png")}>Export PNG</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport("pdf")}>Export PDF</DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsBulkExportOpen(true)}
                      disabled={!bulkExportOffices.length}
                    >
                      Bulk PDF (offices)…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={handleSaveVersion}
                  size="sm"
                  disabled={isSaving}
                  className={cn(
                    "h-11 px-5",
                    unsavedChanges
                      ? "bg-amber-600 text-white hover:bg-amber-500"
                      : "bg-indigo-600 text-white hover:bg-indigo-500"
                  )}
                >
                  <Plus className="mr-2 h-4 w-4" /> {unsavedChanges ? "Save unsaved version" : "Save version"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 px-5"
                  onClick={() => setIsFullscreenEdit(true)}
                  title="Fullscreen edit (Ctrl+F)"
                >
                  <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-11 px-5">
                      <MoreHorizontal className="mr-2 h-4 w-4" />
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleDeleteVersion}
                      disabled={!currentVersionId || isDeletingVersion}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete version
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            )}
            <div
              className={cn(
                "grid min-h-0 flex-1 gap-4 overflow-hidden",
                isFullscreenEdit ? "grid-cols-1" : "lg:grid-cols-[280px,1fr,320px]"
              )}
            >
        <aside
          className={cn(
            "flex min-h-0 flex-col gap-3 overflow-hidden",
            isFullscreenEdit && "hidden"
          )}
        >
          <Card className="min-h-0 flex-1">
            <CardContent className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pt-4">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-semibold">Offices</Label>
                  <Badge variant="secondary" className="text-xs">{offices.length}</Badge>
                </div>
                <div className="relative">
                  <Input
                    value={officeSearch}
                    onChange={(event) => setOfficeSearch(event.target.value)}
                    placeholder="Search offices..."
                    className="h-8 pr-8"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const first = filteredOffices[0];
                        if (first) setFocusOfficeId(first.data.officeId ?? first.id);
                      }
                    }}
                  />
                  <ListFilter className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 space-y-1">
                  {paginatedOffices.length ? paginatedOffices.map((office: FlowNode) => {
                    const officeIdentifier = office.data.officeId ?? office.id;
                    const isActive = focusOfficeId === officeIdentifier || focusOfficeId === office.id;
                    return (
                      <button
                        key={office.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        )}
                        onClick={() => setFocusOfficeId(officeIdentifier)}
                        title={office.data.name}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{office.data.name}</span>
                      </button>
                    );
                  }) : (
                    <p className="px-2 py-4 text-sm text-muted-foreground">No matches</p>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Page {officePage} of {totalOfficePages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setOfficePage((prev) => Math.max(1, prev - 1))}
                      disabled={officePage <= 1}
                    >
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setOfficePage((prev) => Math.min(totalOfficePages, prev + 1))}
                      disabled={officePage >= totalOfficePages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
       
              </div>

              <div className="rounded-xl border p-3">
                <Label className="mb-2 block text-sm font-semibold">Quick Add</Label>
                <div className="grid gap-2">
                  <Button size="sm" variant="outline" className="border-blue-200 text-blue-700" onClick={() => setIsAddOfficeOpen(true)}>Add office</Button>
                  <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => addStandaloneNode("unit")}>Add unit</Button>
                  <Button size="sm" variant="outline" className="border-violet-200 text-violet-700" onClick={() => setIsAddPersonOpen(true)}>Add person</Button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border p-3">
                <Label className="text-sm font-semibold">View Options</Label>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Allow cross-office links</Label>
                  <Switch
                    checked={allowCrossOfficeEdges}
                    onCheckedChange={(state) => setAllowCrossOfficeEdges(Boolean(state))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Show photos</Label>
                  <Switch
                    checked={showPhotos}
                    onCheckedChange={(state) => setShowPhotos(Boolean(state))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border bg-[#f3f4f6]">
          <div className={cn("flex items-center border-b px-4 py-2", isFullscreenEdit && "hidden")}>
            <div className="flex w-full items-center justify-between gap-2 rounded-md border bg-background p-1">
              <div className="flex items-center gap-1">
              <div className="relative pt-1.5">
                <span className="absolute left-1 top-0 text-[9px] leading-none text-muted-foreground">Connector style</span>
                <Select value={edgeType} onValueChange={handleEdgeTypeChange}>
                  <SelectTrigger className="h-8 w-36 gap-1.5">
                    <GitBranch className="h-4 w-4 shrink-0" />
                    <SelectValue placeholder="Edge type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDGE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>
              <div className="mx-1 h-7 w-px bg-border" />
              <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  undo();
                }}
                disabled={!historyStatus.canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  redo();
                }}
                disabled={!historyStatus.canRedo}
                title="Redo (Ctrl/Cmd+Y)"
                aria-label="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="mx-1 h-7 w-px bg-border" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const vp = getViewport();
                  zoomToOfficeContent(vp.zoom - 0.1);
                }}
                title="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const vp = getViewport();
                  zoomToOfficeContent(vp.zoom + 0.1);
                }}
                title="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[64px]"
                onClick={() => {
                  setViewport({ x: 0, y: 0, zoom: DEFAULT_CANVAS_ZOOM }, { duration: 200 });
                  setCanvasZoom(DEFAULT_CANVAS_ZOOM);
                }}
              >
                {`${Math.round(canvasZoom * 100)}%`}
              </Button>
              <Button variant="outline" size="sm" className="px-3" onClick={() => focusOffice(focusOfficeId, 0)}>
                Fit to screen
              </Button>
              </div>
            </div>
            {isChartLoading ? (
              <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                <div className="flex items-center gap-3 rounded-md border bg-background px-4 py-2 shadow-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  <p className="text-sm text-foreground">Loading org chart...</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div
              ref={reactFlowWrapper}
              className={cn(
                "relative h-full w-full",
                isHand
                  ? "cursor-grab active:cursor-grabbing"
                  : tool === "connect"
                    ? "cursor-crosshair"
                    : "cursor-default"
              )}
              onPointerMove={(event) => {
                updatePointerPosition(event);
                handleFreeLinePointerMove(event);
              }}
              onPointerLeave={clearPointerPosition}
              onPointerDown={handleFreeLinePointerDown}
              onPointerUp={handleFreeLinePointerUp}
              onPointerCancel={handleFreeLinePointerUp}
            >
              {/* Lucidchart-style tool rail — left of canvas (above React Flow hit layer) */}
              <div
                className="nodrag nopan pointer-events-auto absolute left-2 top-1/2 z-[80] flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm"
                role="toolbar"
                aria-label="Canvas tools"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Button
                  type="button"
                  variant={tool === "select" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  title="Select"
                  aria-pressed={tool === "select"}
                  onClick={() => setTool("select")}
                >
                  <MousePointer2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={tool === "hand" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  title="Hand / Pan (H)"
                  aria-pressed={tool === "hand"}
                  onClick={() => setTool((current) => (current === "hand" ? "select" : "hand"))}
                >
                  <Hand className="h-4 w-4" />
                </Button>
                <Popover open={lineMenuOpen} onOpenChange={setLineMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={tool === "connect" || lineMenuOpen ? "default" : "ghost"}
                      size="icon"
                      className="h-9 w-9"
                      title="Line / Connect"
                      aria-pressed={tool === "connect"}
                      aria-expanded={lineMenuOpen}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="center"
                    sideOffset={10}
                    className="z-[10000] w-48 border-slate-700 bg-slate-800 p-1.5 text-slate-50 shadow-xl"
                  >
                    <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Line
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {LINE_FLYOUT_OPTIONS.map((option) => {
                        const isActive = edgeType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                              isActive ? "bg-slate-700 text-white" : "text-slate-100 hover:bg-slate-700/80"
                            )}
                            onClick={() => selectLineStyleFromFlyout(option.value)}
                          >
                            <span className="min-w-0 flex-1 truncate">{option.label}</span>
                            {isActive ? <Check className="h-3.5 w-3.5 shrink-0 text-sky-300" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="my-0.5 h-px w-7 bg-border" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Add text"
                  onClick={() => {
                    setTool("select");
                    addStandaloneNode("annotation");
                  }}
                >
                  <Type className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Add office"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setTool("select");
                    setIsAddOfficeOpen(true);
                  }}
                >
                  <Building2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Add unit"
                  onClick={() => {
                    setTool("select");
                    addStandaloneNode("unit");
                  }}
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="Add person"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setTool("select");
                    setIsAddPersonOpen(true);
                  }}
                >
                  <User className="h-4 w-4" />
                </Button>
              </div>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onConnectStart={handleConnectStart}
                onConnectEnd={handleConnectEnd}
                onSelectionChange={handleSelectionChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                snapToGrid
                snapGrid={[10, 10]}
                selectionOnDrag={!isHand}
                multiSelectionKeyCode="Shift"
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={defaultEdgeOptions}
                panOnDrag={isHand}
                nodesDraggable={!isHand}
                nodesConnectable={!isHand}
                elementsSelectable={!isHand}
                onNodeDragStart={handleNodeDragStart}
                onNodeDrag={handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                onMoveStart={handleMoveStart}
                onMoveEnd={handleMoveEnd}
                onMove={(_, viewport) => setCanvasZoom(viewport.zoom)}
                minZoom={0.2}
                maxZoom={3}
                defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_CANVAS_ZOOM }}
                deleteKeyCode={["Delete", "Backspace"]}
                connectionLineType={
                  edgeType === "smoothstep"
                    ? SMOOTH_CONNECTION_LINE
                    : edgeType === "straight"
                      ? STRAIGHT_CONNECTION_LINE
                      : ORTHOGONAL_CONNECTION_LINE
                }
                proOptions={{ hideAttribution: true }}
                style={{ width: "100%", height: "100%", backgroundColor: "#f3f4f6" }}
              >
                <MarkerDefinitionsLayer definitions={customMarkerDefinitions} />
                <Background
                  id="org-chart-dots"
                  variant={BackgroundVariant.Dots}
                  gap={18}
                  size={1.4}
                  color="#cfd4dc"
                />
                <MiniMap
                  className="rounded-md border bg-background"
                  zoomable
                  pannable
                  nodeStrokeWidth={3}
                  nodeColor={(node: FlowNode) =>
                    node.data.outlineColor ??
                    node.data.headerColor ??
                    DEFAULT_NODE_COLORS[node.type as OrgNodeType]
                  }
                  position="bottom-left"
                />
                <Controls showInteractive={false} position="bottom-right" />
                <AlignmentGuides
                  vertical={helperLines.vertical}
                  horizontal={helperLines.horizontal}
                  spacings={helperLines.spacings}
                />

              </ReactFlow>
              <div
                className="orgchart-watermark pointer-events-none absolute inset-0 z-[5] items-center justify-center"
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={watermarkSrc}
                  alt=""
                  className="max-h-[55%] max-w-[55%] object-contain opacity-[0.07]"
                  draggable={false}
                />
              </div>
              <div
                data-orgchart-export-ignore="true"
                className="pointer-events-none absolute left-1/2 top-8 z-30 -translate-x-1/2 rounded-full border bg-background/95 px-4 py-1.5 text-sm text-muted-foreground shadow-sm"
              >
                {tool === "connect"
                  ? freeLineDraft
                    ? "Release to place the line"
                    : "Click-drag on empty canvas to draw (+) • Or drag from node handles"
                  : "Drag to pan • Scroll to zoom • Click a node to edit"}
              </div>
              {freeLineDraft ? (
                <FreeLinePreview draft={freeLineDraft} getViewport={getViewport} />
              ) : null}
              {isHand ? (
                <div
                  data-orgchart-export-ignore="true"
                  className="pointer-events-none absolute right-3 top-3 z-50 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white shadow"
                >
                  Hand tool active - press ESC to exit
                </div>
              ) : null}
            </div>
          </div>
        </section>

          <aside
            className={cn(
              "min-h-0 space-y-4 overflow-auto pr-1",
              isFullscreenEdit && !showFullscreenInspector && "hidden",
              isFullscreenEdit &&
                showFullscreenInspector &&
                "absolute right-3 top-[4.75rem] z-40 w-[min(320px,calc(100%-1.5rem))] max-h-[calc(100dvh-5.5rem)] rounded-xl border bg-background p-1 shadow-xl"
            )}
          >
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {selectedNode ? "Selected Node" : selectedEdge ? "Selected Edge" : "Selection"}
                  </h3>
                  {selectedNode ? (
                    selectedNode.type === "person" ? (
                      <User className="h-4 w-4" />
                    ) : selectedNode.type === "unit" ? (
                      <Users className="h-4 w-4" />
                    ) : selectedNode.type === "annotation" ? (
                      <Type className="h-4 w-4" />
                    ) : selectedNode.type === "junction" ? (
                      <GitBranch className="h-4 w-4" />
                    ) : selectedNode.type === "lineEndpoint" ? (
                      <Link2 className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )
                  ) : selectedEdge ? (
                    <GitBranch className="h-4 w-4" />
                  ) : null}
                </div>
                {selectedNode ? (
                  selectedNode.type === "lineEndpoint" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Line endpoint — drag to reshape the standalone line, or remove it.
                      </p>
                      <Button variant="destructive" size="sm" onClick={removeSelectedNode} className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> Remove endpoint
                      </Button>
                    </div>
                  ) : selectedNode.type === "junction" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Connection junction — drag this hub, then release to snap into a straight T. Or click Straighten.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex w-full items-center gap-2"
                        onClick={() => {
                          const straightened = straightenChartGeometry(
                            nodesRef.current,
                            edgesRef.current,
                            new Set([selectedNode.id])
                          );
                          if (straightened !== nodesRef.current) {
                            runWithHistory(() => {
                              setNodes(straightened);
                              nodesRef.current = straightened;
                            });
                          }
                          toast({
                            title: "Junction straightened",
                            description: "Hub snapped to a level T with centered stem.",
                          });
                        }}
                      >
                        <GitBranch className="h-4 w-4" /> Straighten
                      </Button>
                      <Button variant="destructive" size="sm" onClick={removeSelectedNode} className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> Remove junction
                      </Button>
                    </div>
                  ) : selectedNode.type === "annotation" ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="annotation-text">Text</Label>
                        <Textarea
                          id="annotation-text"
                          rows={3}
                          value={selectedAnnotationText}
                          onChange={(event) =>
                            updateSelectedNode({
                              text: event.target.value,
                              name: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="annotation-color">Text color</Label>
                        <Input
                          id="annotation-color"
                          type="color"
                          value={selectedAnnotationColor}
                          onChange={(event) => updateSelectedNode({ color: event.target.value })}
                          className="h-10 w-16 cursor-pointer p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="annotation-bg">Background</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="annotation-bg"
                            type="color"
                            value={selectedAnnotationBg ?? "#ffffff"}
                            onChange={(event) => updateSelectedNode({ bg: event.target.value })}
                            className="h-10 w-16 cursor-pointer p-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSelectedNode({ bg: undefined })}
                            disabled={!selectedAnnotationBg}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="annotation-font-size">Font size</Label>
                        <Input
                          id="annotation-font-size"
                          type="range"
                          min={MIN_ANNOTATION_FONT_SIZE}
                          max={MAX_ANNOTATION_FONT_SIZE}
                          value={selectedAnnotationFontSize}
                          onChange={(event) => updateSelectedNode({ fontSize: Number(event.target.value) })}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {MIN_ANNOTATION_FONT_SIZE}-{MAX_ANNOTATION_FONT_SIZE}px
                          </span>
                          <span>{selectedAnnotationFontSize}px</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Weight</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={selectedAnnotationWeight === "normal" ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateSelectedNode({ weight: "normal" })}
                          >
                            Normal
                          </Button>
                          <Button
                            type="button"
                            variant={selectedAnnotationWeight === "bold" ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateSelectedNode({ weight: "bold" })}
                          >
                            <Bold className="mr-1 h-4 w-4" /> Bold
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Align</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={selectedAnnotationAlign === "left" ? "default" : "outline"}
                            size="icon"
                            onClick={() => updateSelectedNode({ align: "left" })}
                            aria-label="Align left"
                          >
                            <AlignLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={selectedAnnotationAlign === "center" ? "default" : "outline"}
                            size="icon"
                            onClick={() => updateSelectedNode({ align: "center" })}
                            aria-label="Align center"
                          >
                            <AlignCenter className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={selectedAnnotationAlign === "right" ? "default" : "outline"}
                            size="icon"
                            onClick={() => updateSelectedNode({ align: "right" })}
                            aria-label="Align right"
                          >
                            <AlignRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="annotation-rotate">Rotate</Label>
                        <Input
                          id="annotation-rotate"
                          type="range"
                          min={MIN_ANNOTATION_ROTATION}
                          max={MAX_ANNOTATION_ROTATION}
                          value={selectedAnnotationRotation}
                          onChange={(event) => updateSelectedNode({ rotate: Number(event.target.value) })}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {MIN_ANNOTATION_ROTATION}° - {MAX_ANNOTATION_ROTATION}°
                          </span>
                          <span>{selectedAnnotationRotation}°</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          {selectedAnnotationLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          <span>{selectedAnnotationLocked ? "Position locked" : "Position unlocked"}</span>
                        </div>
                        <Switch
                          checked={selectedAnnotationLocked}
                          onCheckedChange={(state) => updateSelectedNode({ lock: state })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={sendToBack}>
                          <Layers className="mr-2 h-4 w-4" /> Send back
                        </Button>
                        <Button variant="outline" size="sm" onClick={bringToFront}>
                          <Layers className="mr-2 h-4 w-4 rotate-180" /> Bring front
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => duplicateNode(selectedNode.id)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </Button>
                        <Button variant="destructive" size="sm" onClick={removeSelectedNode} className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : selectedNode.type === "office" ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{selectedNode.data.name}</p>
                            <Badge variant="secondary" className="mt-1 text-[10px]">Office</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="office-name">Name</Label>
                        <Input
                          id="office-name"
                          value={selectedNode.data.name}
                          onChange={(event) => updateSelectedNode({ name: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="office-type">Type</Label>
                        <Select value="office" onValueChange={() => undefined} disabled>
                          <SelectTrigger id="office-type">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="office">Office</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="office-select">Office</Label>
                        <Select
                          value={selectedNode.data.officeId ?? selectedNode.id}
                          onValueChange={(value) => setFocusOfficeId(value)}
                        >
                          <SelectTrigger id="office-select">
                            <SelectValue placeholder="Office" />
                          </SelectTrigger>
                          <SelectContent>
                            {offices.map((office) => (
                              <SelectItem key={office.id} value={office.data.officeId ?? office.id}>
                                {office.data.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedNode.type !== "person" ? (
                        <div className="space-y-1">
                          <Label htmlFor="prop-label">Header label</Label>
                          <Input
                            id="prop-label"
                            value={selectedNode.data.label ?? ""}
                            onChange={(event) => updateSelectedNode({ label: event.target.value || undefined })}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1">
                        <Label htmlFor="prop-outline">Outline color</Label>
                        <Input
                          id="prop-outline"
                          type="color"
                          value={selectedNodeOutlineColor}
                          onChange={(event) => updateSelectedNode({ outlineColor: event.target.value })}
                          className="h-10 w-16 cursor-pointer p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="prop-name">Name</Label>
                        <Input
                          id="prop-name"
                          value={selectedNode.data.name}
                          onChange={(event) => updateSelectedNode({ name: event.target.value })}
                        />
                      </div>
                      {selectedNode.type !== "office" ? (
                        <div className="space-y-1">
                          <Label htmlFor="prop-title">Title</Label>
                          <Input
                            id="prop-title"
                            value={selectedNode.data.title ?? ""}
                            onChange={(event) => updateSelectedNode({ title: event.target.value })}
                          />
                        </div>
                      ) : null}
                      {selectedNode.type === "person" ? (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="prop-type">Employee type</Label>
                            <Input
                              id="prop-type"
                              value={selectedNode.data.employeeTypeName ?? ""}
                              onChange={(event) => updateSelectedNode({ employeeTypeName: event.target.value || undefined })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Head of office</Label>
                            <Switch
                              checked={Boolean(selectedNode.data.isHead)}
                              onCheckedChange={(state) => updateSelectedNode({ isHead: Boolean(state) })}
                            />
                          </div>
                        </>
                      ) : null}
                      <div className="space-y-1">
                        <Label htmlFor="prop-notes">Notes</Label>
                        <Textarea
                          id="prop-notes"
                          rows={3}
                          value={selectedNode.data.notes ?? ""}
                          onChange={(event) => updateSelectedNode({ notes: event.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={sendToBack}>
                          <Layers className="mr-2 h-4 w-4" /> Send back
                        </Button>
                        <Button variant="outline" size="sm" onClick={bringToFront}>
                          <Layers className="mr-2 h-4 w-4 rotate-180" /> Bring front
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => duplicateNode(selectedNode.id)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </Button>
                        <Button variant="destructive" size="sm" onClick={removeSelectedNode} className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  )
                ) : selectedEdge ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="edge-label">Label</Label>
                    <Input
                      id="edge-label"
                      value={typeof selectedEdge.label === "string" ? selectedEdge.label : selectedEdge.label ? String(selectedEdge.label) : ""}
                      onChange={(event) => updateSelectedEdge({ label: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edge-type">Style</Label>
                  <Select
                    value={selectedEdge.data?.customType ?? mapFlowEdgeTypeToDoc(selectedEdge.type)}
                    onValueChange={(value: "orth" | "smoothstep" | "straight") =>
                      updateSelectedEdge({
                        type: mapDocEdgeTypeToFlow(value),
                        data: { ...selectedEdge.data, customType: value },
                      })
                    }
                  >
                    <SelectTrigger id="edge-type">
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                      <SelectContent>
                        {EDGE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edge-color">Color</Label>
                    <Input
                      id="edge-color"
                      type="color"
                      value={selectedEdge.data?.color ?? DEFAULT_EDGE_COLOR}
                      onChange={(event) => {
                        const color = event.target.value;
                        updateSelectedEdge({
                          data: {
                            ...selectedEdge.data,
                            color,
                            markerColor: color,
                          },
                        });
                      }}
                      className="h-10 w-16 cursor-pointer p-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="edge-start-marker">Start marker</Label>
                      <MarkerPreview
                        type={selectedEdgeMarkerConfig.start}
                        color={selectedEdgeMarkerConfig.color}
                        direction="start"
                      />
                    </div>
                    <Select
                      value={selectedEdgeMarkerConfig.start}
                      onValueChange={(value) =>
                        updateSelectedEdge({
                          data: {
                            ...selectedEdge.data,
                            markerStartType: value as OrgMarkerType,
                          },
                        })
                      }
                    >
                      <SelectTrigger id="edge-start-marker">
                        <SelectValue placeholder="Start marker" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKER_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} title={option.description}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="edge-end-marker">End marker</Label>
                      <MarkerPreview
                        type={selectedEdgeMarkerConfig.end}
                        color={selectedEdgeMarkerConfig.color}
                        direction="end"
                      />
                    </div>
                    <Select
                      value={selectedEdgeMarkerConfig.end}
                      onValueChange={(value) =>
                        updateSelectedEdge({
                          data: {
                            ...selectedEdge.data,
                            markerEndType: value as OrgMarkerType,
                          },
                        })
                      }
                    >
                      <SelectTrigger id="edge-end-marker">
                        <SelectValue placeholder="End marker" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKER_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} title={option.description}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edge-marker-color">Marker color</Label>
                    <Input
                      id="edge-marker-color"
                      type="color"
                      value={selectedEdgeMarkerConfig.color}
                      onChange={(event) => {
                        const markerColor = event.target.value;
                        updateSelectedEdge({
                          data: {
                            ...selectedEdge.data,
                            markerColor,
                          },
                        });
                      }}
                      className="h-10 w-16 cursor-pointer p-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edge-marker-size">Marker size</Label>
                    <Input
                      id="edge-marker-size"
                      type="number"
                      min={MIN_MARKER_SIZE}
                      max={MAX_MARKER_SIZE}
                      value={selectedEdgeMarkerConfig.size}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        const markerSize = normalizeMarkerSizeValue(Number.isNaN(value) ? DEFAULT_MARKER_SIZE : value);
                        updateSelectedEdge({
                          data: {
                            ...selectedEdge.data,
                            markerSize,
                          },
                        });
                      }}
                      className="h-10 w-20"
                    />
                    <p className="text-xs text-muted-foreground">{MIN_MARKER_SIZE}-{MAX_MARKER_SIZE} px</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={removeSelectedEdge} className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" /> Remove connection
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a node or edge to edit its properties.</p>
              )}
            </CardContent>
          </Card>

          <Card className={cn(isFullscreenEdit && "hidden")}>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Summary</p>
                <span className="text-xs text-muted-foreground">i</span>
              </div>
              <div className="rounded-md border bg-background p-2">
                <div className="flex items-center justify-between px-1 py-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span>Offices</span>
                  </div>
                  <span className="font-semibold text-foreground">{offices.length}</span>
                </div>
                <div className="flex items-center justify-between px-1 py-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>Units</span>
                  </div>
                  <span className="font-semibold text-foreground">{nodes.filter((node: FlowNode) => node.type === "unit").length}</span>
                </div>
                <div className="flex items-center justify-between px-1 py-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>People</span>
                  </div>
                  <span className="font-semibold text-foreground">{nodes.filter((node: FlowNode) => node.type === "person").length}</span>
                </div>
                <div className="flex items-center justify-between px-1 py-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <GitBranch className="h-3.5 w-3.5 text-primary" />
                    <span>Total nodes</span>
                  </div>
                  <span className="font-semibold text-foreground">{nodes.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
         
        </aside>
            </div>
          </div>
        </CanvasActionsContext.Provider>
      </CanvasSettingsContext.Provider>
      <AddPersonDialog
        open={isAddPersonOpen}
        onOpenChange={setIsAddPersonOpen}
        departmentId={departmentId}
        onSelect={handleAddPersonSelection}
        canConnectToParent={canConnectToSelectedParent}
        initialConnectToParent={canConnectToSelectedParent}
        initialDropNearCursor={defaultDropNearCursor}
      />
      <AddOfficeDialog
        open={isAddOfficeOpen}
        onOpenChange={setIsAddOfficeOpen}
        departmentId={departmentId}
        onSelect={handleAddOfficeSelection}
      />
      <BulkExportDialog
        open={isBulkExportOpen}
        onOpenChange={setIsBulkExportOpen}
        offices={bulkExportOffices}
        isExporting={isExporting}
        onConfirm={handleBulkExport}
      />
      <AlertModal
        title="Delete version?"
        description="This permanently removes the selected org chart version. Current draft is not affected."
        isOpen={isDeleteVersionOpen}
        onClose={() => {
          if (!isDeletingVersion) {
            setIsDeleteVersionOpen(false);
          }
        }}
        onConfirm={confirmDeleteVersion}
        loading={isDeletingVersion}
        variant="destructive"
        confirmText="Delete"
      />
      {isSyncing ? (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <LoadingWithProgress active />
        </div>
      ) : null}
    </>
  );
};

const nodeTypes = {
  office: (props: NodeProps<FlowNodeData>) => (
    <FlowNodeCard {...props} icon={<Building2 className="h-4 w-4" />} showHeaderLabel={false} />
  ),
  unit: (props: NodeProps<FlowNodeData>) => (
    <FlowNodeCard {...props} icon={<Users className="h-4 w-4" />} showHeaderLabel={false} />
  ),
  person: (props: NodeProps<FlowNodeData>) => <FlowNodeCard {...props} icon={<User className="h-4 w-4" />} />,
  annotation: (props: NodeProps<FlowNodeData>) => <AnnotationNode {...props} />,
  junction: (props: NodeProps<FlowNodeData>) => <JunctionNode {...props} />,
  lineEndpoint: (props: NodeProps<FlowNodeData>) => <LineEndpointNode {...props} />,
};

const edgeTypes = {
  step: (props: EdgeProps) => <OrgChartBranchEdge {...props} pathVariant="step" />,
  smoothstep: (props: EdgeProps) => <OrgChartBranchEdge {...props} pathVariant="smoothstep" />,
  straight: (props: EdgeProps) => <OrgChartBranchEdge {...props} pathVariant="straight" />,
  default: (props: EdgeProps) => <OrgChartBranchEdge {...props} pathVariant="smoothstep" />,
};

function OrgChartBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  label,
  selected,
  pathVariant,
}: EdgeProps & { pathVariant: "step" | "smoothstep" | "straight" }) {
  const [isHovered, setIsHovered] = useState(false);
  const isConnecting = useStore((state) => Boolean(state.connectionNodeId));
  const [edgePath, labelX, labelY] =
    pathVariant === "straight"
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: pathVariant === "step" ? 0 : 8,
        });

  const showMidpoint = selected || isHovered || isConnecting;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={36}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={36}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          data-orgchart-edge-id={id}
          className={cn(
            "nodrag nopan pointer-events-auto rounded-full border-2 border-white bg-[#3b82f6] shadow-sm transition-opacity duration-150",
            isConnecting ? "h-5 w-5" : "h-3.5 w-3.5",
            showMidpoint ? "opacity-100" : "opacity-0"
          )}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            zIndex: 5,
            pointerEvents: "all",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Drop connection here to make a T-branch"
        />
        {label ? (
          <div
            className="nodrag nopan pointer-events-none rounded bg-background/90 px-1 text-[10px] text-foreground"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 14}px)`,
            }}
          >
            {label}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}

function FreeLinePreview({
  draft,
  getViewport,
}: {
  draft: { start: { x: number; y: number }; end: { x: number; y: number } };
  getViewport: () => { x: number; y: number; zoom: number };
}) {
  const viewport = getViewport();
  const x1 = draft.start.x * viewport.zoom + viewport.x;
  const y1 = draft.start.y * viewport.zoom + viewport.y;
  const x2 = draft.end.x * viewport.zoom + viewport.x;
  const y2 = draft.end.y * viewport.zoom + viewport.y;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[25]"
      width="100%"
      height="100%"
      aria-hidden
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={x1} cy={y1} r={4} fill="#fff" stroke="#3b82f6" strokeWidth={2} />
      <circle cx={x2} cy={y2} r={4} fill="#fff" stroke="#3b82f6" strokeWidth={2} />
    </svg>
  );
}

function JunctionNode({ selected }: NodeProps<FlowNodeData>) {
  const handles = getHandlesForType("junction");
  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        selected && "ring-2 ring-indigo-400 ring-offset-1 rounded-full"
      )}
      style={{ width: JUNCTION_NODE_SIZE, height: JUNCTION_NODE_SIZE }}
      title="Drag hub to straighten the T-junction"
    >
      <div
        className="rounded-full border-2 border-white bg-slate-900 shadow"
        style={{ width: JUNCTION_VISUAL_SIZE, height: JUNCTION_VISUAL_SIZE }}
      />
      {handles.map((handle) => (
        <Handle
          key={handle.id}
          type={handle.type}
          position={handle.position}
          id={handle.id}
          className="!h-3 !w-3 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent"
          style={handle.style}
        />
      ))}
    </div>
  );
}

function LineEndpointNode({ selected }: NodeProps<FlowNodeData>) {
  const handles = getHandlesForType("lineEndpoint");
  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        selected && "ring-2 ring-sky-400 ring-offset-1 rounded-full"
      )}
      style={{ width: LINE_ENDPOINT_SIZE, height: LINE_ENDPOINT_SIZE }}
      title="Drag endpoint to reshape the line"
    >
      <div
        className="rounded-full border-2 border-sky-500 bg-white shadow"
        style={{ width: LINE_ENDPOINT_VISUAL, height: LINE_ENDPOINT_VISUAL }}
      />
      {handles.map((handle) => (
        <Handle
          key={handle.id}
          type={handle.type}
          position={handle.position}
          id={handle.id}
          className="!h-3 !w-3 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent"
          style={handle.style}
        />
      ))}
    </div>
  );
}

type FlowNodeCardProps = NodeProps<FlowNodeData> & { icon: ReactNode; showHeaderLabel?: boolean };

function AutoFitTextBlock({
  children,
  className,
  maxFontSize,
  minFontSize,
  fitKey,
}: {
  children: ReactNode;
  className?: string;
  maxFontSize: number;
  minFontSize: number;
  fitKey: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    let size = maxFontSize;
    content.style.fontSize = `${size}px`;
    content.style.lineHeight = "1.2";

    const fits = () =>
      content.scrollHeight <= container.clientHeight + 0.5 &&
      content.scrollWidth <= container.clientWidth + 0.5;

    while (size > minFontSize && !fits()) {
      size -= 0.5;
      content.style.fontSize = `${size}px`;
    }
  }, [fitKey, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", className)}>
      <div ref={contentRef} className="w-full break-words [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

function FlowNodeCard({ id, data, type, selected, icon }: FlowNodeCardProps) {
  const actions = useCanvasActions();
  const updateNodeInternals = useUpdateNodeInternals();
  const handles = getHandlesForType(type as OrgNodeType);
  const { showPhotos, focusedOfficeId, employeePhotosById, employeePhotosByName } = useCanvasSettings();
  const outlineColor = normalizeColor(data.outlineColor) ?? NEUTRAL_OUTLINE_COLOR;
  const borderWidth = data.isHead ? 3 : 2;
  const glowSize = data.isHead ? 6 : 3;
  const isPerson = type === "person";
  const cardWidth = isPerson ? PERSON_CARD_WIDTH : GROUP_CARD_WIDTH;
  const cardHeight = isPerson ? PERSON_CARD_HEIGHT : GROUP_CARD_HEIGHT;
  const cardStyles: CSSProperties = {
    borderColor: outlineColor,
    borderWidth,
    boxShadow: `0 0 0 ${glowSize}px ${colorWithAlpha(outlineColor, data.isHead ? 0.25 : 0.15)}`,
    width: cardWidth,
    height: cardHeight,
  };

  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, selected, cardWidth, cardHeight, borderWidth, updateNodeInternals]);

  const renderAvatar = () => {
    const belongsToFocusedOffice =
      !focusedOfficeId ||
      (data.officeId != null && data.officeId === focusedOfficeId) ||
      id === focusedOfficeId;

    const latestImageUrl = data.employeeId ? employeePhotosById.get(data.employeeId) : undefined;
    const matchedImageUrl = data.employeeId
      ? undefined
      : employeePhotosByName.get(normalizePhotoLookupName(data.name));
    const imageUrl = latestImageUrl ?? data.imageUrl ?? matchedImageUrl;
    const avatarSizeClass = isPerson ? "h-12 w-12" : "h-10 w-10";

    if (showPhotos && belongsToFocusedOffice && imageUrl) {
      return (
        <Image
          src={imageUrl}
          alt={data.name}
          width={isPerson ? 48 : 40}
          height={isPerson ? 48 : 40}
          sizes={isPerson ? "48px" : "40px"}
          unoptimized
          className={cn(avatarSizeClass, "shrink-0 rounded-full border-2 object-cover shadow-md")}
          style={{ borderColor: colorWithAlpha(outlineColor, 0.35) }}
        />
      );
    }
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-sm text-foreground",
          avatarSizeClass
        )}
        style={{
          border: `2px solid ${colorWithAlpha(outlineColor, 0.3)}`,
          backgroundColor: colorWithAlpha(outlineColor, 0.12),
        }}
      >
        {icon}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "group relative box-border overflow-visible rounded-lg border bg-card transition-shadow",
        selected && "ring-2 ring-primary/40"
      )}
      style={cardStyles}
    >
      <NodeToolbar
        isVisible={selected}
        className="flex gap-2 rounded-full border bg-background px-3 py-1 text-xs shadow"
      >
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => actions.duplicateNode(id)} type="button">
          <Copy className="h-3 w-3" /> Duplicate
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => actions.addChildUnit(id)} type="button">
          <Users className="h-3 w-3" /> Unit
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => actions.addChildPerson(id)} type="button">
          <User className="h-3 w-3" /> Person
        </button>
      </NodeToolbar>

      {handles.map((handle) => (
        <Handle
          key={handle.id}
          type={handle.type}
          position={handle.position}
          id={handle.id}
          className="!min-h-0 !min-w-0 !rounded-full !border-2 !border-white !bg-[#3b82f6]"
          style={handle.style}
        />
      ))}

      <div className="flex h-full min-h-0 items-center gap-3 overflow-hidden px-3 py-2">
        {renderAvatar()}
        <AutoFitTextBlock
          maxFontSize={isPerson ? 13 : 14}
          minFontSize={9}
          fitKey={`${data.name}|${data.title ?? ""}|${data.employeeTypeName ?? ""}|${data.isHead ? 1 : 0}|${type}`}
          className="flex items-center"
        >
          <div className="space-y-0.5 pr-1">
            <div className="flex items-start gap-1.5">
              <p className="min-w-0 flex-1 font-semibold leading-tight text-foreground">
                {data.name}
              </p>
              {data.isHead ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-none bg-transparent px-1 py-0 text-[9px] uppercase tracking-wide text-muted-foreground"
                >
                  Head
                </Badge>
              ) : null}
            </div>
            {data.title ? (
              <p className="leading-tight text-muted-foreground" style={{ fontSize: "0.92em" }}>
                {data.title}
              </p>
            ) : null}
            {data.employeeTypeName ? (
              <p className="leading-tight text-muted-foreground" style={{ fontSize: "0.88em" }}>
                {data.employeeTypeName}
              </p>
            ) : null}
          </div>
        </AutoFitTextBlock>
      </div>
    </div>
  );
}

function AnnotationNode({ id, data, selected }: NodeProps<FlowNodeData>) {
  const actions = useCanvasActions();
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [draftText, setDraftText] = useState(
    data.text ?? data.name ?? DEFAULT_ANNOTATION_TEXT
  );

  useEffect(() => {
    setDraftText(data.text ?? data.name ?? DEFAULT_ANNOTATION_TEXT);
  }, [data.name, data.text]);

  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== draftText) {
      contentRef.current.textContent = draftText;
    }
  }, [draftText]);

  useEffect(() => {
    if (!isEditing) return;
    const element = contentRef.current;
    if (!element) return;
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing]);

  const commitText = useCallback(() => {
    const value = (contentRef.current?.textContent ?? "").trim();
    const normalized = value || DEFAULT_ANNOTATION_TEXT;
    setDraftText(normalized);
    actions.updateNodeData(id, { text: normalized, name: normalized });
    setIsEditing(false);
  }, [actions, id]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setDraftText(data.text ?? data.name ?? DEFAULT_ANNOTATION_TEXT);
  }, [data.name, data.text]);

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        const nextWeight = data.weight === "bold" ? "normal" : "bold";
        actions.updateNodeData(id, { weight: nextWeight });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (isEditing) {
          commitText();
        } else {
          setIsEditing(true);
        }
        return;
      }

      if (event.key === "Escape" && isEditing) {
        event.preventDefault();
        cancelEditing();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actions, cancelEditing, commitText, data.weight, id, isEditing, selected]);

  const color = normalizeColor(data.color) ?? DEFAULT_ANNOTATION_COLOR;
  const bg = normalizeColor(data.bg) ?? undefined;
  const fontSize = normalizeAnnotationFontSize(data.fontSize);
  const weight = normalizeAnnotationWeight(data.weight);
  const align = normalizeAnnotationAlignment(data.align);
  const rotation = normalizeAnnotationRotation(data.rotate);
  const zIndex = typeof data.z === "number" && !Number.isNaN(data.z) ? data.z : 0;
  const locked = Boolean(data.lock);

  return (
    <div
      className={cn(
        "group min-w-[120px] max-w-md cursor-text rounded-md px-3 py-2 shadow-sm transition",
        selected ? "ring-2 ring-primary/40" : "ring-1 ring-transparent",
        isEditing ? "cursor-text" : locked ? "cursor-default" : "cursor-move"
      )}
      style={{
        color,
        backgroundColor: bg ?? "transparent",
        fontSize,
        fontWeight: weight,
        textAlign: align,
        transform: `rotate(${rotation}deg)`,
        zIndex,
      }}
      onDoubleClick={() => {
        setIsEditing(true);
      }}
      onPointerDown={(event) => {
        if (isEditing) {
          event.stopPropagation();
        }
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          "whitespace-pre-wrap break-words border border-transparent outline-none",
          selected ? "border-dashed border-primary/40" : "border-transparent"
        )}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onInput={(event) => setDraftText((event.target as HTMLDivElement).textContent ?? "")}
        onBlur={() => {
          if (isEditing) {
            commitText();
          }
        }}
      >
        {draftText}
      </div>
    </div>
  );
}

type HandleConfig = { id: string; type: "source" | "target"; position: Position; style?: CSSProperties };

const HANDLE_POSITIONS: Array<{
  id: "t" | "r" | "b" | "l";
  position: Position;
  style: CSSProperties;
}> = [
  {
    id: "t",
    position: Position.Top,
    // Match React Flow defaults so edge endpoints sit on the handle center.
    style: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
  },
  {
    id: "r",
    position: Position.Right,
    style: { top: "50%", right: 0, transform: "translate(50%, -50%)" },
  },
  {
    id: "b",
    position: Position.Bottom,
    style: { bottom: 0, left: "50%", transform: "translate(-50%, 50%)" },
  },
  {
    id: "l",
    position: Position.Left,
    style: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
  },
];

function getHandlesForType(type: OrgNodeType): HandleConfig[] {
  if (type === "junction" || type === "lineEndpoint") {
    // All handles share the center so lines meet at one point (no bend).
    const centerStyle: CSSProperties = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 5,
      opacity: 0,
      pointerEvents: "all",
    };
    return HANDLE_POSITIONS.flatMap(({ id, position }) => [
      { id: `${id}-target`, type: "target" as const, position, style: { ...centerStyle } },
      { id: `${id}-source`, type: "source" as const, position, style: { ...centerStyle } },
    ]);
  }
  return HANDLE_POSITIONS.flatMap(({ id, position, style }) => [
    { id: `${id}-target`, type: "target" as const, position, style: { ...style, zIndex: 5 } },
    { id: `${id}-source`, type: "source" as const, position, style: { ...style, zIndex: 5 } },
  ]);
}

function mapDocEdgeTypeToFlow(type?: "orth" | "smoothstep" | "straight"): Edge["type"] {
  if (type === "smoothstep") return "smoothstep";
  if (type === "straight") return "straight";
  // Default/document value "orth" maps to React Flow's built-in "step" type
  return "step";
}

function mapFlowEdgeTypeToDoc(type?: string): "orth" | "smoothstep" | "straight" {
  if (type === "smoothstep" || type === "default" || type === "bezier") return "smoothstep";
  if (type === "straight") return "straight";
  // Treat any orthogonal/step-like type as "orth" in the document
  if (type === "step" || type === "orthogonal" || type === "orth") return "orth";
  return "orth";
}


