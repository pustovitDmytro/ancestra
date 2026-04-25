import { createId } from '@/lib/id';
import type { Person, PersonId, TreeState } from '@/types';

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
    photoDataUrl: partial.photoDataUrl,
  };
  return id;
}

export function removePersonOp(tree: TreeState, id: PersonId): void {
  delete tree.persons[id];
  tree.parentChild = tree.parentChild.filter((l) => l.parentId !== id && l.childId !== id);
  tree.partnerships = tree.partnerships.filter((p) => p.aId !== id && p.bId !== id);
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
