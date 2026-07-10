// Admin-API-client (brief §9). Alle endpoints zijn admin-guarded op de server.

import type { PresetName } from '../config/compression';
import { api } from './api';

export interface TeacherRow {
  username: string;
  email: string;
  classes: string[];
  hasPassword: boolean;
}
export interface AdminRow {
  email: string;
  bootstrap: boolean;
}
export interface ClassStorage {
  id: string;
  albums: number;
  photos: number;
  bytes: number;
}
export interface StorageOverview {
  classes: ClassStorage[];
  totalBytes: number;
  usedGb: number;
  capGb: number;
  warn: boolean;
  capReached: boolean;
}
export interface ExportAlbum {
  name: string;
  items: { id: string; url: string }[];
}

export const adminApi = {
  getTeachers: () => api.get<{ teachers: TeacherRow[] }>('/api/admin/teachers'),
  upsertTeacher: (t: { username: string; email: string; classes: string[]; password?: string }) =>
    api.post<{ ok: true }>('/api/admin/teachers', t),
  deleteTeacher: (username: string) =>
    api.del<{ ok: true }>(`/api/admin/teachers?username=${encodeURIComponent(username)}`),

  getAdmins: () => api.get<{ admins: AdminRow[] }>('/api/admin/admins'),
  addAdmin: (email: string) => api.post<{ ok: true }>('/api/admin/admins', { email }),
  deleteAdmin: (email: string) =>
    api.del<{ ok: true }>(`/api/admin/admins?email=${encodeURIComponent(email)}`),

  clearPasswords: () => api.post<{ ok: true; cleared: number }>('/api/admin/passwords/clear'),

  getStorage: () => api.get<StorageOverview>('/api/admin/storage'),
  getSettings: () => api.get<{ pinnedPreset: PresetName | null }>('/api/admin/settings'),
  setPinnedPreset: (pinnedPreset: PresetName | null) =>
    api.post<{ ok: true; pinnedPreset: PresetName | null }>('/api/admin/settings', { pinnedPreset }),

  armBypass: () => api.post<{ ok: true; bypassUntil: number }>('/api/admin/bypass'),

  getExport: (classId: string) => api.get<{ albums: ExportAlbum[] }>(`/api/admin/export/${classId}`),

  wipe: (confirm: string) =>
    api.post<{ ok: true; deletedObjects: number; freedBytes: number }>('/api/admin/wipe', {
      confirm,
    }),
};
