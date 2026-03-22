export type Technique =
  | 'idle'
  | 'hollowPurple'
  | 'red'
  | 'infiniteVoid'
  | 'malevolentShrine';

/** 미리보기 스켈레톤 색만 유지 (영상과 동일 톤) */
export const TECHNIQUE_CONFIG: Record<Technique, { skeleton: string }> = {
  idle: { skeleton: '#64748b' },
  hollowPurple: { skeleton: '#c084fc' },
  red: { skeleton: '#f87171' },
  infiniteVoid: { skeleton: '#22d3ee' },
  malevolentShrine: { skeleton: '#4ade80' },
};
