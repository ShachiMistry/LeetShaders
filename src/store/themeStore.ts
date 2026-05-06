import { create } from 'zustand';
import { darkColors, lightColors, darkTheme, lightTheme, setColorMode, type ColorPalette } from '../theme';
import type { Theme } from '@mui/material/styles';

type Mode = 'light' | 'dark';

interface ThemeState {
  mode: Mode;
  colors: ColorPalette;
  muiTheme: Theme;
  toggle: () => void;
}

function getInitialMode(): Mode {
  try {
    const saved = localStorage.getItem('ls_theme_mode');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

const initial = getInitialMode();
setColorMode(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initial,
  colors: initial === 'dark' ? darkColors : lightColors,
  muiTheme: initial === 'dark' ? darkTheme : lightTheme,
  toggle: () =>
    set((state) => {
      const next: Mode = state.mode === 'dark' ? 'light' : 'dark';
      setColorMode(next);
      try { localStorage.setItem('ls_theme_mode', next); } catch {}
      return {
        mode: next,
        colors: next === 'dark' ? darkColors : lightColors,
        muiTheme: next === 'dark' ? darkTheme : lightTheme,
      };
    }),
}));
