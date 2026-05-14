import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAuthToken } from '../api/client';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      customer: null,
      setSession: (token, customer) => {
        setAuthToken(token);
        set({ token, customer });
      },
      logout: () => {
        setAuthToken(null);
        set({ token: null, customer: null });
      },
      hydrateToken: () => {
        const t = get().token;
        setAuthToken(t || null);
      },
    }),
    {
      name: 'isp-customer-portal',
      partialize: (s) => ({ token: s.token, customer: s.customer }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    }
  )
);
