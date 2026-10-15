import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ExternalLink,
  FileCode,
  Info,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  GitBranch,
  Folder,
  FolderOpen,
  Box,
  Binary,
  Code2,
  Package,
  Compass,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  Crosshair,
  SlidersHorizontal,
  X,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import type { ArchitectureGraph, GraphNode, GraphEdge, RepoFile, SymbolItem, Repository } from '../../../types/index.ts';
import { FlowchartView } from './FlowchartView.tsx';

interface ArchitectureViewProps {
  architecture: ArchitectureGraph;
  files: RepoFile[];
  symbols?: SymbolItem[];
  currentRepo?: Repository | null;
  onSelectFile: (file: RepoFile) => void;
  onInspectAST?: () => void;
  onAskAI?: (question: string) => void;
}

export type LayoutMode = 'hierarchical' | 'grouped' | 'radial';

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  architecture,
  files,
  symbols = [],
  currentRepo,
  onSelectFile,
  onInspectAST,
  onAskAI,
}) => {
  // Navigation & Zoom State
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Adjusting & Custom Offsets
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState<{ clientX: number; clientY: number; origX: number; origY: number }>({
    clientX: 0,
    clientY: 0,
    origX: 0,
    origY: 0,
  });

  // Diagram Presentation Type: Flowchart (Clear & Structured, Default) vs Raw AST Graph
  const [diagramType, setDiagramType] = useState<'flowchart' | 'graph'>('flowchart');

  // Filters & Layout Mode
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('hierarchical');
  const [searchFilter, setSearchFilter] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');
  const [relationFilter, setRelationFilter] = useState<string>('all');

  // Interactive Tools: Trace Mode & Focus Mode
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [isTraceMode, setIsTraceMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Progressive Disclosure: Set of expanded files showing internal classes/functions
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Filter Nodes based on progressive disclosure and user filters
  const visibleNodes = useMemo(() => {
    return architecture.nodes.filter((node) => {
      // Progressive disclosure: hide class & function nodes unless parent file is expanded
      if ((node.type === 'class' || node.type === 'function') && node.parent) {
        if (!expandedFileIds.has(node.parent)) {
          return false;
        }
      }

      // Filter by node type
      if (nodeTypeFilter !== 'all') {
        if (nodeTypeFilter === 'file' && node.type !== 'file') return false;
        if (nodeTypeFilter === 'directory' && node.type !== 'directory') return false;
        if (nodeTypeFilter === 'class' && node.type !== 'class') return false;
        if (nodeTypeFilter === 'function' && node.type !== 'function') return false;
        if (nodeTypeFilter === 'external' && node.type !== 'external') return false;
      }

      // Search query
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          node.name.toLowerCase().includes(q) ||
          (node.path && node.path.toLowerCase().includes(q)) ||
          (node.language && node.language.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [architecture.nodes, nodeTypeFilter, searchFilter, expandedFileIds]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // 2. Filter Edges
  const visibleEdges = useMemo(() => {
    return architecture.edges.filter((e) => {
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) return false;
      if (relationFilter !== 'all' && e.relationship !== relationFilter) return false;
      return true;
    });
  }, [architecture.edges, visibleNodeIds, relationFilter]);

  // 3. Selection Neighborhood: Direct incoming & outgoing nodes for highlighting
  const selectionInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    const incomingEdges = architecture.edges.filter((e) => e.target === selectedNodeId);
    const outgoingEdges = architecture.edges.filter((e) => e.source === selectedNodeId);

    const directIncomingIds = new Set(incomingEdges.map((e) => e.source));
    const directOutgoingIds = new Set(outgoingEdges.map((e) => e.target));

    // For Focus Mode: include 2nd degree nodes
    const secondDegreeIds = new Set<string>();
    if (isFocusMode) {
      architecture.edges.forEach((e) => {
        if (directIncomingIds.has(e.target)) secondDegreeIds.add(e.source);
        if (directOutgoingIds.has(e.source)) secondDegreeIds.add(e.target);
      });
    }

    const connectedNodeIds = new Set([
      selectedNodeId,
      ...Array.from(directIncomingIds),
      ...Array.from(directOutgoingIds),
      ...Array.from(secondDegreeIds),
    ]);

    const activeEdgeIds = new Set(
      architecture.edges
        .filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
        .map((e) => e.id),
    );

    return {
      incomingEdges,
      outgoingEdges,
      directIncomingIds,
      directOutgoingIds,
      connectedNodeIds,
      activeEdgeIds,
    };
  }, [selectedNodeId, architecture.edges, isFocusMode]);

  // Active Selected Node Object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return architecture.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, architecture.nodes]);

  // Associated File details for the selected node
  const selectedFile = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'file') {
      return files.find((f) => f.path === selectedNode.path || f.name === selectedNode.name) || null;
    }
    if (selectedNode.path) {
      return files.find((f) => f.path === selectedNode.path) || null;
    }
    return null;
  }, [selectedNode, files]);

  // Symbols belonging to the selected file
  const fileInternalSymbols = useMemo(() => {
    if (!selectedFile) return [];
    return symbols.filter((s) => s.filePath === selectedFile.path);
  }, [selectedFile, symbols]);

  // 4. Structured Layout Calculations
  const nodePositions = useMemo(() => {
    const pos = new Map<string, NodePosition>();

    // Dimensions per node type
    const getDimensions = (type: string) => {
      switch (type) {
        case 'repository':
          return { width: 220, height: 70 };
        case 'directory':
          return { width: 180, height: 60 };
        case 'file':
          return { width: 195, height: 68 };
        case 'class':
          return { width: 165, height: 50 };
        case 'function':
          return { width: 155, height: 44 };
        case 'external':
          return { width: 165, height: 50 };
        default:
          return { width: 170, height: 54 };
      }
    };

    if (layoutMode === 'hierarchical') {
      const repoNodes = visibleNodes.filter((n) => n.type === 'repository');
      const dirNodes = visibleNodes.filter((n) => n.type === 'directory');
      const fileNodes = visibleNodes.filter((n) => n.type === 'file');
      const symbolNodes = visibleNodes.filter((n) => n.type === 'class' || n.type === 'function');
      const externalNodes = visibleNodes.filter((n) => n.type === 'external');

      // Group files under their parent directory for clean tree alignment
      const filesByDir = new Map<string, GraphNode[]>();
      const rootFiles: GraphNode[] = [];

      fileNodes.forEach((f) => {
        const dirId = f.parent && f.parent.startsWith('dir-') ? f.parent : null;
        if (dirId) {
          if (!filesByDir.has(dirId)) filesByDir.set(dirId, []);
          filesByDir.get(dirId)!.push(f);
        } else {
          rootFiles.push(f);
        }
      });

      const col0X = 40;
      const col1X = 320;
      const col2X = 640;
      const col3X = 940;
      const col4X = 1200;

      let currentY = 50;

      // Layout directories and their child files together in clean blocks
      dirNodes.forEach((dirNode) => {
        const children = filesByDir.get(dirNode.id) || [];
        const dirDim = getDimensions('directory');
        const fileDim = getDimensions('file');

        const childrenHeight = Math.max(1, children.length) * 82;
        const dirCenterY = currentY + childrenHeight / 2 - dirDim.height / 2;

        pos.set(dirNode.id, {
          x: col1X,
          y: Math.max(currentY, dirCenterY),
          ...dirDim,
        });

        children.forEach((childFile, cIdx) => {
          const fileY = currentY + cIdx * 82;
          pos.set(childFile.id, {
            x: col2X,
            y: fileY,
            ...fileDim,
          });

          // Position any expanded classes/functions directly next to their file
          const syms = symbolNodes.filter((s) => s.parent === childFile.id);
          syms.forEach((sym, sIdx) => {
            const symDim = getDimensions(sym.type);
            pos.set(sym.id, {
              x: col3X,
              y: fileY + sIdx * 56,
              ...symDim,
            });
          });
        });

        currentY += Math.max(childrenHeight, 90) + 20;
      });

      // Position root-level files (e.g. README, config)
      rootFiles.forEach((rf) => {
        const fileDim = getDimensions('file');
        pos.set(rf.id, {
          x: col2X,
          y: currentY,
          ...fileDim,
        });
        currentY += 82;
      });

      // Position Repository Root Node vertically centered
      const repoDim = getDimensions('repository');
      const totalGraphHeight = currentY - 50;
      repoNodes.forEach((node) => {
        pos.set(node.id, {
          x: col0X,
          y: Math.max(60, totalGraphHeight / 2 - repoDim.height / 2),
          ...repoDim,
        });
      });

      // Position External Packages cleanly along the right edge
      const extDim = getDimensions('external');
      const extSpacing = 58;
      externalNodes.forEach((node, i) => {
        pos.set(node.id, {
          x: col4X,
          y: 60 + i * extSpacing,
          ...extDim,
        });
      });
    } else if (layoutMode === 'grouped') {
      // Grouped by directory / subsystem clusters
      const dirGroups = new Map<string, GraphNode[]>();

      visibleNodes.forEach((node) => {
        const key = node.type === 'external' ? 'external-libs' : node.directory || 'root';
        if (!dirGroups.has(key)) dirGroups.set(key, []);
        dirGroups.get(key)!.push(node);
      });

      const groupKeys = Array.from(dirGroups.keys());
      const cols = Math.min(3, Math.max(1, groupKeys.length));

      groupKeys.forEach((key, groupIdx) => {
        const groupNodes = dirGroups.get(key)!;
        const col = groupIdx % cols;
        const row = Math.floor(groupIdx / cols);

        const groupOriginX = 50 + col * 360;
        const groupOriginY = 60 + row * 440;

        groupNodes.forEach((node, nodeIdx) => {
          const dim = getDimensions(node.type);
          pos.set(node.id, {
            x: groupOriginX + 15,
            y: groupOriginY + 50 + nodeIdx * (dim.height + 18),
            ...dim,
          });
        });
      });
    } else {
      // Radial / Orbital Layout
      const centerX = 550;
      const centerY = 400;

      const repoNodes = visibleNodes.filter((n) => n.type === 'repository');
      const dirNodes = visibleNodes.filter((n) => n.type === 'directory');
      const fileNodes = visibleNodes.filter((n) => n.type === 'file');
      const otherNodes = visibleNodes.filter((n) => n.type !== 'repository' && n.type !== 'directory' && n.type !== 'file');

      // Center: Repository
      repoNodes.forEach((node) => {
        const dim = getDimensions('repository');
        pos.set(node.id, { x: centerX - dim.width / 2, y: centerY - dim.height / 2, ...dim });
      });

      // Ring 1: Directories
      const r1 = 200;
      dirNodes.forEach((node, i) => {
        const angle = (i / Math.max(1, dirNodes.length)) * 2 * Math.PI;
        const dim = getDimensions('directory');
        pos.set(node.id, {
          x: centerX + r1 * Math.cos(angle) - dim.width / 2,
          y: centerY + r1 * Math.sin(angle) - dim.height / 2,
          ...dim,
        });
      });

      // Ring 2: Files
      const r2 = 380;
      fileNodes.forEach((node, i) => {
        const angle = (i / Math.max(1, fileNodes.length)) * 2 * Math.PI;
        const dim = getDimensions('file');
        pos.set(node.id, {
          x: centerX + r2 * Math.cos(angle) - dim.width / 2,
          y: centerY + r2 * Math.sin(angle) - dim.height / 2,
          ...dim,
        });
      });

      // Ring 3: External & Symbols
      const r3 = 540;
      otherNodes.forEach((node, i) => {
        const angle = (i / Math.max(1, otherNodes.length)) * 2 * Math.PI;
        const dim = getDimensions(node.type);
        pos.set(node.id, {
          x: centerX + r3 * Math.cos(angle) - dim.width / 2,
          y: centerY + r3 * Math.sin(angle) - dim.height / 2,
          ...dim,
        });
      });
    }

    return pos;
  }, [visibleNodes, layoutMode]);

  // Effective Node Positions including user manual drags
  const effectiveNodePositions = useMemo(() => {
    const res = new Map<string, NodePosition>();
    nodePositions.forEach((pos, id) => {
      const offset = nodeOffsets[id] || { x: 0, y: 0 };
      res.set(id, {
        ...pos,
        x: pos.x + offset.x,
        y: pos.y + offset.y,
      });
    });
    return res;
  }, [nodePositions, nodeOffsets]);

  // Mouse Wheel Zoom Handler (smooth cursor-centered zoom)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(2.5, Math.max(0.25, parseFloat((prevZoom * zoomFactor).toFixed(3))));
      const scaleRatio = nextZoom / prevZoom;
      setPan((prevPan) => ({
        x: mouseX - (mouseX - prevPan.x) * scaleRatio,
        y: mouseY - (mouseY - prevPan.y) * scaleRatio,
      }));
      return nextZoom;
    });
  };

  // Canvas Pan & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-node-card')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Individual Node Drag Handler to adjust node positions
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    const currentOffset = nodeOffsets[nodeId] || { x: 0, y: 0 };
    setNodeDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      origX: currentOffset.x,
      origY: currentOffset.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const dx = (e.clientX - nodeDragStart.clientX) / zoom;
      const dy = (e.clientY - nodeDragStart.clientY) / zoom;
      setNodeOffsets((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: nodeDragStart.origX + dx,
          y: nodeDragStart.origY + dy,
        },
      }));
    } else if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingNodeId(null);
  };

  // Progressive Disclosure: Toggle expanding symbols inside a file
  const toggleFileExpansion = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  // Center selected node in view
  const handleCenterSelected = () => {
    if (!selectedNodeId) return;
    const nodePos = effectiveNodePositions.get(selectedNodeId);
    if (!nodePos || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    setPan({
      x: containerWidth / 2 - (nodePos.x + nodePos.width / 2) * zoom,
      y: containerHeight / 2 - (nodePos.y + nodePos.height / 2) * zoom,
    });
  };

  // Reset View & Clear Manual Node Adjustments
  const handleResetLayout = () => {
    setZoom(0.85);
    setPan({ x: 80, y: 60 });
    setNodeOffsets({});
    setSelectedNodeId(null);
    setIsFocusMode(false);
    setIsTraceMode(false);
    setSearchFilter('');
    setNodeTypeFilter('all');
    setRelationFilter('all');
  };

  // Fit View to Screen
  const handleFitView = () => {
    if (visibleNodes.length === 0 || !containerRef.current) return;
    const allX = Array.from(effectiveNodePositions.values()).map((p) => p.x);
    const allY = Array.from(effectiveNodePositions.values()).map((p) => p.y);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX) + 200;
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY) + 100;

    const graphWidth = maxX - minX || 800;
    const graphHeight = maxY - minY || 600;

    const containerWidth = containerRef.current.clientWidth - 100;
    const containerHeight = containerRef.current.clientHeight - 100;

    const newZoom = Math.min(1.2, Math.max(0.4, Math.min(containerWidth / graphWidth, containerHeight / graphHeight)));
    setZoom(newZoom);
    setPan({
      x: (containerRef.current.clientWidth - graphWidth * newZoom) / 2 - minX * newZoom,
      y: (containerRef.current.clientHeight - graphHeight * newZoom) / 2 - minY * newZoom,
    });
  };

  // Edge Path Generator (Smooth orthogonal/bezier curve)
  const getEdgePath = (srcPos: NodePosition, tgtPos: NodePosition) => {
    // If layout is hierarchical or grouped: connect from right-center of source to left-center of target
    if (srcPos.x < tgtPos.x) {
      const startX = srcPos.x + srcPos.width;
      const startY = srcPos.y + srcPos.height / 2;
      const endX = tgtPos.x;
      const endY = tgtPos.y + tgtPos.height / 2;

      const deltaX = Math.max(30, (endX - startX) * 0.5);
      return `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;
    }

    // If source is to the right of target (e.g. circular, feedback edge, or vertical)
    const startX = srcPos.x + srcPos.width / 2;
    const startY = srcPos.y + srcPos.height / 2;
    const endX = tgtPos.x + tgtPos.width / 2;
    const endY = tgtPos.y + tgtPos.height / 2;

    return `M ${startX} ${startY} Q ${(startX + endX) / 2 + 40} ${(startY + endY) / 2}, ${endX} ${endY}`;
  };

  // Summary statistics from backend or calculated from actual nodes
  const stats = useMemo(() => {
    if (architecture.summary) return architecture.summary;

    const filesCount = files.length;
    const dirCount = new Set(files.map((f) => f.path.split('/')[0]).filter(Boolean)).size;
    const classesCount = symbols.filter((s) => s.type === 'class').length;
    const functionsCount = symbols.filter((s) => s.type === 'function' || s.type === 'method').length;
    const externalDepsCount = architecture.nodes.filter((n) => n.type === 'external').length;

    const entryCandidates = ['main.py', 'app.py', 'index.ts', 'server.ts', 'Application.java'];
    let mainEntryPoint: string | null = null;
    for (const cand of entryCandidates) {
      const found = files.find((f) => f.name.toLowerCase() === cand.toLowerCase());
      if (found) {
        mainEntryPoint = found.name;
        break;
      }
    }
    if (!mainEntryPoint && files.length > 0) mainEntryPoint = files[0].name;

    const sortedByDegree = [...architecture.nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const mostConnectedModule = sortedByDegree.length > 0 ? sortedByDegree[0].name : null;

    return {
      totalNodes: architecture.nodes.length,
      totalEdges: architecture.edges.length,
      filesCount,
      modulesCount: dirCount,
      classesCount,
      functionsCount,
      externalDepsCount,
      mainEntryPoint,
      mostConnectedModule,
      primaryLanguage: files[0]?.language || 'Polyglot',
      aiSummary:
        currentRepo?.architectureSummary ||
        `Grounded analysis identified ${filesCount} files across ${dirCount} modules, organized around primary entrypoint ${mainEntryPoint} with core dependencies anchored on ${mostConnectedModule}.`,
    };
  }, [architecture, files, symbols, currentRepo]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-[#070a11] text-slate-100 select-none">
      {/* 0. Master View Switcher: Flowchart (Primary & Intuitive) vs Raw AST Graph */}
      <div className="border-b border-slate-800/90 bg-[#080c15] px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 p-1 rounded-xl bg-[#0e1422] border border-slate-700/80 shadow-inner">
            <button
              onClick={() => setDiagramType('flowchart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center space-x-2 ${
                diagramType === 'flowchart'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flowchart Diagram</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                Recommended
              </span>
            </button>
            <button
              onClick={() => setDiagramType('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center space-x-2 ${
                diagramType === 'graph'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Raw AST Graph</span>
            </button>
          </div>
          <span className="text-xs text-slate-400 hidden lg:inline font-sans">
            {diagramType === 'flowchart'
              ? 'Structured workflow flowchart showing clear execution paths, decision logic, and AI explanation.'
              : 'Detailed multi-layer AST node graph showing file, module, class, and function dependencies.'}
          </span>
        </div>

        {onAskAI && (
          <button
            onClick={() =>
              onAskAI(
                `Explain the architecture structure of repository ${currentRepo?.name || ''}, highlighting how requests flow through key components.`,
              )
            }
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Ask AI About Architecture</span>
            <ArrowRight className="w-3 h-3 text-cyan-400" />
          </button>
        )}
      </div>

      {diagramType === 'flowchart' ? (
        <div className="flex-1 overflow-hidden">
          <FlowchartView
            currentRepo={currentRepo || null}
            files={files}
            symbols={symbols}
            onSelectFile={onSelectFile}
            onAskAI={onAskAI}
          />
        </div>
      ) : (
        <>
          {/* 1. Header Toolbar (Section 16: Professional Code Observability Header) */}
          <div className="border-b border-slate-800 bg-[#090d16] px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 z-20">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold tracking-tight text-white font-mono uppercase">
                  ARCHITECTURE
                </h1>
                <span className="text-slate-400 font-normal text-xs">&bull;</span>
                <span className="text-xs text-slate-300 font-medium">Dependency &amp; Code Structure</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-800/70 font-semibold">
                  {visibleNodes.length} nodes &bull; {visibleEdges.length} relationships
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Explore how files, modules, classes, functions, and dependencies connect across this repository.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Layout Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Node Search Bar */}
          <div className="relative w-44 sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search component..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-white text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Layout Mode Selector (Hierarchical, Grouped, Radial) */}
          <div className="flex items-center bg-[#0b0f17] border border-slate-700/80 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setLayoutMode('hierarchical')}
              className={`px-2.5 py-1 rounded transition ${
                layoutMode === 'hierarchical'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Hierarchical Tier Layout (Recommended)"
            >
              Hierarchical
            </button>
            <button
              onClick={() => setLayoutMode('grouped')}
              className={`px-2.5 py-1 rounded transition ${
                layoutMode === 'grouped'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grouped by Directory Modules"
            >
              Grouped
            </button>
            <button
              onClick={() => setLayoutMode('radial')}
              className={`px-2.5 py-1 rounded transition ${
                layoutMode === 'radial'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Radial Orbital Layout"
            >
              Radial
            </button>
          </div>

          {/* Node Type Filter */}
          <select
            value={nodeTypeFilter}
            onChange={(e) => setNodeTypeFilter(e.target.value)}
            className="bg-[#0b0f17] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Node Types</option>
            <option value="file">Files Only</option>
            <option value="directory">Directories / Modules</option>
            <option value="class">Classes</option>
            <option value="function">Functions</option>
            <option value="external">External Dependencies</option>
          </select>

          {/* Relationship Filter */}
          <select
            value={relationFilter}
            onChange={(e) => setRelationFilter(e.target.value)}
            className="bg-[#0b0f17] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer hidden lg:block"
          >
            <option value="all">All Relationships</option>
            <option value="imports">Imports Only</option>
            <option value="calls">Calls Only</option>
            <option value="inherits">Inherits Only</option>
            <option value="contains">Contains Only</option>
          </select>

          {/* Trace Dependency Mode Toggle */}
          <button
            onClick={() => setIsTraceMode(!isTraceMode)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition border ${
              isTraceMode
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-500/20'
                : 'bg-[#0b0f17] text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
            title="Toggle Trace Dependency Mode"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trace Dependency</span>
          </button>

          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            disabled={!selectedNodeId}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition border disabled:opacity-40 disabled:cursor-not-allowed ${
              isFocusMode
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-500/20'
                : 'bg-[#0b0f17] text-slate-400 border-slate-700/80 hover:text-slate-200'
            }`}
            title="Focus on selected node and direct connections"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Focus Mode</span>
          </button>

          {/* Zoom & Fit Actions */}
          <div className="flex items-center bg-[#0b0f17] border border-slate-700/80 rounded-lg p-0.5 space-x-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.35, z - 0.15))}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitView}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition text-xs font-mono px-1.5"
              title="Fit Graph to Viewport"
            >
              Fit
            </button>
            {selectedNodeId && (
              <button
                onClick={handleCenterSelected}
                className="p-1 hover:bg-slate-800 rounded text-cyan-400 hover:text-cyan-300 transition"
                title="Center Selected Node"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleResetLayout}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Architecture Overview & AI Summary Banner (Sections 11 & 12) */}
      <div className="border-b border-slate-800/90 bg-[#080d16] px-5 py-2.5 z-10 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs font-mono">
          {/* Key Metric Pills */}
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md">
              <span className="text-slate-500 text-[10px] uppercase">Nodes</span>
              <span className="text-cyan-300 font-bold">{stats.totalNodes}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md">
              <span className="text-slate-500 text-[10px] uppercase">Edges</span>
              <span className="text-slate-200 font-bold">{stats.totalEdges}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md">
              <span className="text-slate-500 text-[10px] uppercase">Files</span>
              <span className="text-cyan-400 font-bold">{stats.filesCount}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md">
              <span className="text-slate-500 text-[10px] uppercase">Modules</span>
              <span className="text-indigo-400 font-bold">{stats.modulesCount}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md">
              <span className="text-slate-500 text-[10px] uppercase">Classes</span>
              <span className="text-amber-400 font-bold">{stats.classesCount}</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md">
              <span className="text-slate-500 text-[10px] uppercase">External</span>
              <span className="text-emerald-400 font-bold">{stats.externalDepsCount}</span>
            </div>
            {stats.mainEntryPoint && (
              <div className="flex items-center space-x-1 text-slate-400 pl-2 border-l border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase">Entrypoint:</span>
                <span className="text-cyan-300 font-semibold">{stats.mainEntryPoint}</span>
              </div>
            )}
            {stats.mostConnectedModule && (
              <div className="flex items-center space-x-1 text-slate-400 pl-2 border-l border-slate-800 hidden sm:flex">
                <span className="text-slate-500 text-[10px] uppercase">Hub:</span>
                <span className="text-teal-300 font-semibold">{stats.mostConnectedModule}</span>
              </div>
            )}
          </div>

          {/* AI Architecture Summary Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="flex items-center space-x-1.5 text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/60 px-2.5 py-1 rounded-md text-[11px] font-mono transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Architecture Summary</span>
              {isSummaryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {onAskAI && (
              <button
                onClick={() =>
                  onAskAI(
                    `Explain the architecture structure of repository ${currentRepo?.name || ''}, detailing interactions between entrypoint ${stats.mainEntryPoint} and modules like ${stats.mostConnectedModule}.`,
                  )
                }
                className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-700 transition"
              >
                <span>Ask AI About Architecture</span>
                <ArrowRight className="w-3 h-3 text-cyan-400" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible AI Architecture Narrative */}
        {isSummaryExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/70 flex items-start space-x-2.5 text-xs font-sans text-slate-300 leading-relaxed bg-[#0b101d]/60 p-3 rounded-lg border border-cyan-950/50">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-cyan-300 font-mono text-[11px] uppercase mr-1.5">
                Grounded Architectural Analysis:
              </span>
              <span>{stats.aiSummary}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Graph Workspace + Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative flex overflow-hidden"
        onWheel={handleWheel}
      >
        {/* Interactive SVG Canvas */}
        <div
          className="flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Subtle Engineering Grid Background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          ></div>

          {/* Group Boundaries (when in 'grouped' mode) */}
          {layoutMode === 'grouped' && (
            <div
              className="absolute pointer-events-none transition-transform"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Dynamic cluster visual backgrounds */}
            </div>
          )}

          {/* SVG Canvas for Edges and Markers */}
          <svg
            ref={svgRef}
            className="w-full h-full absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <defs>
              {/* Directional Arrowheads */}
              <marker
                id="arrow-imports"
                markerWidth="8"
                markerHeight="6"
                refX="10"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
              </marker>
              <marker
                id="arrow-calls"
                markerWidth="8"
                markerHeight="6"
                refX="10"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#a855f7" />
              </marker>
              <marker
                id="arrow-inherits"
                markerWidth="8"
                markerHeight="6"
                refX="10"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
              </marker>
              <marker
                id="arrow-depends_on"
                markerWidth="8"
                markerHeight="6"
                refX="10"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#14b8a6" />
              </marker>
              <marker
                id="arrow-contains"
                markerWidth="6"
                markerHeight="4"
                refX="8"
                refY="2"
                orient="auto"
              >
                <polygon points="0 0, 6 2, 0 4" fill="#64748b" />
              </marker>
              <marker
                id="arrow-highlighted"
                markerWidth="10"
                markerHeight="7"
                refX="12"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
              </marker>
            </defs>

            {/* Render Graph Edges */}
            {visibleEdges.map((edge) => {
              const srcPos = effectiveNodePositions.get(edge.source);
              const tgtPos = effectiveNodePositions.get(edge.target);
              if (!srcPos || !tgtPos) return null;

              const isConnectedToSelected =
                selectionInfo &&
                (selectionInfo.activeEdgeIds.has(edge.id) ||
                  edge.source === selectedNodeId ||
                  edge.target === selectedNodeId);

              const isOutgoing = edge.source === selectedNodeId;
              const isIncoming = edge.target === selectedNodeId;

              // Dimming logic: if a node is selected, dim unrelated edges
              const isDimmed = selectedNodeId && !isConnectedToSelected;
              const isHovered = hoveredEdgeId === edge.id;

              // Line Style and Color based on relationship
              let strokeColor = '#38bdf8';
              let strokeDash: string | undefined = undefined;
              let strokeWidth = 1.3;

              if (edge.relationship === 'inherits') {
                strokeColor = '#f59e0b';
                strokeDash = '3 3';
                strokeWidth = 1.6;
              } else if (edge.relationship === 'calls') {
                strokeColor = '#a855f7';
                strokeDash = '5 3';
                strokeWidth = 1.5;
              } else if (edge.relationship === 'depends_on') {
                strokeColor = '#14b8a6';
                strokeDash = '4 2';
              } else if (edge.relationship === 'contains') {
                strokeColor = '#475569';
                strokeDash = '2 2';
                strokeWidth = 1.0;
              }

              if (isOutgoing) {
                strokeColor = '#06b6d4'; // Bright cyan for outgoing callees/imports
                strokeWidth = 2.4;
              } else if (isIncoming) {
                strokeColor = '#10b981'; // Emerald for incoming callers
                strokeWidth = 2.4;
              }

              const pathString = getEdgePath(srcPos, tgtPos);
              const markerType = isConnectedToSelected
                ? 'url(#arrow-highlighted)'
                : `url(#arrow-${edge.relationship || 'imports'})`;

              return (
                <g key={edge.id} className="transition-all duration-300">
                  <path
                    d={pathString}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? strokeWidth + 1.2 : strokeWidth}
                    strokeOpacity={isDimmed ? 0.12 : isConnectedToSelected ? 0.95 : 0.45}
                    strokeDasharray={strokeDash}
                    markerEnd={markerType}
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}
                    className="pointer-events-auto cursor-pointer"
                  />
                  {/* Edge label on hover or when connected node selected */}
                  {(isHovered || isConnectedToSelected) && edge.relationship !== 'contains' && (
                    <text
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fill={isOutgoing ? '#38bdf8' : isIncoming ? '#34d399' : '#94a3b8'}
                      textAnchor="middle"
                      className="pointer-events-none drop-shadow"
                    >
                      <textPath
                        href={`#edge-path-${edge.id}`}
                        startOffset="50%"
                      >
                        {edge.relationship.toUpperCase()}
                      </textPath>
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML Nodes Layer (Cards rendered at exact zoom & pan) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {visibleNodes.map((node) => {
              const pos = effectiveNodePositions.get(node.id);
              if (!pos) return null;

              const isSelected = selectedNodeId === node.id;
              const isDirectOutgoing = selectionInfo?.directOutgoingIds.has(node.id);
              const isDirectIncoming = selectionInfo?.directIncomingIds.has(node.id);
              const isConnected = selectionInfo?.connectedNodeIds.has(node.id);
              const isDimmed = selectedNodeId && !isSelected && !isConnected;

              // Node type icon & colors
              let Icon = FileCode;
              let borderClass = 'border-slate-800 hover:border-slate-700 bg-slate-900/90 text-slate-200';
              let badgeText = node.type.toUpperCase();

              if (node.type === 'repository') {
                Icon = Compass;
                borderClass = 'border-cyan-500/60 bg-[#0c182c] shadow-lg shadow-cyan-950/40 text-cyan-200';
              } else if (node.type === 'directory') {
                Icon = Folder;
                borderClass = 'border-indigo-800/60 bg-[#0f1424] text-indigo-200';
              } else if (node.type === 'class') {
                Icon = Binary;
                borderClass = 'border-amber-800/60 bg-[#16130d] text-amber-200';
              } else if (node.type === 'function') {
                Icon = Code2;
                borderClass = 'border-purple-800/60 bg-[#150f1f] text-purple-200';
              } else if (node.type === 'external') {
                Icon = Package;
                borderClass = 'border-emerald-800/60 bg-[#0b1916] text-emerald-200';
              }

              // Highlight styling
              if (isSelected) {
                borderClass = 'border-cyan-400 bg-cyan-950 ring-2 ring-cyan-400/50 shadow-xl shadow-cyan-900/40 text-white';
              } else if (isDirectOutgoing) {
                borderClass = 'border-cyan-500 bg-[#0c1d2e] ring-1 ring-cyan-400/40 text-cyan-100';
              } else if (isDirectIncoming) {
                borderClass = 'border-emerald-500 bg-[#0a1e1b] ring-1 ring-emerald-400/40 text-emerald-100';
              }

              const isFile = node.type === 'file';
              const isExpanded = expandedFileIds.has(node.id);
              const hasSymbols = (node.symbolCount || 0) > 0;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${pos.width}px`,
                    height: `${pos.height}px`,
                    opacity: isDimmed ? 0.16 : 1,
                    cursor: draggingNodeId === node.id ? 'grabbing' : 'grab',
                  }}
                  className={`interactive-node-card pointer-events-auto rounded-xl border p-2.5 transition-shadow duration-150 flex flex-col justify-between select-none active:scale-[1.01] shadow-md hover:shadow-cyan-950/60 ${borderClass}`}
                  title="Click to inspect • Drag to reposition"
                >
                  {/* Top row: Icon, Name & Type Badge */}
                  <div className="flex items-center justify-between space-x-1.5 truncate">
                    <div className="flex items-center space-x-1.5 truncate">
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-90" />
                      <span className="text-xs font-mono font-bold truncate" title={node.name}>
                        {node.name}
                      </span>
                    </div>

                    {/* Node Type or Language Badge */}
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-950/80 border border-slate-800/80 uppercase shrink-0">
                      {node.language || badgeText}
                    </span>
                  </div>

                  {/* Bottom row: Metrics, Symbols count, or Expansion */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                    {isFile ? (
                      <>
                        <span className="truncate">
                          {node.linesCount ? `${node.linesCount} lines` : 'module'}
                        </span>
                        {hasSymbols && (
                          <button
                            onClick={(e) => toggleFileExpansion(node.id, e)}
                            className="text-[9px] text-cyan-400 hover:text-cyan-200 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800/60 flex items-center space-x-0.5"
                            title="Expand / collapse symbols"
                          >
                            <span>{node.symbolCount} syms</span>
                            {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          </button>
                        )}
                      </>
                    ) : node.type === 'class' ? (
                      <>
                        <span>{node.details?.methodsCount || 0} methods</span>
                        <span className="text-amber-400 text-[9px]">Class</span>
                      </>
                    ) : node.type === 'function' ? (
                      <span className="truncate text-purple-300">
                        {node.details?.signature ? node.details.signature.slice(0, 18) + '...' : 'func'}
                      </span>
                    ) : node.type === 'external' ? (
                      <span className="text-emerald-400 text-[9px]">Third-Party</span>
                    ) : (
                      <span>{node.degree ? `${node.degree} links` : ''}</span>
                    )}

                    {/* Trace Indicator Badge if in Trace Mode */}
                    {isTraceMode && isDirectOutgoing && (
                      <span className="text-[9px] text-cyan-400 font-bold flex items-center">
                        <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> OUT
                      </span>
                    )}
                    {isTraceMode && isDirectIncoming && (
                      <span className="text-[9px] text-emerald-400 font-bold flex items-center">
                        <ArrowDownLeft className="w-2.5 h-2.5 mr-0.5" /> IN
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Collapsible Graph Legend (Section 10) */}
        <div className="absolute bottom-4 left-4 z-20">
          {isLegendOpen ? (
            <div className="bg-[#090d16]/95 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-xl backdrop-blur-md text-xs font-mono w-64">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">
                  Graph Legend
                </span>
                <button
                  onClick={() => setIsLegendOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  &times;
                </button>
              </div>

              {/* Node Types */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Node Types</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <span className="flex items-center space-x-1.5 text-cyan-300">
                    <Compass className="w-3.5 h-3.5" /> <span>Repository</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-indigo-300">
                    <Folder className="w-3.5 h-3.5" /> <span>Directory</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-slate-200">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" /> <span>File</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-amber-300">
                    <Binary className="w-3.5 h-3.5" /> <span>Class</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-purple-300">
                    <Code2 className="w-3.5 h-3.5" /> <span>Function</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-emerald-300">
                    <Package className="w-3.5 h-3.5" /> <span>External</span>
                  </span>
                </div>
              </div>

              {/* Relationships */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Relationships</p>
                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400">&mdash;&rarr; Imports</span>
                    <span className="text-[10px] text-slate-500">Solid Cyan</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400">---&rarr; Calls</span>
                    <span className="text-[10px] text-slate-500">Dashed Purple</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400">&middot;&middot;&middot;&rarr; Inherits</span>
                    <span className="text-[10px] text-slate-500">Dotted Amber</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">&middot;&middot;&middot; Contains</span>
                    <span className="text-[10px] text-slate-500">Subtle Slate</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsLegendOpen(true)}
              className="bg-[#090d16]/90 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-1.5 shadow-md backdrop-blur-md"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Legend</span>
            </button>
          )}
        </div>

        {/* Floating Controls HUD: Zoom, Fit, Reset & Adjustments */}
        <div className="absolute bottom-6 right-6 z-20 flex items-center bg-[#0a101d]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-1.5 shadow-2xl shadow-cyan-950/60 space-x-1 font-mono text-xs text-slate-200">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, parseFloat((z - 0.15).toFixed(2))))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 hover:text-cyan-300 border border-slate-700/60 transition active:scale-95 cursor-pointer"
            title="Zoom Out (or Scroll Mouse Wheel Down)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="px-2 py-1 text-center font-bold text-cyan-300 min-w-[50px] select-none text-[11px]">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, parseFloat((z + 0.15).toFixed(2))))}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 hover:text-cyan-300 border border-slate-700/60 transition active:scale-95 cursor-pointer"
            title="Zoom In (or Scroll Mouse Wheel Up)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-4 w-[1px] bg-slate-700/80 mx-1"></div>
          <button
            onClick={handleFitView}
            className="px-2.5 h-8 flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 hover:text-cyan-300 border border-slate-700/60 transition text-[11px] font-semibold active:scale-95 cursor-pointer"
            title="Fit Graph to Screen"
          >
            Fit
          </button>
          <button
            onClick={handleResetLayout}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/90 hover:bg-slate-800 hover:text-cyan-300 border border-slate-700/60 transition active:scale-95 cursor-pointer"
            title="Reset Zoom, Pan & Repositioned Nodes"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Instructions Overlay */}
        <div className="absolute bottom-6 left-28 z-10 hidden md:flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-mono text-slate-400 select-none pointer-events-none">
          <span className="text-cyan-400 font-semibold">Controls:</span>
          <span>Scroll to Zoom</span>
          <span>•</span>
          <span>Drag Background to Pan</span>
          <span>•</span>
          <span>Drag any Node to Adjust</span>
        </div>

        {/* 5. Right-Side Node Details Drawer (Section 7) */}
        {selectedNode && (
          <aside className="w-80 md:w-96 border-l border-slate-800 bg-[#090d16]/98 backdrop-blur-xl flex flex-col justify-between shrink-0 z-30 shadow-2xl overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/70">
                    {selectedNode.type}
                  </span>
                  <h2 className="text-base font-bold text-white font-mono break-all pt-1">
                    {selectedNode.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-sm font-mono"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Metadata attributes */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#0b0f17] border border-slate-800/80 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Language</span>
                  <span className="text-slate-200 font-semibold">{selectedNode.language || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Lines</span>
                  <span className="text-slate-200 font-semibold">{selectedNode.linesCount || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">In-Degree (Callers)</span>
                  <span className="text-emerald-400 font-bold">{selectedNode.inDegree || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Out-Degree (Callees)</span>
                  <span className="text-cyan-400 font-bold">{selectedNode.outDegree || 0}</span>
                </div>
                {selectedNode.path && (
                  <div className="col-span-2 pt-1 border-t border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase block">Path</span>
                    <span className="text-slate-300 break-all text-[11px]">{selectedNode.path}</span>
                  </div>
                )}
              </div>

              {/* Direct Outgoing Dependencies (What this component imports / calls) */}
              <div>
                <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Outgoing Dependencies ({selectionInfo?.outgoingEdges.length || 0})</span>
                </h3>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectionInfo?.outgoingEdges.map((e, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedNodeId(e.target)}
                      className="cursor-pointer text-xs font-mono bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 p-2 rounded-lg flex items-center justify-between transition"
                    >
                      <span className="text-slate-200 truncate">{e.target}</span>
                      <span className="text-[10px] font-bold text-cyan-400 uppercase">
                        {e.relationship}
                      </span>
                    </div>
                  ))}
                  {(!selectionInfo || selectionInfo.outgoingEdges.length === 0) && (
                    <p className="text-xs text-slate-500 font-mono italic">No outgoing dependencies</p>
                  )}
                </div>
              </div>

              {/* Direct Incoming Dependencies (Who depends on this component) */}
              <div>
                <h3 className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Incoming Callers / Importers ({selectionInfo?.incomingEdges.length || 0})</span>
                </h3>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectionInfo?.incomingEdges.map((e, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedNodeId(e.source)}
                      className="cursor-pointer text-xs font-mono bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 p-2 rounded-lg flex items-center justify-between transition"
                    >
                      <span className="text-slate-200 truncate">{e.source}</span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">
                        {e.relationship}
                      </span>
                    </div>
                  ))}
                  {(!selectionInfo || selectionInfo.incomingEdges.length === 0) && (
                    <p className="text-xs text-slate-500 font-mono italic">No incoming consumers detected</p>
                  )}
                </div>
              </div>

              {/* Symbols Inside File (if file node) */}
              {selectedFile && fileInternalSymbols.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Binary className="w-3.5 h-3.5 text-amber-400" />
                    <span>AST Symbols in File ({fileInternalSymbols.length})</span>
                  </h3>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {fileInternalSymbols.map((sym) => (
                      <div
                        key={sym.id}
                        className="text-xs font-mono bg-slate-900/50 border border-slate-800 p-2 rounded flex items-center justify-between"
                      >
                        <span className="text-slate-300 font-semibold truncate">{sym.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">
                          {sym.type} (L{sym.startLine})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar (Open File, Inspect AST, Ask AI) */}
            <div className="p-4 border-t border-slate-800 bg-[#070b13] space-y-2">
              {selectedFile && (
                <button
                  onClick={() => onSelectFile(selectedFile)}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 rounded-lg transition flex items-center justify-center space-x-1.5 shadow-md shadow-cyan-950/40 font-mono"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Open File in Explorer</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {onInspectAST && (
                  <button
                    onClick={onInspectAST}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg transition border border-slate-700 font-mono text-center truncate px-2"
                  >
                    Analyze AST
                  </button>
                )}

                {onAskAI && (
                  <button
                    onClick={() =>
                      onAskAI(
                        `Analyze the architecture role, dependencies, and responsibilities of ${selectedNode.name} in file ${selectedNode.path || selectedNode.name}.`,
                      )
                    }
                    className="bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs py-2 rounded-lg transition border border-slate-700 font-mono text-center truncate px-2 flex items-center justify-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Ask AI</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
      </>
      )}
    </div>
  );
};
