export interface ProjectIconStyle {
  bg: string;
  text: string;
  letter: string;
}

const PALETTE: Omit<ProjectIconStyle, 'letter'>[] = [
  { bg: 'bg-[#F27020]', text: 'text-white' },
  { bg: 'bg-[#0078D4]', text: 'text-white' },
  { bg: 'bg-[#FFC107]', text: 'text-slate-900' },
  { bg: 'bg-emerald-500', text: 'text-white' },
  { bg: 'bg-violet-500', text: 'text-white' },
  { bg: 'bg-rose-500', text: 'text-white' },
];

export function getProjectIconStyle(title: string, id: number): ProjectIconStyle {
  const letter = (title?.trim().charAt(0) || 'P').toUpperCase();
  let hash = id;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = PALETTE[Math.abs(hash) % PALETTE.length];
  return { ...palette, letter };
}
