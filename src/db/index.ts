import Dexie, { type Table } from 'dexie';
import type { TreeState } from '@/types';

interface TreeRow {
  id: string;
  data: TreeState;
}

class AncestraDB extends Dexie {
  tree!: Table<TreeRow, string>;

  constructor() {
    super('ancestra');
    this.version(1).stores({ tree: 'id' });
  }
}

export const db = new AncestraDB();

const MAIN_ID = 'main';

export async function loadTree(): Promise<TreeState | null> {
  const row = await db.tree.get(MAIN_ID);
  return row?.data ?? null;
}

export async function saveTree(data: TreeState): Promise<void> {
  await db.tree.put({ id: MAIN_ID, data });
}
