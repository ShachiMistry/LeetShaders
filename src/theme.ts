import { createTheme, type Theme } from '@mui/material/styles';

export interface ColorPalette {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderHover: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  danger: string;
}

export const darkColors: ColorPalette = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceHover: '#1c2129',
  border: '#21262d',
  borderHover: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textTertiary: '#484f58',
  accent: '#58a6ff',
  accentHover: '#79c0ff',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
};

export const lightColors: ColorPalette = {
  bg: '#ffffff',
  surface: '#f6f8fa',
  surfaceHover: '#eaeef2',
  border: '#d0d7de',
  borderHover: '#afb8c1',
  textPrimary: '#1f2328',
  textSecondary: '#656d76',
  textTertiary: '#8b949e',
  accent: '#0969da',
  accentHover: '#0550ae',
  success: '#1a7f37',
  warning: '#9a6700',
  danger: '#cf222e',
};

let colors: ColorPalette = darkColors;

export function getColors(): ColorPalette {
  return colors;
}

export function setColorMode(mode: 'light' | 'dark') {
  colors = mode === 'light' ? lightColors : darkColors;
}

export { colors };

function buildTheme(c: ColorPalette, mode: 'light' | 'dark'): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { main: c.accent },
      secondary: { main: c.success },
      background: {
        default: c.bg,
        paper: c.surface,
      },
      text: {
        primary: c.textPrimary,
        secondary: c.textSecondary,
      },
      success: { main: c.success },
      warning: { main: c.warning },
      error: { main: c.danger },
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: 14,
      h1: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, letterSpacing: '-0.03em' },
      h2: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      h3: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      h4: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      h5: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      h6: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600 },
      button: { fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 4 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: c.bg },
        },
      },
      MuiButton: {
        defaultProps: { disableRipple: true },
        styleOverrides: {
          root: {
            borderRadius: 4,
            fontWeight: 500,
            fontSize: '0.78rem',
            lineHeight: 1.4,
            minWidth: 0,
          },
          sizeSmall: {
            padding: '4px 12px',
            fontSize: '0.72rem',
          },
          contained: {
            backgroundColor: c.success,
            color: '#ffffff',
            boxShadow: 'none',
            '&:hover': { backgroundColor: mode === 'dark' ? '#2ea043' : '#15803d', boxShadow: 'none' },
            '&.Mui-disabled': { backgroundColor: c.border, color: c.textTertiary },
          },
          outlined: {
            borderColor: c.border,
            color: c.textSecondary,
            '&:hover': { borderColor: c.borderHover, backgroundColor: c.surfaceHover, color: c.textPrimary },
          },
          text: {
            color: c.textSecondary,
            '&:hover': { backgroundColor: c.surfaceHover, color: c.textPrimary },
          },
        },
      },
    },
  });
}

export const darkTheme = buildTheme(darkColors, 'dark');
export const lightTheme = buildTheme(lightColors, 'light');

export const theme = darkTheme;
