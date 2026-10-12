import { computeFamilyLayout, COLLATERAL_NODE_H, COLLATERAL_NODE_W, NODE_H, NODE_W } from '@/lib/layoutTree';
import type { TreeState } from '@/types';

const PAD = 96;
const MIN_W = 640;
const MIN_H = 480;
const MAX_W = 16384;
const MAX_H = 8192;

export function captureDimensionsForTree(tree: TreeState): { width: number; height: number } {
  const { positions, families, spine } = computeFamilyLayout(tree);
  if (positions.size === 0) {
    return { width: MIN_W, height: MIN_H };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const extend = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };

  for (const [id, p] of positions.entries()) {
    const onSpine = spine.has(id);
    extend(p.x, p.y, onSpine ? NODE_W : COLLATERAL_NODE_W, onSpine ? NODE_H : COLLATERAL_NODE_H);
  }
  for (const f of families) {
    extend(f.x, f.y, 2, 2);
  }

  const width = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(maxX - minX + PAD * 2)));
  const height = Math.min(MAX_H, Math.max(MIN_H, Math.ceil(maxY - minY + PAD * 2)));

  return { width, height };
}
