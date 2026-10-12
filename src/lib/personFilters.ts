import { personDisplayName } from '@/lib/treeOps';
import type { Gender, Person } from '@/types';

export type GenderFilter = 'all' | Gender | 'unknown';
export type LifeFilter = 'all' | 'living' | 'deceased';
export type PhotoFilter = 'all' | 'yes' | 'no';
export type PeopleSort = 'name-asc' | 'name-desc' | 'birth-asc' | 'birth-desc';

export interface PeopleFilters {
  query: string;
  gender: GenderFilter;
  life: LifeFilter;
  photo: PhotoFilter;
  sort: PeopleSort;
}

export const defaultPeopleFilters = (): PeopleFilters => ({
  query: '',
  gender: 'all',
  life: 'all',
  photo: 'all',
  sort: 'name-asc',
});

/** First 3-4 digit year in a free-form or GEDCOM date */
export function dateYear(value?: string): string | null {
  return value?.match(/-?\d{3,4}/)?.[0] ?? null;
}

function extractYear(value?: string): number | null {
  const year = dateYear(value);
  return year === null ? null : Number(year);
}

export function personYearLine(person: Person): string {
  const b = dateYear(person.birthDate) ?? '';
  const d = dateYear(person.deathDate) ?? '';
  if (b && d) return `${b} – ${d}`;
  if (b) return b;
  if (d) return `– ${d}`;
  return '';
}

function matchesQuery(person: Person, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    person.firstName,
    person.lastName,
    personDisplayName(person),
    person.birthDate,
    person.deathDate,
    person.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function matchesGender(person: Person, gender: GenderFilter): boolean {
  if (gender === 'all') return true;
  if (gender === 'unknown') return !person.gender;
  return person.gender === gender;
}

function matchesLife(person: Person, life: LifeFilter): boolean {
  if (life === 'all') return true;
  if (life === 'living') return !person.deathDate?.trim();
  return !!person.deathDate?.trim();
}

function matchesPhoto(person: Person, photo: PhotoFilter): boolean {
  if (photo === 'all') return true;
  if (photo === 'yes') return !!person.photoDataUrl;
  return !person.photoDataUrl;
}

function comparePeople(a: Person, b: Person, sort: PeopleSort): number {
  if (sort === 'name-asc' || sort === 'name-desc') {
    const cmp = personDisplayName(a).localeCompare(personDisplayName(b), undefined, {
      sensitivity: 'base',
    });
    return sort === 'name-asc' ? cmp : -cmp;
  }

  const ay = extractYear(a.birthDate);
  const by = extractYear(b.birthDate);
  if (ay === null && by === null) {
    return personDisplayName(a).localeCompare(personDisplayName(b), undefined, {
      sensitivity: 'base',
    });
  }
  if (ay === null) return 1;
  if (by === null) return -1;
  const cmp = ay - by;
  return sort === 'birth-asc' ? cmp : -cmp;
}

export function filterAndSortPeople(persons: Person[], filters: PeopleFilters): Person[] {
  return persons
    .filter(
      (p) =>
        matchesQuery(p, filters.query) &&
        matchesGender(p, filters.gender) &&
        matchesLife(p, filters.life) &&
        matchesPhoto(p, filters.photo)
    )
    .sort((a, b) => comparePeople(a, b, filters.sort));
}
