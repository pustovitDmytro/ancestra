import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadTree } from '@/db';
import { useTreeStore } from '@/store/treeStore';
import App from './App';
import './index.css';

async function bootstrap() {
  const data = await loadTree();
  if (data) {
    useTreeStore.getState().importTree(data);
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
