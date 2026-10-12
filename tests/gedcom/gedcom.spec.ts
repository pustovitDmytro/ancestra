import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureTreeEvents } from '@/lib/familyEvents';
import { addPersonOp, addPartnershipOp, removePartnershipOp } from '@/lib/treeOps';
import { exportGedcom, parseGedcom } from '@/services/gedcom';
import { emptyTree, type TreeState } from '@/types';

const FIXTURE_DIR = join(process.cwd(), 'tests/fixtures');
const FIXTURES = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.ged'));

/** People are matched by position: export keeps their order, while ids are regenerated */
function personIndex(tree: TreeState): Map<string, number> {
  return new Map(Object.keys(tree.persons).map((id, i) => [id, i]));
}

function eventSignatures(tree: TreeState): string[] {
  const index = personIndex(tree);
  return tree.events
    .filter((e) => e.personIds.length > 0)
    .map((e) => {
      const people = e.personIds.map((id) => index.get(id)).sort().join('&');
      return [e.type, e.date ?? '', e.place ?? '', e.description ?? '', people].join('|');
    })
    .sort();
}

function linkSignatures(tree: TreeState): string[] {
  const index = personIndex(tree);
  return [
    ...tree.parentChild.map((l) => `pc|${index.get(l.parentId)}>${index.get(l.childId)}`),
    ...tree.partnerships.map((p) => `ps|${[index.get(p.aId), index.get(p.bId)].sort().join('&')}`),
  ].sort();
}

describe.each(FIXTURES)('GEDCOM export round trip: %s', (file) => {
  const original = parseGedcom(readFileSync(join(FIXTURE_DIR, file), 'utf8'));
  const reimported = parseGedcom(exportGedcom(original));

  it('keeps people, partnerships and parent-child links', () => {
    expect(Object.keys(reimported.persons)).toHaveLength(Object.keys(original.persons).length);
    expect(linkSignatures(reimported)).toEqual(linkSignatures(original));
  });

  it('keeps every event with its date, place and type', () => {
    expect(eventSignatures(reimported)).toEqual(eventSignatures(original));
  });

  it('writes children inside a FAM record', () => {
    let inFam = false;
    for (const line of exportGedcom(original).split('\n')) {
      if (line.startsWith('0 ')) inFam = / FAM$/.test(line);
      if (line.startsWith('1 CHIL ')) expect(inFam).toBe(true);
    }
  });
});

describe('GEDCOM edge cases', () => {
  it('keeps the dated birth when a person has several BIRT records', () => {
    const tree = parseGedcom(
      ['0 @I1@ INDI', '1 NAME Ann /Lee/', '1 BIRT', '2 DATE 1500', '1 BIRT', '2 PLAC London'].join('\n')
    );
    const [person] = Object.values(tree.persons);
    expect(person!.birthDate).toBe('1500');
    const loaded = ensureTreeEvents(tree);
    expect(loaded.events.filter((e) => e.type === 'BIRT').map((e) => e.date)).toEqual([
      '1500',
      undefined,
    ]);
  });

  it('does not bring back a removed partnership through its marriage event', () => {
    const tree = emptyTree();
    const a = addPersonOp(tree, { firstName: 'Ann', lastName: 'Lee', gender: 'female' });
    const b = addPersonOp(tree, { firstName: 'Bob', lastName: 'Lee', gender: 'male' });
    addPartnershipOp(tree, a, b);
    tree.events.push({ id: 'm', type: 'MARR', date: '1520', personIds: [a, b] });
    removePartnershipOp(tree, tree.partnerships[0]!.id);

    const reimported = parseGedcom(exportGedcom(tree));
    expect(reimported.partnerships).toEqual([]);
    expect(reimported.events.filter((e) => e.type === 'MARR')).toHaveLength(2);
  });

  it('keeps multi-line text on one GEDCOM line', () => {
    const tree = emptyTree();
    const a = addPersonOp(tree, { firstName: 'Ann', lastName: 'Lee' });
    tree.events.push({ id: 'e', type: 'EVEN', description: 'line one\nline two', personIds: [a] });
    const reimported = parseGedcom(exportGedcom(tree));
    expect(reimported.events.map((e) => e.description)).toEqual(['line one line two']);
  });
});
