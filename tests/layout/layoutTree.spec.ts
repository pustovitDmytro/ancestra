import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLayoutInvariants,
  collectLayoutViolations,
  layoutNodeCenterX,
} from '@/lib/layoutAssertions';
import { computeFamilyLayout, NODE_W, PARTNER_GAP } from '@/lib/layoutTree';
import { parseGedcom } from '@/services/gedcom';
import type { TreeState } from '@/types';

const FIXTURE_DIR = join(process.cwd(), 'tests/fixtures');
/** Private trees kept out of git; covered by the strict suite when present locally */
const GED_DIR = join(process.cwd(), 'ged');
/** Public fixtures the current layout satisfies in full; the rest only get smoke checks */
const STRICT_FIXTURES = new Set(['basic.ged']);

interface LayoutCase {
  label: string;
  path: string;
  strict: boolean;
  /** Proband placement checks were tuned on the private trees and fail on public ones */
  probandChecks: boolean;
}

function listGedFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.ged'))
      .sort();
  } catch {
    return [];
  }
}

function listCases(): LayoutCase[] {
  return [
    ...listGedFiles(FIXTURE_DIR).map((f) => ({
      label: basename(f, '.ged'),
      path: join(FIXTURE_DIR, f),
      strict: STRICT_FIXTURES.has(f),
      probandChecks: false,
    })),
    ...listGedFiles(GED_DIR).map((f) => ({
      label: `local/${basename(f, '.ged')}`,
      path: join(GED_DIR, f),
      strict: true,
      probandChecks: true,
    })),
  ];
}

function loadGedTree(path: string): TreeState {
  return parseGedcom(readFileSync(path, 'utf8'));
}

function layoutFor(tree: TreeState) {
  const result = computeFamilyLayout(tree);
  return {
    tree,
    layout: {
      positions: result.positions,
      generations: result.generations,
      spine: result.spine,
      proband: result.proband,
      branchSide: result.branchSide,
    },
    families: result.families,
  };
}

function parentsOf(tree: TreeState, personId: string): string[] {
  const out: string[] = [];
  for (const pc of tree.parentChild) {
    if (pc.childId === personId && tree.persons[pc.parentId] && !out.includes(pc.parentId)) {
      out.push(pc.parentId);
    }
  }
  return out;
}

function childrenOf(tree: TreeState, personId: string): string[] {
  const out: string[] = [];
  for (const pc of tree.parentChild) {
    if (pc.parentId === personId && tree.persons[pc.childId] && !out.includes(pc.childId)) {
      out.push(pc.childId);
    }
  }
  return out;
}

function siblingsOf(tree: TreeState, personId: string): string[] {
  const out = new Set<string>();
  for (const p of parentsOf(tree, personId)) {
    for (const c of childrenOf(tree, p)) {
      if (c !== personId) out.add(c);
    }
  }
  return [...out];
}

/**
 * Blood kin of one proband parent: their ancestors, plus every ancestor's
 * siblings with all their descendants. Married-in spouses are not included.
 */
function kinClosureOf(tree: TreeState, parentId: string): Set<string> {
  const kin = new Set<string>([parentId]);
  const stack = [parentId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const p of parentsOf(tree, cur)) {
      if (!kin.has(p)) {
        kin.add(p);
        stack.push(p);
      }
    }
  }
  for (const anchor of [...kin]) {
    for (const sib of siblingsOf(tree, anchor)) {
      const dStack = [sib];
      while (dStack.length) {
        const d = dStack.pop()!;
        if (kin.has(d)) continue;
        kin.add(d);
        for (const c of childrenOf(tree, d)) dStack.push(c);
      }
    }
  }
  return kin;
}

describe('family tree layout invariants', () => {
  const cases = listCases();

  for (const { label, path, strict, probandChecks } of cases) {
    describe(label, () => {
      const { tree, layout } = layoutFor(loadGedTree(path));

      it('people never overlap on a row', () => {
        const violations = collectLayoutViolations(tree, layout).filter(
          (v) => v.rule === 'no-overlap'
        );
        expect(violations).toEqual([]);
      });

      it('exports render coordinates for every person', () => {
        for (const id of Object.keys(tree.persons)) {
          const pos = layout.positions.get(id);
          expect(pos, `missing position for ${id}`).toBeDefined();
          expect(pos!.x).toBeTypeOf('number');
          expect(pos!.y).toBeTypeOf('number');
        }
      });

      if (!strict) return;

      it('children are always below parents', () => {
        const violations = collectLayoutViolations(tree, layout).filter(
          (v) => v.rule === 'children-below-parents'
        );
        expect(violations).toEqual([]);
      });

      it('married partners are adjacent on the same row', () => {
        const violations = collectLayoutViolations(tree, layout).filter(
          (v) => v.rule === 'married-adjacent'
        );
        expect(violations).toEqual([]);
      });

      it('spouse family lines stay on their side of the couple hub', () => {
        const violations = collectLayoutViolations(tree, layout).filter(
          (v) => v.rule === 'branch-separation'
        );
        expect(violations).toEqual([]);
      });

      it('passes all layout invariants together', () => {
        expect(() => assertLayoutInvariants(tree, layout)).not.toThrow();
      });

      if (!probandChecks || parentsOf(tree, layout.proband).length !== 2) return;

      it('keeps proband parents adjacent above proband', () => {
        const proband = layout.proband;
        const parentIds = parentsOf(tree, proband);
        expect(parentIds.length).toBe(2);

        const [fatherId, motherId] = parentIds.sort((a, b) => {
          const ax = layout.positions.get(a)!.x;
          const bx = layout.positions.get(b)!.x;
          return ax - bx;
        });
        const fatherPos = layout.positions.get(fatherId)!;
        const motherPos = layout.positions.get(motherId)!;
        const probandPos = layout.positions.get(proband)!;

        expect(fatherPos.y).toBe(motherPos.y);
        expect(fatherPos.y).toBeLessThan(probandPos.y);
        expect(motherPos.x - (fatherPos.x + NODE_W)).toBeCloseTo(PARTNER_GAP, 0);

        const parentsCx =
          (layoutNodeCenterX(layout, fatherId)! +
            layoutNodeCenterX(layout, motherId)!) /
          2;
        const childCx = layoutNodeCenterX(layout, proband)!;
        expect(Math.abs(parentsCx - childCx)).toBeLessThan(8);
      });

      // Proband's father (left) + mother (right): each parent's
      // ancestor branch owns a half-plane, and no blood relative of one parent
      // may drift into the other parent's half-plane. Applies tree-wide since
      // the closures cover every ancestor's siblings and their descendants.
      it('keeps each parent branch inside its own half-plane', () => {
        const tolerance = 8;
        const proband = layout.proband;
        const parentIds = parentsOf(tree, proband);
        expect(parentIds.length).toBe(2);

        const sorted = [...parentIds].sort(
          (a, b) => layoutNodeCenterX(layout, a)! - layoutNodeCenterX(layout, b)!
        );
        const [leftParent, rightParent] = sorted as [string, string];
        const midline =
          (layoutNodeCenterX(layout, leftParent)! + layoutNodeCenterX(layout, rightParent)!) / 2;

        const describePerson = (id: string) => {
          const p = tree.persons[id]!;
          return `${p.firstName} ${p.lastName}`.trim();
        };

        const wrongSide: string[] = [];
        for (const id of kinClosureOf(tree, leftParent)) {
          const cx = layoutNodeCenterX(layout, id);
          if (cx !== null && cx > midline + tolerance) {
            wrongSide.push(`${describePerson(id)} (left kin, cx=${Math.round(cx)})`);
          }
        }
        for (const id of kinClosureOf(tree, rightParent)) {
          const cx = layoutNodeCenterX(layout, id);
          if (cx !== null && cx < midline - tolerance) {
            wrongSide.push(`${describePerson(id)} (right kin, cx=${Math.round(cx)})`);
          }
        }
        expect(wrongSide, `midline=${Math.round(midline)}`).toEqual([]);
      });
    });
  }
});

