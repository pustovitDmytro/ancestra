import {
  COLLATERAL_ANCHOR_BOTTOM,
  COLLATERAL_ANCHOR_TOP,
  COLLATERAL_NODE_W,
  MARRIAGE_BAR_DROP,
  NODE_ANCHOR_BOTTOM,
  NODE_ANCHOR_TOP,
  NODE_W,
} from '@/lib/layoutTree';

export type PedigreeRouting = 'parent-drop' | 'marriage-bar' | 'child-stem';

export interface Point {
  x: number;
  y: number;
}

export function marriageBarY(parentBottomY: number): number {
  return parentBottomY + MARRIAGE_BAR_DROP;
}

export function personAnchor(
  x: number,
  y: number,
  onSpine: boolean,
  role: 'top' | 'bottom'
): Point {
  const w = onSpine ? NODE_W : COLLATERAL_NODE_W;
  const anchorY =
    role === 'top'
      ? onSpine
        ? NODE_ANCHOR_TOP
        : COLLATERAL_ANCHOR_TOP
      : onSpine
        ? NODE_ANCHOR_BOTTOM
        : COLLATERAL_ANCHOR_BOTTOM;
  return { x: x + w / 2, y: y + anchorY };
}

/**
 * Classic pedigree fork: each parent ↓, horizontal bar, no return stroke upward.
 *   O     O
 *   |     |
 *   +-----+
 */
export function coupleConnectorPath(a: Point, b: Point, barY: number): string {
  return [
    `M ${a.x} ${a.y} L ${a.x} ${barY}`,
    `M ${b.x} ${b.y} L ${b.x} ${barY}`,
    `M ${a.x} ${barY} L ${b.x} ${barY}`,
  ].join(' ');
}

/** Single parent ↓ to the marriage / fork row. */
export function parentDropPath(from: Point, barY: number): string {
  if (Math.abs(from.y - barY) < 0.5) return '';
  return `M ${from.x} ${from.y} L ${from.x} ${barY}`;
}

/**
 * Straight stem ↓ from hub center to the child (arrow on the child edge).
 * `forkFrac` sets the height of the horizontal run so that neighbouring
 * families use different rails and their connectors don't merge visually.
 */
export function childStemPath(hub: Point, childTop: Point, forkFrac = 0.5): string {
  if (Math.abs(hub.x - childTop.x) < 4) {
    return `M ${hub.x} ${hub.y} L ${childTop.x} ${childTop.y}`;
  }
  const midY = hub.y + (childTop.y - hub.y) * forkFrac;
  return `M ${hub.x} ${hub.y} L ${hub.x} ${midY} L ${childTop.x} ${midY} L ${childTop.x} ${childTop.y}`;
}

type FamilyHubData = { parents?: string[]; children?: string[] };
type PersonNodeData = { onSpine?: boolean };

function nodeOnSpine(node: { data?: unknown } | undefined): boolean {
  return Boolean((node?.data as PersonNodeData | undefined)?.onSpine);
}

/** Recompute pedigree edge paths and family-hub positions from live node coordinates. */
export function syncPedigreeGeometry<
  N extends { id: string; position: { x: number; y: number }; data?: unknown },
  E extends { id: string; data?: { path?: string; forkFrac?: number } },
>(nodes: N[], edges: E[]): { nodes: N[]; edges: E[] } {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, position: { ...n.position } }]));
  const edgeMap = new Map(edges.map((e) => [e.id, { ...e, data: e.data ? { ...e.data } : {} }]));

  for (const node of nodes) {
    if (!node.id.startsWith('fam-')) continue;
    const famData = node.data as FamilyHubData;
    const parents = famData.parents ?? [];
    const children = famData.children ?? [];
    const familyNodeId = node.id;

    const parentBottoms = parents
      .map((parentId) => {
        const pn = nodeMap.get(parentId);
        if (!pn) return null;
        return personAnchor(
          pn.position.x,
          pn.position.y,
          nodeOnSpine(pn),
          'bottom'
        );
      })
      .filter((p): p is Point => p !== null);

    if (parentBottoms.length === 0) continue;

    const hubY = marriageBarY(parentBottoms[0]!.y);
    const hubX =
      parentBottoms.length >= 2
        ? (parentBottoms[0]!.x + parentBottoms[1]!.x) / 2
        : parentBottoms[0]!.x;
    const hub = { x: hubX, y: hubY };

    const hubNode = nodeMap.get(familyNodeId);
    if (hubNode) {
      hubNode.position = { x: hub.x, y: hub.y };
    }

    if (parents.length === 2 && parentBottoms.length === 2) {
      const edge = edgeMap.get(`fm-${familyNodeId}`);
      if (edge) {
        edge.data = {
          ...edge.data,
          path: coupleConnectorPath(parentBottoms[0]!, parentBottoms[1]!, hubY),
        };
      }
    }

    for (let i = 0; i < parents.length; i++) {
      if (parents.length === 2) continue;
      const edge = edgeMap.get(`fp-${familyNodeId}-${parents[i]}`);
      if (edge && parentBottoms[i]) {
        edge.data = {
          ...edge.data,
          path: parentDropPath(parentBottoms[i]!, hubY),
        };
      }
    }

    for (const childId of children) {
      const edge = edgeMap.get(`fc-${familyNodeId}-${childId}`);
      const childNode = nodeMap.get(childId);
      if (!edge || !childNode) continue;
      const childTop = personAnchor(
        childNode.position.x,
        childNode.position.y,
        nodeOnSpine(childNode),
        'top'
      );
      const forkFrac = edge.data?.forkFrac ?? 0.5;
      edge.data = {
        ...edge.data,
        path: childStemPath(hub, childTop, forkFrac),
      };
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
  };
}
