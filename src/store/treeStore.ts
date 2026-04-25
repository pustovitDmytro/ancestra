import { create } from 'zustand';
import { emptyTree, type Person, type PersonId, type TreeState } from '@/types';
import {
  addParentChildOp,
  addPartnershipOp,
  addPersonOp,
  cloneTree,
  removeParentChildOp,
  removePartnershipOp,
  removePersonOp,
} from '@/lib/treeOps';

const HISTORY_MAX = 50;

function snapshot(t: TreeState): TreeState {
  return cloneTree(t);
}

interface TreeStore {
  tree: TreeState;
  selectedId: PersonId | null;
  searchQuery: string;
  hydrated: boolean;
  past: TreeState[];
  future: TreeState[];

  setHydrated: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  selectPerson: (id: PersonId | null) => void;

  commit: (next: TreeState) => void;
  replaceTree: (next: TreeState, skipHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;

  addPerson: (partial: Partial<Omit<Person, 'id'>> & Pick<Person, 'firstName' | 'lastName'>) => PersonId;
  updatePerson: (id: PersonId, patch: Partial<Omit<Person, 'id'>>) => void;
  deletePerson: (id: PersonId) => void;
  addParentChild: (parentId: PersonId, childId: PersonId) => void;
  removeParentChild: (linkId: string) => void;
  addPartnership: (aId: PersonId, bId: PersonId) => void;
  removePartnership: (linkId: string) => void;
  clearAll: () => void;
  importTree: (next: TreeState) => void;
}

export const useTreeStore = create<TreeStore>((set, get) => ({
    tree: emptyTree(),
    selectedId: null,
    searchQuery: '',
    hydrated: false,
    past: [],
    future: [],

    setHydrated: (v) => set({ hydrated: v }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    selectPerson: (id) => set({ selectedId: id }),

    commit: (next) => {
      const { tree, past } = get();
      const snap = snapshot(tree);
      const pastNext = [...past, snap].slice(-HISTORY_MAX);
      set({ tree: next, past: pastNext, future: [] });
    },

    replaceTree: (next, skipHistory) => {
      if (skipHistory) {
        set({ tree: next, future: [] });
        return;
      }
      get().commit(next);
    },

    undo: () => {
      const { past, tree, future } = get();
      if (past.length === 0) return;
      const prev = past[past.length - 1];
      const newPast = past.slice(0, -1);
      const curSnap = snapshot(tree);
      set({
        tree: cloneTree(prev),
        past: newPast,
        future: [curSnap, ...future].slice(0, HISTORY_MAX),
      });
    },

    redo: () => {
      const { future, tree, past } = get();
      if (future.length === 0) return;
      const [next, ...rest] = future;
      const curSnap = snapshot(tree);
      set({
        tree: cloneTree(next),
        future: rest,
        past: [...past, curSnap].slice(-HISTORY_MAX),
      });
    },

    addPerson: (partial) => {
      const next = cloneTree(get().tree);
      const id = addPersonOp(next, partial);
      get().commit(next);
      return id;
    },

    updatePerson: (id, patch) => {
      const next = cloneTree(get().tree);
      const p = next.persons[id];
      if (!p) return;
      Object.assign(p, patch);
      get().commit(next);
    },

    deletePerson: (id) => {
      const next = cloneTree(get().tree);
      removePersonOp(next, id);
      get().commit(next);
      const sel = get().selectedId;
      if (sel === id) set({ selectedId: null });
    },

    addParentChild: (parentId, childId) => {
      const next = cloneTree(get().tree);
      addParentChildOp(next, parentId, childId);
      get().commit(next);
    },

    removeParentChild: (linkId) => {
      const next = cloneTree(get().tree);
      removeParentChildOp(next, linkId);
      get().commit(next);
    },

    addPartnership: (aId, bId) => {
      const next = cloneTree(get().tree);
      addPartnershipOp(next, aId, bId);
      get().commit(next);
    },

    removePartnership: (linkId) => {
      const next = cloneTree(get().tree);
      removePartnershipOp(next, linkId);
      get().commit(next);
    },

    clearAll: () => {
      get().commit(emptyTree());
      set({ selectedId: null });
    },

    importTree: (next) => {
      set({
        tree: cloneTree(next),
        past: [],
        future: [],
        selectedId: null,
      });
    },
  })
);

export function useCanUndo(): boolean {
  return useTreeStore((s) => s.past.length > 0);
}

export function useCanRedo(): boolean {
  return useTreeStore((s) => s.future.length > 0);
}
