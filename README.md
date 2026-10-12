# Ancestra

A **local-first** family tree app: your data stays in the browser (IndexedDB). No backend, no account — a simple, Notion-inspired UI with dark mode, search, undo/redo, and GEDCOM / JSON import and export.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

The built assets are static; there is no service worker, so the app needs the server to load.

## Features

- **Tree** — pedigree layout around a proband: the direct ancestral line in the middle, collateral relatives beside it. Selecting a person and choosing **View only this lineage** narrows the tree to their ancestors and descendants; **Export lineage GEDCOM** then exports just that subtree.
- **People** — searchable catalog with filters by gender, living/deceased and photo, and sorting by name or birth year.
- **Events** — timeline of births, deaths, marriages, burials and other GEDCOM events, grouped by year and filterable by type.
- **Gender** — male / female / unknown per person; drives node colors, silhouettes and which side of a couple a person is drawn on.

## Stack

- React 18 + Vite + TypeScript  
- Tailwind CSS  
- Zustand (state + undo/redo)  
- Dexie.js (IndexedDB)  
- React Flow (`@xyflow/react`) for the graph  

## Data

- **Autosave**: every change is debounced and written to IndexedDB.  
- **Import**: GEDCOM (`.ged`) or JSON (same shape as **Export JSON**).  
- **Export**: JSON (primary) or GEDCOM.  
- **Sample**: toolbar **Load sample** or empty-state **Load sample tree** — or use `public/sample-tree.json`.

## GEDCOM

The parser supports a subset: individuals (`INDI`) with names, sex and life events (birth, death, burial, occupation, residence, `EVEN` and similar, with `DATE`, `PLAC` and `TYPE`), and families (`FAM`) with `HUSB`, `WIFE`, `CHIL` and family events such as marriage and divorce. Notes, sources, media and `CONC`/`CONT` continuations are ignored. Export writes people, families and all stored events.

## Tests

```bash
npm test                      # vitest: GEDCOM round trip, date/event sync, layout invariants
npm run test:visual:install   # once: Playwright Chromium
npm run test:visual           # renders every fixture and saves screenshots to tmp/test_execution_results
```

Fixtures in `tests/fixtures/` are public sample trees (see `tests/fixtures/README.md`). Put private trees in `ged/` — it is git-ignored, and when present the tests also run the full layout checks on those files.
