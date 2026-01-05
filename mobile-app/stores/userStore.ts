import { create } from 'zustand';
import { AvailabilityStatus } from '../lib/types';

interface UserState {
  currentStatus: AvailabilityStatus | null;
  setCurrentStatus: (status: AvailabilityStatus) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentStatus: null,
  setCurrentStatus: (status) => set({ currentStatus: status }),
}));

