import { createId } from '@/lib/id';
import type { Person, PersonId, TreeState } from '@/types';
import { emptyTree } from '@/types';

export function cloneTree(t: TreeState): TreeState {
  return structuredClone(t);
}

export function addPersonOp(
  tree: TreeState,
  partial: Partial<Omit<Person, 'id'>> & Pick<Person, 'firstName' | 'lastName'>
): PersonId {
  const id = createId('p');
  tree.persons[id] = {
    id,
    firstName: partial.firstName,
    lastName: partial.lastName,
    birthDate: partial.birthDate,
    deathDate: partial.deathDate,
    notes: partial.notes,
    gender: partial.gender,
    photoDataUrl: partial.photoDataUrl,
  };
  return id;
}

export function removePersonOp(tree: TreeState, id: PersonId): void {
  delete tree.persons[id];
  tree.parentChild = tree.parentChild.filter((l) => l.parentId !== id && l.childId !== id);
  tree.partnerships = tree.partnerships.filter((p) => p.aId !== id && p.bId !== id);
  tree.events = (tree.events ?? [])
    .map((event) => ({
      ...event,
      personIds: event.personIds.filter((pid) => pid !== id),
    }))
    .filter((event) => event.personIds.length > 0);
}

export function addParentChildOp(tree: TreeState, parentId: PersonId, childId: PersonId): void {
  if (parentId === childId) return;
  if (!tree.persons[parentId] || !tree.persons[childId]) return;
  const exists = tree.parentChild.some(
    (l) => l.parentId === parentId && l.childId === childId
  );
  if (exists) return;
  tree.parentChild.push({
    id: createId('pc'),
    parentId,
    childId,
  });
}

export function removeParentChildOp(tree: TreeState, linkId: string): void {
  tree.parentChild = tree.parentChild.filter((l) => l.id !== linkId);
}

export function addPartnershipOp(tree: TreeState, aId: PersonId, bId: PersonId): void {
  if (aId === bId) return;
  if (!tree.persons[aId] || !tree.persons[bId]) return;
  const exists = tree.partnerships.some(
    (p) => (p.aId === aId && p.bId === bId) || (p.aId === bId && p.bId === aId)
  );
  if (exists) return;
  tree.partnerships.push({ id: createId('ps'), aId, bId });
}

export function removePartnershipOp(tree: TreeState, linkId: string): void {
  tree.partnerships = tree.partnerships.filter((p) => p.id !== linkId);
}

export function personDisplayName(p: Person): string {
  const t = `${p.firstName} ${p.lastName}`.trim();
  return t || 'Unnamed';
}

export function isTreeEmpty(t: TreeState): boolean {
  return Object.keys(t.persons).length === 0;
}

export function computeLineage(tree: TreeState, rootId: PersonId): Set<PersonId> {
  const lineage = new Set<PersonId>();
  if (!tree.persons[rootId]) return lineage;
  lineage.add(rootId);
  const parentsOf = new Map<PersonId, PersonId[]>();
  const childrenOf = new Map<PersonId, PersonId[]>();
  for (const rel of tree.parentChild) {
    const ps = parentsOf.get(rel.childId) ?? [];
    ps.push(rel.parentId);
    parentsOf.set(rel.childId, ps);
    const cs = childrenOf.get(rel.parentId) ?? [];
    cs.push(rel.childId);
    childrenOf.set(rel.parentId, cs);
  }
  const upQueue = [rootId];
  while (upQueue.length) {
    const cur = upQueue.shift() as PersonId;
    for (const p of parentsOf.get(cur) ?? []) {
      if (!lineage.has(p)) {
        lineage.add(p);
        upQueue.push(p);
      }
    }
  }
  const downQueue = [rootId];
  while (downQueue.length) {
    const cur = downQueue.shift() as PersonId;
    for (const c of childrenOf.get(cur) ?? []) {
      if (!lineage.has(c)) {
        lineage.add(c);
        downQueue.push(c);
      }
    }
  }
  return lineage;
}

export function filterTreeToIds(tree: TreeState, ids: Set<PersonId>): TreeState {
  if (ids.size === 0) return emptyTree();
  const next = emptyTree();
  for (const id of ids) {
    const p = tree.persons[id];
    if (p) next.persons[id] = p;
  }
  next.parentChild = tree.parentChild.filter(
    (l) => ids.has(l.parentId) && ids.has(l.childId)
  );
  next.partnerships = tree.partnerships.filter(
    (l) => ids.has(l.aId) && ids.has(l.bId)
  );
  next.events = (tree.events ?? []).filter((event) =>
    event.personIds.every((pid) => ids.has(pid))
  );
  return next;
}

const ROMAN_TABLE: Array<[string, number]> = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
  ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
  ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  let value = Math.floor(n);
  let out = '';
  for (const [glyph, weight] of ROMAN_TABLE) {
    while (value >= weight) {
      out += glyph;
      value -= weight;
    }
  }
  return out;
}
