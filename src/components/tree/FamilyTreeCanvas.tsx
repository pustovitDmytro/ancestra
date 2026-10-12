import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { computeFamilyLayout } from '@/lib/layoutTree';
import {
  childStemPath,
  coupleConnectorPath,
  marriageBarY,
  parentDropPath,
  personAnchor,
  syncPedigreeGeometry,
} from '@/lib/pedigreePaths';
import { computeLineage, filterTreeToIds, personDisplayName } from '@/lib/treeOps';
import { useTreeStore } from '@/store/treeStore';
import { PersonNode, type PersonFlowNode } from './PersonNode';
import { PedigreeEdge } from './PedigreeEdge';

const nodeTypes = { person: PersonNode };
const edgeTypes = { pedigree: PedigreeEdge };

function FitViewHelper({
  count,
  screenshotMode,
}: {
  count: number;
  screenshotMode?: boolean;
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      fitView(
        screenshotMode
          ? { padding: 0.1, duration: 0, minZoom: 0.98, maxZoom: 1.02 }
          : { padding: 0.2, duration: 280 }
      );
      if (screenshotMode) {
        requestAnimationFrame(() => {
          document.documentElement.dataset.treeRendered = 'true';
        });
      }
    });
    return () => cancelAnimationFrame(t);
  }, [count, fitView, screenshotMode]);
  return null;
}

function FitPanel() {
  const { fitView } = useReactFlow();
  return (
    <Panel position="top-left" className="!m-2">
      <button
        type="button"
        onClick={() => fitView({ padding: 0.2, duration: 320 })}
        className="rounded-lg border border-[#C5A059]/40 bg-[#1a1a1a] px-3 py-2 font-['Montserrat',system-ui,sans-serif] text-xs font-medium text-[#C5A059] transition hover:border-[#C5A059]/70 hover:text-[#d4b06f]"
      >
        Fit to screen
      </button>
    </Panel>
  );
}

const TREE_GOLD = '#C5A059';
const SPINE_GOLD = '#E8C878';

function buildGraph(
  tree: ReturnType<typeof useTreeStore.getState>['tree'],
  selectedId: string | null,
  search: string,
  anchorId?: string | null
): { nodes: Node[]; edges: Edge[] } {
  const { positions, families, generations: genMap, spine } = computeFamilyLayout(tree, {
    anchorId: anchorId ?? undefined,
  });
  const genVals = [...genMap.values()];
  const minGen = genVals.length ? Math.min(...genVals) : 0;
  const q = search.trim().toLowerCase();
  const lineage = selectedId
    ? computeLineage(tree, selectedId)
    : new Set<string>();
  const nodes: Node[] = Object.values(tree.persons).map((p) => {
    const name = personDisplayName(p).toLowerCase();
    const dimBySearch = q.length > 0 && !name.includes(q);
    const dimByFocus = selectedId !== null && !lineage.has(p.id);
    const dimmed = dimBySearch || dimByFocus;
    const g = genMap.get(p.id) ?? 0;
    const generation = g - minGen + 1;
    const onSpine = spine.has(p.id);
    const pos = positions.get(p.id) ?? { x: 0, y: 0 };
    const n: PersonFlowNode = {
      id: p.id,
      type: 'person',
      position: { x: pos.x, y: pos.y },
      data: {
        person: p,
        selected: selectedId === p.id,
        dimmed,
        generation,
        onSpine,
      },
      selectable: true,
      zIndex: onSpine ? 2 : 0,
    };
    return n;
  });

  // Stagger the horizontal "fork" rails so adjacent families on the same
  // row route their child connectors at different heights.
  const forkFracByFam = new Map<string, number>();
  {
    const famsByGen = new Map<number, typeof families>();
    for (const f of families) {
      const list = famsByGen.get(f.generation) ?? [];
      list.push(f);
      famsByGen.set(f.generation, list);
    }
    for (const fams of famsByGen.values()) {
      const sorted = [...fams].sort((a, b) => a.x - b.x);
      sorted.forEach((f, i) => forkFracByFam.set(f.id, 0.3 + (i % 3) * 0.17));
    }
  }

  const edges: Edge[] = [];
  for (const fam of families) {
    const familyNodeId = `fam-${fam.id}`;
    const isSpineFam = fam.onSpine ?? false;
    const famParentInLineage = fam.parents.some((id) => lineage.has(id));
    const famChildInLineage = fam.children.some((id) => lineage.has(id));

    const parentBottoms = fam.parents.map((parentId) => {
      const pos = positions.get(parentId)!;
      return personAnchor(pos.x, pos.y, spine.has(parentId), 'bottom');
    });
    const hubY = parentBottoms[0] ? marriageBarY(parentBottoms[0].y) : fam.y;
    const hubX =
      parentBottoms.length >= 2
        ? (parentBottoms[0]!.x + parentBottoms[1]!.x) / 2
        : (parentBottoms[0]?.x ?? fam.x);
    const hub = { x: hubX, y: hubY };

    nodes.push({
      id: familyNodeId,
      type: 'default',
      position: { x: hub.x, y: hub.y },
      data: { parents: fam.parents, children: fam.children },
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      className: 'family-hub-node',
      style: {
        width: 1,
        height: 1,
        opacity: 0,
        border: 'none',
        background: 'transparent',
        pointerEvents: 'none',
      },
      zIndex: isSpineFam ? 2 : 0,
    });

    const childless = fam.children.length === 0;

    if (fam.parents.length === 2 && parentBottoms.length === 2) {
      const active =
        selectedId !== null &&
        fam.parents.some((id) => lineage.has(id)) &&
        (famChildInLineage || childless);
      const spineEdge = isSpineFam || active;
      const couplePath = coupleConnectorPath(
        parentBottoms[0]!,
        parentBottoms[1]!,
        hubY
      );
      edges.push({
        id: `fm-${familyNodeId}`,
        source: fam.parents[0]!,
        target: fam.parents[1]!,
        type: 'pedigree',
        data: {
          routing: 'marriage-bar' as const,
          path: couplePath,
        },
        animated: false,
        className: spineEdge
          ? 'family-edge family-edge-marriage family-edge-spine'
          : 'family-edge family-edge-marriage family-edge-collateral',
        style: {
          stroke: spineEdge ? SPINE_GOLD : TREE_GOLD,
          strokeWidth: spineEdge ? 2.2 : 0.9,
          strokeDasharray: spineEdge ? undefined : '5 6',
          opacity: spineEdge ? 0.95 : 0.32,
        },
        zIndex: spineEdge ? 2 : 0,
      });
    }

    for (let i = 0; i < fam.parents.length; i++) {
      const parentId = fam.parents[i]!;
      const parentBottom = parentBottoms[i]!;
      if (fam.parents.length === 2) continue;
      const active =
        selectedId !== null &&
        lineage.has(parentId) &&
        (famChildInLineage || childless);
      const spineEdge = isSpineFam || active;
      const dropPath = parentDropPath(parentBottom, hubY);
      if (!dropPath) continue;
      edges.push({
        id: `fp-${familyNodeId}-${parentId}`,
        source: parentId,
        target: familyNodeId,
        type: 'pedigree',
        data: {
          routing: 'parent-drop' as const,
          path: dropPath,
        },
        animated: false,
        className: spineEdge
          ? 'family-edge family-edge-marriage family-edge-spine'
          : 'family-edge family-edge-marriage family-edge-collateral',
        style: {
          stroke: spineEdge ? SPINE_GOLD : TREE_GOLD,
          strokeWidth: spineEdge ? 2.2 : 0.9,
          strokeDasharray: spineEdge ? undefined : '5 6',
          opacity: spineEdge ? 0.95 : 0.32,
        },
        zIndex: spineEdge ? 2 : 0,
      });
    }

    for (const childId of fam.children) {
      const childPos = positions.get(childId);
      if (!childPos) continue;
      const childTop = personAnchor(childPos.x, childPos.y, spine.has(childId), 'top');
      const active =
        selectedId !== null &&
        lineage.has(childId) &&
        famParentInLineage;
      const spineEdge = isSpineFam || active;
      edges.push({
        id: `fc-${familyNodeId}-${childId}`,
        source: familyNodeId,
        target: childId,
        type: 'pedigree',
        data: {
          routing: 'child-stem' as const,
          path: childStemPath(hub, childTop, forkFracByFam.get(fam.id) ?? 0.5),
          forkFrac: forkFracByFam.get(fam.id) ?? 0.5,
        },
        animated: false,
        className: spineEdge
          ? 'family-edge family-edge-child family-edge-spine'
          : 'family-edge family-edge-child family-edge-collateral',
        style: {
          stroke: spineEdge ? SPINE_GOLD : TREE_GOLD,
          strokeWidth: spineEdge ? 2.6 : 0.9,
          opacity: spineEdge ? 1 : 0.28,
        },
        markerEnd: spineEdge
          ? {
              type: MarkerType.ArrowClosed,
              width: 13,
              height: 13,
              color: SPINE_GOLD,
            }
          : undefined,
        zIndex: spineEdge ? 2 : 0,
      });
    }
  }

  return { nodes, edges };
}

export function FamilyTreeCanvas({
  screenshotMode = false,
}: {
  screenshotMode?: boolean;
} = {}) {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const focusedId = useTreeStore((s) => s.focusedId);
  const search = useTreeStore((s) => s.searchQuery);
  const selectPerson = useTreeStore((s) => s.selectPerson);
  const clearFocus = useTreeStore((s) => s.clearFocus);

  const visibleTree = useMemo(() => {
    if (!focusedId || !tree.persons[focusedId]) return tree;
    return filterTreeToIds(tree, computeLineage(tree, focusedId));
  }, [tree, focusedId]);

  const focusedPerson = focusedId ? tree.persons[focusedId] ?? null : null;

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(visibleTree, selectedId, search, focusedId),
    [visibleTree, selectedId, search, focusedId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const syncGeometryFromNodes = useCallback(
    (liveNodes: Node[], updateHubNodes = false) => {
      const synced = syncPedigreeGeometry(liveNodes, edgesRef.current);
      if (updateHubNodes) {
        setNodes(synced.nodes);
      }
      setEdges(synced.edges);
    },
    [setNodes, setEdges]
  );

  const onNodeDrag = useCallback(
    (_: MouseEvent, _node: Node, liveNodes: Node[]) => {
      syncGeometryFromNodes(liveNodes);
    },
    [syncGeometryFromNodes]
  );

  const onNodeDragStop = useCallback(
    (_: MouseEvent, _node: Node, liveNodes: Node[]) => {
      syncGeometryFromNodes(liveNodes, true);
    },
    [syncGeometryFromNodes]
  );

  useEffect(() => {
    const g = buildGraph(visibleTree, selectedId, search, focusedId);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [visibleTree, selectedId, search, focusedId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: MouseEvent, n: Node) => {
      selectPerson(n.id);
    },
    [selectPerson]
  );

  const onPaneClick = useCallback(() => {
    selectPerson(null);
  }, [selectPerson]);

  const fitKey =
    Object.keys(visibleTree.persons).length +
    visibleTree.parentChild.length +
    (focusedId ? 1 : 0);

  return (
    <div className="family-tree-canvas h-full w-full overflow-hidden rounded-2xl border border-[#C5A059]/25 bg-[#121212] shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        fitView
        className="!bg-[#121212]"
        defaultEdgeOptions={{ zIndex: 0 }}
      >
        <FitViewHelper count={fitKey} screenshotMode={screenshotMode} />
        <FitPanel />
        {focusedPerson ? (
          <Panel position="top-center" className="!m-2">
            <div className="flex items-center gap-3 rounded-lg border border-[#C5A059]/40 bg-[#1a1a1a]/95 px-3 py-2 font-['Montserrat',system-ui,sans-serif] text-xs text-[#C5A059] shadow-lg backdrop-blur">
              <span className="opacity-70">Lineage of</span>
              <span className="font-semibold text-[#d4b06f]">
                {personDisplayName(focusedPerson)}
              </span>
              <button
                type="button"
                onClick={clearFocus}
                className="rounded-md border border-[#C5A059]/40 px-2 py-1 font-medium text-[#C5A059] transition hover:border-[#C5A059]/70 hover:text-[#d4b06f]"
              >
                Show full tree
              </button>
            </div>
          </Panel>
        ) : null}
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="rgba(197, 160, 89, 0.11)"
          className="!bg-[#121212]"
        />
        <Controls className="family-tree-controls !m-2 !overflow-hidden !rounded-lg !border !border-[#C5A059]/30 !bg-[#1a1a1a]/95 !shadow-none" />
        <MiniMap
          className="!m-2 !overflow-hidden !rounded-lg !border !border-[#C5A059]/30 !bg-[#1a1a1a]/95"
          maskColor="rgba(18, 18, 18, 0.85)"
          nodeColor={(n) => (n.id.startsWith('fam-') ? 'transparent' : '#C5A059')}
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}
