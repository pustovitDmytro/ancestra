import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { personDisplayName } from '@/lib/treeOps';
import type { Person } from '@/types';

export type PersonNodeData = {
  person: Person;
  selected: boolean;
  dimmed: boolean;
  generationLabel?: string;
};

export type PersonFlowNode = Node<PersonNodeData, 'person'>;

const GOLD = '#C5A059';
const RED = '#ff1a1a';

function PersonNodeInner(props: NodeProps<PersonFlowNode>) {
  const { data } = props;
  const { person, selected, dimmed, generationLabel } = data;
  const name = personDisplayName(person);
  const dates = [person.birthDate, person.deathDate].filter(Boolean).join(' – ');
  const sub = dates || generationLabel || '';
  const isPlaceholderName = !name.trim() || /^unknown\b/i.test(name.trim());
  const showQuestion = isPlaceholderName && !person.photoDataUrl;

  return (
    <div
      className={[
        'family-tree-person relative flex w-[128px] flex-col items-center rounded-none border-0 bg-transparent px-0 py-1 transition-all duration-200',
        dimmed ? 'opacity-[0.38]' : 'opacity-100',
        selected ? 'scale-[1.03]' : '',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border !border-[#C5A059]/80 !bg-[#121212] !opacity-100"
      />
      <div
        className={[
          'relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 bg-[#1a1a1a] transition-[border-color,box-shadow] duration-200',
          selected
            ? 'border-[#ff1a1a] shadow-[0_0_14px_rgba(255,26,26,0.45)]'
            : 'border-[#C5A059] shadow-[inset_0_0_0_1px_rgba(197,160,89,0.15)]',
        ].join(' ')}
        style={{ borderColor: selected ? RED : GOLD }}
      >
        {person.photoDataUrl ? (
          <img
            src={person.photoDataUrl}
            alt=""
            className="h-full w-full object-cover contrast-[0.92] saturate-[0.78]"
          />
        ) : showQuestion ? (
          <div
            className="flex h-full w-full items-center justify-center font-['Montserrat',system-ui,sans-serif] text-2xl font-semibold text-[#C5A059]"
            style={{ color: GOLD }}
          >
            ?
          </div>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-['Montserrat',system-ui,sans-serif] text-sm font-semibold tracking-wide text-[#C5A059]"
            style={{ color: GOLD }}
          >
            {name.split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join('')}
          </div>
        )}
      </div>
      <div className="mt-2 w-full px-0.5 text-center">
        <div className="line-clamp-2 min-h-[2.25rem] text-[11px] font-semibold leading-tight text-white font-['Montserrat',system-ui,sans-serif]">
          {name || '—'}
        </div>
        {sub ? (
          <div className="mt-0.5 truncate text-[10px] font-medium text-[#C5A059]/80 font-['Montserrat',system-ui,sans-serif]">
            {sub}
          </div>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1.5 !w-1.5 !border !border-[#C5A059]/80 !bg-[#121212] !opacity-100"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeInner);
