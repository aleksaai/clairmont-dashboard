// Static color presets for admin-created custom folder categories.
// Tailwind JIT only compiles class names that appear as full strings
// somewhere in the source — dynamic concatenation breaks. So we
// pre-declare every variant here and the DB only stores the token key.

export type ColorToken =
  | 'blue'
  | 'emerald'
  | 'yellow'
  | 'red'
  | 'purple'
  | 'pink'
  | 'cyan'
  | 'orange';

export interface ColorPreset {
  token: ColorToken;
  label: string;
  color: string;     // text color class (used for label + icon)
  bgColor: string;   // background + border + shadow combo for the card
  swatch: string;    // solid swatch used in the color picker
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    token: 'blue',
    label: 'Blau',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/[0.08] border-blue-400/20 shadow-lg shadow-blue-500/[0.06]',
    swatch: 'bg-blue-500',
  },
  {
    token: 'emerald',
    label: 'Grün',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/[0.08] border-emerald-400/20 shadow-lg shadow-emerald-500/[0.06]',
    swatch: 'bg-emerald-500',
  },
  {
    token: 'yellow',
    label: 'Gelb',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/[0.08] border-yellow-400/20 shadow-lg shadow-yellow-500/[0.06]',
    swatch: 'bg-yellow-500',
  },
  {
    token: 'red',
    label: 'Rot',
    color: 'text-red-400',
    bgColor: 'bg-red-500/[0.08] border-red-400/20 shadow-lg shadow-red-500/[0.06]',
    swatch: 'bg-red-500',
  },
  {
    token: 'purple',
    label: 'Lila',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/[0.08] border-purple-400/20 shadow-lg shadow-purple-500/[0.06]',
    swatch: 'bg-purple-500',
  },
  {
    token: 'pink',
    label: 'Pink',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/[0.08] border-pink-400/20 shadow-lg shadow-pink-500/[0.06]',
    swatch: 'bg-pink-500',
  },
  {
    token: 'cyan',
    label: 'Cyan',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/[0.08] border-cyan-400/20 shadow-lg shadow-cyan-500/[0.06]',
    swatch: 'bg-cyan-500',
  },
  {
    token: 'orange',
    label: 'Orange',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/[0.08] border-orange-400/20 shadow-lg shadow-orange-500/[0.06]',
    swatch: 'bg-orange-500',
  },
];

export function getColorPreset(token: string | null | undefined): ColorPreset {
  return COLOR_PRESETS.find((p) => p.token === token) ?? COLOR_PRESETS[0];
}
