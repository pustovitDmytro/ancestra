import { BaseEdge, type EdgeProps } from '@xyflow/react';
import type { PedigreeRouting } from '@/lib/pedigreePaths';

export type PedigreeEdgeData = {
  path?: string;
  routing?: PedigreeRouting;
  forkFrac?: number;
};

export type { PedigreeRouting };

export function PedigreeEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, style, markerEnd, data } = props;
  const edgeData = data as PedigreeEdgeData | undefined;
  const path = edgeData?.path ?? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
