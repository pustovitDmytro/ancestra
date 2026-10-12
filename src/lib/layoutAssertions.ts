import {
  COLLATERAL_NODE_W,
  NODE_W,
  PARTNER_GAP,
  type BranchSide,
  type LayoutPosition,
} from '@/lib/layoutTree';
import type { PersonId, TreeState } from '@/types';

export interface LayoutResult {
  positions: Map<PersonId, LayoutPosition>;
  generations: Map<PersonId, number>;
  spine: Set<PersonId>;
  proband: PersonId;
  branchSide: Map<PersonId, BranchSide>;
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

function parentsOf(tree: TreeState, personId: PersonId): PersonId[] {
  const out: PersonId[] = [];
  for (const pc of tree.parentChild) {
    if (pc.childId === personId && tree.persons[pc.parentId] && !out.includes(pc.parentId)) {
      out.push(pc.parentId);
    }
  }
  return out;
}

function nodeW(personId: PersonId, layout: LayoutResult): number {
  return layout.spine.has(personId) ? NODE_W : COLLATERAL_NODE_W;
}

export function layoutNodeCenterX(layout: LayoutResult, personId: PersonId): number | null {
  const pos = layout.positions.get(personId);
  if (!pos) return null;
  return pos.x + nodeW(personId, layout) / 2;
}

function coupleSlotsByPosition(layout: LayoutResult, a: PersonId, b: PersonId): { left: PersonId; right: PersonId } {
  const posA = layout.positions.get(a);
  const posB = layout.positions.get(b);
  if (!posA || !posB) return { left: a, right: b };
  return posA.x <= posB.x ? { left: a, right: b } : { left: b, right: a };
}

function hasSinglePartner(tree: TreeState, personId: PersonId): boolean {
  return partnersOf(tree, personId).length === 1;
}

function childrenOfParents(tree: TreeState, parentIds: PersonId[]): PersonId[] {
  const parents = new Set(parentIds);
  const out: PersonId[] = [];
  for (const pc of tree.parentChild) {
    if (parents.has(pc.parentId) && tree.persons[pc.childId] && !out.includes(pc.childId)) {
      out.push(pc.childId);
    }
  }
  return out;
}

export type LayoutViolation =
  | { rule: 'children-below-parents'; parentId: PersonId; childId: PersonId; detail: string }
  | { rule: 'married-adjacent'; aId: PersonId; bId: PersonId; detail: string }
  | { rule: 'branch-separation'; coupleA: PersonId; coupleB: PersonId; personId: PersonId; detail: string }
  | { rule: 'no-overlap'; aId: PersonId; bId: PersonId; detail: string };

export function collectLayoutViolations(tree: TreeState, layout: LayoutResult): LayoutViolation[] {
  const violations: LayoutViolation[] = [];
  const gapTolerance = 3;

  for (const { parentId, childId } of tree.parentChild) {
    if (!tree.persons[parentId] || !tree.persons[childId]) continue;
    const parentPos = layout.positions.get(parentId);
    const childPos = layout.positions.get(childId);
    if (!parentPos || !childPos) continue;

    const parentGen = layout.generations.get(parentId) ?? 0;
    const childGen = layout.generations.get(childId) ?? 0;
    if (childGen <= parentGen) {
      violations.push({
        rule: 'children-below-parents',
        parentId,
        childId,
        detail: `generation ${childGen} should be > ${parentGen}`,
      });
    }
    if (childPos.y <= parentPos.y) {
      violations.push({
        rule: 'children-below-parents',
        parentId,
        childId,
        detail: `y=${childPos.y} should be > parent y=${parentPos.y}`,
      });
    }
  }

  const seenCouples = new Set<string>();
  for (const ps of tree.partnerships) {
    const key = [ps.aId, ps.bId].sort().join('|');
    if (seenCouples.has(key)) continue;
    seenCouples.add(key);

    const a = ps.aId;
    const b = ps.bId;
    const posA = layout.positions.get(a);
    const posB = layout.positions.get(b);
    if (!posA || !posB) continue;

    if (posA.y !== posB.y) {
      violations.push({
        rule: 'married-adjacent',
        aId: a,
        bId: b,
        detail: `partners on different rows (y=${posA.y} vs y=${posB.y})`,
      });
      continue;
    }

    if (!hasSinglePartner(tree, a) || !hasSinglePartner(tree, b)) continue;

    const { left, right } = coupleSlotsByPosition(layout, a, b);
    const leftPos = layout.positions.get(left)!;
    const rightPos = layout.positions.get(right)!;
    const wL = nodeW(left, layout);
    const gap = rightPos.x - (leftPos.x + wL);
    if (Math.abs(gap - PARTNER_GAP) > gapTolerance) {
      violations.push({
        rule: 'married-adjacent',
        aId: a,
        bId: b,
        detail: `partner gap ${gap}px, expected ${PARTNER_GAP}px`,
      });
    }
  }

  const probandParents = parentsOf(tree, layout.proband).filter((p) => layout.spine.has(p));
  if (probandParents.length >= 2) {
    const [leftParent, rightParent] = [...probandParents].sort((a, b) => {
      const ax = layout.positions.get(a)?.x ?? 0;
      const bx = layout.positions.get(b)?.x ?? 0;
      return ax - bx;
    });
    const leftLimit = layoutNodeCenterX(layout, leftParent!);
    const rightLimit = layoutNodeCenterX(layout, rightParent!);

    if (leftLimit !== null && rightLimit !== null) {
      for (const personId of layout.spine) {
        const side = layout.branchSide.get(personId);
        const cx = layoutNodeCenterX(layout, personId);
        if (cx === null) continue;
        if (side === 'left' && cx > leftLimit + gapTolerance) {
          violations.push({
            rule: 'branch-separation',
            coupleA: leftParent!,
            coupleB: rightParent!,
            personId,
            detail: `left branch center ${cx} crosses right of left-parent column ${leftLimit}`,
          });
        }
        if (side === 'right' && cx < rightLimit - gapTolerance) {
          violations.push({
            rule: 'branch-separation',
            coupleA: leftParent!,
            coupleB: rightParent!,
            personId,
            detail: `right branch center ${cx} crosses left of right-parent column ${rightLimit}`,
          });
        }
      }

      // Half-plane rule for the whole tree: anyone assigned to a parent's
      // branch (incl. collateral kin) must stay on that side of the midline
      // between the proband's parents.
      const midline = (leftLimit + rightLimit) / 2;
      for (const personId of Object.keys(tree.persons)) {
        const side = layout.branchSide.get(personId);
        if (side !== 'left' && side !== 'right') continue;
        const cx = layoutNodeCenterX(layout, personId);
        if (cx === null) continue;
        if (side === 'left' && cx > midline + gapTolerance) {
          violations.push({
            rule: 'branch-separation',
            coupleA: leftParent!,
            coupleB: rightParent!,
            personId,
            detail: `left-branch relative at ${Math.round(cx)} crosses into the right half-plane (midline ${Math.round(midline)})`,
          });
        }
        if (side === 'right' && cx < midline - gapTolerance) {
          violations.push({
            rule: 'branch-separation',
            coupleA: leftParent!,
            coupleB: rightParent!,
            personId,
            detail: `right-branch relative at ${Math.round(cx)} crosses into the left half-plane (midline ${Math.round(midline)})`,
          });
        }
      }
    }
  }

  // Ancestor strips, tree-wide: for every spine couple the two ancestor
  // subtrees own disjoint vertical strips — every spine ancestor of the left
  // partner stays left of every spine ancestor of the right partner.
  const spineAncestorsOf = (personId: PersonId): PersonId[] => {
    const out: PersonId[] = [];
    const seen = new Set<PersonId>();
    const stack = [...parentsOf(tree, personId)];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (layout.spine.has(cur) && layout.positions.has(cur)) out.push(cur);
      for (const p of parentsOf(tree, cur)) stack.push(p);
    }
    return out;
  };
  const stripTolerance = 8;
  for (const ps of tree.partnerships) {
    const a = ps.aId;
    const b = ps.bId;
    if (!layout.spine.has(a) || !layout.spine.has(b)) continue;
    const posA = layout.positions.get(a);
    const posB = layout.positions.get(b);
    if (!posA || !posB || posA.y !== posB.y) continue;

    const { left, right } = coupleSlotsByPosition(layout, a, b);
    let maxLeft: { id: PersonId; cx: number } | null = null;
    for (const anc of spineAncestorsOf(left)) {
      const cx = layoutNodeCenterX(layout, anc)!;
      if (!maxLeft || cx > maxLeft.cx) maxLeft = { id: anc, cx };
    }
    let minRight: { id: PersonId; cx: number } | null = null;
    for (const anc of spineAncestorsOf(right)) {
      const cx = layoutNodeCenterX(layout, anc)!;
      if (!minRight || cx < minRight.cx) minRight = { id: anc, cx };
    }
    if (maxLeft && minRight && maxLeft.cx > minRight.cx + stripTolerance) {
      violations.push({
        rule: 'branch-separation',
        coupleA: left,
        coupleB: right,
        personId: minRight.id,
        detail: `ancestor strips overlap: right partner's ancestor at ${Math.round(minRight.cx)} is left of left partner's ancestor at ${Math.round(maxLeft.cx)}`,
      });
    }
  }

  // Per spine couple, the husband's and wife's family lines must not cross:
  // parent hubs keep the same left/right order as the partners themselves,
  // and each partner's siblings fan outward away from the spouse.
  const sideTolerance = 8;
  for (const ps of tree.partnerships) {
    const a = ps.aId;
    const b = ps.bId;
    if (!layout.spine.has(a) || !layout.spine.has(b)) continue;
    const posA = layout.positions.get(a);
    const posB = layout.positions.get(b);
    if (!posA || !posB || posA.y !== posB.y) continue;

    const { left, right } = coupleSlotsByPosition(layout, a, b);
    const leftCx = layoutNodeCenterX(layout, left);
    const rightCx = layoutNodeCenterX(layout, right);
    if (leftCx === null || rightCx === null) continue;

    const hubOf = (partner: PersonId): number | null => {
      const parents = parentsOf(tree, partner).filter((p) => layout.positions.get(p));
      if (parents.length === 0) return null;
      let hub = 0;
      for (const p of parents) hub += layoutNodeCenterX(layout, p)!;
      return hub / parents.length;
    };

    const hubL = hubOf(left);
    const hubR = hubOf(right);
    if (hubL !== null && hubR !== null && hubL > hubR + sideTolerance) {
      violations.push({
        rule: 'branch-separation',
        coupleA: left,
        coupleB: right,
        personId: left,
        detail: `left partner's parents hub ${Math.round(hubL)} is right of right partner's parents hub ${Math.round(hubR)} — family lines cross`,
      });
    }

    const checkSiblings = (partner: PersonId, sign: 1 | -1, edge: number): void => {
      const parents = parentsOf(tree, partner).filter((p) => layout.positions.get(p));
      for (const sib of childrenOfParents(tree, parents)) {
        if (sib === left || sib === right) continue;
        const cx = layoutNodeCenterX(layout, sib);
        if (cx === null) continue;
        if (sign * (cx - edge) > sideTolerance) {
          violations.push({
            rule: 'branch-separation',
            coupleA: left,
            coupleB: right,
            personId: sib,
            detail: `sibling of ${sign === 1 ? 'left' : 'right'} partner at ${Math.round(cx)} crosses over the spouse (couple edge ${Math.round(edge)})`,
          });
        }
      }
    };

    checkSiblings(left, 1, leftCx);
    checkSiblings(right, -1, rightCx);
  }

  // No two people on the same row may overlap horizontally.
  const byRow = new Map<number, PersonId[]>();
  for (const id of Object.keys(tree.persons)) {
    const pos = layout.positions.get(id);
    if (!pos) continue;
    const list = byRow.get(pos.y) ?? [];
    list.push(id);
    byRow.set(pos.y, list);
  }
  const overlapTolerance = 0.5;
  for (const rowIds of byRow.values()) {
    const sorted = [...rowIds].sort(
      (a, b) => layout.positions.get(a)!.x - layout.positions.get(b)!.x
    );
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      const aPos = layout.positions.get(a)!;
      const aRight = aPos.x + nodeW(a, layout);
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        const bPos = layout.positions.get(b)!;
        if (bPos.x >= aRight - overlapTolerance) break;
        violations.push({
          rule: 'no-overlap',
          aId: a,
          bId: b,
          detail: `nodes intersect by ${Math.round(aRight - bPos.x)}px on row y=${aPos.y}`,
        });
      }
    }
  }

  return violations;
}

export function formatLayoutViolation(v: LayoutViolation, tree: TreeState): string {
  const name = (id: PersonId) => {
    const p = tree.persons[id];
    return p ? `${p.firstName} ${p.lastName}`.trim() || id : id;
  };
  switch (v.rule) {
    case 'children-below-parents':
      return `[children-below-parents] ${name(v.childId)} under ${name(v.parentId)}: ${v.detail}`;
    case 'married-adjacent':
      return `[married-adjacent] ${name(v.aId)} + ${name(v.bId)}: ${v.detail}`;
    case 'branch-separation':
      return `[branch-separation] ${name(v.personId)} (${name(v.coupleA)} + ${name(v.coupleB)}): ${v.detail}`;
    case 'no-overlap':
      return `[no-overlap] ${name(v.aId)} overlaps ${name(v.bId)}: ${v.detail}`;
  }
}

export function assertLayoutInvariants(tree: TreeState, layout: LayoutResult): void {
  const violations = collectLayoutViolations(tree, layout);
  if (violations.length === 0) return;
  const lines = violations.map((v) => formatLayoutViolation(v, tree));
  throw new Error(`Layout invariant violations (${violations.length}):\n${lines.join('\n')}`);
}
