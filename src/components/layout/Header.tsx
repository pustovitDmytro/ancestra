import { useTheme } from '@/hooks/useTheme';
import { useTreeStore, type AppView } from '@/store/treeStore';

const VIEWS: { id: AppView; label: string }[] = [
  { id: 'tree', label: 'Tree' },
  { id: 'people', label: 'People' },
  { id: 'events', label: 'Events' },
];

export function Header() {
  const [theme, setTheme] = useTheme();
  const view = useTreeStore((s) => s.view);
  const setView = useTreeStore((s) => s.setView);

  return (
    <header className="shrink-0 border-b border-border bg-surface/80 backdrop-blur-md z-20">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-ink font-semibold text-sm">
            A
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-ink truncate">Ancestra</h1>
            <p className="text-xs text-ink-muted hidden sm:block">Private family trees — offline first</p>
          </div>
        </div>

        <nav
          aria-label="Main views"
          className="hidden sm:flex items-center rounded-xl border border-border bg-surface-muted p-0.5"
        >
          {VIEWS.map(({ id, label }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  active
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <nav
            aria-label="Main views"
            className="flex sm:hidden items-center rounded-xl border border-border bg-surface-muted p-0.5"
          >
            {VIEWS.map(({ id, label }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={[
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                    active
                      ? 'bg-surface text-ink shadow-sm'
                      : 'text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-ink transition hover:border-accent/50 hover:bg-surface"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </header>
  );
}
