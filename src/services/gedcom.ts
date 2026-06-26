/**
 * Minimal GEDCOM 5.5 subset parser and exporter.
 */

import { createId } from '@/lib/id';
import type { Person, TreeState } from '@/types';
import { emptyTree } from '@/types';

interface GedLine {
  level: number;
  tag: string;
  value: string;
  pointer?: string;
}

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
  sex?: 'M' | 'F' | 'U';
  birth?: string;
  death?: string;
  famc?: string;
  fams: string[];
};

type FamBlock = {
  xref: string;
  husband?: string;
  wife?: string;
  children: string[];
};

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
      const block: IndiBlock = { xref: L.pointer, fams: [] };
      i++;
      let pending: 'BIRT' | 'DEAT' | null = null;
      while (i < lines.length && lines[i].level > 0) {
        const ln = lines[i];
        if (ln.level === 1) {
          pending = null;
          if (ln.tag === 'NAME') block.name = ln.value;
          else if (ln.tag === 'SEX') {
            const normalized = ln.value.trim().toUpperCase();
            block.sex = normalized === 'M' || normalized === 'F' ? normalized : 'U';
          }
          else if (ln.tag === 'FAMC' && ln.value.startsWith('@')) block.famc = ln.value;
          else if (ln.tag === 'FAMS' && ln.value.startsWith('@')) block.fams.push(ln.value);
          else if (ln.tag === 'BIRT') pending = 'BIRT';
          else if (ln.tag === 'DEAT') pending = 'DEAT';
        } else if (ln.level === 2 && ln.tag === 'DATE' && pending) {
          if (pending === 'BIRT') block.birth = ln.value;
          if (pending === 'DEAT') block.death = ln.value;
        }
        i++;
      }
      indi.push(block);
      continue;
    }
    if (L.tag === 'FAM' && L.pointer) {
      const block: FamBlock = { xref: L.pointer, children: [] };
      i++;
      while (i < lines.length && lines[i].level > 0) {
        const ln = lines[i];
        if (ln.level === 1) {
          if (ln.tag === 'HUSB' && ln.value.startsWith('@')) block.husband = ln.value;
          else if (ln.tag === 'WIFE' && ln.value.startsWith('@')) block.wife = ln.value;
          else if (ln.tag === 'CHIL' && ln.value.startsWith('@')) block.children.push(ln.value);
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
    const person: Person = {
      id,
      firstName: first,
      lastName: last,
      sex: ib.sex,
      birthDate: ib.birth,
      deathDate: ib.death,
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

  return tree;
}

let gedcomSerial = 1;
function nextIndiXref(): string {
  return `@I${gedcomSerial++}@`;
}
function nextFamXref(): string {
  return `@F${gedcomSerial++}@`;
}

/** Export TreeState to a basic, valid GEDCOM file */
export function exportGedcom(tree: TreeState): string {
  gedcomSerial = 1;
  const idToXref = new Map<string, string>();
  for (const id of Object.keys(tree.persons)) {
    idToXref.set(id, nextIndiXref());
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
    if (p.sex) {
      out.push(`1 SEX ${p.sex}`);
    }
    if (p.birthDate) {
      out.push('1 BIRT');
      out.push(`2 DATE ${p.birthDate}`);
    }
    if (p.deathDate) {
      out.push('1 DEAT');
      out.push(`2 DATE ${p.deathDate}`);
    }
    if (p.notes) {
      out.push(`1 NOTE ${p.notes.replace(/\n/g, ' ').slice(0, 248)}`);
    }
  }

  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const famXrefByPair = new Map<string, string>();

  for (const pr of tree.partnerships) {
    const fx = nextFamXref();
    famXrefByPair.set(pairKey(pr.aId, pr.bId), fx);
    out.push(`0 ${fx} FAM`);
    const a = idToXref.get(pr.aId);
    const b = idToXref.get(pr.bId);
    if (a) out.push(`1 HUSB ${a}`);
    if (b) out.push(`1 WIFE ${b}`);
  }

  const parentFam = new Map<string, string>();
  for (const pr of tree.partnerships) {
    const fx = famXrefByPair.get(pairKey(pr.aId, pr.bId));
    if (fx) {
      parentFam.set(pr.aId, fx);
      parentFam.set(pr.bId, fx);
    }
  }

  const chilSeen = new Set<string>();
  for (const pc of tree.parentChild) {
    let fx = parentFam.get(pc.parentId);
    if (!fx) {
      fx = nextFamXref();
      out.push(`0 ${fx} FAM`);
      const px = idToXref.get(pc.parentId);
      if (px) out.push(`1 HUSB ${px}`);
      parentFam.set(pc.parentId, fx);
    }
    const cx = idToXref.get(pc.childId);
    if (cx) {
      const ck = `${fx}|${cx}`;
      if (!chilSeen.has(ck)) {
        chilSeen.add(ck);
        out.push(`1 CHIL ${cx}`);
      }
    }
  }

  out.push('0 TRLR');
  return out.join('\n');
}
