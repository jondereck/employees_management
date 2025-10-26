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
import type {
  OrgChartDocument,
  OrgChartEdge,
  OrgChartNode,
  OrgChartVersion,
  OrgNodeData,
  OrgNodeType,
} from "@/types/orgChart";
import {
  BadgeCheck,
  Building2,
  Copy,
  Download,
  GitBranch,
  Layers,
  ListFilter,
  Move,
  Plus,
  RefreshCw,
  Trash2,
  User,
  Users,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as htmlToImage from "html-to-image";
import { PDFDocument } from "pdf-lib";

const DEFAULT_NODE_COLORS: Record<OrgNodeType, string> = {
  office: "#1E88E5",
  unit: "#FB8C00",
  person: "#3949AB",
};

const DEFAULT_EDGE_COLOR = "#0F172A";

const EDGE_TYPE_OPTIONS: Array<{ label: string; value: "orth" | "smoothstep" }> = [
  { label: "Orthogonal", value: "orth" },
  { label: "Smooth", value: "smoothstep" },
];

type OrgChartToolProps = {
  departmentId: string;
};

type FlowNodeData = OrgNodeData;
type FlowNode = Node<FlowNodeData>;
type FlowEdge = Edge<{ color?: string; customType?: "orth" | "smoothstep" }>;

type EmployeeOption = {
  id: string;
  name: string;
  title: string;
  officeId: string | null;
  employeeTypeName: string;
};

type VersionRecord = OrgChartVersion & { isDefault?: boolean };

type CanvasActions = {
  duplicateNode: (id: string) => void;
  addChildUnit: (id: string) => void;
  addChildPerson: (id: string) => void;
};

const CanvasActionsContext = createContext<CanvasActions | null>(null);

const useCanvasActions = () => {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) {
    throw new Error("Canvas actions context not available");
  }
  return ctx;
};

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
  const [edges, setEdges, onEdgesChange] = useEdgesState<{ color?: string; customType?: "orth" | "smoothstep" }>([]);
  const [edgeType, setEdgeType] = useState<"orth" | "smoothstep">("orth");
  const [allowCrossOfficeEdges, setAllowCrossOfficeEdges] = useState(true);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [focusOfficeId, setFocusOfficeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draftSnapshot, setDraftSnapshot] = useState<string>(JSON.stringify(docRef.current));

  const { fitView, project, getNode, setViewport } = useReactFlow<
    FlowNodeData,
    { color?: string; customType?: "orth" | "smoothstep" }
  >();

  const offices = useMemo(() => nodes.filter((node: FlowNode) => node.type === "office"), [nodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeIds.length) return null;
    return nodes.find((node: FlowNode) => node.id === selectedNodeIds[0]) ?? null;
  }, [nodes, selectedNodeIds]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeIds.length) return null;
    return edges.find((edge: FlowEdge) => edge.id === selectedEdgeIds[0]) ?? null;
  }, [edges, selectedEdgeIds]);

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
          isHead: node.data.isHead,
          officeId: node.data.officeId,
          employeeId: node.data.employeeId,
          label: node.data.label,
          headerColor: node.data.headerColor,
          notes: node.data.notes,
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
      })),
      edgeType: currentEdgeType,
    }),
    []
  );

  const applyNodeDefaults = useCallback(
    (docNodes: OrgChartNode[]): FlowNode[] =>
      docNodes.map((node: OrgChartNode) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          name: node.data.name,
          title: node.data.title,
          employeeTypeName: node.data.employeeTypeName,
          isHead: node.data.isHead,
          officeId: node.data.officeId,
          employeeId: node.data.employeeId,
          label: node.data.label ?? (node.type === "person" ? node.data.title ?? node.data.name : node.data.name),
          headerColor: node.data.headerColor ?? DEFAULT_NODE_COLORS[node.type],
          notes: node.data.notes,
        },
        width: node.width,
        height: node.height,
      })),
    []
  );

  const applyEdgeDefaults = useCallback(
    (docEdges: OrgChartEdge[]): FlowEdge[] =>
      docEdges.map((edge: OrgChartEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: mapDocEdgeTypeToFlow(edge.type),
        label: edge.label,
        data: { color: edge.color ?? DEFAULT_EDGE_COLOR, customType: edge.type },
        style: { stroke: edge.color ?? DEFAULT_EDGE_COLOR, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edge.color ?? DEFAULT_EDGE_COLOR },
      })),
    []
  );

  const setDocument = useCallback(
    (document: OrgChartDocument, markSaved = true) => {
      const flowNodes = applyNodeDefaults(document.nodes);
      const flowEdges = applyEdgeDefaults(document.edges);
      setNodes(flowNodes);
      setEdges(flowEdges);
      setEdgeType(document.edgeType ?? "orth");
      docRef.current = document;
      const snapshot = JSON.stringify(document);
      setDraftSnapshot(snapshot);
      if (markSaved) {
        lastSavedSnapshotRef.current = snapshot;
      }
      requestAnimationFrame(() => {
        try {
          fitView({ padding: 0.3, duration: 400 });
        } catch (error) {
          // ignore
        }
      });
    },
    [applyEdgeDefaults, applyNodeDefaults, fitView, setEdges, setNodes]
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
      setDocument(previewData.document, true);

      if (employeesRes.ok) {
        const employees = (await employeesRes.json()) as EmployeeOption[];
        setAvailableEmployees(employees);
      }

      if (versionsRes.ok) {
        const versionList = (await versionsRes.json()) as VersionRecord[];
        setVersions(versionList);
        const defaultVersion = versionList.find((item) => item.isDefault);
        if (defaultVersion) {
          setSelectedVersionId(defaultVersion.id);
        }
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
  }, [departmentId, setDocument, toast]);

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
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!focusOfficeId && !normalizedSearch) {
    setNodes((nds: FlowNode[]) => nds.map((node: FlowNode) => ({ ...node, hidden: false })));
    setEdges((eds: FlowEdge[]) => eds.map((edge: FlowEdge) => ({ ...edge, hidden: false })));
      return;
    }

    const visibleNodeIds = new Set<string>();

    setNodes((nds: FlowNode[]) =>
      nds.map((node: FlowNode) => {
        const officeMatch =
          !focusOfficeId ||
          (node.type === "office"
            ? (node.data.officeId ?? node.id) === focusOfficeId
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
      onNodesChange(changes);
    },
    [edges, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
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

      if (!allowCrossOfficeEdges) {
        const sourceNode = getNode(connection.source);
        const targetNode = getNode(connection.target);
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

      const newEdge: FlowEdge = {
        id: `edge-${crypto.randomUUID()}`,
        source: connection.source,
        target: connection.target,
        type: mapDocEdgeTypeToFlow(edgeType),
        label: "",
        data: { color: DEFAULT_EDGE_COLOR },
        style: { stroke: DEFAULT_EDGE_COLOR, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: DEFAULT_EDGE_COLOR },
      };

      setEdges((eds: FlowEdge[]) => addEdge(newEdge, eds));
    },
    [allowCrossOfficeEdges, edgeType, edges, getNode, setEdges, toast]
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
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
    },
    [setNodes]
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
          headerColor: DEFAULT_NODE_COLORS[type],
          officeId: type === "office" ? undefined : parentOfficeId,
        },
      };

      setNodes((nds: FlowNode[]) => [...nds, newNode]);
      setEdges((eds: FlowEdge[]) => [
        ...eds,
        {
          id: `edge-${crypto.randomUUID()}`,
          source: parent.id,
          target: newId,
          type: mapDocEdgeTypeToFlow(edgeType),
          label: "",
          data: { color: DEFAULT_EDGE_COLOR },
          style: { stroke: DEFAULT_EDGE_COLOR, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: DEFAULT_EDGE_COLOR },
        },
      ]);
    },
    [edgeType, getNode, getOfficeIdForNode, setEdges, setNodes]
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

      const newNode: FlowNode = {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        position: { x: projected.x, y: projected.y },
        data: {
          name: type === "person" ? "New Person" : type === "unit" ? "New Unit" : "New Office",
          label: type === "person" ? "New Role" : type === "unit" ? "Unit" : "Office",
          title: type === "person" ? "" : undefined,
          headerColor: DEFAULT_NODE_COLORS[type],
          officeId: type === "office" ? undefined : officeId,
        },
      };

      setNodes((nds: FlowNode[]) => [...nds, newNode]);
    },
    [focusOfficeId, offices, project, selectedNode, setNodes, toast]
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
      if (!response.ok) throw new Error(await response.text());
      const record: VersionRecord = await response.json();
      setVersions((prev) => [record, ...prev]);
      setSelectedVersionId(record.id);
      lastSavedSnapshotRef.current = snapshot;
      toast({ title: "Version saved", description: label });
    } catch (error) {
      toast({
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Unable to save version",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [departmentId, edgeType, edges, nodes, serializeDocument, toast]);

  const handleSetDefault = useCallback(async () => {
    if (!selectedVersionId) return;
    try {
      const response = await fetch(
        `/api/${departmentId}/org-chart/versions/${selectedVersionId}/default`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error(await response.text());
      const updated: VersionRecord = await response.json();
      setVersions((prev) => prev.map((item) => ({ ...item, isDefault: item.id === updated.id })));
      toast({ title: "Default version updated", description: updated.label });
    } catch (error) {
      toast({
        title: "Failed to set default",
        description: error instanceof Error ? error.message : "Unable to set default version",
        variant: "destructive",
      });
    }
  }, [departmentId, selectedVersionId, toast]);

  const handleVersionChange = useCallback(
    async (value: string) => {
      if (value === "__draft__") {
        setSelectedVersionId(null);
        return;
      }

      try {
        const response = await fetch(`/api/${departmentId}/org-chart/versions/${value}`);
        if (!response.ok) throw new Error(await response.text());
        const record: VersionRecord = await response.json();
        setDocument(record.data, true);
        setSelectedVersionId(record.id);
        toast({ title: "Version loaded", description: record.label });
      } catch (error) {
        toast({
          title: "Failed to load version",
          description: error instanceof Error ? error.message : "Unable to load version",
          variant: "destructive",
        });
      }
    },
    [departmentId, setDocument, toast]
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
      setNodes((nds: FlowNode[]) =>
        nds.map((node: FlowNode) =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates,
                },
              }
            : node
        )
      );
    },
    [selectedNode, setNodes]
  );

  const updateSelectedEdge = useCallback(
    (updates: Partial<FlowEdge>) => {
      if (!selectedEdge) return;
      setEdges((eds: FlowEdge[]) =>
        eds.map((edge: FlowEdge) =>
          edge.id === selectedEdge.id
            ? {
                ...edge,
                ...updates,
                data: {
                  ...edge.data,
                  ...(updates.data ?? {}),
                },
                style: updates.style ?? edge.style,
                markerEnd: updates.markerEnd ?? edge.markerEnd,
              }
            : edge
        )
      );
    },
    [selectedEdge, setEdges]
  );

  const removeSelectedNode = useCallback(() => {
    if (!selectedNode) return;
      const outgoing = edges.filter((edge: FlowEdge) => edge.source === selectedNode.id);
    if (outgoing.length && !window.confirm("Remove node and its connections?")) {
      return;
    }
    setNodes((nds: FlowNode[]) => nds.filter((node) => node.id !== selectedNode.id));
    setEdges((eds: FlowEdge[]) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNodeIds([]);
  }, [edges, selectedNode, setEdges, setNodes]);

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((eds: FlowEdge[]) => eds.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedEdgeIds([]);
  }, [selectedEdge, setEdges]);

  const bringToFront = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds: FlowNode[]) => {
      const index = nds.findIndex((node) => node.id === selectedNode.id);
      if (index === -1) return nds;
      const clone = [...nds];
      const [node] = clone.splice(index, 1);
      clone.push(node);
      return clone;
    });
  }, [selectedNode, setNodes]);

  const sendToBack = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds: FlowNode[]) => {
      const index = nds.findIndex((node) => node.id === selectedNode.id);
      if (index === -1) return nds;
      const clone = [...nds];
      const [node] = clone.splice(index, 1);
      clone.unshift(node);
      return clone;
    });
  }, [selectedNode, setNodes]);

  const actionsContextValue = useMemo(
    () => ({ duplicateNode, addChildUnit, addChildPerson }),
    [addChildPerson, addChildUnit, duplicateNode]
  );

  if (loading) {
    return (
      <div className="flex h-[640px] items-center justify-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">Preparing org chart…</p>
      </div>
    );
  }

  return (
    <CanvasActionsContext.Provider value={actionsContextValue}>
      <div className="grid gap-4 lg:grid-cols-[280px,1fr,320px]">
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
              <Select value={selectedVersionId ?? "__draft__"} onValueChange={handleVersionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Current draft" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__draft__">Current draft</SelectItem>
                  {versions.map((version) => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label}
                      {version.isDefault ? " • default" : ""}
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
                  disabled={!selectedVersionId}
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
                    {offices.map((office: FlowNode) => (
                      <Button
                        key={office.id}
                        variant={focusOfficeId === (office.data.officeId ?? office.id) ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setFocusOfficeId(office.data.officeId ?? office.id)}
                      >
                        {office.data.name}
                      </Button>
                    ))}
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

        <section className="relative overflow-hidden rounded-lg border bg-background">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Move className="h-4 w-4" /> Drag, pan, and connect nodes freely
            </div>
            <div className="flex items-center gap-2">
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
              <Button variant="outline" size="icon" onClick={() => fitView({ padding: 0.3, duration: 400 })}>
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div ref={reactFlowWrapper} className="h-[640px] w-full">
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
              selectionOnDrag
              multiSelectionKeyCode="Shift"
              connectionMode={ConnectionMode.Loose}
              fitView
              minZoom={0.2}
              maxZoom={3}
              deleteKeyCode={["Delete", "Backspace"]}
              connectionLineType={edgeType === "smoothstep" ? ConnectionLineType.SmoothStep : ConnectionLineType.Step}
            >
              <Background gap={10} color="rgba(15,23,42,0.08)" size={1} />
              <MiniMap
                className="rounded-md border bg-background"
                zoomable
                pannable
                nodeStrokeWidth={3}
                nodeColor={(node: FlowNode) => node.data.headerColor ?? DEFAULT_NODE_COLORS[node.type as OrgNodeType]}
              />
              <Controls showInteractive={false} position="bottom-right" />
            </ReactFlow>
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
                    <Label htmlFor="prop-color">Header color</Label>
                    <Input
                      id="prop-color"
                      type="color"
                      value={selectedNode.data.headerColor ?? DEFAULT_NODE_COLORS[selectedNode.type as OrgNodeType]}
                      onChange={(event) => updateSelectedNode({ headerColor: event.target.value })}
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
                          data: { ...selectedEdge.data, color },
                          style: { stroke: color, strokeWidth: 2 },
                          markerEnd: { type: MarkerType.ArrowClosed, color },
                        });
                      }}
                      className="h-10 w-16 cursor-pointer p-1"
                    />
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

  return (
    <div className={cn("group relative min-w-[220px] max-w-xs rounded-lg border bg-card shadow-sm transition", selected && "ring-2 ring-primary")}
    >
      <NodeToolbar isVisible={selected} className="flex gap-2 rounded-full border bg-background px-3 py-1 text-xs shadow">
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
        />
      ))}

      <div className="overflow-hidden rounded-t-lg" style={{ backgroundColor: data.headerColor ?? DEFAULT_NODE_COLORS[type as OrgNodeType] }}>
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/90">
          {icon}
          <span>{data.label ?? data.name}</span>
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{data.name}</p>
          {data.title ? <p className="text-xs text-muted-foreground">{data.title}</p> : null}
          {type === "person" && data.employeeTypeName ? (
            <span className="mt-1 inline-flex rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {data.employeeTypeName}
            </span>
          ) : null}
        </div>
        {data.isHead ? (
          <Badge variant="outline" className="text-xs text-primary">
            Head
          </Badge>
        ) : null}
        {data.notes ? <p className="text-xs text-muted-foreground">{data.notes}</p> : null}
      </div>
    </div>
  );
}

type HandleConfig = { id: string; type: "source" | "target"; position: Position };

function getHandlesForType(type: OrgNodeType): HandleConfig[] {
  return [
    { id: "top", type: "target", position: Position.Top },
    { id: "bottom", type: "source", position: Position.Bottom },
    { id: "left", type: "source", position: Position.Left },
    { id: "right", type: "source", position: Position.Right },
  ];
}

function mapDocEdgeTypeToFlow(type?: "orth" | "smoothstep"): Edge["type"] {
  return type === "smoothstep" ? "smoothstep" : "step";
}

function mapFlowEdgeTypeToDoc(type?: string): "orth" | "smoothstep" {
  return type === "smoothstep" ? "smoothstep" : "orth";
}
