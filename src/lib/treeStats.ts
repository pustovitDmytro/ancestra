import type { Person, TreeState } from '@/types';

export function isPersonDeceased(person: Person): boolean {
  return !!person.deathDate?.trim();
}

export interface TreeStats {
  total: number;
  living: number;
  deceased: number;
}

export function computeTreeStats(tree: TreeState): TreeStats {
  const people = Object.values(tree.persons);
  let deceased = 0;
  for (const person of people) {
    if (isPersonDeceased(person)) deceased++;
  }
  return {
    total: people.length,
    living: people.length - deceased,
    deceased,
  };
}
