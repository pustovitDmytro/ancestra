import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { personDisplayName } from '@/lib/treeOps';
import { useTreeStore } from '@/store/treeStore';
import type { PersonId } from '@/types';

type Props = {
  personId: PersonId | null;
  onClose: () => void;
};

export function PersonPanel({ personId, onClose }: Props) {
  const tree = useTreeStore((s) => s.tree);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const deletePerson = useTreeStore((s) => s.deletePerson);
  const addParentChild = useTreeStore((s) => s.addParentChild);
  const removeParentChild = useTreeStore((s) => s.removeParentChild);
  const addPartnership = useTreeStore((s) => s.addPartnership);
  const removePartnership = useTreeStore((s) => s.removePartnership);

  const person = personId ? tree.persons[personId] : null;

  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [birthDate, setBirth] = useState('');
  const [deathDate, setDeath] = useState('');
  const [notes, setNotes] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!person) return;
    setFirst(person.firstName);
    setLast(person.lastName);
    setBirth(person.birthDate ?? '');
    setDeath(person.deathDate ?? '');
    setNotes(person.notes ?? '');
  }, [person]);

  const others = useMemo(
    () => Object.values(tree.persons).filter((p) => p.id !== personId),
    [tree.persons, personId]
  );

  const parentLinks = useMemo(
    () => tree.parentChild.filter((l) => l.childId === personId),
    [tree.parentChild, personId]
  );
  const childLinks = useMemo(
    () => tree.parentChild.filter((l) => l.parentId === personId),
    [tree.parentChild, personId]
  );
  const partnerLinks = useMemo(
    () =>
      tree.partnerships.filter((p) => p.aId === personId || p.bId === personId),
    [tree.partnerships, personId]
  );

  if (!personId || !person) {
    return (
      <aside className="hidden lg:flex w-[340px] shrink-0 border-l border-border bg-surface-muted/50 p-6 flex-col justify-center text-center">
        <p className="text-sm text-ink-muted">Select a person on the tree to view and edit details.</p>
      </aside>
    );
  }

  const saveFields = () => {
    updatePerson(personId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate.trim() || undefined,
      deathDate: deathDate.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !personId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : undefined;
      if (url) updatePerson(personId, { photoDataUrl: url });
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  return (
    <aside className="w-full lg:w-[380px] shrink-0 border-l border-border bg-surface flex flex-col max-h-[calc(100vh-64px)] lg:max-h-none lg:min-h-[calc(100vh-64px)]">
      <div className="flex items-start justify-between gap-2 p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-ink leading-tight">{personDisplayName(person)}</h2>
          <p className="text-xs text-ink-muted mt-1">Edits save automatically</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-ink-muted hover:text-ink hover:bg-surface-muted transition"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="flex gap-3 items-start">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface-muted border border-border">
            {person.photoDataUrl ? (
              <img src={person.photoDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-ink-muted">No photo</div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm hover:border-accent/50 transition"
            >
              Upload photo
            </button>
            {person.photoDataUrl && (
              <button
                type="button"
                onClick={() => updatePerson(personId, { photoDataUrl: undefined })}
                className="text-xs text-ink-muted hover:text-ink"
              >
                Remove photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-xs font-medium text-ink-muted">First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirst(e.target.value)}
              onBlur={saveFields}
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="block col-span-2 sm:col-span-1">
            <span className="text-xs font-medium text-ink-muted">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLast(e.target.value)}
              onBlur={saveFields}
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Birth</span>
            <input
              value={birthDate}
              onChange={(e) => setBirth(e.target.value)}
              onBlur={saveFields}
              placeholder="e.g. 1924"
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Death</span>
            <input
              value={deathDate}
              onChange={(e) => setDeath(e.target.value)}
              onBlur={saveFields}
              placeholder="optional"
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-ink-muted">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveFields}
            rows={4}
            className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30 resize-y min-h-[96px]"
          />
        </label>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Parents</h3>
          <ul className="space-y-2">
            {parentLinks.map((l) => {
              const p = tree.persons[l.parentId];
              if (!p) return null;
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate">{personDisplayName(p)}</span>
                  <button
                    type="button"
                    className="text-xs text-red-600/80 hover:underline dark:text-red-400"
                    onClick={() => removeParentChild(l.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <AddRelation
            label="Add parent"
            options={others}
            onPick={(id) => addParentChild(id, personId)}
          />
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Children</h3>
          <ul className="space-y-2">
            {childLinks.map((l) => {
              const c = tree.persons[l.childId];
              if (!c) return null;
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate">{personDisplayName(c)}</span>
                  <button
                    type="button"
                    className="text-xs text-red-600/80 hover:underline dark:text-red-400"
                    onClick={() => removeParentChild(l.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <AddRelation
            label="Add child"
            options={others}
            onPick={(id) => addParentChild(personId, id)}
          />
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Partners</h3>
          <ul className="space-y-2">
            {partnerLinks.map((l) => {
              const oid = l.aId === personId ? l.bId : l.aId;
              const p = tree.persons[oid];
              if (!p) return null;
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate">{personDisplayName(p)}</span>
                  <button
                    type="button"
                    className="text-xs text-red-600/80 hover:underline dark:text-red-400"
                    onClick={() => removePartnership(l.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <AddRelation
            label="Link partner"
            options={others.filter(
              (o) =>
                !partnerLinks.some(
                  (l) => l.aId === o.id || l.bId === o.id
                )
            )}
            onPick={(id) => addPartnership(personId, id)}
          />
        </section>

        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this person and their relationship links?')) {
              deletePerson(personId);
              onClose();
            }
          }}
          className="w-full rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-500/10 transition"
        >
          Delete person
        </button>
      </div>
    </aside>
  );
}

function AddRelation({
  label,
  options,
  onPick,
}: {
  label: string;
  options: { id: string; firstName: string; lastName: string }[];
  onPick: (id: string) => void;
}) {
  const [val, setVal] = useState('');
  return (
    <div className="mt-2 flex gap-2 items-center">
      <select
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 min-w-0 rounded-xl border border-border bg-surface-muted px-2 py-2 text-sm outline-none"
      >
        <option value="">{label}…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {personDisplayName(o)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!val}
        onClick={() => {
          if (val) {
            onPick(val);
            setVal('');
          }
        }}
        className="shrink-0 rounded-xl bg-accent px-3 py-2 text-sm text-white disabled:opacity-40 transition hover:bg-accent-hover"
      >
        Add
      </button>
    </div>
  );
}
