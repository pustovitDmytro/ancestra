import { describe, expect, it } from 'vitest';
import { ensureTreeEvents } from '@/lib/familyEvents';
import { addPersonOp, syncPersonDateEventsOp } from '@/lib/treeOps';
import { emptyTree } from '@/types';

const own = (type: string, id: string) => (e: { type: string; personIds: string[] }) =>
  e.type === type && e.personIds.length === 1 && e.personIds[0] === id;

describe('person date events', () => {
  it('creates BIRT and DEAT for a new person with dates', () => {
    const tree = emptyTree();
    const id = addPersonOp(tree, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      birthDate: '10 DEC 1815',
      deathDate: '1852',
    });
    expect(tree.events.find(own('BIRT', id))?.date).toBe('10 DEC 1815');
    expect(tree.events.find(own('DEAT', id))?.date).toBe('1852');
  });

  it('follows edits and drops an emptied event', () => {
    const tree = emptyTree();
    const id = addPersonOp(tree, { firstName: 'Ada', lastName: 'Lovelace', birthDate: '1815' });
    tree.persons[id]!.birthDate = '1816';
    syncPersonDateEventsOp(tree, id);
    expect(tree.events.filter(own('BIRT', id)).map((e) => e.date)).toEqual(['1816']);

    tree.persons[id]!.birthDate = undefined;
    syncPersonDateEventsOp(tree, id);
    expect(tree.events.some(own('BIRT', id))).toBe(false);
  });

  it('keeps the place when the date is cleared', () => {
    const tree = emptyTree();
    const id = addPersonOp(tree, { firstName: 'Ada', lastName: 'Lovelace', birthDate: '1815' });
    tree.events.find(own('BIRT', id))!.place = 'London';
    tree.persons[id]!.birthDate = undefined;
    syncPersonDateEventsOp(tree, id);
    expect(tree.events.find(own('BIRT', id))).toMatchObject({ place: 'London', date: undefined });
  });

  it('leaves a matching event alone when a person has several', () => {
    const tree = emptyTree();
    const id = addPersonOp(tree, { firstName: 'Ada', lastName: 'Lovelace' });
    tree.events.push(
      { id: 'a', type: 'BIRT', date: '1815', personIds: [id] },
      { id: 'b', type: 'BIRT', date: 'ABT 1816', personIds: [id] }
    );
    tree.persons[id]!.birthDate = 'ABT 1816';
    syncPersonDateEventsOp(tree, id);
    expect(tree.events.filter(own('BIRT', id)).map((e) => e.date)).toEqual(['1815', 'ABT 1816']);
  });

  it('repairs stale events on load', () => {
    const tree = emptyTree();
    const id = addPersonOp(tree, { firstName: 'Ada', lastName: 'Lovelace', birthDate: '1815' });
    tree.persons[id]!.deathDate = '1852';
    const loaded = ensureTreeEvents(tree);
    expect(loaded.events.find(own('DEAT', id))?.date).toBe('1852');
    expect(tree.events.some(own('DEAT', id))).toBe(false);
  });
});
