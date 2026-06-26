import { useCallback, useEffect, useMemo, type MouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
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
import { personDisplayName } from '@/lib/treeOps';
import { useTreeStore } from '@/store/treeStore';
import { PersonNode, type PersonFlowNode } from './PersonNode';

const nodeTypes = { person: PersonNode };

function FitViewHelper({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 280 });
    });
    return () => cancelAnimationFrame(t);
  }, [count, fitView]);
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

function buildGraph(
  tree: ReturnType<typeof useTreeStore.getState>['tree'],
  selectedId: string | null,
  search: string
): { nodes: Node[]; edges: Edge[] } {
  const { positions, families, generations: genMap } = computeFamilyLayout(tree);
  const genVals = [...genMap.values()];
  const minGen = genVals.length ? Math.min(...genVals) : 0;
  const q = search.trim().toLowerCase();
  const relativesOfSelected = new Set<string>();
  if (selectedId) {
    relativesOfSelected.add(selectedId);
    for (const rel of tree.partnerships) {
      if (rel.aId === selectedId) relativesOfSelected.add(rel.bId);
      if (rel.bId === selectedId) relativesOfSelected.add(rel.aId);
    }
    for (const rel of tree.parentChild) {
      if (rel.parentId === selectedId) relativesOfSelected.add(rel.childId);
      if (rel.childId === selectedId) relativesOfSelected.add(rel.parentId);
    }
  }
  const nodes: Node[] = Object.values(tree.persons).map((p) => {
    const name = personDisplayName(p).toLowerCase();
    const dimBySearch = q.length > 0 && !name.includes(q);
    const dimByFocus =
      selectedId !== null && !relativesOfSelected.has(p.id) && p.id !== selectedId;
    const dimmed = dimBySearch || dimByFocus;
    const g = genMap.get(p.id) ?? 0;
    const generationLabel = `Gen ${g - minGen + 1}`;
    const n: PersonFlowNode = {
      id: p.id,
      type: 'person',
      position: positions.get(p.id) ?? { x: 0, y: 0 },
      data: {
        person: p,
        selected: selectedId === p.id,
        dimmed,
        generationLabel,
      },
      selectable: true,
    };
    return n;
  });

  const edges: Edge[] = [];
  for (const fam of families) {
    const familyNodeId = `fam-${fam.id}`;
    const familyHighlighted =
      selectedId !== null &&
      (fam.parents.includes(selectedId) || fam.children.includes(selectedId));

    nodes.push({
      id: familyNodeId,
      type: 'default',
      position: { x: fam.x, y: fam.y },
      data: {},
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      className: 'family-hub-node',
      style: {
        width: 2,
        height: 2,
        opacity: 0,
        border: 'none',
        background: 'transparent',
        pointerEvents: 'none',
      },
    });

    for (const parentId of fam.parents) {
      const active = selectedId !== null && (selectedId === parentId || familyHighlighted);
      edges.push({
        id: `fp-${familyNodeId}-${parentId}`,
        source: parentId,
        target: familyNodeId,
        type: 'straight',
        animated: false,
        className: 'family-edge family-edge-parent',
        style: {
          stroke: TREE_GOLD,
          strokeWidth: active ? 1.4 : 0.95,
          opacity: active ? 0.78 : 0.28,
        },
      });
    }

    for (const childId of fam.children) {
      const active = selectedId !== null && (selectedId === childId || familyHighlighted);
      edges.push({
        id: `fc-${familyNodeId}-${childId}`,
        source: familyNodeId,
        target: childId,
        type: 'straight',
        animated: false,
        className: 'family-edge family-edge-child',
        style: {
          stroke: TREE_GOLD,
          strokeWidth: active ? 1.8 : 1.25,
          opacity: active ? 0.9 : 0.52,
        },
      });
    }
  }

  for (const ps of tree.partnerships) {
    const active = selectedId !== null && (selectedId === ps.aId || selectedId === ps.bId);
    edges.push({
      id: `ps-${ps.id}`,
      source: ps.aId,
      target: ps.bId,
      type: 'straight',
      className: 'family-edge family-edge-partner',
      style: {
        stroke: TREE_GOLD,
        strokeWidth: active ? 1.05 : 0.8,
        strokeDasharray: '4 6',
        opacity: active ? 0.64 : 0.22,
      },
    });
  }

  return { nodes, edges };
}

export function FamilyTreeCanvas() {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const search = useTreeStore((s) => s.searchQuery);
  const selectPerson = useTreeStore((s) => s.selectPerson);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(tree, selectedId, search),
    [tree, selectedId, search]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const g = buildGraph(tree, selectedId, search);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [tree, selectedId, search, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: MouseEvent, n: Node) => {
      selectPerson(n.id);
    },
    [selectPerson]
  );

  const onPaneClick = useCallback(() => {
    selectPerson(null);
  }, [selectPerson]);

  const fitKey = Object.keys(tree.persons).length + tree.parentChild.length;

  return (
    <div className="family-tree-canvas h-full w-full overflow-hidden rounded-2xl border border-[#C5A059]/25 bg-[#121212] shadow-[inset_0_0_80px_rgba(0,0,0,0.45)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        fitView
        className="!bg-[#121212]"
        defaultEdgeOptions={{ zIndex: 0 }}
      >
        <FitViewHelper count={fitKey} />
        <FitPanel />
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
