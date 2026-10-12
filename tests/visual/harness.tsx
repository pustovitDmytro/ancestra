import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FamilyTreeCanvas } from '@/components/tree/FamilyTreeCanvas';
import { parseGedcom } from '@/services/gedcom';
import { useTreeStore } from '@/store/treeStore';
import { captureDimensionsForTree } from './captureBounds';
import '@/index.css';
import './harness.css';

function applyCaptureSize(width: number, height: number) {
  const px = `${width}px`;
  const py = `${height}px`;
  document.documentElement.style.width = px;
  document.documentElement.style.height = py;
  document.body.style.width = px;
  document.body.style.height = py;
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.style.width = px;
    rootEl.style.height = py;
  }
  document.documentElement.dataset.captureWidth = String(width);
  document.documentElement.dataset.captureHeight = String(height);
}

async function bootstrap() {
  const ged = new URLSearchParams(window.location.search).get('ged');
  const root = document.getElementById('root');
  if (!root) return;

  if (!ged || ged.includes('/') || ged.includes('\\') || !ged.endsWith('.ged')) {
    root.textContent = 'Pass ?ged=<filename>.ged';
    document.documentElement.dataset.treeError = 'invalid-query';
    return;
  }

  const res = await fetch(`/ged/${encodeURIComponent(ged)}`);
  if (!res.ok) {
    root.textContent = `Failed to load ${ged}: ${res.status}`;
    document.documentElement.dataset.treeError = 'load-failed';
    return;
  }

  const tree = parseGedcom(await res.text());
  const { width, height } = captureDimensionsForTree(tree);
  applyCaptureSize(width, height);

  useTreeStore.getState().importTree(tree);
  useTreeStore.getState().setHydrated(true);

  createRoot(root).render(
    <StrictMode>
      <div className="h-full w-full" data-testid="tree-canvas">
        <FamilyTreeCanvas screenshotMode />
      </div>
    </StrictMode>
  );
}

void bootstrap();
