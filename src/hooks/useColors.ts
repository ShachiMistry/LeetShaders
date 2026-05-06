import { useThemeStore } from '../store/themeStore';
import type { ColorPalette } from '../theme';

export function useColors(): ColorPalette {
  return useThemeStore((s) => s.colors);
}
