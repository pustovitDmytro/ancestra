import { AppShell } from '@/components/layout/AppShell';
import { Header } from '@/components/layout/Header';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { FamilyTreeCanvas } from '@/components/tree/FamilyTreeCanvas';
import { PersonPanel } from '@/components/person/PersonPanel';
import { EmptyState } from '@/components/empty/EmptyState';
import { usePersistence } from '@/hooks/usePersistence';
import { isTreeEmpty } from '@/lib/treeOps';
import { useTreeStore } from '@/store/treeStore';

export default function App() {
  const hydrated = useTreeStore((s) => s.hydrated);
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const selectPerson = useTreeStore((s) => s.selectPerson);

  usePersistence();

  const empty = isTreeEmpty(tree);

  return (
    <AppShell>
      <Header />
      <Toolbar />
      {!hydrated ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-ink-muted">
          Loading your tree…
        </div>
      ) : empty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-1 flex-col lg:flex-row min-h-0">
          <main className="flex flex-1 flex-col min-h-0 p-4 md:p-6 min-w-0">
            <div className="flex-1 min-h-[min(70vh,720px)] min-w-0">
              <FamilyTreeCanvas />
            </div>
            <p className="mt-3 text-xs text-ink-muted text-center lg:text-left">
              Gold arrows: parent → child · Dashed: partners · Scroll to zoom · Drag to pan
            </p>
          </main>
          <PersonPanel personId={selectedId} onClose={() => selectPerson(null)} />
        </div>
      )}
    </AppShell>
  );
}
