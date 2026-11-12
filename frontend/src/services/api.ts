import {
  User,
  MediaItem,
  SystemConfig,
  AdminOverviewResponse,
  MediaEstado,
  EventFase,
} from '../types';

const TOKEN_STORAGE_KEY = 'gala_graduacion_jwt_token_v1';
const USER_STORAGE_KEY = 'gala_graduacion_user_v1';
const VISITOR_ID_KEY = 'gala_visitor_device_id_v1';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getVisitorId(): string {
  let vid = localStorage.getItem(VISITOR_ID_KEY);
  if (!vid) {
    vid = 'vis-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem(VISITOR_ID_KEY, vid);
  }
  return vid;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const visitorId = getVisitorId();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (visitorId) {
    headers['X-Visitor-Id'] = visitorId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  // Configuración Pública
  getPublicMediaAndConfig: () =>
    requestJson<{ config: SystemConfig; items: MediaItem[] }>('/api/media/public'),

  // Autenticación por Lista Oficial (Typeahead + PIN 4 dígitos)
  searchUsers: (query: string) =>
    requestJson<{ users: User[] }>(`/api/auth/search?q=${encodeURIComponent(query)}`),

  verifyOrCreatePin: (userId: string, pin: string) =>
    requestJson<{
      status: 'PIN_CREATED' | 'AUTHENTICATED';
      message: string;
      token: string;
      user: User;
    }>('/api/auth/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ userId, pin }),
    }),

  guestAccess: (nombre: string, mesa: string) =>
    requestJson<{
      status: 'GUEST_AUTHENTICATED';
      message: string;
      token: string;
      user: User;
    }>('/api/auth/guest-access', {
      method: 'POST',
      body: JSON.stringify({ nombre, mesa }),
    }),

  getCurrentUser: () => requestJson<{ user: User }>('/api/auth/me'),

  // Subida de Fotos y Videos
  uploadMedia: async (formData: FormData) => {
    return requestJson<{ message: string; item: MediaItem }>('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
  },

  getMyUploads: () => requestJson<{ items: MediaItem[] }>('/api/media/my-uploads'),

  requestTakedown: (mediaId: string, motivo: string, solicitante: string) =>
    requestJson<{ message: string }>(`/api/media/${mediaId}/request-takedown`, {
      method: 'POST',
      body: JSON.stringify({ motivo, solicitante }),
    }),

  reactToMedia: (mediaId: string, tipo: 'CORAZON' | 'ESTRELLA' = 'CORAZON') =>
    requestJson<{
      success: boolean;
      action: 'ADDED' | 'REMOVED' | 'CHANGED';
      user_reaction: 'CORAZON' | 'ESTRELLA' | null;
      counts: { total: number; corazon: number; estrella: number };
    }>(`/api/media/${mediaId}/react`, {
      method: 'POST',
      body: JSON.stringify({ tipo, visitor_id: getVisitorId() }),
    }),

  // Panel Exclusivo de Administradoras
  getAdminOverview: () => requestJson<AdminOverviewResponse>('/api/admin/overview'),

  moderateMedia: (
    mediaId: string,
    estado: MediaEstado,
    restaurarPrivacidad = false
  ) =>
    requestJson<{ message: string; item: MediaItem }>(`/api/admin/media/${mediaId}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, restaurarPrivacidad }),
    }),

  reorderStoryboard: (
    items: Array<{ media_item_id: string; duracion_display_seg?: number; transicion?: string }>
  ) =>
    requestJson<{ message: string }>('/api/admin/storyboard/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  resetUserPin: (userId: string) =>
    requestJson<{ message: string; userId: string }>(`/api/admin/users/${userId}/reset-pin`, {
      method: 'POST',
    }),

  createUser: (payload: {
    nombre_completo: string;
    distintivo_homonimo?: string;
    mesa?: string;
    rol?: 'ALUMNO' | 'ADMIN';
  }) =>
    requestJson<{ message: string; createdCount: number }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateConfig: (payload: Partial<SystemConfig> & { fase_actual?: EventFase }) =>
    requestJson<{ message: string; config: SystemConfig }>('/api/admin/config', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  downloadSequentialZip: async () => {
    const token = getStoredToken();
    const res = await fetch('/api/admin/export-zip', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error('No fue posible generar el archivo ZIP secuencial.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Storyboard_Graduacion_Secuencial.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

