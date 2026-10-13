import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadTree } from '@/db';
import { ensureTreeEvents } from '@/lib/familyEvents';
import { STAND } from '@/lib/stand';
import { useTreeStore } from '@/store/treeStore';
import App from './App';
import './index.css';

if (STAND) document.title = `[${STAND}] Ancestra`;

async function bootstrap() {
  const data = await loadTree();
  if (data) {
    useTreeStore.getState().importTree(ensureTreeEvents(data));
  }
  useTreeStore.getState().setHydrated(true);
}

void bootstrap().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
