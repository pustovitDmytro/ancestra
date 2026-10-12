import { useMemo } from 'react';
import { computeTreeStats } from '@/lib/treeStats';
import { useTreeStore } from '@/store/treeStore';

type Props = {
  compact?: boolean;
};

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export function TreeStats({ compact = false }: Props) {
  const tree = useTreeStore((s) => s.tree);
  const stats = useMemo(() => computeTreeStats(tree), [tree.persons]);

  if (stats.total === 0) return null;

  return (
    <section
      aria-label="Tree statistics"
      className={compact ? 'shrink-0' : 'shrink-0 border-b border-border bg-surface-muted/30 p-4'}
    >
      {!compact && <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">Overview</h3>}
      <dl className="grid grid-cols-3 gap-2">
        <StatItem label="People" value={stats.total} />
        <StatItem label="Living" value={stats.living} />
        <StatItem label="Deceased" value={stats.deceased} />
      </dl>
    </section>
  );
}
