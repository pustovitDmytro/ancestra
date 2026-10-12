/**
 * Minimal GEDCOM 5.5 subset parser and exporter.
 */

import { createId } from '@/lib/id';
import { isGedcomEventTag } from '@/lib/familyEvents';
import type { FamilyEvent, Person, TreeState } from '@/types';
import { emptyTree } from '@/types';

interface GedLine {
  level: number;
  tag: string;
  value: string;
  pointer?: string;
}

type ParsedEvent = {
  type: string;
  date?: string;
  place?: string;
  description?: string;
};

/** GEDCOM: `0 @I1@ INDI` or `1 NAME John /Doe/` */
function parseLine(raw: string): GedLine | null {
  const line = raw.replace(/\r$/, '').trimEnd();
  if (!line) return null;
  const m = line.match(/^(\d+)\s+(.*)$/);
  if (!m) return null;
  const level = Number(m[1]);
  let rest = m[2].trim();
  let pointer: string | undefined;
  if (rest.startsWith('@')) {
    const end = rest.indexOf('@', 1);
    if (end === -1) return null;
    pointer = rest.slice(0, end + 1);
    rest = rest.slice(end + 1).trim();
  }
  const sp = rest.search(/\s/);
  const tag = sp === -1 ? rest : rest.slice(0, sp);
  const value = sp === -1 ? '' : rest.slice(sp + 1).trim();
  return { level, tag, value, pointer };
}

function parseName(value: string): { first: string; last: string } {
  const m = value.match(/^([^/]*)\s*\/([^/]*)\/\s*(.*)$/);
  if (m) {
    return {
      first: m[1].trim(),
      last: (m[3]?.trim() || m[2].trim()) ?? '',
    };
  }
  const bits = value.trim().split(/\s+/);
  if (bits.length <= 1) return { first: bits[0] ?? '', last: '' };
  return { first: bits.slice(0, -1).join(' '), last: bits[bits.length - 1] ?? '' };
}

type IndiBlock = {
  xref: string;
  name?: string;
  birth?: string;
  death?: string;
  sex?: string;
  famc?: string;
  fams: string[];
  events: ParsedEvent[];
};

type FamBlock = {
  xref: string;
  husband?: string;
  wife?: string;
  children: string[];
  events: ParsedEvent[];
};

function applyEventField(event: ParsedEvent, tag: string, value: string): void {
  if (tag === 'DATE') event.date = value;
  else if (tag === 'PLAC') event.place = value;
  else if (tag === 'TYPE') event.description = value;
}

function readBlocks(lines: GedLine[]): { indi: IndiBlock[]; fam: FamBlock[] } {
  const indi: IndiBlock[] = [];
  const fam: FamBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (L.level !== 0) {
      i++;
      continue;
    }
    if (L.tag === 'INDI' && L.pointer) {
      const block: IndiBlock = { xref: L.pointer, fams: [], events: [] };
      i++;
      let pending: ParsedEvent | null = null;
      while (i < lines.length && lines[i].level > 0) {
        const ln = lines[i];
        if (ln.level === 1) {
          if (ln.tag === 'NAME') block.name = ln.value;
          else if (ln.tag === 'SEX') block.sex = ln.value;
          else if (ln.tag === 'FAMC' && ln.value.startsWith('@')) block.famc = ln.value;
          else if (ln.tag === 'FAMS' && ln.value.startsWith('@')) block.fams.push(ln.value);
          else if (isGedcomEventTag(ln.tag)) {
            const raw = ln.value?.trim();
            pending = {
              type: ln.tag,
              description:
                raw && raw !== 'Y' && raw !== 'N' ? raw : undefined,
            };
            block.events.push(pending);
            if (ln.tag === 'BIRT') block.birth = pending.date;
            else if (ln.tag === 'DEAT') block.death = pending.date;
          } else {
            pending = null;
          }
        } else if (pending && ln.level === 2) {
          applyEventField(pending, ln.tag, ln.value);
          if (pending.type === 'BIRT') block.birth = pending.date;
          else if (pending.type === 'DEAT') block.death = pending.date;
        }
        i++;
      }
      indi.push(block);
      continue;
    }
    if (L.tag === 'FAM' && L.pointer) {
      const block: FamBlock = { xref: L.pointer, children: [], events: [] };
      i++;
      let pending: ParsedEvent | null = null;
      while (i < lines.length && lines[i].level > 0) {
        const ln = lines[i];
        if (ln.level === 1) {
          if (ln.tag === 'HUSB' && ln.value.startsWith('@')) block.husband = ln.value;
          else if (ln.tag === 'WIFE' && ln.value.startsWith('@')) block.wife = ln.value;
          else if (ln.tag === 'CHIL' && ln.value.startsWith('@')) block.children.push(ln.value);
          else if (isGedcomEventTag(ln.tag)) {
            const raw = ln.value?.trim();
            pending = {
              type: ln.tag,
              description:
                raw && raw !== 'Y' && raw !== 'N' ? raw : undefined,
            };
            block.events.push(pending);
          } else {
            pending = null;
          }
        } else if (pending && ln.level === 2) {
          applyEventField(pending, ln.tag, ln.value);
        }
        i++;
      }
      fam.push(block);
      continue;
    }
    i++;
  }
  return { indi, fam };
}

function xrefKey(x: string): string {
  return x.replace(/^@|@$/g, '');
}

export function parseGedcom(text: string): TreeState {
  const rawLines = text.split(/\n/);
  const lines: GedLine[] = [];
  for (const r of rawLines) {
    const p = parseLine(r);
    if (p) lines.push(p);
  }
  const { indi, fam } = readBlocks(lines);

  const tree = emptyTree();
  const xrefToId = new Map<string, string>();

  for (const ib of indi) {
    const k = xrefKey(ib.xref);
    const id = createId('p');
    xrefToId.set(k, id);
    const { first, last } = ib.name ? parseName(ib.name) : { first: '', last: '' };
    const sex = ib.sex?.trim().toUpperCase();
    const person: Person = {
      id,
      firstName: first,
      lastName: last,
      birthDate: ib.birth,
      deathDate: ib.death,
      gender: sex === 'M' ? 'male' : sex === 'F' ? 'female' : undefined,
      notes: `Imported from GEDCOM (${k})`,
    };
    tree.persons[id] = person;
  }

  for (const fb of fam) {
    const hk = fb.husband ? xrefKey(fb.husband) : '';
    const wk = fb.wife ? xrefKey(fb.wife) : '';
    const hid = hk ? xrefToId.get(hk) : undefined;
    const wid = wk ? xrefToId.get(wk) : undefined;
    if (hid && wid) {
      const exists = tree.partnerships.some(
        (p) =>
          (p.aId === hid && p.bId === wid) || (p.aId === wid && p.bId === hid)
      );
      if (!exists) {
        tree.partnerships.push({ id: createId('ps'), aId: hid, bId: wid });
      }
    }
    for (const ch of fb.children) {
      const ck = xrefKey(ch);
      const cid = xrefToId.get(ck);
      if (!cid) continue;
      for (const pid of [hid, wid]) {
        if (!pid) continue;
        const exists = tree.parentChild.some(
          (l) => l.parentId === pid && l.childId === cid
        );
        if (!exists) {
          tree.parentChild.push({ id: createId('pc'), parentId: pid, childId: cid });
        }
      }
    }
  }

  for (const ib of indi) {
    if (!ib.famc) continue;
    const ck = xrefKey(ib.xref);
    const cid = xrefToId.get(ck);
    const fk = xrefKey(ib.famc);
    const famBlock = fam.find((f) => xrefKey(f.xref) === fk);
    if (!cid || !famBlock) continue;
    for (const parentXref of [famBlock.husband, famBlock.wife]) {
      if (!parentXref) continue;
      const pk = xrefKey(parentXref);
      const pid = xrefToId.get(pk);
      if (!pid) continue;
      const exists = tree.parentChild.some(
        (l) => l.parentId === pid && l.childId === cid
      );
      if (!exists) {
        tree.parentChild.push({ id: createId('pc'), parentId: pid, childId: cid });
      }
    }
  }

  for (const ib of indi) {
    const pid = xrefToId.get(xrefKey(ib.xref));
    if (!pid) continue;
    for (const ev of ib.events) {
      tree.events.push({
        id: createId('ev'),
        type: ev.type,
        date: ev.date,
        place: ev.place,
        description: ev.description,
        personIds: [pid],
      });
    }
  }

  for (const fb of fam) {
    const personIds: string[] = [];
    if (fb.husband) {
      const id = xrefToId.get(xrefKey(fb.husband));
      if (id) personIds.push(id);
    }
    if (fb.wife) {
      const id = xrefToId.get(xrefKey(fb.wife));
      if (id) personIds.push(id);
    }
    for (const ev of fb.events) {
      tree.events.push({
        id: createId('ev'),
        type: ev.type,
        date: ev.date,
        place: ev.place,
        description: ev.description,
        personIds,
      });
    }
  }

  return tree;
}

let gedcomSerial = 1;
function nextIndiXref(): string {
  return `@I${gedcomSerial++}@`;
}
function nextFamXref(): string {
  return `@F${gedcomSerial++}@`;
}

/** Tags that only make sense on a FAM record */
const FAMILY_EVENT_TAGS = new Set(['ANUL', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARR']);
/** Tags whose level-1 value is the event's descriptor rather than `Y` */
const VALUE_EVENT_TAGS = new Set(['CAST', 'EDUC', 'OCCU', 'RELI']);

function eventLines(event: FamilyEvent): string[] {
  const valued = VALUE_EVENT_TAGS.has(event.type);
  const empty = !event.date && !event.place && !event.description;
  const value = valued ? (event.description ?? '') : empty ? 'Y' : '';
  const out = [`1 ${event.type}${value ? ` ${value}` : ''}`];
  if (!valued && event.description) out.push(`2 TYPE ${event.description}`);
  if (event.date) out.push(`2 DATE ${event.date}`);
  if (event.place) out.push(`2 PLAC ${event.place}`);
  return out;
}

/** Export TreeState to a basic, valid GEDCOM file */
export function exportGedcom(tree: TreeState): string {
  gedcomSerial = 1;
  const idToXref = new Map<string, string>();
  for (const id of Object.keys(tree.persons)) {
    idToXref.set(id, nextIndiXref());
  }

  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const famLines = new Map<string, string[]>();
  const famXrefByPair = new Map<string, string>();
  const parentFam = new Map<string, string>();

  const openFam = (parentIds: string[]): string => {
    const fx = nextFamXref();
    const lines: string[] = [];
    const [a, b] = parentIds.map((id) => idToXref.get(id));
    if (a) lines.push(`1 HUSB ${a}`);
    if (b) lines.push(`1 WIFE ${b}`);
    famLines.set(fx, lines);
    return fx;
  };

  for (const pr of tree.partnerships) {
    const fx = openFam([pr.aId, pr.bId]);
    famXrefByPair.set(pairKey(pr.aId, pr.bId), fx);
    parentFam.set(pr.aId, fx);
    parentFam.set(pr.bId, fx);
  }

  const chilSeen = new Set<string>();
  for (const pc of tree.parentChild) {
    let fx = parentFam.get(pc.parentId);
    if (!fx) {
      fx = openFam([pc.parentId]);
      parentFam.set(pc.parentId, fx);
    }
    const cx = idToXref.get(pc.childId);
    if (cx && !chilSeen.has(`${fx}|${cx}`)) {
      chilSeen.add(`${fx}|${cx}`);
      famLines.get(fx)!.push(`1 CHIL ${cx}`);
    }
  }

  const indiEvents = new Map<string, FamilyEvent[]>();
  for (const event of tree.events ?? []) {
    const ids = event.personIds.filter((id) => idToXref.has(id));
    if (ids.length === 0) continue;
    if (ids.length === 1 && !FAMILY_EVENT_TAGS.has(event.type)) {
      indiEvents.set(ids[0], [...(indiEvents.get(ids[0]) ?? []), event]);
      continue;
    }
    const pair = ids.length >= 2 ? pairKey(ids[0], ids[1]) : '';
    let fx = famXrefByPair.get(pair);
    if (!fx) {
      fx = openFam(ids.slice(0, 2));
      if (pair) famXrefByPair.set(pair, fx);
    }
    famLines.get(fx)!.push(...eventLines(event));
  }

  const out: string[] = [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 5.5',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '1 SOUR ANCESTRA',
    '1 DEST ANY',
  ];

  for (const p of Object.values(tree.persons)) {
    const xr = idToXref.get(p.id);
    if (!xr) continue;
    const name = `${p.firstName} /${p.lastName || 'Unknown'}/`.trim();
    out.push(`0 ${xr} INDI`);
    out.push(`1 NAME ${name || '/Unknown/'}`);
    if (p.gender === 'male') out.push('1 SEX M');
    else if (p.gender === 'female') out.push('1 SEX F');
    const events = indiEvents.get(p.id) ?? [];
    if (p.birthDate && !events.some((e) => e.type === 'BIRT')) {
      out.push('1 BIRT');
      out.push(`2 DATE ${p.birthDate}`);
    }
    if (p.deathDate && !events.some((e) => e.type === 'DEAT')) {
      out.push('1 DEAT');
      out.push(`2 DATE ${p.deathDate}`);
    }
    for (const event of events) out.push(...eventLines(event));
    if (p.notes) {
      out.push(`1 NOTE ${p.notes.replace(/\n/g, ' ').slice(0, 248)}`);
    }
  }

  for (const [fx, lines] of famLines) {
    out.push(`0 ${fx} FAM`, ...lines);
  }

  out.push('0 TRLR');
  return out.join('\n');
}
