import type { PersonId, TreeState } from '@/types';

/** Portrait node: circle + label below (see PersonNode) */
export const NODE_W = 128;
export const NODE_H = 160;
const GAP_X = 78;
const GAP_Y = 168;

/** Space between partners side-by-side */
const PARTNER_GAP = 18;
const FAMILY_GAP = 120;

export interface LayoutPosition {
  x: number;
  y: number;
}

export interface FamilyGroupLayout {
  id: string;
  parents: PersonId[];
  children: PersonId[];
  generation: number;
  x: number;
  y: number;
}

export function computeGenerations(tree: TreeState): Map<PersonId, number> {
  const ids = Object.keys(tree.persons);
  const gen = new Map<PersonId, number>(ids.map((id) => [id, 0]));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < ids.length + 20) {
    changed = false;
    for (const { parentId, childId } of tree.parentChild) {
      const pg = gen.get(parentId) ?? 0;
      const next = pg + 1;
      const cg = gen.get(childId) ?? 0;
      if (next > cg) {
        gen.set(childId, next);
        changed = true;
      }
    }
  }
  return gen;
}

function getParents(tree: TreeState, childId: PersonId): PersonId[] {
  return tree.parentChild.filter((pc) => pc.childId === childId).map((pc) => pc.parentId);
}

function nameCompare(tree: TreeState, a: PersonId, b: PersonId): number {
  const pa = tree.persons[a];
  const pb = tree.persons[b];
  return `${pa.lastName} ${pa.firstName}`.localeCompare(
    `${pb.lastName} ${pb.firstName}`,
    undefined,
    { sensitivity: 'base' }
  );
}

function nodeCenterX(x: number): number {
  return x + NODE_W / 2;
}

function parentKey(parents: PersonId[]): string {
  if (parents.length === 0) return '';
  return [...parents].sort().join('|');
}

function resolveOverlaps(layerIds: PersonId[], pos: Map<PersonId, LayoutPosition>): void {
  const sorted = [...layerIds].sort((a, b) => (pos.get(a)?.x ?? 0) - (pos.get(b)?.x ?? 0));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const pPrev = pos.get(prev)!;
    const pCur = pos.get(cur)!;
    const minGap = NODE_W + GAP_X;
    const minX = pPrev.x + minGap;
    if (pCur.x < minX) {
      pCur.x = minX;
    }
  }
  for (let i = sorted.length - 2; i >= 0; i--) {
    const cur = sorted[i]!;
    const next = sorted[i + 1]!;
    const pCur = pos.get(cur)!;
    const pNext = pos.get(next)!;
    const maxX = pNext.x - (NODE_W + GAP_X);
    if (pCur.x > maxX) {
      pCur.x = maxX;
    }
  }
}

function applyCoupleAdjacency(
  partnerships: TreeState['partnerships'],
  ids: PersonId[],
  pos: Map<PersonId, LayoutPosition>
): void {
  const inLayer = new Set(ids);
  for (const ps of partnerships) {
    if (!inLayer.has(ps.aId) || !inLayer.has(ps.bId)) continue;
    const ax = pos.get(ps.aId)?.x;
    const bx = pos.get(ps.bId)?.x;
    if (ax == null || bx == null) continue;
    const leftId = ax <= bx ? ps.aId : ps.bId;
    const rightId = leftId === ps.aId ? ps.bId : ps.aId;
    const mid = (ax + bx) / 2;
    const half = (NODE_W + PARTNER_GAP) / 2;
    const leftPos = pos.get(leftId);
    const rightPos = pos.get(rightId);
    if (leftPos) leftPos.x = mid - half;
    if (rightPos) rightPos.x = mid + half;
  }
  resolveOverlaps(ids, pos);
}

export function computeFamilyLayout(tree: TreeState): {
  positions: Map<PersonId, LayoutPosition>;
  families: FamilyGroupLayout[];
  generations: Map<PersonId, number>;
} {
  const pos = new Map<PersonId, LayoutPosition>();
  const ids = Object.keys(tree.persons);
  if (ids.length === 0) return { positions: pos, families: [], generations: new Map() };

  const gen = computeGenerations(tree);
  const byGen = new Map<number, PersonId[]>();
  for (const id of ids) {
    const g = gen.get(id) ?? 0;
    const list = byGen.get(g) ?? [];
    list.push(id);
    byGen.set(g, list);
  }

  const gens = [...byGen.keys()].sort((a, b) => a - b);
  const minG = Math.min(...gens);
  const childToParents = new Map<PersonId, PersonId[]>();
  for (const rel of tree.parentChild) {
    const list = childToParents.get(rel.childId) ?? [];
    list.push(rel.parentId);
    childToParents.set(rel.childId, list);
  }

  const familyMap = new Map<string, FamilyGroupLayout>();
  for (const p of tree.partnerships) {
    const parents = [p.aId, p.bId].sort();
    const g = Math.min(gen.get(parents[0]) ?? minG, gen.get(parents[1]) ?? minG);
    const key = `f:${parents.join('|')}`;
    familyMap.set(key, {
      id: key,
      parents,
      children: [],
      generation: g,
      x: 0,
      y: 0,
    });
  }

  for (const [childId, rawParents] of childToParents) {
    const parents = [...new Set(rawParents)].filter((p) => tree.persons[p]).sort();
    if (parents.length === 0) continue;
    const key = `f:${parents.join('|')}`;
    const existing = familyMap.get(key);
    if (existing) {
      existing.children.push(childId);
      continue;
    }
    const g = Math.min(...parents.map((p) => gen.get(p) ?? minG));
    familyMap.set(key, {
      id: key,
      parents,
      children: [childId],
      generation: g,
      x: 0,
      y: 0,
    });
  }

  const families = [...familyMap.values()]
    .map((f) => ({
      ...f,
      children: [...new Set(f.children)].sort((a, b) => nameCompare(tree, a, b)),
    }))
    .sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));

  const desired = new Map<PersonId, number>();

  for (const g of gens) {
    const y = (g - minG) * (NODE_H + GAP_Y);
    const layerIds = [...(byGen.get(g) ?? [])];
    const layerSet = new Set(layerIds);
    const layerFamilies = families.filter((f) => f.generation === g && f.parents.some((p) => layerSet.has(p)));

    if (g === minG) {
      let cursor = 0;
      const roots = [...layerIds].sort((a, b) => nameCompare(tree, a, b));
      for (const id of roots) {
        pos.set(id, { x: cursor, y });
        cursor += NODE_W + GAP_X;
      }
      applyCoupleAdjacency(tree.partnerships, layerIds, pos);
    } else {
      const ordered = [...layerIds].sort((a, b) => {
        const da = desired.get(a) ?? Number.MAX_SAFE_INTEGER;
        const db = desired.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return nameCompare(tree, a, b);
      });

      const desiredCenters: number[] = [];
      for (const id of ordered) {
        const parents = getParents(tree, id).filter((p) => tree.persons[p]).sort();
        const key = parentKey(parents) || `single:${id}`;
        const target = desired.get(id) ?? desiredCenters.length * (NODE_W + GAP_X);
        const groupOffset = key.startsWith('single:') ? 0 : FAMILY_GAP * 0.12;
        pos.set(id, { x: target - NODE_W / 2 + groupOffset, y });
        desiredCenters.push(target);
      }
      resolveOverlaps(layerIds, pos);
      const actualCenters = ordered.map((id) => nodeCenterX(pos.get(id)!.x));
      if (actualCenters.length > 0 && desiredCenters.length > 0) {
        const actualMid = actualCenters.reduce((s, x) => s + x, 0) / actualCenters.length;
        const desiredMid = desiredCenters.reduce((s, x) => s + x, 0) / desiredCenters.length;
        const shift = desiredMid - actualMid;
        for (const id of layerIds) {
          const p = pos.get(id);
          if (p) p.x += shift;
        }
      }
      resolveOverlaps(layerIds, pos);
      applyCoupleAdjacency(tree.partnerships, layerIds, pos);
    }

    for (const fam of layerFamilies) {
      const parentCenters = fam.parents
        .filter((p) => pos.has(p))
        .map((p) => nodeCenterX(pos.get(p)!.x));
      if (parentCenters.length === 0) continue;
      const center = parentCenters.reduce((s, x) => s + x, 0) / parentCenters.length;
      fam.x = center;
      fam.y = y + NODE_H + Math.round(GAP_Y * 0.22);
      for (const c of fam.children) {
        const current = desired.get(c);
        desired.set(c, current == null ? center : (current + center) / 2);
      }
    }
  }

  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  for (const id of ids) {
    const p = pos.get(id);
    if (p) {
      p.x -= minX;
      p.y -= minY;
    }
  }

  for (const fam of families) {
    fam.x -= minX;
    fam.y -= minY;
  }

  return { positions: pos, families, generations: gen };
}

export function layoutTree(tree: TreeState): Map<PersonId, LayoutPosition> {
  return computeFamilyLayout(tree).positions;
}
