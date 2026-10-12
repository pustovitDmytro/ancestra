import { useEffect, useMemo, useState } from 'react';
import { PersonPanel } from '@/components/person/PersonPanel';
import {
  collectTimelineEvents,
  eventTagLabel,
  eventTypeLabel,
  formatEventPeople,
  groupEventsByYear,
  treeNeedsGedcomReimport,
  type EventYearGroup,
} from '@/lib/familyEvents';
import { useTreeStore } from '@/store/treeStore';
import type { FamilyEvent, PersonId } from '@/types';

function eventMatchesFilter(event: FamilyEvent, filter: string): boolean {
  if (filter === 'all') return true;
  return event.type === filter;
}

export function FamilyEventsTimeline() {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useTreeStore((s) => s.selectedId);
  const selectPerson = useTreeStore((s) => s.selectPerson);

  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');

  const allEvents = useMemo(() => collectTimelineEvents(tree), [tree]);
  const needsReimport = useMemo(() => treeNeedsGedcomReimport(tree), [tree]);

  const availableTypes = useMemo(() => {
    const types = new Set(allEvents.map((event) => event.type));
    return [...types].sort((a, b) =>
      eventTagLabel(a).localeCompare(eventTagLabel(b), undefined, { sensitivity: 'base' })
    );
  }, [allEvents]);

  useEffect(() => {
    if (typeFilter !== 'all' && !availableTypes.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [typeFilter, availableTypes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEvents.filter((event) => {
      if (!eventMatchesFilter(event, typeFilter)) return false;
      if (!q) return true;
      const haystack = [
        eventTypeLabel(event),
        event.date,
        event.place,
        event.description,
        formatEventPeople(event.personIds, tree.persons),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allEvents, typeFilter, query, tree.persons]);

  const groups = useMemo(() => groupEventsByYear(filtered), [filtered]);

  const hasActiveFilters = typeFilter !== 'all' || query.trim() !== '';

  return (
    <div className="flex flex-1 flex-col lg:flex-row min-h-0">
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        <div className="shrink-0 border-b border-border bg-surface-muted/30 px-4 py-4 md:px-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Family events</h2>
              <p className="text-sm text-ink-muted mt-0.5">
                {filtered.length === allEvents.length
                  ? `${allEvents.length} ${allEvents.length === 1 ? 'event' : 'events'} in chronological order`
                  : `${filtered.length} of ${allEvents.length} events`}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setQuery('');
                }}
                className="text-sm text-accent hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {needsReimport && (
            <p className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-ink-muted">
              Marriage, burial, and other GEDCOM events are missing from this tree.
              Use <strong className="font-medium text-ink">Import GEDCOM</strong> in the toolbar to
              reload the full event history.
            </p>
          )}

          <label className="block">
            <span className="sr-only">Search events</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by person, place, or date…"
              className="w-full max-w-xl rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 transition"
            />
          </label>

          {availableTypes.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-ink-muted">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="all">All types</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {eventTagLabel(type)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
          {filtered.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center text-center">
              <p className="text-sm text-ink-muted">
                {allEvents.length === 0
                  ? needsReimport
                    ? 'Re-import your GEDCOM file to load dated events (marriages, burials, etc.).'
                    : 'No dated events yet. Import a GEDCOM file or add birth and death dates to people.'
                  : 'No events match your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              {groups.map((group) => (
                <YearSection
                  key={group.year!}
                  group={group}
                  selectedId={selectedId}
                  onSelectPerson={selectPerson}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PersonPanel personId={selectedId} onClose={() => selectPerson(null)} />
    </div>
  );
}

function YearSection({
  group,
  selectedId,
  onSelectPerson,
}: {
  group: EventYearGroup;
  selectedId: PersonId | null;
  onSelectPerson: (id: PersonId) => void;
}) {
  const tree = useTreeStore((s) => s.tree);
  const yearLabel = group.year ?? '';

  return (
    <section>
      <h3 className="sticky top-0 z-10 mb-3 border-b border-border bg-surface/95 py-1 text-sm font-semibold text-ink-muted backdrop-blur-sm">
        {yearLabel}
      </h3>
      <ol className="relative space-y-3 border-l-2 border-accent/25 pl-5 ml-2">
        {group.events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            peopleLabel={formatEventPeople(event.personIds, tree.persons)}
            selectedPersonId={selectedId}
            onSelectPerson={onSelectPerson}
          />
        ))}
      </ol>
    </section>
  );
}

function EventRow({
  event,
  peopleLabel,
  selectedPersonId,
  onSelectPerson,
}: {
  event: FamilyEvent;
  peopleLabel: string;
  selectedPersonId: PersonId | null;
  onSelectPerson: (id: PersonId) => void;
}) {
  const label = eventTypeLabel(event);
  const primaryPersonId = event.personIds[0] ?? null;
  const isSelected = primaryPersonId !== null && selectedPersonId === primaryPersonId;

  return (
    <li className="relative">
      <span
        className="absolute -left-[1.35rem] top-3 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent"
        aria-hidden
      />
      <article
        className={[
          'rounded-xl border px-4 py-3 transition',
          isSelected
            ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
            : 'border-border bg-surface hover:border-accent/40 hover:bg-surface-muted/40',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-ink">{label}</p>
          {event.date && (
            <time className="text-xs font-medium text-ink-muted tabular-nums">{event.date}</time>
          )}
        </div>

        <p className="mt-1.5 text-sm text-ink">
          {event.personIds.length === 1 && primaryPersonId ? (
            <button
              type="button"
              onClick={() => onSelectPerson(primaryPersonId)}
              className="font-medium text-accent hover:underline text-left"
            >
              {peopleLabel}
            </button>
          ) : (
            <PersonLinks event={event} onSelectPerson={onSelectPerson} />
          )}
        </p>

        {event.place && (
          <p className="mt-1 text-xs text-ink-muted">{event.place}</p>
        )}
        {event.description && event.type !== 'EVEN' && event.type !== 'OCCU' && (
          <p className="mt-1 text-xs text-ink-muted">{event.description}</p>
        )}
      </article>
    </li>
  );
}

function PersonLinks({
  event,
  onSelectPerson,
}: {
  event: FamilyEvent;
  onSelectPerson: (id: PersonId) => void;
}) {
  const persons = useTreeStore((s) => s.tree.persons);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {event.personIds.map((id, index) => {
        const person = persons[id];
        const name = person ? `${person.firstName} ${person.lastName}`.trim() || 'Unnamed' : 'Unknown';
        return (
          <span key={id}>
            {index > 0 && <span className="text-ink-muted"> · </span>}
            <button
              type="button"
              onClick={() => onSelectPerson(id)}
              className="font-medium text-accent hover:underline"
            >
              {name}
            </button>
          </span>
        );
      })}
    </span>
  );
}
