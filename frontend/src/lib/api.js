import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Handle 429 (rate limit)
    if (err.response?.status === 429) {
      if (typeof window !== 'undefined') {
        if (!window.__rateLimitToastShown) {
          window.__rateLimitToastShown = true;
          import('react-hot-toast').then((m) => {
            m.default.error('طلبات كثيرة، انتظر قليلاً ثم حدّث الصفحة', { duration: 5000 });
          });
          setTimeout(() => { window.__rateLimitToastShown = false; }, 10000);
        }
      }
      return Promise.reject(err);
    }

    // Handle 401 — but NOT for discord/guilds (token might be expired, handled gracefully)
    const url = err.config?.url || '';
    const isDiscordGuilds = url.includes('discord/guilds') || url.includes('discord/link');

    if (err.response?.status === 401 && !isDiscordGuilds && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────
export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me:    () => api.get('/auth/me'),
  logout:() => api.post('/auth/logout'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  // Discord linking
  linkDiscord:    () => api.get('/auth/discord/link'),
  unlinkDiscord:  () => api.post('/auth/discord/unlink'),
  discordGuilds:  () => api.get('/auth/discord/guilds'),
};

// ── Guilds ───────────────────────────────────────────────────────
export const guildsAPI = {
  list:     () => api.get('/guilds'),
  get:      (id) => api.get(`/guilds/${id}`),
  register: (data) => api.post('/guilds/register', data),
  unregister: (id) => api.delete(`/guilds/${id}`),
  toggle:   (id) => api.post(`/guilds/${id}/toggle`),
  updateSettings: (id, data) => api.patch(`/guilds/${id}/settings`, data),
};

export const welcomeAPI = {
  get:    (guildId)       => api.get(`/welcome/${guildId}`),
  save:   (guildId, data) => api.post(`/welcome/${guildId}`, data),
  test:   (guildId)       => api.post(`/welcome/${guildId}/test`),
  remove: (guildId)       => api.delete(`/welcome/${guildId}`),
};

// ── Tickets ──────────────────────────────────────────────────────
export const ticketsAPI = {
  list:   (guildId, status) => api.get(`/tickets/${guildId}`, { params: { status } }),
  panels: (guildId) => api.get(`/tickets/panels/${guildId}`),
  getPanel:    (guildId, panelId) => api.get(`/tickets/panel/${guildId}/${panelId}`),
  createPanel: (guildId, data)    => api.post(`/tickets/panel/${guildId}`, data),
  updatePanel: (guildId, panelId, data) => api.put(`/tickets/panel/${guildId}/${panelId}`, data),
  deletePanel: (guildId, panelId) => api.delete(`/tickets/panel/${guildId}/${panelId}`),
  channels: (guildId) => api.get(`/tickets/discord-channels/${guildId}`),
  roles:    (guildId) => api.get(`/tickets/discord-roles/${guildId}`),
};

// ── Broadcast ────────────────────────────────────────────────────
export const broadcastAPI = {
  send:    (data) => api.post('/broadcast/send', data),
  logs:    (guildId, page = 1) => api.get(`/broadcast/logs/${guildId}`, { params: { page } }),
  details: (guildId, logId) => api.get(`/broadcast/logs/${guildId}/${logId}`),
};

// ── Bot ──────────────────────────────────────────────────────────
export const botAPI = {
  setToken:    (data) => api.post('/bot/token', data),
  removeToken: (guildId) => api.delete(`/bot/token/${guildId}`),
  status:      (guildId) => api.get(`/bot/status/${guildId}`),
};

// ── Subscription ─────────────────────────────────────────────────
export const subscriptionAPI = {
  plans: () => api.get('/subscription/plans'),
  me:    () => api.get('/subscription/me'),
};

// ── Social Media Alerts ──────────────────────────────────────────
export const socialAPI = {
  platforms: () => api.get('/social/platforms'),
  lookup:    (platform, username) => api.get(`/social/lookup/${platform}/${username}`),
  list:      (guildId) => api.get(`/social/${guildId}`),
  add:       (guildId, data) => api.post(`/social/${guildId}`, data),
  update:    (guildId, channelId, data) => api.put(`/social/${guildId}/${channelId}`, data),
  remove:    (guildId, channelId) => api.delete(`/social/${guildId}/${channelId}`),
};

// ── Adhkar (Islamic Reminders) ───────────────────────────────────
export const adhkarAPI = {
  categories: () => api.get('/adhkar/categories'),
  get:        (guildId) => api.get(`/adhkar/${guildId}`),
  save:       (guildId, data) => api.put(`/adhkar/${guildId}`, data),
  test:       (guildId) => api.post(`/adhkar/${guildId}/test`),
};

// ── Giveaway ─────────────────────────────────────────────────────
export const giveawayAPI = {
  list:   (guildId, status) => api.get(`/giveaway/${guildId}`, { params: { status } }),
  create: (guildId, data) => api.post(`/giveaway/${guildId}`, data),
  end:    (guildId, id) => api.post(`/giveaway/${guildId}/${id}/end`),
  reroll: (guildId, id) => api.post(`/giveaway/${guildId}/${id}/reroll`),
  delete: (guildId, id) => api.delete(`/giveaway/${guildId}/${id}`),
};

// ── Admin ────────────────────────────────────────────────────────
export const adminAPI = {
  stats:        () => api.get('/admin/stats'),
  users:        (params) => api.get('/admin/users', { params }),
  createUser:   (data) => api.post('/admin/users', data),
  updateUser:   (id, data) => api.patch(`/admin/users/${id}`, data),
  deleteUser:   (id) => api.delete(`/admin/users/${id}`),
  resetPassword:(id, newPassword) => api.post(`/admin/users/${id}/reset-password`, { newPassword }),
  setPlan:      (id, plan, duration) => api.post(`/admin/users/${id}/plan`, { plan, duration }),
  banUser:      (id, reason) => api.post(`/admin/users/${id}/ban`, { reason }),
  unbanUser:    (id) => api.post(`/admin/users/${id}/unban`),
  disableUser:  (id) => api.post(`/admin/users/${id}/disable`),
  enableUser:   (id) => api.post(`/admin/users/${id}/enable`),
  guilds:       (params) => api.get('/admin/guilds', { params }),
  forceDisableGuild: (id, reason) => api.post(`/admin/guilds/${id}/force-disable`, { reason }),
  forceEnableGuild:  (id) => api.post(`/admin/guilds/${id}/force-enable`),
  broadcasts:   (params) => api.get('/admin/broadcasts', { params }),
};
