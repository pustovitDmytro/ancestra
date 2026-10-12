import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportGedcom, parseGedcom } from '@/services/gedcom';
import type { TreeState } from '@/types';

const FIXTURE = join(process.cwd(), 'tests/fixtures/english-tudor-royal-family.ged');

/** People are matched by position: export keeps their order, while ids are regenerated */
function eventSignatures(tree: TreeState): string[] {
  const index = new Map(Object.keys(tree.persons).map((id, i) => [id, i]));
  return tree.events
    .filter((e) => e.personIds.length > 0)
    .map((e) => {
      const people = e.personIds.map((id) => index.get(id)).sort().join('&');
      return [e.type, e.date ?? '', e.place ?? '', e.description ?? '', people].join('|');
    })
    .sort();
}

describe('GEDCOM export round trip', () => {
  const original = parseGedcom(readFileSync(FIXTURE, 'utf8'));
  const reimported = parseGedcom(exportGedcom(original));

  it('keeps people and partnerships', () => {
    expect(Object.keys(reimported.persons)).toHaveLength(Object.keys(original.persons).length);
    expect(reimported.partnerships).toHaveLength(original.partnerships.length);
  });

  it('keeps every event with its date, place and type', () => {
    expect(original.events.length).toBeGreaterThan(1000);
    expect(eventSignatures(reimported)).toEqual(eventSignatures(original));
  });

  it('writes children inside their own FAM record', () => {
    const lines = exportGedcom(original).split('\n');
    let current = '';
    const famOf = new Map<string, string[]>();
    for (const line of lines) {
      const head = line.match(/^0 (@F\d+@) FAM$/);
      if (head) current = head[1]!;
      else if (line.startsWith('0 ')) current = '';
      const chil = line.match(/^1 CHIL (@I\d+@)$/);
      if (chil) famOf.set(current, [...(famOf.get(current) ?? []), chil[1]!]);
    }
    expect(famOf.has('')).toBe(false);
    expect(famOf.size).toBeGreaterThan(1);
  });
});
