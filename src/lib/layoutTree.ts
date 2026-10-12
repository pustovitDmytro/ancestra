import type { Person, PersonId, TreeState } from '@/types';

/** Portrait node: circle + label below (see PersonNode) */
export const NODE_W = 128;
/** Row pitch — vertical gap between generations uses this, not the handle position. */
export const NODE_H = 160;
/** Collateral relatives (siblings/cousins) use the same footprint as spine nodes. */
export const COLLATERAL_NODE_W = NODE_W;
export const COLLATERAL_NODE_H = NODE_H;

/** Gap below the parent handle before the horizontal marriage bar. */
export const MARRIAGE_BAR_DROP = 24;
/** Y offset from node.position.y to the bottom handle (under birth year). */
export const NODE_ANCHOR_BOTTOM = 138;
/** Y offset from node.position.y to the top handle. */
export const NODE_ANCHOR_TOP = 4;
export const COLLATERAL_ANCHOR_BOTTOM = NODE_ANCHOR_BOTTOM;
export const COLLATERAL_ANCHOR_TOP = NODE_ANCHOR_TOP;

/** Gap between a spine node and the first collateral relative beside it */
const COLLATERAL_GAP = 36;
/** Horizontal gap between collateral sibling blocks */
const COLLATERAL_SIB_GAP = 32;
/** Horizontal gap between unrelated root subtrees */
const FAMILY_GAP = 96;
/** Vertical gap between generations */
const GAP_Y = 136;
/** Gap between two partners side-by-side */
export const PARTNER_GAP = 24;

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
  /** True when this unit connects proband's direct ancestral line */
  onSpine?: boolean;
}

interface FamilyUnit {
  id: string;
  parents: PersonId[];
  children: PersonId[];
}

function unitKey(parents: PersonId[]): string {
  return `f:${[...parents].sort().join('|')}`;
}

function parentsOf(tree: TreeState, id: PersonId): PersonId[] {
  return tree.parentChild
    .filter((pc) => pc.childId === id)
    .map((pc) => pc.parentId)
    .filter((p) => tree.persons[p]);
}

function partnersOf(tree: TreeState, id: PersonId): PersonId[] {
  const out: PersonId[] = [];
  for (const ps of tree.partnerships) {
    if (!tree.persons[ps.aId] || !tree.persons[ps.bId]) continue;
    if (ps.aId === id) out.push(ps.bId);
    else if (ps.bId === id) out.push(ps.aId);
  }
  return out;
}

function birthYear(p: Person | undefined): number {
  if (!p?.birthDate) return Number.POSITIVE_INFINITY;
  const m = p.birthDate.match(/-?\d{3,4}/);
  return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
}

function nameKey(p: Person | undefined): string {
  if (!p) return '';
  return `${p.lastName ?? ''} ${p.firstName ?? ''}`.toLowerCase();
}

function siblingOrder(tree: TreeState, a: PersonId, b: PersonId): number {
  const pa = tree.persons[a];
  const pb = tree.persons[b];
  const ya = birthYear(pa);
  const yb = birthYear(pb);
  if (ya !== yb) return ya - yb;
  return nameKey(pa).localeCompare(nameKey(pb));
}

/**
 * Generations:
 *   1) Longest path from any source — gen(child) ≥ gen(parent) + 1.
 *   2) Anchor "married-in" spouses (no own parents) to their partner's gen,
 *      so the spouse sits on the row of the partner instead of in row 0.
 *   3) Re-propagate downward to keep child rows consistent.
 */
export function computeGenerations(tree: TreeState): Map<PersonId, number> {
  const ids = Object.keys(tree.persons);
  const gen = new Map<PersonId, number>(ids.map((id) => [id, 0]));

  let changed = true;
  let guard = 0;
  while (changed && guard++ < ids.length + 4) {
    changed = false;
    for (const { parentId, childId } of tree.parentChild) {
      if (!tree.persons[parentId] || !tree.persons[childId]) continue;
      const next = (gen.get(parentId) ?? 0) + 1;
      if (next > (gen.get(childId) ?? 0)) {
        gen.set(childId, next);
        changed = true;
      }
    }
  }

  // Sibling groups: all children sharing the same parent set (a "unit").
  const siblingGroups: PersonId[][] = [];
  {
    const childParents = new Map<PersonId, PersonId[]>();
    for (const pc of tree.parentChild) {
      if (!tree.persons[pc.parentId] || !tree.persons[pc.childId]) continue;
      const list = childParents.get(pc.childId) ?? [];
      if (!list.includes(pc.parentId)) list.push(pc.parentId);
      childParents.set(pc.childId, list);
    }
    const byKey = new Map<string, PersonId[]>();
    for (const [child, parents] of childParents) {
      const key = [...parents].sort().join('|');
      const list = byKey.get(key) ?? [];
      list.push(child);
      byKey.set(key, list);
    }
    for (const sibs of byKey.values()) siblingGroups.push(sibs);
  }

  changed = true;
  guard = 0;
  const maxIters = Math.max(8, ids.length * 4);
  while (changed && guard++ < maxIters) {
    changed = false;
    // Equalize partners: both partners share the deeper of their gens.
    // For genealogy a marriage occupies one row, even if one partner's
    // ancestry tree is deeper than the other's.
    for (const ps of tree.partnerships) {
      if (!tree.persons[ps.aId] || !tree.persons[ps.bId]) continue;
      const ag = gen.get(ps.aId) ?? 0;
      const bg = gen.get(ps.bId) ?? 0;
      if (ag === bg) continue;
      const m = Math.max(ag, bg);
      if (ag !== m) {
        gen.set(ps.aId, m);
        changed = true;
      }
      if (bg !== m) {
        gen.set(ps.bId, m);
        changed = true;
      }
    }
    // Equalize siblings: keeping a sibling group on one row avoids the
    // odd "older sibling, younger sibling" stagger that appears when one
    // sibling marries into a deeper subtree.
    for (const sibs of siblingGroups) {
      let m = 0;
      for (const s of sibs) m = Math.max(m, gen.get(s) ?? 0);
      for (const s of sibs) {
        if ((gen.get(s) ?? 0) !== m) {
          gen.set(s, m);
          changed = true;
        }
      }
    }
    // Re-propagate downward to keep child rows below their parents'.
    for (const { parentId, childId } of tree.parentChild) {
      if (!tree.persons[parentId] || !tree.persons[childId]) continue;
      const next = (gen.get(parentId) ?? 0) + 1;
      if (next > (gen.get(childId) ?? 0)) {
        gen.set(childId, next);
        changed = true;
      }
    }
    // Upward propagation: if a child got pushed deeper than parent + 1
    // (e.g. via a partner-equalize step), pull the parent down so the
    // gap between generations is always exactly one row. Without this,
    // grandparents on a "shorter" ancestry chain end up far above the
    // grandparents of their grandchild's other side.
    for (const { parentId, childId } of tree.parentChild) {
      if (!tree.persons[parentId] || !tree.persons[childId]) continue;
      const want = (gen.get(childId) ?? 0) - 1;
      if (want > (gen.get(parentId) ?? 0)) {
        gen.set(parentId, want);
        changed = true;
      }
    }
  }

  return gen;
}

function buildUnits(tree: TreeState): {
  units: Map<string, FamilyUnit>;
  childUnit: Map<PersonId, string>;
  parentUnits: Map<PersonId, string[]>;
} {
  const units = new Map<string, FamilyUnit>();

  for (const ps of tree.partnerships) {
    if (!tree.persons[ps.aId] || !tree.persons[ps.bId]) continue;
    const parents = [ps.aId, ps.bId].sort();
    const id = unitKey(parents);
    if (!units.has(id)) units.set(id, { id, parents, children: [] });
  }

  const childParents = new Map<PersonId, PersonId[]>();
  for (const pc of tree.parentChild) {
    if (!tree.persons[pc.parentId] || !tree.persons[pc.childId]) continue;
    const list = childParents.get(pc.childId) ?? [];
    if (!list.includes(pc.parentId)) list.push(pc.parentId);
    childParents.set(pc.childId, list);
  }

  const childUnit = new Map<PersonId, string>();
  for (const [child, parents] of childParents) {
    const sorted = [...parents].sort();
    const id = unitKey(sorted);
    let unit = units.get(id);
    if (!unit) {
      unit = { id, parents: sorted, children: [] };
      units.set(id, unit);
    }
    if (!unit.children.includes(child)) unit.children.push(child);
    childUnit.set(child, id);
  }

  const parentUnits = new Map<PersonId, string[]>();
  for (const u of units.values()) {
    for (const p of u.parents) {
      const list = parentUnits.get(p) ?? [];
      list.push(u.id);
      parentUnits.set(p, list);
    }
  }

  return { units, childUnit, parentUnits };
}

function ancestorCount(tree: TreeState, personId: PersonId): number {
  const seen = new Set<PersonId>();
  const stack = [personId];
  let count = 0;
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    count++;
    for (const p of parentsOf(tree, cur)) stack.push(p);
  }
  return count;
}

/** Home person: deepest generation with both parents, preferring the richest ancestral line. */
function findProband(tree: TreeState, generations: Map<PersonId, number>): PersonId {
  const ids = Object.keys(tree.persons);
  const withTwoParents = ids.filter((id) => parentsOf(tree, id).length >= 2);
  const pool = withTwoParents.length > 0 ? withTwoParents : ids;

  function score(id: PersonId): number {
    let s = ancestorCount(tree, id) * 100;
    s += (generations.get(id) ?? 0) * 10;
    if (
      tree.parentChild.filter((pc) => pc.parentId === id && tree.persons[pc.childId]).length === 0
    ) {
      s += 5;
    }
    const by = birthYear(tree.persons[id]);
    if (Number.isFinite(by)) s += by / 100_000;
    return s;
  }

  pool.sort((a, b) => score(b) - score(a) || nameKey(tree.persons[a]).localeCompare(nameKey(tree.persons[b])));
  return pool[0] ?? ids[0]!;
}

type BranchSide = 'left' | 'center' | 'right';

export type { BranchSide };

function assignBranchSides(tree: TreeState, proband: PersonId): Map<PersonId, BranchSide> {
  const side = new Map<PersonId, BranchSide>();

  function mark(id: PersonId, s: BranchSide): void {
    if (!tree.persons[id] || side.has(id)) return;
    side.set(id, s);
    for (const p of partnersOf(tree, id)) {
      // Spouses with their own ancestry get their side from markAncestry, not the partner.
      if (parentsOf(tree, p).length > 0) continue;
      if (!side.has(p)) mark(p, s);
    }
    for (const sib of siblingsOf(tree, id)) mark(sib, s);
    if (s === 'center') {
      for (const c of childrenOfPerson(tree, id)) mark(c, 'center');
    }
  }

  function markAncestry(id: PersonId, s: 'left' | 'right'): void {
    mark(id, s);
    for (const p of orderedParents(tree, id)) markAncestry(p, s);
    for (const sib of siblingsOf(tree, id)) {
      mark(sib, s);
      for (const c of childrenOfPerson(tree, sib)) mark(c, s);
    }
  }

  mark(proband, 'center');
  for (const s of siblingsOf(tree, proband)) mark(s, 'center');
  for (const c of childrenOfPerson(tree, proband)) mark(c, 'center');

  const ps = orderedParents(tree, proband);
  if (ps[0]) markAncestry(ps[0], 'left');
  if (ps[1]) markAncestry(ps[1], 'right');

  for (const id of Object.keys(tree.persons)) {
    if (!side.has(id)) mark(id, 'center');
  }
  return side;
}

function siblingsOf(tree: TreeState, personId: PersonId): PersonId[] {
  const parIds = new Set(parentsOf(tree, personId));
  if (parIds.size === 0) return [];
  const out: PersonId[] = [];
  for (const pc of tree.parentChild) {
    if (!parIds.has(pc.parentId) || pc.childId === personId || !tree.persons[pc.childId]) continue;
    if (!out.includes(pc.childId)) out.push(pc.childId);
  }
  return out.sort((a, b) => siblingOrder(tree, a, b));
}

function orderedParents(tree: TreeState, personId: PersonId): PersonId[] {
  const ps = parentsOf(tree, personId);
  return ps.sort((a, b) => {
    const ga = tree.persons[a]?.gender;
    const gb = tree.persons[b]?.gender;
    if (ga === 'male' && gb !== 'male') return -1;
    if (gb === 'male' && ga !== 'male') return 1;
    return siblingOrder(tree, a, b);
  });
}

function childrenOfPerson(tree: TreeState, personId: PersonId): PersonId[] {
  const out: PersonId[] = [];
  const seen = new Set<PersonId>();
  for (const pc of tree.parentChild) {
    if (pc.parentId !== personId || !tree.persons[pc.childId]) continue;
    if (seen.has(pc.childId)) continue;
    seen.add(pc.childId);
    out.push(pc.childId);
  }
  return out.sort((a, b) => siblingOrder(tree, a, b));
}

/** Direct ancestors of proband (proband → parents → grandparents → …). */
export function computeAncestralSpine(tree: TreeState, proband: PersonId): Set<PersonId> {
  const spine = new Set<PersonId>([proband]);
  let frontier: PersonId[] = [proband];
  while (frontier.length > 0) {
    const next: PersonId[] = [];
    for (const id of frontier) {
      for (const p of orderedParents(tree, id)) {
        if (!spine.has(p)) {
          spine.add(p);
          next.push(p);
        }
      }
    }
    frontier = next;
  }
  return spine;
}

/**
 * Proband-centered pedigree: direct ancestors on a vertical spine; collateral relatives
 * fan out to the sides at smaller size so parent→child links stay readable.
 */
export function computeFamilyLayout(
  tree: TreeState,
  options?: { anchorId?: PersonId }
): {
  positions: Map<PersonId, LayoutPosition>;
  families: FamilyGroupLayout[];
  generations: Map<PersonId, number>;
  spine: Set<PersonId>;
  proband: PersonId;
  branchSide: Map<PersonId, BranchSide>;
} {
  const positions = new Map<PersonId, LayoutPosition>();
  const ids = Object.keys(tree.persons);
  if (ids.length === 0) {
    return {
      positions,
      families: [],
      generations: new Map(),
      spine: new Set(),
      proband: '',
      branchSide: new Map(),
    };
  }

  const generations = computeGenerations(tree);
  const { units } = buildUnits(tree);

  const minGen = Math.min(...generations.values());
  const genY = (g: number) => (g - minGen) * (NODE_H + GAP_Y);

  const proband = options?.anchorId ?? findProband(tree, generations);
  const spine = computeAncestralSpine(tree, proband);
  const branchSide = assignBranchSides(tree, proband);

  function onSpine(personId: PersonId): boolean {
    return spine.has(personId);
  }

  function sideOf(personId: PersonId): BranchSide {
    return branchSide.get(personId) ?? 'center';
  }

  function nodeW(personId: PersonId): number {
    return onSpine(personId) ? NODE_W : COLLATERAL_NODE_W;
  }

  /** Married-in spouse placed adjacent to their partner. */
  function adjacentPartnerOf(personId: PersonId): PersonId | null {
    const partners = partnersOf(tree, personId);
    if (partners.length === 0) return null;
    const meHas = parentsOf(tree, personId).length > 0;
    for (const p of partners) {
      const pHas = parentsOf(tree, p).length > 0;
      if (meHas && !pHas) return p;
      if (!meHas && !pHas && personId < p) return p;
    }
    return null;
  }

  function coupleWidth(personId: PersonId): number {
    const w = nodeW(personId);
    return adjacentPartnerOf(personId) ? w * 2 + PARTNER_GAP : w;
  }

  const rowOcc = new Map<number, Array<{ left: number; right: number }>>();
  const ROW_MIN_GAP = 36;
  const NODE_VISUAL_PAD = 10;

  function rowSegments(y: number): Array<{ left: number; right: number }> {
    return rowOcc.get(y) ?? [];
  }

  function overlapsRow(y: number, left: number, right: number, gap = ROW_MIN_GAP): boolean {
    for (const seg of rowSegments(y)) {
      if (left < seg.right + gap && right > seg.left - gap) return true;
    }
    return false;
  }

  function registerRow(y: number, left: number, right: number): void {
    const list = rowOcc.get(y) ?? [];
    list.push({ left: left - NODE_VISUAL_PAD, right: right + NODE_VISUAL_PAD });
    rowOcc.set(y, list);
  }

  /** Nudge centerX until the couple block fits on the row. */
  function resolveCenterX(
    y: number,
    centerX: number,
    coupleW: number,
    prefer: 'left' | 'right' = 'right'
  ): number {
    let left = centerX - coupleW / 2;
    let right = left + coupleW;
    if (!overlapsRow(y, left, right)) return centerX;

    let guard = 0;
    while (overlapsRow(y, left, right) && guard++ < 500) {
      const segs = rowSegments(y);
      if (prefer === 'right') {
        let maxRight = left;
        for (const seg of segs) {
          if (left < seg.right + ROW_MIN_GAP && right > seg.left - ROW_MIN_GAP) {
            maxRight = Math.max(maxRight, seg.right + ROW_MIN_GAP);
          }
        }
        left = maxRight;
      } else {
        let minLeft = left;
        for (const seg of segs) {
          if (left < seg.right + ROW_MIN_GAP && right > seg.left - ROW_MIN_GAP) {
            minLeft = Math.min(minLeft, seg.left - ROW_MIN_GAP - coupleW);
          }
        }
        left = minLeft;
      }
      right = left + coupleW;
      centerX = left + coupleW / 2;
    }
    return centerX;
  }

  function seedRowOccFromPositions(): void {
    rowOcc.clear();
    const seen = new Set<PersonId>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      const pos = positions.get(id);
      if (!pos) continue;
      const partner = adjacentPartnerOf(id);
      const partnerPos = partner ? positions.get(partner) : null;
      if (partner && partnerPos && partnerPos.y === pos.y) {
        const left = Math.min(pos.x, partnerPos.x);
        const right = Math.max(pos.x + nodeW(id), partnerPos.x + nodeW(partner));
        registerRow(pos.y, left, right);
        seen.add(partner);
      } else {
        registerRow(pos.y, pos.x, pos.x + nodeW(id));
      }
      seen.add(id);
    }
  }

  const placed = new Set<PersonId>();

  function coupleBounds(centerX: number, coupleW: number): { left: number; right: number } {
    const left = centerX - coupleW / 2;
    return { left, right: left + coupleW };
  }

  function setPos(personId: PersonId, leftX: number, y: number): void {
    positions.set(personId, { x: leftX, y });
    placed.add(personId);
  }

  function placeCouple(
    personId: PersonId,
    centerX: number,
    y: number,
    exact = false,
    prefer: 'left' | 'right' = 'right'
  ): void {
    if (placed.has(personId) && !exact) return;

    const coupleW = coupleWidth(personId);
    const resolved = exact ? centerX : resolveCenterX(y, centerX, coupleW, prefer);
    const { left: leftX, right } = coupleBounds(resolved, coupleW);
    const w = nodeW(personId);
    setPos(personId, leftX, y);
    const partner = adjacentPartnerOf(personId);
    if (partner) {
      setPos(partner, leftX + w + PARTNER_GAP, y);
    }
    registerRow(y, leftX, right);
  }

  function nodeCenterX(personId: PersonId): number {
    const pos = positions.get(personId);
    if (!pos) return 0;
    const partner = adjacentPartnerOf(personId);
    const partnerPos = partner ? positions.get(partner) : null;
    const w = nodeW(personId);
    if (partner && partnerPos && partnerPos.y === pos.y) {
      return (pos.x + partnerPos.x + nodeW(partner)) / 2;
    }
    return pos.x + w / 2;
  }

  const SPINE_COUPLE_W = NODE_W * 2 + PARTNER_GAP;

  /** Parent couple sits above child, extending away from the tree midline. */
  function outwardCoupleCenter(childCenterX: number, side: BranchSide): number {
    if (side === 'left') return childCenterX - SPINE_COUPLE_W / 2;
    if (side === 'right') return childCenterX + SPINE_COUPLE_W / 2;
    return childCenterX;
  }

  function outwardSingleCenter(childCenterX: number, side: BranchSide): number {
    if (side === 'left') return childCenterX - NODE_W / 2;
    if (side === 'right') return childCenterX + NODE_W / 2;
    return childCenterX;
  }

  function placeParentCouple(
    childCenterX: number,
    y: number,
    father: PersonId,
    mother: PersonId,
    force = false,
    childSide: BranchSide = 'center'
  ): void {
    if (!force && placed.has(father) && placed.has(mother)) return;

    const { left: leftP, right: rightP } = coupleSlots(father, mother);
    let cx =
      childSide === 'center'
        ? childCenterX
        : coupleCenterFromParentHubs(leftP, rightP) ?? outwardCoupleCenter(childCenterX, childSide);
    const coupleW = SPINE_COUPLE_W;
    if (force) {
      let left = cx - coupleW / 2;
      let right = left + coupleW;
      let guard = 0;
      const step = coupleW + ROW_MIN_GAP;
      while (sameBranchSpineOverlaps(y, left, right, leftP, rightP, childSide) && guard++ < 64) {
        if (childSide === 'left') cx -= step;
        else cx += step;
        left = cx - coupleW / 2;
        right = left + coupleW;
      }
    }

    placeSpineCoupleAt(leftP, rightP, cx, y);
  }

  function sameBranchSpineOverlaps(
    y: number,
    left: number,
    right: number,
    skipA: PersonId,
    skipB: PersonId,
    side: BranchSide
  ): boolean {
    const skip = new Set([skipA, skipB]);
    for (const [id, pos] of positions) {
      if (pos.y !== y || !onSpine(id) || skip.has(id)) continue;
      const idSide = sideOf(id);
      if (side !== 'center' && idSide !== 'center' && idSide !== side) continue;
      const r = pos.x + NODE_W;
      if (left < r + ROW_MIN_GAP && right > pos.x - ROW_MIN_GAP) return true;
    }
    return false;
  }

  function shiftColumn(personId: PersonId, dx: number): void {
    if (dx === 0) return;
    const stack = [personId];
    const seen = new Set<PersonId>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const c of childrenOfPerson(tree, cur)) stack.push(c);
      const pos = positions.get(cur);
      if (pos) pos.x += dx;
      const partner = adjacentPartnerOf(cur);
      if (partner && !seen.has(partner)) {
        seen.add(partner);
        const pp = positions.get(partner);
        if (pp && pp.y === pos?.y) pp.x += dx;
      }
    }
  }

  function placeCollateralDescendants(personId: PersonId, centerX: number): void {
    const kids = childrenOfPerson(tree, personId);
    if (kids.length === 0) return;

    const parentCx = placed.has(personId) ? nodeCenterX(personId) : centerX;
    const unplaced = kids.filter((c) => !placed.has(c));
    if (unplaced.length === 0) return;

    let kidsW = 0;
    for (const c of unplaced) kidsW += coupleWidth(c);
    if (unplaced.length > 1) kidsW += (unplaced.length - 1) * COLLATERAL_SIB_GAP;

    const side = sideOf(personId);
    const ordered =
      side === 'left' ? [...unplaced].reverse() : unplaced;
    let cursor =
      side === 'left'
        ? parentCx - coupleWidth(personId) / 2 - COLLATERAL_GAP
        : side === 'right'
          ? parentCx + coupleWidth(personId) / 2 + COLLATERAL_GAP
          : parentCx - kidsW / 2;

    for (const c of ordered) {
      const cw = coupleWidth(c);
      const childY = genY(generations.get(c) ?? 0);
      if (side === 'left') {
        cursor -= cw;
        placeCouple(c, cursor + cw / 2, childY, false, 'left');
        cursor -= COLLATERAL_SIB_GAP;
      } else if (side === 'right') {
        placeCouple(c, cursor + cw / 2, childY, false, 'right');
        cursor += cw + COLLATERAL_SIB_GAP;
      } else {
        const childCenter = cursor + cw / 2;
        placeCouple(c, childCenter, childY);
        cursor += cw + COLLATERAL_SIB_GAP;
      }
      placeCollateralDescendants(c, nodeCenterX(c));
    }
  }

  /** Walk up the spine only — no collateral yet. */
  function layoutSpineUp(childId: PersonId, childCenterX: number): void {
    const childSide = sideOf(childId);
    const ps = orderedParents(tree, childId).filter((p) => onSpine(p));
    if (ps.length === 2) {
      const y = genY(generations.get(ps[0]!) ?? 0);
      const fatherCenter = childCenterX - NODE_W / 2 - PARTNER_GAP / 2;
      const motherCenter = childCenterX + NODE_W / 2 + PARTNER_GAP / 2;
      layoutSpineUp(ps[0]!, fatherCenter);
      layoutSpineUp(ps[1]!, motherCenter);
      placeParentCouple(childCenterX, y, ps[0]!, ps[1]!, false, childSide);
    } else if (ps.length === 1) {
      layoutSpineUp(ps[0]!, childCenterX);
      if (!placed.has(ps[0]!)) {
        const cx = outwardSingleCenter(childCenterX, childSide);
        placeCouple(ps[0]!, cx, genY(generations.get(ps[0]!) ?? 0), true);
      }
    }
  }

  /**
   * Re-seat spine ancestors generation by generation, bottom-up. Each parent
   * unit targets its child's column (outward for side branches); units on a
   * row are then spread left-to-right preserving order, so the husband's and
   * wife's ancestor lines can never leapfrog each other.
   */
  /** Which slot the person holds inside their own spine couple. */
  function slotSideOf(personId: PersonId): 'left' | 'right' | 'center' {
    for (const ps of tree.partnerships) {
      const other = ps.aId === personId ? ps.bId : ps.bId === personId ? ps.aId : null;
      if (!other || !onSpine(other) || !tree.persons[other]) continue;
      return coupleSlots(personId, other).left === personId ? 'left' : 'right';
    }
    return 'center';
  }

  function realignSpineRows(): void {
    const midlineX = nodeCenterX(proband);
    let level: PersonId[] = [proband];
    const seenUnits = new Set<string>();

    while (level.length > 0) {
      type SpineUnit = {
        members: PersonId[];
        desired: number;
        width: number;
        /** Reserved space beside the unit for each partner's sibling fan. */
        leftPad: number;
        rightPad: number;
        y: number;
      };
      const units: SpineUnit[] = [];
      const nextLevel: PersonId[] = [];

      for (const child of [...level].sort((a, b) => nodeCenterX(a) - nodeCenterX(b))) {
        const ps = orderedParents(tree, child).filter((p) => onSpine(p));
        if (ps.length === 0) continue;
        const key = [...ps].sort().join('|');
        if (seenUnits.has(key)) continue;
        seenUnits.add(key);

        const childCx = nodeCenterX(child);
        // Parents extend away from the child's spouse (per couple slot), which
        // nests each partner's ancestor strip on their own side.
        const dir = slotSideOf(child);
        const y = genY(generations.get(ps[0]!) ?? 0);
        if (ps.length === 2) {
          const { left, right } = coupleSlots(ps[0]!, ps[1]!);
          const desired = dir === 'center' ? childCx : outwardCoupleCenter(childCx, dir);
          units.push({
            members: [left, right],
            desired,
            width: SPINE_COUPLE_W,
            leftPad: collateralSiblingsWidth(left),
            rightPad: collateralSiblingsWidth(right),
            y,
          });
        } else {
          const pid = ps[0]!;
          const desired = dir === 'center' ? childCx : outwardSingleCenter(childCx, dir);
          const sibsW = collateralSiblingsWidth(pid);
          const sibsGoLeft =
            adjacentPartnerOf(pid) !== null || tree.persons[pid]?.gender !== 'female';
          units.push({
            members: [pid],
            desired,
            width: coupleWidth(pid),
            leftPad: sibsGoLeft ? sibsW : 0,
            rightPad: sibsGoLeft ? 0 : sibsW,
            y,
          });
        }
        nextLevel.push(...ps);
      }

      const byRow = new Map<number, SpineUnit[]>();
      for (const u of units) {
        const list = byRow.get(u.y) ?? [];
        list.push(u);
        byRow.set(u.y, list);
      }
      for (const rowUnits of byRow.values()) {
        rowUnits.sort((a, b) => a.desired - b.desired);

        const unitSide = (u: SpineUnit): BranchSide => {
          const sides = new Set(u.members.map((m) => sideOf(m)));
          if (sides.size === 1) return [...sides][0]!;
          return 'center';
        };
        const lefts = rowUnits.filter((u) => unitSide(u) === 'left');
        const centers = rowUnits.filter((u) => unitSide(u) === 'center');
        const rights = rowUnits.filter((u) => unitSide(u) === 'right');

        // Center units keep their column; each branch resolves collisions
        // outward preserving order, never crossing the proband midline.
        let leftBound = midlineX - ROW_MIN_GAP;
        let rightBound = midlineX + ROW_MIN_GAP;
        for (const u of centers) {
          leftBound = Math.min(leftBound, u.desired - u.width / 2 - u.leftPad - ROW_MIN_GAP);
          rightBound = Math.max(rightBound, u.desired + u.width / 2 + u.rightPad + ROW_MIN_GAP);
        }
        for (let i = lefts.length - 1; i >= 0; i--) {
          const cur = lefts[i]!;
          const maxCenter = leftBound - cur.width / 2 - cur.rightPad;
          if (cur.desired > maxCenter) cur.desired = maxCenter;
          leftBound = cur.desired - cur.width / 2 - cur.leftPad - ROW_MIN_GAP;
        }
        for (const cur of rights) {
          const minCenter = rightBound + cur.width / 2 + cur.leftPad;
          if (cur.desired < minCenter) cur.desired = minCenter;
          rightBound = cur.desired + cur.width / 2 + cur.rightPad + ROW_MIN_GAP;
        }

        for (const u of rowUnits) {
          if (u.members.length === 2) {
            placeSpineCoupleAt(u.members[0]!, u.members[1]!, u.desired, u.y);
          } else {
            placeCouple(u.members[0]!, u.desired, u.y, true);
          }
        }
      }

      level = nextLevel;
    }
  }

  /** Width the non-spine siblings of a spine anchor will occupy beside them. */
  function collateralSiblingsWidth(anchorId: PersonId): number {
    const sibs = siblingsOf(tree, anchorId).filter((s) => !onSpine(s));
    if (sibs.length === 0) return 0;
    let w = COLLATERAL_GAP;
    for (const s of sibs) w += coupleWidth(s) + COLLATERAL_SIB_GAP;
    return w;
  }

  /** Center X of a person's parent couple (used to nest sibling groups). */
  function parentsCenterX(personId: PersonId): number {
    const ps = orderedParents(tree, personId).filter((p) => positions.has(p));
    if (ps.length === 0) return nodeCenterX(personId);
    let sum = 0;
    for (const p of ps) sum += nodeCenterX(p);
    return sum / ps.length;
  }

  function spineParentCenterX(personId: PersonId): number | null {
    const ps = orderedParents(tree, personId).filter((p) => onSpine(p) && positions.has(p));
    if (ps.length === 0) return null;
    if (ps.length === 1) return nodeCenterX(ps[0]!);
    return (nodeCenterX(ps[0]!) + nodeCenterX(ps[1]!)) / 2;
  }

  /**
   * Left/right slots so each partner sits under their own parent's column.
   * Frozen on first computation: later passes move parents around, and
   * re-deriving the order from live coordinates would flip couples after
   * their siblings were already fanned out to the old sides.
   */
  const frozenCoupleSlots = new Map<string, { left: PersonId; right: PersonId }>();
  function coupleSlots(a: PersonId, b: PersonId): { left: PersonId; right: PersonId } {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const frozen = frozenCoupleSlots.get(key);
    if (frozen) return frozen;

    const compute = (): { left: PersonId; right: PersonId } => {
      const aPc = spineParentCenterX(a);
      const bPc = spineParentCenterX(b);
      if (aPc !== null && bPc !== null && Math.abs(aPc - bPc) > 4) {
        return aPc <= bPc ? { left: a, right: b } : { left: b, right: a };
      }
      const ga = tree.persons[a]?.gender;
      const gb = tree.persons[b]?.gender;
      if (ga === 'male' && gb !== 'male') return { left: a, right: b };
      if (gb === 'male' && ga !== 'male') return { left: b, right: a };
      const fallbackA = aPc ?? parentsCenterX(a);
      const fallbackB = bPc ?? parentsCenterX(b);
      return fallbackA <= fallbackB ? { left: a, right: b } : { left: b, right: a };
    };

    const result = compute();
    frozenCoupleSlots.set(key, result);
    return result;
  }

  function spineParentCount(personId: PersonId): number {
    return orderedParents(tree, personId).filter((p) => onSpine(p) && positions.has(p)).length;
  }

  /** Hub midpoint only when each partner has a single spine parent (cross-family marriage). */
  function coupleCenterFromParentHubs(a: PersonId, b: PersonId): number | null {
    if (spineParentCount(a) !== 1 || spineParentCount(b) !== 1) return null;
    const aPc = spineParentCenterX(a);
    const bPc = spineParentCenterX(b);
    if (aPc === null || bPc === null) return null;
    return (aPc + bPc) / 2;
  }

  function placeSpineCoupleAt(
    leftP: PersonId,
    rightP: PersonId,
    cx: number,
    y: number
  ): void {
    const leftX = cx - NODE_W - PARTNER_GAP / 2;
    const rightX = cx + PARTNER_GAP / 2;
    positions.set(leftP, { x: leftX, y });
    positions.set(rightP, { x: rightX, y });
    placed.add(leftP);
    placed.add(rightP);
    for (const pid of [leftP, rightP]) {
      const partner = adjacentPartnerOf(pid);
      if (!partner || partner === leftP || partner === rightP) continue;
      const baseX = pid === leftP ? leftX : rightX;
      positions.set(partner, { x: baseX + NODE_W + PARTNER_GAP, y });
      placed.add(partner);
    }
    let left = leftX;
    let right = rightX + NODE_W;
    registerRow(y, left, right);
  }

  /** Siblings fan out away from the spouse: father’s kin left, mother’s kin right. */
  function siblingPlacementSide(anchorId: PersonId): 'left' | 'right' {
    const pos = positions.get(anchorId);
    if (!pos) return sideOf(anchorId) === 'right' ? 'right' : 'left';

    const partner = adjacentPartnerOf(anchorId);
    const partnerPos = partner ? positions.get(partner) : null;
    if (partner && partnerPos && partnerPos.y === pos.y) {
      return pos.x < partnerPos.x ? 'left' : 'right';
    }

    const gender = tree.persons[anchorId]?.gender;
    if (gender === 'female') return 'right';
    if (gender === 'male') return 'left';
    return sideOf(anchorId) === 'right' ? 'right' : 'left';
  }

  /** Place collateral beside the spine, tracking free space per row. */
  function layoutAllCollateral(): void {
    const leftEdgeByY = new Map<number, number>();
    const rightEdgeByY = new Map<number, number>();

    const groups = new Map<string, PersonId[]>();
    for (const anchorId of spine) {
      const sibs = siblingsOf(tree, anchorId).filter((s) => !onSpine(s) && !placed.has(s));
      if (sibs.length === 0 || !positions.has(anchorId)) continue;
      const y = genY(generations.get(anchorId) ?? 0);
      const placement = siblingPlacementSide(anchorId);
      const key = `${y}|${placement}`;
      const list = groups.get(key) ?? [];
      list.push(anchorId);
      groups.set(key, list);
    }

    const orderedKeys = [...groups.keys()].sort(
      (a, b) => Number(a.split('|')[0]) - Number(b.split('|')[0])
    );

    for (const key of orderedKeys) {
      const [yStr, placement] = key.split('|') as [string, 'left' | 'right'];
      const y = Number(yStr);
      const anchors = groups.get(key)!;
      anchors.sort((a, b) =>
        placement === 'left'
          ? parentsCenterX(b) - parentsCenterX(a)
          : parentsCenterX(a) - parentsCenterX(b)
      );

      for (const anchorId of anchors) {
        const sibs = siblingsOf(tree, anchorId).filter((s) => !onSpine(s) && !placed.has(s));
        if (sibs.length === 0) continue;

        if (placement === 'left') {
          const anchorLeft = nodeCenterX(anchorId) - coupleWidth(anchorId) / 2;
          let cursor = Math.min(
            leftEdgeByY.get(y) ?? Infinity,
            anchorLeft - COLLATERAL_GAP
          );
          for (const s of [...sibs].reverse()) {
            const cw = coupleWidth(s);
            cursor -= cw;
            placeCouple(s, cursor + cw / 2, y, false, 'left');
            placeCollateralDescendants(s, nodeCenterX(s));
            cursor -= COLLATERAL_SIB_GAP;
          }
          leftEdgeByY.set(y, cursor);
        } else {
          const anchorRight = nodeCenterX(anchorId) + coupleWidth(anchorId) / 2;
          let cursor = Math.max(
            rightEdgeByY.get(y) ?? -Infinity,
            anchorRight + COLLATERAL_GAP
          );
          for (const s of sibs) {
            const cw = coupleWidth(s);
            placeCouple(s, cursor + cw / 2, y, false, 'right');
            placeCollateralDescendants(s, nodeCenterX(s));
            cursor += cw + COLLATERAL_SIB_GAP;
          }
          rightEdgeByY.set(y, cursor);
        }
      }
    }

    const probandSibs = siblingsOf(tree, proband).filter((s) => !placed.has(s));
    if (probandSibs.length > 0) {
      const y = genY(generations.get(proband) ?? 0);
      const probandPos = positions.get(proband)!;
      let cursor = rightEdgeByY.get(y) ?? probandPos.x + NODE_W + COLLATERAL_GAP;
      for (const s of probandSibs) {
        const cw = coupleWidth(s);
        placeCouple(s, cursor + cw / 2, y, false, 'right');
        placeCollateralDescendants(s, nodeCenterX(s));
        cursor += cw + COLLATERAL_SIB_GAP;
      }
      rightEdgeByY.set(y, cursor);
    }
  }

  /** Re-seat spine couples under their own parents' columns. */
  function alignSpineCouplesToParents(): void {
    const seen = new Set<string>();
    for (const id of spine) {
      const partner = adjacentPartnerOf(id);
      if (!partner || !onSpine(partner) || !positions.has(partner)) continue;
      const key = [id, partner].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const { left, right } = coupleSlots(id, partner);
      const cx = coupleCenterFromParentHubs(left, right);
      if (cx === null) continue;

      const y = positions.get(left)!.y;
      placeSpineCoupleAt(left, right, cx, y);
    }
  }

  /** Move spine children with two parents under their couple hub (not single-parent spouses). */
  function alignAllSpineChildren(): void {
    for (const id of spine) {
      // Members of a same-row spine couple are positioned as a pair by the
      // couple passes; aligning them individually would tear the pair apart.
      const pos = positions.get(id);
      const spinePartner = partnersOf(tree, id).find(
        (p) => onSpine(p) && positions.get(p)?.y === pos?.y
      );
      if (spinePartner) continue;
      const ps = orderedParents(tree, id).filter((p) => onSpine(p));
      if (ps.length >= 2) alignSpineToParents(id);
    }
  }

  function placeMarriedCoupleAt(
    leftP: PersonId,
    rightP: PersonId,
    cx: number,
    y: number
  ): void {
    if (onSpine(leftP) && onSpine(rightP)) {
      placeSpineCoupleAt(leftP, rightP, cx, y);
      return;
    }
    const wL = nodeW(leftP);
    const wR = nodeW(rightP);
    const totalW = wL + PARTNER_GAP + wR;
    const leftX = cx - totalW / 2;
    positions.set(leftP, { x: leftX, y });
    positions.set(rightP, { x: leftX + wL + PARTNER_GAP, y });
    placed.add(leftP);
    placed.add(rightP);
    registerRow(y, leftX, leftX + totalW);
  }

  /** Snap every marriage row back to the standard partner gap. */
  function ensureCouplesAdjacent(): void {
    const seen = new Set<string>();
    for (const ps of tree.partnerships) {
      const key = [ps.aId, ps.bId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = ps.aId;
      const b = ps.bId;
      if (!positions.has(a) || !positions.has(b)) continue;
      const posA = positions.get(a)!;
      const posB = positions.get(b)!;
      if (posA.y !== posB.y) continue;

      const { left, right } = coupleSlots(a, b);
      const leftPos = positions.get(left)!;
      const rightPos = positions.get(right)!;
      const wL = nodeW(left);
      const wR = nodeW(right);
      const gap = rightPos.x - (leftPos.x + wL);
      if (Math.abs(gap - PARTNER_GAP) <= 2) continue;

      // Anchor at the partner rooted in the ancestral line: a spouse married in
      // from a stray family must come to the sibling group, not drag the
      // sibling toward the stray family across the whole tree.
      const total = wL + PARTNER_GAP + wR;
      const leftRooted = spineParentCount(left) > 0;
      const rightRooted = spineParentCount(right) > 0;
      let cx: number;
      if (leftRooted && !rightRooted) {
        cx = leftPos.x + total / 2;
      } else if (rightRooted && !leftRooted) {
        cx = rightPos.x + wR - total / 2;
      } else {
        cx = (leftPos.x + wL / 2 + rightPos.x + wR / 2) / 2;
      }
      placeMarriedCoupleAt(left, right, cx, leftPos.y);
    }
  }

  /** Final safety pass: couples move as one block; blocks get pushed apart outward from the midline so nodes never overlap. */
  function resolveRowOverlaps(): void {
    const midline = nodeCenterX(proband);
    const rows = new Map<number, PersonId[]>();
    for (const id of ids) {
      const pos = positions.get(id);
      if (!pos) continue;
      const list = rows.get(pos.y) ?? [];
      list.push(id);
      rows.set(pos.y, list);
    }

    for (const rowIds of rows.values()) {
      const onRow = new Set(rowIds);
      const leader = new Map<PersonId, PersonId>(rowIds.map((id) => [id, id]));
      const find = (id: PersonId): PersonId => {
        let root = id;
        while (leader.get(root) !== root) root = leader.get(root)!;
        return root;
      };
      for (const ps of tree.partnerships) {
        if (!onRow.has(ps.aId) || !onRow.has(ps.bId)) continue;
        leader.set(find(ps.aId), find(ps.bId));
      }

      const groups = new Map<PersonId, PersonId[]>();
      for (const id of rowIds) {
        const root = find(id);
        const list = groups.get(root) ?? [];
        list.push(id);
        groups.set(root, list);
      }

      const blocks = [...groups.values()].map((members) => {
        // Re-pack marriage chains (e.g. one person with two spouses) tightly:
        // members keep their order but sit exactly PARTNER_GAP apart.
        if (members.length > 2) {
          members.sort((a, b) => positions.get(a)!.x - positions.get(b)!.x);
          let total = -PARTNER_GAP;
          for (const id of members) total += nodeW(id) + PARTNER_GAP;
          const oldCenter =
            (Math.min(...members.map((id) => positions.get(id)!.x)) +
              Math.max(...members.map((id) => positions.get(id)!.x + nodeW(id)))) /
            2;
          let cursor = oldCenter - total / 2;
          for (const id of members) {
            positions.get(id)!.x = cursor;
            cursor += nodeW(id) + PARTNER_GAP;
          }
        }
        let left = Infinity;
        let right = -Infinity;
        for (const id of members) {
          const pos = positions.get(id)!;
          left = Math.min(left, pos.x);
          right = Math.max(right, pos.x + nodeW(id));
        }
        return { members, left, right };
      });
      blocks.sort(
        (a, b) =>
          Math.abs((a.left + a.right) / 2 - midline) -
          Math.abs((b.left + b.right) / 2 - midline)
      );

      const fixed: Array<{ left: number; right: number }> = [];
      const collidesWith = (left: number, right: number) =>
        fixed.find((seg) => left < seg.right + ROW_MIN_GAP && right > seg.left - ROW_MIN_GAP);

      for (const block of blocks) {
        let left = block.left;
        let right = block.right;
        const dir = (left + right) / 2 < midline ? -1 : 1;
        let guard = 0;
        let hit = collidesWith(left, right);
        while (hit && guard++ < 128) {
          const dx =
            dir < 0 ? hit.left - ROW_MIN_GAP - right : hit.right + ROW_MIN_GAP - left;
          left += dx;
          right += dx;
          hit = collidesWith(left, right);
        }
        const dx = left - block.left;
        if (Math.abs(dx) > 0.01) {
          for (const id of block.members) {
            positions.get(id)!.x += dx;
          }
        }
        fixed.push({ left, right });
      }
    }
  }

  /** Move spine child (and descendants) to sit under their parent couple. */
  function alignSpineToParents(childId: PersonId): void {
    if (!onSpine(childId) || !positions.has(childId)) return;
    const ps = orderedParents(tree, childId).filter((p) => onSpine(p));
    if (ps.length === 0) return;
    const targetCx =
      ps.length >= 2
        ? (nodeCenterX(ps[0]!) + nodeCenterX(ps[1]!)) / 2
        : nodeCenterX(ps[0]!);
    const dx = targetCx - nodeCenterX(childId);
    if (Math.abs(dx) > 1) shiftColumn(childId, dx);
  }

  layoutSpineUp(proband, 0);
  if (!placed.has(proband)) {
    placeCouple(proband, 0, genY(generations.get(proband) ?? 0), true);
  }
  realignSpineRows();
  seedRowOccFromPositions();
  layoutAllCollateral();

  let strayCursor = 0;
  for (const id of ids) {
    const pos = positions.get(id);
    if (pos) strayCursor = Math.max(strayCursor, pos.x + nodeW(id));
  }
  strayCursor += FAMILY_GAP;
  for (const id of ids) {
    if (placed.has(id)) continue;
    const cw = coupleWidth(id);
    placeCouple(id, strayCursor + cw / 2, genY(generations.get(id) ?? 0));
    placeCollateralDescendants(id, nodeCenterX(id));
    strayCursor += cw + FAMILY_GAP;
  }

  seedRowOccFromPositions();
  alignSpineCouplesToParents();
  alignAllSpineChildren();
  ensureCouplesAdjacent();
  resolveRowOverlaps();

  const families: FamilyGroupLayout[] = [];
  for (const u of units.values()) {
    if (u.parents.length === 0) continue;
    const ps = u.parents.map((p) => positions.get(p)).filter(Boolean) as LayoutPosition[];
    if (ps.length === 0) continue;

    const spineChild = u.children.find((c) => onSpine(c));
    const onSpineFam =
      u.children.some((c) => onSpine(c)) && u.parents.some((p) => onSpine(p));

    const minPy = Math.min(...ps.map((p) => p.y));

    // Hub sits on the marriage bar — centered between parents, not at children centroid.
    let hubX: number;
    if (u.parents.length === 2) {
      hubX = (nodeCenterX(u.parents[0]!) + nodeCenterX(u.parents[1]!)) / 2;
    } else if (u.parents.length === 1) {
      hubX = nodeCenterX(u.parents[0]!);
    } else if (spineChild) {
      hubX = nodeCenterX(spineChild);
    } else if (u.children.length > 0) {
      let sum = 0;
      let n = 0;
      for (const c of u.children) {
        const cp = positions.get(c);
        if (!cp) continue;
        sum += cp.x + nodeW(c) / 2;
        n++;
      }
      hubX = n > 0 ? sum / n : 0;
    } else {
      hubX = nodeCenterX(u.parents[0]!);
    }

    const parentAnchorBottom = Math.max(
      ...u.parents.map((p) => (onSpine(p) ? NODE_ANCHOR_BOTTOM : COLLATERAL_ANCHOR_BOTTOM))
    );
    const g = Math.min(...u.parents.map((p) => generations.get(p) ?? 0));
    families.push({
      id: u.id,
      parents: u.parents,
      children: u.children,
      generation: g,
      x: hubX,
      y: minPy + parentAnchorBottom + MARRIAGE_BAR_DROP,
      onSpine: onSpineFam,
    });
  }

  const probandCenter = nodeCenterX(proband);
  let minY = Infinity;
  for (const p of positions.values()) {
    p.x -= probandCenter;
    if (p.y < minY) minY = p.y;
  }
  if (!isFinite(minY)) minY = 0;
  for (const p of positions.values()) {
    p.y -= minY;
  }
  for (const f of families) {
    f.x -= probandCenter;
    f.y -= minY;
  }

  return { positions, families, generations, spine, proband, branchSide };
}
