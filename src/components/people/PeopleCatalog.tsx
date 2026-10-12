import { useMemo, useState, type ReactNode } from 'react';
import { Silhouette } from '@/components/avatar/Silhouette';
import { PersonPanel } from '@/components/person/PersonPanel';
import {
  defaultPeopleFilters,
  filterAndSortPeople,
  personYearLine,
  type GenderFilter,
  type LifeFilter,
  type PeopleSort,
  type PhotoFilter,
} from '@/lib/personFilters';
import { personDisplayName } from '@/lib/treeOps';
import { useTreeStore } from '@/store/treeStore';
import type { PersonId } from '@/types';

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-2.5 py-1 text-xs font-medium transition',
        active
          ? 'bg-accent text-white shadow-sm'
          : 'bg-surface text-ink-muted hover:text-ink hover:bg-surface-muted border border-border',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function PeopleCatalog() {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const selectPerson = useTreeStore((s) => s.selectPerson);

  const [filters, setFilters] = useState(defaultPeopleFilters);

  const allPeople = useMemo(() => Object.values(tree.persons), [tree.persons]);
  const filtered = useMemo(
    () => filterAndSortPeople(allPeople, filters),
    [allPeople, filters]
  );

  const setQuery = (query: string) => setFilters((f) => ({ ...f, query }));
  const setGender = (gender: GenderFilter) => setFilters((f) => ({ ...f, gender }));
  const setLife = (life: LifeFilter) => setFilters((f) => ({ ...f, life }));
  const setPhoto = (photo: PhotoFilter) => setFilters((f) => ({ ...f, photo }));
  const setSort = (sort: PeopleSort) => setFilters((f) => ({ ...f, sort }));

  const hasActiveFilters =
    filters.query.trim() !== '' ||
    filters.gender !== 'all' ||
    filters.life !== 'all' ||
    filters.photo !== 'all';

  return (
    <div className="flex flex-1 flex-col lg:flex-row min-h-0">
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        <div className="shrink-0 border-b border-border bg-surface-muted/30 px-4 py-4 md:px-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">People</h2>
              <p className="text-sm text-ink-muted mt-0.5">
                {filtered.length === allPeople.length
                  ? `${allPeople.length} ${allPeople.length === 1 ? 'person' : 'people'}`
                  : `${filtered.length} of ${allPeople.length} people`}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setFilters(defaultPeopleFilters())}
                className="text-sm text-accent hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <label className="block">
            <span className="sr-only">Search people</span>
            <input
              value={filters.query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, dates, or notes…"
              className="w-full max-w-xl rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 transition"
            />
          </label>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <fieldset className="flex flex-wrap items-center gap-1.5">
              <legend className="sr-only">Gender</legend>
              <span className="text-xs font-medium text-ink-muted mr-1">Gender</span>
              {(
                [
                  ['all', 'All'],
                  ['male', 'Male'],
                  ['female', 'Female'],
                  ['unknown', 'Unknown'],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={filters.gender === value}
                  onClick={() => setGender(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </fieldset>

            <fieldset className="flex flex-wrap items-center gap-1.5">
              <legend className="sr-only">Life status</legend>
              <span className="text-xs font-medium text-ink-muted mr-1">Status</span>
              {(
                [
                  ['all', 'All'],
                  ['living', 'Living'],
                  ['deceased', 'Deceased'],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={filters.life === value}
                  onClick={() => setLife(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </fieldset>

            <fieldset className="flex flex-wrap items-center gap-1.5">
              <legend className="sr-only">Photo</legend>
              <span className="text-xs font-medium text-ink-muted mr-1">Photo</span>
              {(
                [
                  ['all', 'All'],
                  ['yes', 'With photo'],
                  ['no', 'No photo'],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={filters.photo === value}
                  onClick={() => setPhoto(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-ink-muted">Sort</span>
              <select
                value={filters.sort}
                onChange={(e) => setSort(e.target.value as PeopleSort)}
                className="rounded-xl border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="birth-asc">Birth year ↑</option>
                <option value="birth-desc">Birth year ↓</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
          {filtered.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-center">
              <p className="text-sm text-ink-muted">
                {allPeople.length === 0
                  ? 'No people in this tree yet.'
                  : 'No people match your search or filters.'}
              </p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((person) => (
                <PersonRow
                  key={person.id}
                  personId={person.id}
                  selected={selectedId === person.id}
                  onSelect={() => selectPerson(person.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <PersonPanel personId={selectedId} onClose={() => selectPerson(null)} />
    </div>
  );
}

function PersonRow({
  personId,
  selected,
  onSelect,
}: {
  personId: PersonId;
  selected: boolean;
  onSelect: () => void;
}) {
  const person = useTreeStore((s) => s.tree.persons[personId]);
  if (!person) return null;

  const name = personDisplayName(person);
  const years = personYearLine(person);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
          selected
            ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
            : 'border-border bg-surface hover:border-accent/40 hover:bg-surface-muted/50',
        ].join(' ')}
      >
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-surface-muted border border-border">
          {person.photoDataUrl ? (
            <img src={person.photoDataUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Silhouette gender={person.gender} className="h-full w-full text-ink-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          {years ? (
            <p className="truncate text-xs text-ink-muted mt-0.5">{years}</p>
          ) : (
            <p className="truncate text-xs text-ink-muted/60 mt-0.5 italic">No dates</p>
          )}
        </div>
      </button>
    </li>
  );
}
