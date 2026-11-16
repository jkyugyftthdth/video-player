import { AccentTheme } from '@/src/types/video';

export interface AccentPalette {
  label: string;
  hexDark: string;
  hexLight: string;
  buttonBg: string;
  buttonText: string;
  activeText: string;
  indicatorBg: string;
  ring: string;
}

export const ACCENT_PALETTES: Record<AccentTheme, AccentPalette> = {
  sky: {
    label: 'Fluent Blue',
    hexDark: '#60cdff',
    hexLight: '#0067c0',
    buttonBg: 'bg-[#0067c0] dark:bg-[#60cdff] hover:bg-[#005a9e] dark:hover:bg-[#7ad5ff]',
    buttonText: 'text-white dark:text-[#0f172a]',
    activeText: 'text-[#0067c0] dark:text-[#60cdff]',
    indicatorBg: 'bg-[#0067c0] dark:bg-[#60cdff]',
    ring: 'focus-visible:ring-[#0067c0] dark:focus-visible:ring-[#60cdff]',
  },
  amber: {
    label: 'Warm Amber',
    hexDark: '#fbbf24',
    hexLight: '#b45309',
    buttonBg: 'bg-amber-700 dark:bg-amber-400 hover:bg-amber-800 dark:hover:bg-amber-300',
    buttonText: 'text-white dark:text-stone-950',
    activeText: 'text-amber-700 dark:text-amber-400',
    indicatorBg: 'bg-amber-700 dark:bg-amber-400',
    ring: 'focus-visible:ring-amber-600 dark:focus-visible:ring-amber-400',
  },
  emerald: {
    label: 'Forest Mint',
    hexDark: '#34d399',
    hexLight: '#047857',
    buttonBg: 'bg-emerald-700 dark:bg-emerald-400 hover:bg-emerald-800 dark:hover:bg-emerald-300',
    buttonText: 'text-white dark:text-emerald-950',
    activeText: 'text-emerald-700 dark:text-emerald-400',
    indicatorBg: 'bg-emerald-700 dark:bg-emerald-400',
    ring: 'focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-400',
  },
  rose: {
    label: 'Crimson Silk',
    hexDark: '#fb7185',
    hexLight: '#be123c',
    buttonBg: 'bg-rose-700 dark:bg-rose-400 hover:bg-rose-800 dark:hover:bg-rose-300',
    buttonText: 'text-white dark:text-rose-950',
    activeText: 'text-rose-700 dark:text-rose-400',
    indicatorBg: 'bg-rose-700 dark:bg-rose-400',
    ring: 'focus-visible:ring-rose-600 dark:focus-visible:ring-rose-400',
  },
};
