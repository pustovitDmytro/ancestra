import { cloneTree, personDisplayName, syncPersonDateEventsOp } from '@/lib/treeOps';
import type { FamilyEvent, Person, PersonId, TreeState } from '@/types';

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Birth',
  DEAT: 'Death',
  MARR: 'Marriage',
  DIV: 'Divorce',
  BAPM: 'Baptism',
  CHR: 'Christening',
  BURI: 'Burial',
  CREM: 'Cremation',
  OCCU: 'Occupation',
  RESI: 'Residence',
  EVEN: 'Event',
  ENGA: 'Engagement',
  ADOP: 'Adoption',
  CONF: 'Confirmation',
  GRAD: 'Graduation',
  RETI: 'Retirement',
  EMIG: 'Emigration',
  IMMI: 'Immigration',
  CENS: 'Census',
  NATU: 'Naturalization',
  WILL: 'Will',
  PROB: 'Probate',
};

/** GEDCOM level-1 tags treated as life events */
export const GEDCOM_EVENT_TAGS = new Set([
  'ADOP',
  'BAPM',
  'BIRT',
  'BURI',
  'CAST',
  'CENS',
  'CHR',
  'CONF',
  'CREM',
  'DEAT',
  'DIV',
  'EDUC',
  'EMIG',
  'ENGA',
  'EVEN',
  'FCOM',
  'GRAD',
  'IMMI',
  'MARB',
  'MARC',
  'MARR',
  'NATU',
  'OCCU',
  'ORDN',
  'PROB',
  'RELI',
  'RESI',
  'RETI',
  'WILL',
]);

export function isGedcomEventTag(tag: string): boolean {
  return GEDCOM_EVENT_TAGS.has(tag);
}

export function eventTagLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export function eventTypeLabel(event: Pick<FamilyEvent, 'type' | 'description'>): string {
  if (event.type === 'EVEN' && event.description) return event.description;
  if (event.type === 'OCCU' && event.description) {
    return event.description;
  }
  return eventTagLabel(event.type);
}

/** Numeric sort key: YYYYMMDD; undated events sort last */
export function gedcomDateSortKey(date?: string): number {
  if (!date?.trim()) return Number.POSITIVE_INFINITY;

  const upper = date.toUpperCase();
  const yearMatch = upper.match(/\b(\d{3,4})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : 0;

  let month = 0;
  for (const [abbr, num] of Object.entries(MONTHS)) {
    if (upper.includes(abbr)) {
      month = num;
      break;
    }
  }

  let day = 0;
  if (month > 0) {
    const dayMatch = upper.match(/\b(\d{1,2})\s+[A-Z]{3}\b/);
    if (dayMatch) day = Number(dayMatch[1]);
  }

  return year * 10_000 + month * 100 + day;
}

export function eventYear(date?: string): string | null {
  if (!date?.trim()) return null;
  const m = date.match(/\b(\d{3,4})\b/);
  return m ? m[1] : null;
}

export function hasEventDate(date?: string): boolean {
  return eventYear(date) !== null;
}

export function formatEventPeople(
  personIds: PersonId[],
  persons: Record<PersonId, Person>
): string {
  const names = personIds
    .map((id) => persons[id])
    .filter(Boolean)
    .map((p) => personDisplayName(p));
  if (names.length === 0) return 'Unknown';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function backfillPersonEvents(tree: TreeState): FamilyEvent[] {
  const events: FamilyEvent[] = [];
  for (const person of Object.values(tree.persons)) {
    if (person.birthDate && hasEventDate(person.birthDate)) {
      events.push({
        id: `legacy-birt-${person.id}`,
        type: 'BIRT',
        date: person.birthDate,
        personIds: [person.id],
      });
    }
    if (person.deathDate && hasEventDate(person.deathDate)) {
      events.push({
        id: `legacy-deat-${person.id}`,
        type: 'DEAT',
        date: person.deathDate,
        personIds: [person.id],
      });
    }
  }
  return events;
}

/** Populate events from person dates when a tree predates event storage */
export function ensureTreeEvents(tree: TreeState): TreeState {
  if (!tree.events?.length) return { ...tree, events: backfillPersonEvents(tree) };
  // Trees saved before date edits were mirrored into events can hold stale BIRT/DEAT.
  const next = cloneTree(tree);
  for (const id of Object.keys(next.persons)) syncPersonDateEventsOp(next, id, { repairOnly: true });
  return next;
}

export function collectTimelineEvents(tree: TreeState): FamilyEvent[] {
  const source = tree.events?.length ? tree.events : backfillPersonEvents(tree);
  return source
    .filter((event) => hasEventDate(event.date))
    .slice()
    .sort((a, b) => {
      const ka = gedcomDateSortKey(a.date);
      const kb = gedcomDateSortKey(b.date);
      if (ka !== kb) return ka - kb;
      return eventTypeLabel(a).localeCompare(eventTypeLabel(b), undefined, { sensitivity: 'base' });
    });
}

export function treeNeedsGedcomReimport(tree: TreeState): boolean {
  const stored = tree.events ?? [];
  const fromGedcom = Object.values(tree.persons).some((p) =>
    p.notes?.includes('Imported from GEDCOM')
  );
  if (!fromGedcom || tree.partnerships.length === 0) return false;
  if (stored.length === 0) return true;
  return stored.every((event) => event.id.startsWith('legacy-'));
}

export type EventYearGroup = {
  year: string | null;
  events: FamilyEvent[];
};

export function groupEventsByYear(events: FamilyEvent[]): EventYearGroup[] {
  const groups: EventYearGroup[] = [];
  for (const event of events) {
    const year = eventYear(event.date);
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.events.push(event);
    } else {
      groups.push({ year, events: [event] });
    }
  }
  return groups;
}
