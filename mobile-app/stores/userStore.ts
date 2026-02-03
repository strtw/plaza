import { create } from 'zustand';
import { ContactStatus } from '../lib/types';

interface UserState {
  /** Active status shown in the activity feed (e.g. "Set your status" card). Cleared when status expires or user clears it. */
  currentStatus: ContactStatus | null;
  setCurrentStatus: (status: ContactStatus | null) => void;
  /** Number of friends chosen last time the user finished Add friends (Done). Used by set-status so the "Add some friends:" count persists when navigating set-status → add-friends → set-status. */
  lastAddFriendsCount: number;
  setLastAddFriendsCount: (n: number) => void;
  /** Optimistic mute state so activity row and profile show muted immediately before contacts refetch. */
  locallyMutedContactIds: Set<string>;
  setLocallyMutedContactIds: (ids: Set<string>) => void;
  addLocallyMuted: (id: string) => void;
  removeLocallyMuted: (id: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentStatus: null,
  setCurrentStatus: (status) => set({ currentStatus: status }),
  lastAddFriendsCount: 0,
  setLastAddFriendsCount: (n) => set({ lastAddFriendsCount: n }),
  locallyMutedContactIds: new Set<string>(),
  setLocallyMutedContactIds: (ids) => set({ locallyMutedContactIds: new Set(ids) }),
  addLocallyMuted: (id) =>
    set((s) => {
      const next = new Set(s.locallyMutedContactIds);
      next.add(id);
      return { locallyMutedContactIds: next };
    }),
  removeLocallyMuted: (id) =>
    set((s) => {
      const next = new Set(s.locallyMutedContactIds);
      next.delete(id);
      return { locallyMutedContactIds: next };
    }),
}));

