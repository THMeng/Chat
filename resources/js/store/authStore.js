// resources/js/store/authStore.js
import { create } from 'zustand';
import api from '../lib/api';

export const useAuthStore = create((set) => ({
    user:  null,
    token: localStorage.getItem('auth_token') || null,

    login: async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('auth_token', res.data.token);
        set({ user: res.data.user, token: res.data.token });
        return res.data;
    },

    register: async (name, email, password, password_confirmation) => {
        const res = await api.post('/auth/register', {
            name,
            email,
            password,
            password_confirmation,
        });
        localStorage.setItem('auth_token', res.data.token);
        set({ user: res.data.user, token: res.data.token });
        return res.data;
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch {}
        localStorage.removeItem('auth_token');
        set({ user: null, token: null });
    },

    fetchMe: async () => {
        try {
            const res = await api.get('/auth/me');
            set({ user: res.data.user });
        } catch {
            localStorage.removeItem('auth_token');
            set({ user: null, token: null });
        }
    },
}));