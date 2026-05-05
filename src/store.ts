import { create } from 'zustand';
import type { Challenge, JudgeResult } from './judge/types';

// Minimal cross-page state per AI_SYSTEMS.md task 5. Keep this lean; prefer
// hooks/props over store for anything not shared across routes.
interface AppState {
  activeChallenge: Challenge | null;
  lastResult: JudgeResult | null;
  setActiveChallenge: (c: Challenge | null) => void;
  setLastResult: (r: JudgeResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeChallenge: null,
  lastResult: null,
  setActiveChallenge: (activeChallenge) => set({ activeChallenge }),
  setLastResult: (lastResult) => set({ lastResult }),
}));
