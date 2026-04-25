import { useTheme } from '@/hooks/useTheme';

export function Header() {
  const [theme, setTheme] = useTheme();

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
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-ink transition hover:border-accent/50 hover:bg-surface"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
