import { create } from 'zustand';
import { ContactStatus } from '../lib/types';

interface UserState {
  currentStatus: ContactStatus | null;
  setCurrentStatus: (status: ContactStatus | null) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentStatus: null,
  setCurrentStatus: (status) => set({ currentStatus: status }),
}));

