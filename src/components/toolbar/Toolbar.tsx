import { useRef, type ChangeEvent } from 'react';
import { exportGedcom, parseGedcom } from '@/services/gedcom';
import { exportTreeJson, parseTreeJson } from '@/services/jsonExport';
import { useCanRedo, useCanUndo, useTreeStore } from '@/store/treeStore';
import { isTreeEmpty } from '@/lib/treeOps';
import { sampleTree } from '@/data/sampleTree';

export function Toolbar() {
  const gedRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const searchQuery = useTreeStore((s) => s.searchQuery);
  const setSearch = useTreeStore((s) => s.setSearchQuery);
  const tree = useTreeStore((s) => s.tree);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const addPerson = useTreeStore((s) => s.addPerson);
  const selectPerson = useTreeStore((s) => s.selectPerson);
  const importTree = useTreeStore((s) => s.importTree);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const empty = isTreeEmpty(tree);

  const download = (filename: string, mime: string, body: string) => {
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onGedFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      try {
        const parsed = parseGedcom(text);
        importTree(parsed);
      } catch (err) {
        console.error(err);
        alert('Could not parse GEDCOM file.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const onJsonFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      try {
        const parsed = parseTreeJson(text);
        importTree(parsed);
      } catch {
        alert('Invalid JSON tree file.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface-muted/40 px-4 py-3 md:flex-row md:flex-wrap md:items-center md:gap-2 md:px-6">
      <div className="flex flex-1 min-w-[200px] max-w-md items-center gap-2">
        <label className="sr-only" htmlFor="search">
          Search people
        </label>
        <input
          id="search"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 transition"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => {
            const id = addPerson({ firstName: 'New', lastName: 'Person' });
            selectPerson(id);
          }}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition"
        >
          New person
        </button>

        <button
          type="button"
          disabled={!canUndo}
          onClick={() => undo()}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:opacity-40 hover:border-accent/40 transition"
          title="Undo"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={() => redo()}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:opacity-40 hover:border-accent/40 transition"
          title="Redo"
        >
          Redo
        </button>

        <span className="hidden sm:inline w-px h-6 bg-border mx-1" aria-hidden />

        <button
          type="button"
          onClick={() => gedRef.current?.click()}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:border-accent/40 transition"
        >
          Import GEDCOM
        </button>
        <input
          ref={gedRef}
          type="file"
          accept=".ged,.gedcom,text/plain"
          className="hidden"
          onChange={onGedFile}
        />

        <button
          type="button"
          onClick={() => jsonRef.current?.click()}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:border-accent/40 transition"
        >
          Import JSON
        </button>
        <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={onJsonFile} />

        <button
          type="button"
          disabled={empty}
          onClick={() => download('ancestra-tree.json', 'application/json', exportTreeJson(tree))}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:opacity-40 hover:border-accent/40 transition"
        >
          Export JSON
        </button>
        <button
          type="button"
          disabled={empty}
          onClick={() => download('ancestra-tree.ged', 'text/plain', exportGedcom(tree))}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm disabled:opacity-40 hover:border-accent/40 transition"
        >
          Export GEDCOM
        </button>

        <button
          type="button"
          onClick={() => importTree(structuredClone(sampleTree))}
          className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-ink-muted hover:border-accent/50 hover:text-ink transition"
        >
          Load sample
        </button>
      </div>
    </div>
  );
}
