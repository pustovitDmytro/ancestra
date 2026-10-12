import { memo } from 'react';
import { NODE_W } from '@/lib/layoutTree';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Silhouette } from '@/components/avatar/Silhouette';
import { personDisplayName, toRoman } from '@/lib/treeOps';
import type { Gender, Person } from '@/types';

export type PersonNodeData = {
  person: Person;
  selected: boolean;
  dimmed: boolean;
  generation?: number;
  /** Direct ancestor of the home person — bright connectors */
  onSpine?: boolean;
};

export type PersonFlowNode = Node<PersonNodeData, 'person'>;

const GOLD = '#C5A059';
const RED = '#ff1a1a';
const MALE = '#7E9DC2';
const FEMALE = '#D9909C';

function accentFor(gender?: Gender): string {
  if (gender === 'male') return MALE;
  if (gender === 'female') return FEMALE;
  return GOLD;
}

function extractYear(value?: string): string {
  if (!value) return '';
  const m = value.match(/-?\d{3,4}/);
  return m ? m[0] : value.trim();
}

function yearLine(person: Person): string {
  const b = extractYear(person.birthDate);
  const d = extractYear(person.deathDate);
  if (b && d) return `${b} – ${d}`;
  if (b) return b;
  if (d) return `– ${d}`;
  return '';
}

function PersonNodeInner(props: NodeProps<PersonFlowNode>) {
  const { data } = props;
  const { person, selected, dimmed, generation, onSpine } = data;
  const name = personDisplayName(person);
  const sub = yearLine(person);
  const isPlaceholderName = !name.trim() || /^unknown\b/i.test(name.trim());
  const showQuestion = isPlaceholderName && !person.photoDataUrl;
  const accent = accentFor(person.gender);
  const borderColor = selected ? RED : accent;
  const roman = generation && generation > 0 ? toRoman(generation) : '';
  const nodeW = NODE_W;
  const avatar = 'h-20 w-20';
  const nameCls = 'text-[11px]';
  const yearCls = 'text-[10px] min-h-[14px]';

  return (
    <div
      className={[
        'family-tree-person relative flex flex-col items-center rounded-none border-0 bg-transparent px-0 py-1 transition-all duration-200',
        dimmed ? 'opacity-[0.32]' : onSpine ? 'opacity-100' : 'opacity-[0.78]',
        selected ? 'scale-[1.03]' : '',
      ].join(' ')}
      style={{ width: nodeW }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1.5 !w-1.5 !border !border-[#C5A059]/80 !bg-[#121212] !opacity-100"
      />
      <div className="relative">
        <div
          className={[
            'relative shrink-0 overflow-hidden rounded-full border-2 bg-[#1a1a1a] transition-[border-color,box-shadow] duration-200',
            avatar,
            onSpine ? 'border-[2.5px]' : '',
          ].join(' ')}
          style={{
            borderColor,
            boxShadow: selected
              ? `0 0 14px ${RED}73`
              : onSpine
                ? `0 0 10px ${accent}55, inset 0 0 0 1px ${accent}40`
                : `inset 0 0 0 1px ${accent}26`,
          }}
        >
          {person.photoDataUrl ? (
            <img
              src={person.photoDataUrl}
              alt=""
              className="h-full w-full object-cover contrast-[0.92] saturate-[0.78]"
            />
          ) : showQuestion ? (
            <div
              className="flex h-full w-full items-center justify-center font-['Montserrat',system-ui,sans-serif] text-2xl font-semibold"
              style={{ color: accent }}
            >
              ?
            </div>
          ) : (
            <Silhouette
              gender={person.gender}
              color={accent}
              className="h-full w-full"
            />
          )}
        </div>
        {roman ? (
          <div
            className="absolute -bottom-1 -right-1 flex min-h-[18px] min-w-[22px] items-center justify-center rounded-full border bg-[#121212] px-1 font-['Cormorant_Garamond',Georgia,serif] text-[10px] font-semibold leading-none tracking-wider"
            style={{ borderColor: accent, color: accent }}
            title={`Generation ${generation}`}
          >
            {roman}
          </div>
        ) : null}
      </div>
      <div className="mt-2 w-full px-0.5 text-center">
        <div
          className={`line-clamp-2 font-semibold leading-tight text-white font-['Montserrat',system-ui,sans-serif] ${nameCls}`}
        >
          {name || '—'}
        </div>
        <div
          className={`truncate font-medium font-['Montserrat',system-ui,sans-serif] ${yearCls}`}
          style={{ color: `${accent}cc` }}
        >
          {sub}
        </div>
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
