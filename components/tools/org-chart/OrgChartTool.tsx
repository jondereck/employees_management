"use client";

import "reactflow/dist/style.css";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  ConnectionLineType,
  ConnectionMode,
  Edge,
  EdgeChange,
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
} from "reactflow";
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
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
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
  BadgeCheck,
  Building2,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Download,
  GitBranch,
  Layers,
  ListFilter,
  Move,
  Plus,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2,
  User,
  Users,
  Wand2,
  Hand,
} from "lucide-react";
import * as htmlToImage from "html-to-image";
import { PDFDocument } from "pdf-lib";

const DEFAULT_NODE_COLORS: Record<OrgNodeType, string> = {
  office: "#1E88E5",
  unit: "#FB8C00",
  person: "#3949AB",
};

const DEFAULT_EDGE_COLOR = "#0F172A";
const NEUTRAL_OUTLINE_COLOR = "#E2E8F0";
const HISTORY_LIMIT = 100;

const EDGE_TYPE_OPTIONS: Array<{ label: string; value: "orth" | "smoothstep" }> = [
  { label: "Orthogonal", value: "orth" },
  { label: "Smooth", value: "smoothstep" },
];

const MARKER_TYPE_OPTIONS: Array<{ label: string; value: OrgMarkerType; description: string }> = [
  { label: "None", value: "none", description: "No marker" },
  { label: "Arrow", value: "arrow", description: "Open arrow" },
  { label: "Arrow (closed)", value: "arrowClosed", description: "Closed arrow" },
  { label: "Diamond", value: "diamond", description: "Diamond marker" },
  { label: "Circle", value: "circle", description: "Circle marker" },
];

const DEFAULT_MARKER_START: OrgMarkerType = "none";
const DEFAULT_MARKER_END: OrgMarkerType = "arrowClosed";
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
  const nextStyle = { ...(edge.style ?? {}), stroke: normalizedColor, strokeWidth: 2 };

  const currentData = edge.data ?? {};
  const dataMatches =
    (normalizeColor(currentData.color) ?? DEFAULT_EDGE_COLOR) === normalizedColor &&
    normalizeMarkerSizeValue(currentData.markerSize) === markerSize &&
    (normalizeColor(currentData.markerColor ?? currentData.color) ?? normalizedColor) === markerColor &&
    (currentData.markerStartType ?? DEFAULT_MARKER_START) === markerStartType &&
    (currentData.markerEndType ?? DEFAULT_MARKER_END) === markerEndType;

  const styleMatches =
    (edge.style?.stroke ?? normalizedColor) === normalizedColor &&
    (edge.style?.strokeWidth ?? 2) === 2;

  const startMatches = markerEquals(edge.markerStart, markerStartRef);
  const endMatches = markerEquals(edge.markerEnd, markerEndRef);

  if (dataMatches && styleMatches && startMatches && endMatches) {
    return edge;
  }

  return {
    ...edge,
    data: nextData,
    style: nextStyle,
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

const EDGE_ALIGNMENT_TOLERANCE = 6;
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 160;

const getNodeCenter = (node: FlowNode | undefined): { x: number; y: number } | null => {
  if (!node) return null;
  const baseX = node.positionAbsolute?.x ?? node.position.x;
  const baseY = node.positionAbsolute?.y ?? node.position.y;
  const width = node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.height ?? DEFAULT_NODE_HEIGHT;
  return { x: baseX + width / 2, y: baseY + height / 2 };
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
      type: alignsX ? "straight" : "step",
    };
  }

  const sourceLeftOfTarget = deltaX <= 0;
  const alignsY = absDeltaY <= EDGE_ALIGNMENT_TOLERANCE;
  return {
    source: sourceLeftOfTarget ? "l" : "r",
    target: sourceLeftOfTarget ? "r" : "l",
    type: alignsY ? "straight" : "step",
  };
};

// React Flow uses "step" as the built-in orthogonal connection/edge type.
// Use the enum instead of a string cast to avoid runtime/type issues.
const ORTHOGONAL_CONNECTION_LINE = ConnectionLineType.Step;

type EmployeeOption = {
  id: string;
  name: string;
  title: string;
  officeId: string | null;
  employeeTypeName: string;
  employeeTypeColor?: string;
  imageUrl: string;
};

type CanvasActions = {
  duplicateNode: (id: string) => void;
  addChildUnit: (id: string) => void;
  addChildPerson: (id: string) => void;
};

const CanvasActionsContext = createContext<CanvasActions | null>(null);
const CanvasSettingsContext = createContext<{ showPhotos: boolean }>({ showPhotos: false });

const useCanvasActions = () => {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) {
    throw new Error("Canvas actions context not available");
  }
  return ctx;
};

const useCanvasSettings = () => useContext(CanvasSettingsContext);

const OrgChartTool = ({ departmentId }: OrgChartToolProps) => (
  <ReactFlowProvider>
    <OrgChartToolInner departmentId={departmentId} />
  </ReactFlowProvider>
);

export default OrgChartTool;

const OrgChartToolInner = ({ departmentId }: OrgChartToolProps) => {
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<OrgChartDocument>({ nodes: [], edges: [], edgeType: "orth" });
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(docRef.current));
  const saveTimer = useRef<number | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeData>([]);
  const [edgeType, setEdgeType] = useState<"orth" | "smoothstep">("orth");
  const [allowCrossOfficeEdges, setAllowCrossOfficeEdges] = useState(true);
  const [versions, setVersions] = useState<OrgChartVersionSummary[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [focusOfficeId, setFocusOfficeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [officeSearch, setOfficeSearch] = useState("");
  const [draftSnapshot, setDraftSnapshot] = useState<string>(JSON.stringify(docRef.current));
  const [showPhotos, setShowPhotos] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const versionStorageKey = useMemo(
    () => `org-chart:current-version:${departmentId}`,
    [departmentId]
  );
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

  const defaultEdgeOptions = useMemo(() => ({ type: "step" as Edge["type"] }), []);
  const clipboardAvailable = useMemo(() => clipboardVersion > 0 && clipboardRef.current !== null, [clipboardVersion]);
  const reactFlowInstance = useReactFlow<FlowNodeData, FlowEdgeData>();
  const { fitView, project, getNode, setViewport } = reactFlowInstance;

  const MIN_FOCUS_ZOOM = 0.25;
  const MAX_FOCUS_ZOOM = 1.5;

  const requestFocus = useCallback(() => {
    setFocusTrigger((prev) => prev + 1);
  }, []);

  const offices = useMemo(() => nodes.filter((node: FlowNode) => node.type === "office"), [nodes]);
  const filteredOffices = useMemo(() => {
    const query = officeSearch.trim().toLowerCase();
    if (!query) return offices;
    return offices.filter((office) => office.data.name.toLowerCase().includes(query));
  }, [officeSearch, offices]);

  const isHand = tool === "hand";
  const customMarkerDefinitions = useMemo(() => getCustomMarkerDefinitions(edges), [edges]);

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
      if (event.key.toLowerCase() === "h") {
        if (isEditable(activeElement)) {
          return;
        }
        event.preventDefault();
        setTool("hand");
        return;
      }

      if (event.key === "Escape") {
        setTool("select");
      }
    };

    window.addEventListener("keydown", handleToolHotkeys);
    return () => {
      window.removeEventListener("keydown", handleToolHotkeys);
    };
  }, [setTool]);

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
  const dragRecenterTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
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
      if (dragRecenterTimeoutRef.current) {
        window.clearTimeout(dragRecenterTimeoutRef.current);
      }
      pendingHistoryEntryRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!offices.length) return;
    const firstOffice = offices[0];
    const firstOfficeId = firstOffice.data.officeId ?? firstOffice.id;

    setFocusOfficeId((current) => {
      if (
        current &&
        offices.some((office) => {
          const officeId = office.data.officeId ?? office.id;
          return officeId === current || office.id === current;
        })
      ) {
        return current;
      }
      return firstOfficeId ?? current;
    });
    requestFocus();
  }, [offices, requestFocus]);

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
      }

      if (targetOfficeId === clipboard.sourceOfficeId && !options?.centerOnViewport) {
        offset = { x: 120, y: 120 };
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
  }, [copySelection, pasteIntoOffice, redo, undo]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeIds.length) return null;
    return nodes.find((node: FlowNode) => node.id === selectedNodeIds[0]) ?? null;
  }, [nodes, selectedNodeIds]);

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
    (officeId: string | null) => {
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
      }, 200);
    },
    [collectNodesForOffice, fitView, MAX_FOCUS_ZOOM, MIN_FOCUS_ZOOM]
  );

  const handleNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
    pendingHistoryEntryRef.current = getCurrentGraphState();
    if (dragRecenterTimeoutRef.current) {
      window.clearTimeout(dragRecenterTimeoutRef.current);
      dragRecenterTimeoutRef.current = null;
    }
  }, [getCurrentGraphState]);

  const handleNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
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
    if (dragRecenterTimeoutRef.current) {
      window.clearTimeout(dragRecenterTimeoutRef.current);
    }
    dragRecenterTimeoutRef.current = window.setTimeout(() => {
      focusOffice(focusOfficeId);
      dragRecenterTimeoutRef.current = null;
    }, 120);
  }, [focusOffice, focusOfficeId, pushHistoryEntry]);

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
    (flowNodes: FlowNode[], flowEdges: FlowEdge[], currentEdgeType: "orth" | "smoothstep"): OrgChartDocument => ({
      nodes: flowNodes.map((node: FlowNode) => ({
        id: node.id,
        type: node.type as OrgNodeType,
        position: node.position,
        data: {
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
        const outlineColor =
          normalizeColor(node.data.outlineColor) ??
          normalizeColor(node.data.headerColor) ??
          (node.type === "person" ? normalizeColor(node.data.employeeTypeColor) : null) ??
          normalizeColor(DEFAULT_NODE_COLORS[node.type]) ??
          NEUTRAL_OUTLINE_COLOR;
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
          width: node.width,
          height: node.height,
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
      const fallbackType =
        currentCustomType === "smoothstep"
          ? "smoothstep"
          : currentCustomType === "straight"
          ? "straight"
          : mapDocEdgeTypeToFlow(edgeType);
      const layout = resolveEdgeLayout(sourceNode, targetNode, fallbackType);

      let desiredSourceHandle =
        edge.sourceHandle ??
        getSourceHandleId(normalizeHandleId(edge.sourceHandle)) ??
        getSourceHandleId("r");
      let desiredTargetHandle =
        edge.targetHandle ??
        getTargetHandleId(normalizeHandleId(edge.targetHandle)) ??
        getTargetHandleId("l");
      let desiredType: Edge["type"] = edge.type;

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
            : layout.type === "smoothstep"
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
      setNodes(flowNodes);
      setEdges(flowEdges);
      setEdgeType(document.edgeType ?? "orth");
      const normalizedDocument = serializeDocument(flowNodes, flowEdges, document.edgeType ?? "orth");
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

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [previewRes, employeesRes, versionsRes] = await Promise.all([
        fetch(`/api/${departmentId}/org-chart/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeStaffUnit: true }),
        }),
        fetch(`/api/${departmentId}/employees/simple`),
        fetch(`/api/${departmentId}/org-chart/versions`),
      ]);

      if (!previewRes.ok) throw new Error(await previewRes.text());
      const previewData = (await previewRes.json()) as { document: OrgChartDocument };
      setDocument(previewData.document, true, true);

      if (employeesRes.ok) {
        const employees = (await employeesRes.json()) as EmployeeOption[];
        setAvailableEmployees(employees);
      }

      let versionList: OrgChartVersionSummary[] = [];
      if (versionsRes.ok) {
        versionList = (await versionsRes.json()) as OrgChartVersionSummary[];
      }
      setVersions(versionList);

      let hasLoadedVersion = false;

      const storedVersionId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(versionStorageKey)
          : null;

      if (storedVersionId) {
        const restored = await loadVersionById(storedVersionId);
        if (restored.status === "success") {
          hasLoadedVersion = true;
        } else if (restored.status === "not_found") {
          applyCurrentVersionId(null);
          toast({
            title: "Version not found",
            description: "Showing current draft.",
          });
        } else if (restored.status === "error") {
          toast({
            title: "Failed to restore version",
            description: restored.message,
            variant: "destructive",
          });
        }
      }

      if (!hasLoadedVersion && versionList.length) {
        const defaultVersion = versionList.find((item) => item.isDefault);
        if (defaultVersion) {
          const loadDefault = await loadVersionById(defaultVersion.id);
          if (loadDefault.status === "success") {
            hasLoadedVersion = true;
          } else if (loadDefault.status === "not_found") {
            applyCurrentVersionId(null);
            toast({
              title: "Default version missing",
              description: "Showing current draft.",
            });
          }
        }
      }

      if (!hasLoadedVersion) {
        applyCurrentVersionId(null);
      }
    } catch (error) {
      toast({
        title: "Failed to load org chart",
        description: error instanceof Error ? error.message : "Unable to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [applyCurrentVersionId, departmentId, loadVersionById, setDocument, toast, versionStorageKey]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    const snapshotDocument = serializeDocument(nodes, edges, edgeType);
    saveTimer.current = window.setTimeout(() => {
      docRef.current = snapshotDocument;
      setDraftSnapshot(JSON.stringify(snapshotDocument));
    }, 800);
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [edgeType, edges, nodes, serializeDocument]);

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

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const visibleNodeIds = new Set<string>();

    setNodes((nds: FlowNode[]) =>
      nds.map((node: FlowNode) => {
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

        const visible = officeMatch && searchMatch;
        if (visible) {
          visibleNodeIds.add(node.id);
        }

        return { ...node, hidden: !visible };
      })
    );

    setEdges((eds: FlowEdge[]) =>
      eds.map((edge: FlowEdge) => ({
        ...edge,
        hidden: !(visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
      }))
    );
  }, [focusOfficeId, searchTerm, setEdges, setNodes]);

  useEffect(() => {
    if (!nodesRef.current.length) return;
    focusOffice(focusOfficeId);
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
          : resolvedType === "smoothstep"
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
        setEdges((eds: FlowEdge[]) => addEdge(newEdge, eds));
      });
    },
    [allowCrossOfficeEdges, edgeType, edges, getNode, runWithHistory, setEdges, toast]
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
              name: `${node.data.name} copy`,
              employeeId: undefined,
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
    },
    [focusOfficeId, offices, project, runWithHistory, selectedNode, setNodes, toast]
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
        applyCurrentVersionId(null);
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
      applyCurrentVersionId(null);
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Unable to save version",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [applyCurrentVersionId, departmentId, edgeType, edges, nodes, serializeDocument, toast]);

  const handleSetDefault = useCallback(async () => {
    if (!currentVersionId) return;
    try {
      const response = await fetch(
        `/api/${departmentId}/org-chart/versions/${currentVersionId}/default`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error(await response.text());
      const updated = (await response.json()) as OrgChartVersion;
      setVersions((prev) => prev.map((item) => ({ ...item, isDefault: item.id === updated.id })));
      toast({ title: "Default version updated", description: updated.label });
    } catch (error) {
      toast({
        title: "Failed to set default",
        description: error instanceof Error ? error.message : "Unable to set default version",
        variant: "destructive",
      });
    }
  }, [currentVersionId, departmentId, toast]);

  const handleVersionChange = useCallback(
    async (value: string) => {
      if (value === "__draft__") {
        applyCurrentVersionId(null);
        return;
      }

      const result = await loadVersionById(value);
      if (result.status === "success") {
        toast({ title: "Version loaded", description: result.record.label });
        return;
      }

      if (result.status === "not_found") {
        applyCurrentVersionId(null);
        toast({
          title: "Version not found",
          description: "The requested version is unavailable.",
          variant: "destructive",
        });
        return;
      }

      if (result.status === "error") {
        toast({
          title: "Failed to load version",
          description: result.message ?? "Unable to load version",
          variant: "destructive",
        });
      }
    },
    [applyCurrentVersionId, loadVersionById, toast]
  );

  const handleExport = useCallback(
    async (format: "png" | "pdf") => {
      if (!reactFlowWrapper.current) return;
      try {
        setIsExporting(true);
        const dataUrl = await htmlToImage.toPng(reactFlowWrapper.current, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });

        if (format === "png") {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = `org-chart-${new Date().toISOString()}.png`;
          link.click();
          toast({ title: "PNG exported" });
          return;
        }

        const pdf = await PDFDocument.create();
        const page = pdf.addPage([1122, 793]);
        const image = await pdf.embedPng(dataUrl);
        const { width, height } = image.scaleToFit(page.getWidth() - 40, page.getHeight() - 40);
        page.drawImage(image, {
          x: (page.getWidth() - width) / 2,
          y: (page.getHeight() - height) / 2,
          width,
          height,
        });
        const bytes = await pdf.save();
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `org-chart-${new Date().toISOString()}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
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
    [toast]
  );

  const updateSelectedNode = useCallback(
    (updates: Partial<OrgNodeData>) => {
      if (!selectedNode) return;
      const preparedUpdates: Partial<OrgNodeData> = { ...updates };
      if (updates.outlineColor) {
        const normalized =
          normalizeColor(updates.outlineColor) ??
          normalizeColor(selectedNode.data.outlineColor) ??
          NEUTRAL_OUTLINE_COLOR;
        preparedUpdates.outlineColor = normalized;
        preparedUpdates.headerColor = normalized;
      }
      if (updates.employeeTypeColor) {
        preparedUpdates.employeeTypeColor = normalizeColor(updates.employeeTypeColor) ?? undefined;
      }
      const hasChanges = Object.entries(preparedUpdates).some(([key, value]) => {
        const current = (selectedNode.data as Record<string, unknown>)[key];
        return current !== value;
      });
      if (!hasChanges) {
        return;
      }
      runWithHistory(() => {
        setNodes((nds: FlowNode[]) =>
          nds.map((node: FlowNode) =>
            node.id === selectedNode.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    ...preparedUpdates,
                  },
                }
              : node
          )
        );
      });
    },
    [runWithHistory, selectedNode, setNodes]
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
  }, [runWithHistory, selectedNode, setNodes]);

  const sendToBack = useCallback(() => {
    if (!selectedNode) return;
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
  }, [runWithHistory, selectedNode, setNodes]);

  const actionsContextValue = useMemo(
    () => ({ duplicateNode, addChildUnit, addChildPerson }),
    [addChildPerson, addChildUnit, duplicateNode]
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-140px)] items-center justify-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">Preparing org chart...</p>
      </div>
    );
  }

  return (
    <CanvasSettingsContext.Provider value={{ showPhotos }}>
      <CanvasActionsContext.Provider value={actionsContextValue}>
        <div
          className="grid min-h-0 gap-4 lg:grid-cols-[280px,1fr,320px]"
          style={{ height: "calc(100vh - 140px)" }}
        >
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Versions</p>
                  {unsavedChanges ? (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Unsaved changes
                    </Badge>
                  ) : null}
                </div>
                <GitBranch className="h-5 w-5 text-muted-foreground" />
              </div>
              <Select value={currentVersionId ?? "__draft__"} onValueChange={handleVersionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Current draft" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__draft__">Current draft</SelectItem>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label}
                      {version.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-2">
                <Button onClick={loadInitialData} variant="secondary" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" /> Build from DB
                </Button>
                <Button onClick={handleSaveVersion} size="sm" disabled={isSaving}>
                  <Plus className="mr-2 h-4 w-4" /> Save version
                </Button>
                <Button
                  onClick={handleSetDefault}
                  variant="outline"
                  size="sm"
                  disabled={!currentVersionId}
                  className="flex items-center gap-2"
                >
                  <BadgeCheck className="h-4 w-4" /> Set default
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Offices</Label>
                <div className="relative">
                  <Input
                    value={officeSearch}
                    onChange={(event) => setOfficeSearch(event.target.value)}
                    placeholder="Search offices"
                    className="h-8 pr-8"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const first = filteredOffices[0];
                        if (first) {
                          setFocusOfficeId(first.data.officeId ?? first.id);
                        }
                      }
                    }}
                  />
                  {officeSearch ? (
                    <button
                      type="button"
                      onClick={() => setOfficeSearch("")}
                      aria-label="Clear office search"
                      className="absolute right-2 top-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <ScrollArea className="mt-2 h-64 pr-2">
                  <div className="space-y-1 pr-1">
                    <Button
                      variant={focusOfficeId ? "ghost" : "secondary"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setFocusOfficeId(null)}
                    >
                      Whole org
                    </Button>
                    {filteredOffices.length ? filteredOffices.map((office: FlowNode) => {
                      const officeIdentifier = office.data.officeId ?? office.id;
                      const isActive = focusOfficeId === officeIdentifier || focusOfficeId === office.id;
                      return (
                        <div key={office.id} className="flex items-center gap-2">
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            size="sm"
                            className="flex-1 justify-start"
                            onClick={() => setFocusOfficeId(officeIdentifier)}
                          >
                            {office.data.name}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-2"
                            onClick={() => pasteIntoOffice({ targetOfficeId: officeIdentifier, centerOnViewport: true })}
                            disabled={!clipboardAvailable}
                            title="Paste into this office"
                          >
                            <ClipboardPaste className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    }) : (
                      <p className="px-2 py-4 text-sm text-muted-foreground">No matches</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-search" className="text-sm font-semibold">
                  Search
                </Label>
                <div className="relative">
                  <Input
                    id="org-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search nodes"
                    className="pl-9"
                  />
                  <ListFilter className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold">New node</Label>
                <div className="grid gap-2">
                  <Button size="sm" variant="outline" onClick={() => addStandaloneNode("office")}>Add office</Button>
                  <Button size="sm" variant="outline" onClick={() => addStandaloneNode("unit")}>Add unit</Button>
                  <Button size="sm" variant="outline" onClick={() => addStandaloneNode("person")}>Add person</Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Allow cross-office edges</Label>
                  <p className="text-xs text-muted-foreground">Permit connectors between offices.</p>
                </div>
                <Switch
                  checked={allowCrossOfficeEdges}
                  onCheckedChange={(state) => setAllowCrossOfficeEdges(Boolean(state))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Show photos</Label>
                  <p className="text-xs text-muted-foreground">Display employee portraits when available.</p>
                </div>
                <Switch
                  checked={showPhotos}
                  onCheckedChange={(state) => setShowPhotos(Boolean(state))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Label className="text-sm font-semibold">Export</Label>
              <Button onClick={() => void handleExport("png")} size="sm" disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" /> PNG
              </Button>
              <Button onClick={() => void handleExport("pdf")} size="sm" variant="outline" disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
            </CardContent>
          </Card>
        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Move className="h-4 w-4" /> Drag, pan, and connect nodes freely
            </div>
            <div className="flex items-center gap-2">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Copy"
                    aria-label="Copy"
                    disabled={loading}
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => copySelection(false)}>
                    Copy structure only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copySelection(true)}>
                    Copy with people
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="icon"
                onClick={() => pasteIntoOffice()}
                disabled={!clipboardAvailable}
                title="Paste (Ctrl/Cmd+V)"
                aria-label="Paste"
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              <Button
                variant={tool === "hand" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool((current) => (current === "hand" ? "select" : "hand"))}
                title="Hand (H) – pan the canvas"
                aria-pressed={tool === "hand"}
              >
                <Hand className="mr-2 h-4 w-4" /> Hand
              </Button>
              <Select value={edgeType} onValueChange={(value: "orth" | "smoothstep") => setEdgeType(value)}>
                <SelectTrigger className="h-9 w-36">
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
              <Button variant="outline" size="icon" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 400 })}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => focusOffice(focusOfficeId)}>
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div
              ref={reactFlowWrapper}
              className={cn(
                "relative h-full w-full",
                isHand ? "cursor-grab active:cursor-grabbing" : "cursor-default"
              )}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onSelectionChange={handleSelectionChange}
                nodeTypes={nodeTypes}
                snapToGrid
                snapGrid={[10, 10]}
                selectionOnDrag={!isHand}
                multiSelectionKeyCode="Shift"
                connectionMode={"loose" as ConnectionMode}
                defaultEdgeOptions={defaultEdgeOptions}
                panOnDrag={isHand}
                nodesDraggable={!isHand}
                nodesConnectable={!isHand}
                elementsSelectable={!isHand}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
                onMoveStart={handleMoveStart}
                onMoveEnd={handleMoveEnd}
                minZoom={0.2}
                maxZoom={3}
                deleteKeyCode={["Delete", "Backspace"]}
                connectionLineType={ORTHOGONAL_CONNECTION_LINE}
                style={{ width: "100%", height: "100%" }}
              >
                <MarkerDefinitionsLayer definitions={customMarkerDefinitions} />
                <Background gap={10} color="rgba(15,23,42,0.08)" size={1} />
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
                />
                <Controls showInteractive={false} position="bottom-right" />
              </ReactFlow>
              {isHand ? (
                <div className="pointer-events-none absolute right-3 top-3 z-50 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white shadow">
                  Hand tool active — press ESC to exit
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Properties</h3>
                {selectedNode?.type === "person" ? <User className="h-4 w-4" /> : selectedNode?.type === "unit" ? <Users className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              </div>
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="prop-label">Header label</Label>
                    <Input
                      id="prop-label"
                      value={selectedNode.data.label ?? ""}
                      onChange={(event) => updateSelectedNode({ label: event.target.value || undefined })}
                    />
                  </div>
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
                    onValueChange={(value: "orth" | "smoothstep") =>
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

          <Card>
            <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">Summary</p>
              <p>
                <span className="font-semibold text-foreground">{offices.length}</span> offices
              </p>
              <p>
                <span className="font-semibold text-foreground">{nodes.filter((node: FlowNode) => node.type === "unit").length}</span> units
              </p>
              <p>
                <span className="font-semibold text-foreground">{nodes.filter((node: FlowNode) => node.type === "person").length}</span> people
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
      </CanvasActionsContext.Provider>
    </CanvasSettingsContext.Provider>
  );
};

const nodeTypes = {
  office: (props: NodeProps<FlowNodeData>) => <FlowNodeCard {...props} icon={<Building2 className="h-4 w-4" />} />,
  unit: (props: NodeProps<FlowNodeData>) => <FlowNodeCard {...props} icon={<Users className="h-4 w-4" />} />,
  person: (props: NodeProps<FlowNodeData>) => <FlowNodeCard {...props} icon={<User className="h-4 w-4" />} />, 
};

type FlowNodeCardProps = NodeProps<FlowNodeData> & { icon: ReactNode };

function FlowNodeCard({ id, data, type, selected, icon }: FlowNodeCardProps) {
  const actions = useCanvasActions();
  const handles = getHandlesForType(type as OrgNodeType);
  const { showPhotos } = useCanvasSettings();
  const outlineColor = normalizeColor(data.outlineColor) ?? NEUTRAL_OUTLINE_COLOR;
  const borderWidth = data.isHead ? 3 : 2;
  const glowSize = data.isHead ? 6 : 3;
  const cardStyles: CSSProperties = {
    borderColor: outlineColor,
    borderWidth,
    boxShadow: `0 0 0 ${glowSize}px ${colorWithAlpha(outlineColor, data.isHead ? 0.25 : 0.15)}`,
  };
  const headerLabel =
    data.label ?? (type === "person" ? data.title ?? data.name : data.name);

  const renderAvatar = () => {
    if (showPhotos && data.imageUrl) {
      return (
        <img
          src={data.imageUrl}
          alt={data.name}
          className="h-14 w-14 rounded-full border-2 object-cover shadow-md"
          style={{ borderColor: colorWithAlpha(outlineColor, 0.35) }}
        />
      );
    }
    return (
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-sm text-foreground"
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
        "group relative min-w-[220px] max-w-xs overflow-visible rounded-lg border bg-card transition-shadow",
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
          className="h-3 w-3"
          style={handle.style}
        />
      ))}

      <div className="rounded-t-lg border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {headerLabel}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        {renderAvatar()}
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{data.name}</p>
              {data.title ? <p className="text-xs text-muted-foreground">{data.title}</p> : null}
            </div>
            {data.isHead ? (
              <Badge variant="outline" className="border-none bg-transparent px-2 py-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                Head
              </Badge>
            ) : null}
          </div>
          {data.employeeTypeName ? <p className="text-xs text-muted-foreground">{data.employeeTypeName}</p> : null}
        </div>
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
    style: { top: 0, left: "50%", transform: "translateX(-50%)" },
  },
  {
    id: "r",
    position: Position.Right,
    style: { top: "50%", right: 0, transform: "translate(50%, -50%)" },
  },
  {
    id: "b",
    position: Position.Bottom,
    style: { bottom: 0, left: "50%", transform: "translateX(-50%)" },
  },
  {
    id: "l",
    position: Position.Left,
    style: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
  },
];

function getHandlesForType(type: OrgNodeType): HandleConfig[] {
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
  if (type === "smoothstep") return "smoothstep";
  if (type === "straight") return "straight";
  // Treat any orthogonal/step-like type as "orth" in the document
  if (type === "step" || type === "orthogonal" || type === "orth") return "orth";
  return "orth";
}
