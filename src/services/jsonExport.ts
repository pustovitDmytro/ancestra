import type { TreeState } from '@/types';

export function exportTreeJson(tree: TreeState): string {
  return JSON.stringify(tree, null, 2);
}

export function parseTreeJson(text: string): TreeState {
  const data = JSON.parse(text) as TreeState;
  if (!data || typeof data.persons !== 'object') {
    throw new Error('Invalid tree JSON');
  }
  if (!Array.isArray(data.parentChild)) data.parentChild = [];
  if (!Array.isArray(data.partnerships)) data.partnerships = [];
  return data;
}
