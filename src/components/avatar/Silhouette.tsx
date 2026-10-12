import type { Gender } from '@/types';

type Props = {
  gender?: Gender;
  color?: string;
  className?: string;
  opacity?: number;
};

export function Silhouette({ gender, color, className, opacity = 0.45 }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ color }}
      aria-hidden="true"
    >
      <g fill="currentColor" opacity={opacity}>
        {gender === 'female' ? (
          <>
            <path d="M26 40 Q26 14 50 14 Q74 14 74 40 L74 58 Q63 51 50 51 Q37 51 26 58 Z" opacity="0.55" />
            <circle cx="50" cy="36" r="13" />
            <path d="M6 100 Q6 60 50 58 Q94 60 94 100 Z" />
          </>
        ) : gender === 'male' ? (
          <>
            <circle cx="50" cy="34" r="14" />
            <path d="M14 100 Q14 56 50 56 Q86 56 86 100 Z" />
          </>
        ) : (
          <>
            <circle cx="50" cy="36" r="13" />
            <path d="M16 100 Q16 58 50 58 Q84 58 84 100 Z" />
          </>
        )}
      </g>
    </svg>
  );
}
