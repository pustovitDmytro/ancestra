import { useEffect, useRef } from 'react';
import { saveTree } from '@/db';
import { useTreeStore } from '@/store/treeStore';

const DEBOUNCE_MS = 250;

export function usePersistence(): void {
  const hydrated = useTreeStore((s) => s.hydrated);
  const tree = useTreeStore((s) => s.tree);
  const tRef = useRef(tree);
  tRef.current = tree;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveTree(tRef.current);
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tree, hydrated]);
}
