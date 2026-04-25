import { sampleTree } from '@/data/sampleTree';
import { useTreeStore } from '@/store/treeStore';

export function EmptyState() {
  const importTree = useTreeStore((s) => s.importTree);
  const addPerson = useTreeStore((s) => s.addPerson);
  const selectPerson = useTreeStore((s) => s.selectPerson);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md rounded-3xl border border-border bg-surface-muted/60 p-10 shadow-soft-lg">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 text-2xl">
          🌳
        </div>
        <h2 className="text-xl font-semibold text-ink tracking-tight">Start your family tree</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Everything stays in your browser. Import a GEDCOM file or add people by hand — no account, no cloud.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              const id = addPerson({ firstName: 'New', lastName: 'Person' });
              selectPerson(id);
            }}
            className="rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition"
          >
            Create first person
          </button>
          <button
            type="button"
            onClick={() => importTree(structuredClone(sampleTree))}
            className="rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-medium hover:border-accent/40 transition"
          >
            Load sample tree
          </button>
        </div>
        <p className="mt-6 text-xs text-ink-muted">
          Tip: use <strong className="font-medium text-ink/80">Import GEDCOM</strong> in the toolbar for existing research.
        </p>
      </div>
    </div>
  );
}
