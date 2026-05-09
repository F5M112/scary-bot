import { create } from 'zustand';
import { authAPI } from './api';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,

  login: async (username, password) => {
    const { data } = await authAPI.login(username, password);
    localStorage.setItem('token', data.token);
    set({ user: data.user, loading: false });
    return data.user;
  },

  fetchUser: async () => {
    try {
      const { data } = await authAPI.me();
      set({ user: data.user, loading: false });
      return data.user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('token');
    set({ user: null });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },
}));
