import { create } from 'zustand';

/**
 * First-run guidance: the product tour and the setup checklist. Both are per-browser conveniences kept in
 * localStorage, so the app must work the same when storage is unavailable.
 */
const TOUR_OFF = 'jantahr:tour:off'; // set by automated captures so the tour never covers a screenshot
const tourKey = (userId: string) => `jantahr:tour:v1:${userId}`;
const guideKey = (companyId: string) => `jantahr:setup-guide:hidden:${companyId}`;

const read = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
};

interface OnboardingState {
  tourOpen: boolean;
  guideHidden: boolean;
  startTour: () => void;
  /** Closes the tour and remembers that this user has seen it. */
  endTour: (userId: string) => void;
  loadGuide: (companyId: string) => void;
  setGuideHidden: (companyId: string, hidden: boolean) => void;
}

export const tourSeen = (userId: string) => read(TOUR_OFF) === '1' || read(tourKey(userId)) === '1';

export const useOnboardingStore = create<OnboardingState>((set) => ({
  tourOpen: false,
  guideHidden: false,
  startTour: () => set({ tourOpen: true }),
  endTour: (userId) => { write(tourKey(userId), '1'); set({ tourOpen: false }); },
  loadGuide: (companyId) => set({ guideHidden: read(guideKey(companyId)) === '1' }),
  setGuideHidden: (companyId, hidden) => { write(guideKey(companyId), hidden ? '1' : null); set({ guideHidden: hidden }); },
}));
