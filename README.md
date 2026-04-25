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

The built assets are static and can be opened offline after the first load.

## Stack

- React 18 + Vite + TypeScript  
- Tailwind CSS  
- Zustand (state + undo/redo)  
- Dexie.js (IndexedDB)  
- React Flow (`@xyflow/react`) for the graph  

## Data

- **Autosave**: every change is debounced and written to IndexedDB.  
- **Import**: GEDCOM (`.ged`) or JSON (same shape as **Export JSON**).  
- **Export**: JSON (primary) or basic GEDCOM.  
- **Sample**: toolbar **Load sample** or empty-state **Load sample tree** — or use `public/sample-tree.json`.

## GEDCOM

The parser supports a **minimal subset**: individuals (`INDI`), names, birth/death dates, families (`FAM`) with `HUSB`, `WIFE`, `CHIL`, and `FAMC` on children. Complex GEDCOM features may be ignored; export produces a valid basic file.
