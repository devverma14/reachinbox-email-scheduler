import axios from 'axios';
import { User, SlackDetails, ScheduledEmail, SentEmail, EmailStats, SearchResult } from '../types';

export const resolveApiBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!envUrl) {
    return '/api';
  }
  const cleanUrl = envUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  getMe: async () => {
    const res = await api.get<{ user: User; slackConnected: boolean; slackDetails: SlackDetails | null }>('/auth/me');
    return res.data;
  },

  devLogin: async (email?: string, name?: string) => {
    const res = await api.post<{ user: User }>('/auth/dev-login', { email, name });
    return res.data;
  },

  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },

  getSlackAuthorizeUrl: async () => {
    const res = await api.get<{ url: string }>('/auth/slack/authorize');
    return res.data.url;
  },

  connectMockSlack: async (channelName?: string) => {
    const res = await api.post<{ slackAccount: SlackDetails }>('/auth/slack/connect-mock', { channelName });
    return res.data;
  },

  disconnectSlack: async () => {
    const res = await api.post('/auth/slack/disconnect');
    return res.data;
  },
};

export const emailApi = {
  schedule: async (payload: {
    senderEmail: string;
    recipients: string[];
    subject: string;
    bodyText: string;
    scheduledAt: string;
    delayBetweenSendsMs: number;
    hourlyLimit: number;
  }) => {
    const res = await api.post('/emails/schedule', payload);
    return res.data;
  },

  getScheduled: async (page = 1, limit = 20, status?: string) => {
    const res = await api.get<{
      data: ScheduledEmail[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/emails/scheduled', { params: { page, limit, status } });
    return res.data;
  },

  getSent: async (page = 1, limit = 20, status?: string) => {
    const res = await api.get<{
      data: SentEmail[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/emails/sent', { params: { page, limit, status } });
    return res.data;
  },

  getStats: async () => {
    const res = await api.get<EmailStats>('/emails/stats');
    return res.data;
  },

  search: async (q: string) => {
    const res = await api.get<{ data: SearchResult[] }>('/emails/search', { params: { q } });
    return res.data.data;
  },

  cancelScheduled: async (logId: string) => {
    const res = await api.delete(`/emails/scheduled/${logId}`);
    return res.data;
  },
};

export const slackApi = {
  sendTestNotification: async (senderEmail: string) => {
    const res = await api.post<{ message: string }>('/slack/test-notification', { senderEmail });
    return res.data;
  },
};

export default api;
