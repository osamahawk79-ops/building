import { UserProfile, Category, Lecture, LMSConfig } from './types';

// Detect environment to set the BASE_URL dynamically
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = window.location.origin;

// Auth Listeners & Local State
type AuthCallback = (userProfile: UserProfile | null) => void;
const authListeners: Set<AuthCallback> = new Set();

// Load cached profile synchronously to prevent screen flickers
const getCachedProfile = (): UserProfile | null => {
  const cached = localStorage.getItem('on_premise_user_profile');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return null;
    }
  }
  return null;
};
let currentUserProfile: UserProfile | null = getCachedProfile();

const getHeaders = () => {
  const token = localStorage.getItem('on_premise_user_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Check local auth on boot
const initAuth = async () => {
  const token = localStorage.getItem('on_premise_user_token');
  if (!token) {
    triggerAuthChange(null);
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('on_premise_user_token');
      triggerAuthChange(null);
      return;
    }
    if (!res.ok) throw new Error('Session invalid');
    const data = await res.json();
    triggerAuthChange(data.profile);
  } catch (err) {
    console.error('Failed to connect to local server. Please ensure it is running.', err);
    // Keep cached profile if it exists, do not remove token on connection failures
    if (!currentUserProfile) {
      triggerAuthChange(null);
    }
  }
};

function triggerAuthChange(profile: UserProfile | null) {
  currentUserProfile = profile;
  if (profile) {
    localStorage.setItem('on_premise_user_profile', JSON.stringify(profile));
  } else {
    localStorage.removeItem('on_premise_user_profile');
  }
  authListeners.forEach(cb => cb(profile));
}

setTimeout(initAuth, 10);

export const apiService = {
  onAuthStateChanged(callback: AuthCallback) {
    authListeners.add(callback);
    callback(currentUserProfile);
    return () => {
      authListeners.delete(callback);
    };
  },

  async signInWithGoogle(): Promise<void> {
    try {
      // 1. Check if Google Client ID is configured on the server
      const urlRes = await fetch(`${BASE_URL}/api/auth/google/url`);
      if (urlRes.ok) {
        const { url } = await urlRes.json();
        // Open a popup for Google login
        return new Promise<void>((resolve, reject) => {
          const width = 500, height = 600;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          const popup = window.open(url, 'Google Login', `width=${width},height=${height},left=${left},top=${top}`);
          
          const listener = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
              localStorage.setItem('on_premise_user_token', event.data.token);
              triggerAuthChange(event.data.profile);
              window.removeEventListener('message', listener);
              resolve();
            } else if (event.data?.type === 'GOOGLE_AUTH_FAILURE') {
              window.removeEventListener('message', listener);
              reject(new Error(event.data.error || 'Google login failed'));
            }
          };
          
          window.addEventListener('message', listener);
          
          const interval = setInterval(() => {
            if (popup?.closed) {
              clearInterval(interval);
              window.removeEventListener('message', listener);
              reject(new Error('تم إغلاق نافذة تسجيل الدخول من قبل المستخدم'));
            }
          }, 1000);
        });
      }
    } catch (e) {
      console.warn("Real Google OAuth not available or failed to fetch config, falling back to offline developer sign-in...", e);
    }

    // Fallback: Offline developer sign-in
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'osamahawk3@gmail.com', name: 'المهندس أسامة (مطور)' })
    });
    if (!res.ok) throw new Error('Auth Failed');
    const data = await res.json();
    localStorage.setItem('on_premise_user_token', data.token || data.profile.uid);
    triggerAuthChange(data.profile);
  },

  async signIn(email: string, password?: string): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Login Failed');
    const data = await res.json();
    localStorage.setItem('on_premise_user_token', data.data.token || data.data.profile.uid);
    triggerAuthChange(data.data.profile);
    return data.data.profile;
  },

  async signUp(email: string, username: string, role: 'admin' | 'user' = 'user'): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, role })
    });
    if (!res.ok) throw new Error('Registration Failed');
    const data = await res.json();
    localStorage.setItem('on_premise_user_token', data.data.token || data.data.profile.uid);
    triggerAuthChange(data.data.profile);
    return data.data.profile;
  },

  async signUpWithPassword(email: string, username: string, password?: string, roleInput?: 'admin' | 'user'): Promise<UserProfile> {
    return this.signUp(email, username, roleInput);
  },

  async signOut() {
    localStorage.removeItem('on_premise_user_token');
    triggerAuthChange(null);
  },

  async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const isAdminUpdate = currentUserProfile?.role === 'admin';
    const endpoint = isAdminUpdate ? `${BASE_URL}/api/admin/users/${userId}/subscription` : `${BASE_URL}/api/auth/profile`;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Update Failed');
    const respData = await res.json();
    if (userId === currentUserProfile?.uid) triggerAuthChange(respData.data.profile);
    return respData.data.profile;
  },

  async getSiteConfig(): Promise<LMSConfig> {
    const res = await fetch(`${BASE_URL}/api/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    const data = await res.json();
    return data.data.settings;
  },

  async saveSiteConfig(config: LMSConfig): Promise<LMSConfig> {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save settings');
    const data = await res.json();
    return data.data.settings;
  },

  async listCategories(): Promise<Category[]> {
    const res = await fetch(`${BASE_URL}/api/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    const data = await res.json();
    return data.data.categories;
  },

  async saveCategory(category: Category): Promise<Category> {
    const res = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(category)
    });
    if (!res.ok) throw new Error('Failed to save category');
    const data = await res.json();
    return data.data.category;
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/categories/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to delete category');
  },

  async listLectures(): Promise<Lecture[]> {
    const res = await fetch(`${BASE_URL}/api/lectures`);
    if (!res.ok) throw new Error('Failed to fetch lectures');
    const data = await res.json();
    return data.data.lectures;
  },

  async mediaAudit(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/api/admin/media-audit`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to audit media');
    const data = await res.json();
    return data.data.audit;
  },

  async smartRelink(lectureId: string): Promise<{ success: boolean, message: string, newPath?: string }> {
    const res = await fetch(`${BASE_URL}/api/lectures/${lectureId}/smart-relink`, {
      method: 'POST',
      headers: getHeaders()
    });
    return await res.json();
  },

  async updateVideoPath(lectureId: string, newPath: string): Promise<{ success: boolean, lecture?: Lecture, error?: string }> {
    const res = await fetch(`${BASE_URL}/api/lectures/${lectureId}/update-video-path`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPath })
    });
    return await res.json();
  },

  async saveLecture(lecture: Lecture): Promise<Lecture> {
    const res = await fetch(`${BASE_URL}/api/lectures`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(lecture)
    });
    if (!res.ok) throw new Error('Failed to save lecture');
    const data = await res.json();
    return data.data.lecture;
  },

  async deleteLecture(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/lectures/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to delete lecture');
  },

  async listUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${BASE_URL}/api/admin/users`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.data.users;
  },

  async uploadFile(file: File, options?: { type?: 'video' | 'attachment' | 'thumbnail', section?: string, lectureId?: string }): Promise<{ url: string, name: string }> {
    const formData = new FormData();
    if (options?.type) formData.append('type', options.type);
    if (options?.section) formData.append('section', options.section);
    if (options?.lectureId) formData.append('lectureId', options.lectureId);
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('on_premise_user_token') || ''}` },
      body: formData
    });
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload Failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return { url: data.path, name: file.name };
  },

  async updateUserQuota(userId: string, data: { maxDownloads?: number, resetCounter?: boolean }): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/api/admin/users/${userId}/quota`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update quota');
    const respData = await res.json();
    return respData.profile;
  },

  async trackDownload(lectureId: string): Promise<{ success: boolean, counter?: number, message?: string }> {
    const res = await fetch(`${BASE_URL}/api/lectures/${lectureId}/download-track`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw await res.json();
    return await res.json();
  },

  async verifyAllLocalFiles(): Promise<{ results: any[] }> {
    const res = await fetch(`${BASE_URL}/api/local-files/verify-all`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to verify files');
    return await res.json();
  },

  async checkLocalFile(path: string): Promise<{ exists: boolean, readable?: boolean, error?: string, errorCode?: string, simulated?: boolean }> {
    const res = await fetch(`${BASE_URL}/api/local-files/check?path=${encodeURIComponent(path)}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to check file');
    return await res.json();
  },

  async updateLocalFilePath(id: string, newPath: string, lectureId?: string, fileType?: string): Promise<{ success: boolean, file?: any }> {
    const res = await fetch(`${BASE_URL}/api/local-files/update-path`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id, newPath, lectureId, fileType })
    });
    if (!res.ok) throw new Error('Failed to update file path');
    return await res.json();
  },

  async getSystemDrives(): Promise<{ drives: string[], error?: string }> {
    const res = await fetch(`${BASE_URL}/api/system/drives`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch drives');
    return await res.json();
  },

  async listSystemDir(path: string): Promise<{ 
    items: Array<{ name: string, isDirectory: boolean, fullPath: string, size?: number, mtime?: string, extension?: string }>, 
    currentPath?: string,
    parentPath?: string | null,
    error?: string 
  }> {
    const res = await fetch(`${BASE_URL}/api/system/ls?path=${encodeURIComponent(path)}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to list directory');
    return await res.json();
  },

  async clearLocalFilesRecords(): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/local-files/clear-all`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to clear records');
    return await res.json();
  },

  async getStreamToken(lectureId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/lectures/${lectureId}/stream-token`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'فشل الحصول على رمز الأمان للبث');
    }
    const data = await res.json();
    return data.token;
  },

  async getDownloadToken(lectureId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/lectures/${lectureId}/download-token`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'فشل الحصول على رمز الأمان للتحميل');
    }
    const data = await res.json();
    return data.token;
  },

  async uploadSystemFile(file: File, type: 'video' | 'attachment' | 'thumbnail' | 'branding', onProgress?: (progress: number) => void): Promise<{ success: boolean, path?: string, filename?: string, originalName?: string, error?: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/api/system/upload?type=${type}`, true);
      
      const headers = getHeaders();
      Object.keys(headers).forEach(key => {
        if (key.toLowerCase() !== 'content-type') {
          xhr.setRequestHeader(key, headers[key as keyof typeof headers]);
        }
      });

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch (e) {
          resolve({ success: false, error: 'فشل تحليل استجابة السيرفر' });
        }
      };

      xhr.onerror = () => resolve({ success: false, error: 'فشل الاتصال بالسيرفر' });
      xhr.send(formData);
    });
  },

  async verifyPath(path: string): Promise<{ exists: boolean, isDirectory?: boolean, size?: number, name?: string, error?: string }> {
    const res = await fetch(`${BASE_URL}/api/system/verify-path`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path })
    });
    return res.json();
  },

  async openNativePicker(type: 'video' | 'attachment'): Promise<{ success: boolean, path?: string, cancelled?: boolean, error?: string }> {
    const res = await fetch(`${BASE_URL}/api/system/native-picker?type=${type}`, {
      headers: getHeaders()
    });
    return res.json();
  },

  async linkLocalMedia(lectureId: string, path: string, type: 'video' | 'attachment'): Promise<{ success: boolean, lecture: Lecture, error?: string }> {
    const res = await fetch(`${BASE_URL}/api/admin/lectures/${lectureId}/link-local-media`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path, type })
    });
    return res.json();
  },

  async updateMediaFolders(folders: string[]): Promise<{ success: boolean, folders: string[], error?: string }> {
    const res = await fetch(`${BASE_URL}/api/admin/settings/media-folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ folders })
    });
    return res.json();
  },

  async getEnvInfo(): Promise<{ isLocal: boolean, isCloud: boolean, envType: string }> {
    const res = await fetch(`${BASE_URL}/api/env-info`, {
      headers: getHeaders()
    });
    return res.json();
  }
};
