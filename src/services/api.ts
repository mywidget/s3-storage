import { StorageFile, StorageHealth, StorageConfigInfo, SyncDiffItem, AuthUser, StorageUsageSummary, StorageEndpointProfile } from '../types';

const TOKEN_KEY = 'cloudvault_auth_token';

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async login(identifier: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login gagal.');
    }
    this.setToken(data.token);
    return data;
  },

  async getMe(): Promise<{ user: AuthUser }> {
    const token = this.getToken();
    if (!token) throw new Error('Tidak ada token aktif.');

    const res = await fetch('/api/auth/me', {
      headers: { ...this.getAuthHeaders() },
    });
    const data = await res.json();
    if (!res.ok) {
      this.clearToken();
      throw new Error(data.error || 'Sesi telah kedaluwarsa.');
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { ...this.getAuthHeaders() },
      });
    } finally {
      this.clearToken();
    }
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal mengubah kata sandi.');
    }
    return data;
  },

  async getHealth(): Promise<StorageHealth> {
    const res = await fetch('/api/health');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Gagal mengecek status storage' }));
      return { status: 'error', message: err.message };
    }
    return res.json();
  },

  async getConfig(): Promise<StorageConfigInfo> {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Gagal mengambil konfigurasi storage');
    return res.json();
  },

  async getEndpoints(): Promise<{
    activeEndpointId: string;
    activeEndpoint: StorageEndpointProfile;
    endpoints: StorageEndpointProfile[];
  }> {
    const res = await fetch('/api/endpoints');
    if (!res.ok) throw new Error('Gagal mengambil daftar endpoint');
    return res.json();
  },

  async switchEndpoint(endpointId: string): Promise<{
    success: boolean;
    message: string;
    activeEndpointId: string;
    activeEndpoint: StorageEndpointProfile;
  }> {
    const res = await fetch('/api/endpoints/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal beralih endpoint');
    return data;
  },

  async testEndpoint(payload: {
    endpointId?: string;
    endpoint?: string;
    region?: string;
    bucket?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }): Promise<{ success: boolean; latencyMs: number; message: string; bucket: string }> {
    const res = await fetch('/api/endpoints/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Gagal menguji endpoint');
    return data;
  },

  async upsertEndpoint(payload: {
    id?: string;
    name: string;
    endpoint: string;
    region?: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl?: string;
    makeActive?: boolean;
  }): Promise<{ success: boolean; message: string; endpoint: StorageEndpointProfile }> {
    const res = await fetch('/api/endpoints/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Gagal menyimpan endpoint');
    return data;
  },

  async deleteEndpoint(id: string): Promise<{ success: boolean; message: string; activeEndpointId: string }> {
    const res = await fetch(`/api/endpoints/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus endpoint');
    return data;
  },

  async getStorageSummary(force = false): Promise<StorageUsageSummary> {
    const res = await fetch(`/api/storage/summary?force=${force ? 'true' : 'false'}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.details || 'Gagal mengambil ringkasan pemakaian storage');
    }
    return res.json();
  },

  async updateConfig(payload: {
    endpoint?: string;
    region?: string;
    bucket?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    masterKey?: string;
    publicUrl?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal memperbarui konfigurasi');
    return data;
  },

  async listFiles(
    prefix = '',
    options: {
      limit?: number;
      recursive?: boolean;
      continuationToken?: string;
    } = {}
  ): Promise<{
    files: StorageFile[];
    folders: string[];
    folderStats?: Record<string, { fileCount: number; totalSizeBytes: number }>;
    prefix: string;
    totalCount: number;
    bucket: string;
    publicBaseUrl: string;
    limit: number;
    isTruncated?: boolean;
    nextContinuationToken?: string | null;
  }> {
    const params = new URLSearchParams();
    if (prefix) params.append('prefix', prefix);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.recursive) params.append('recursive', 'true');
    if (options.continuationToken) params.append('continuationToken', options.continuationToken);
    params.append('_t', Date.now().toString());

    const url = `/api/files?${params.toString()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.details || 'Gagal mengambil daftar file');
    }
    return res.json();
  },

  async createFolder(folderPath: string): Promise<{ success: boolean; message: string; folder: string }> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({ folderPath }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.details || 'Gagal membuat folder');
    return data;
  },

  async uploadFile(
    file: File,
    options: {
      folder?: string;
      encrypt?: boolean;
      passphrase?: string;
      onProgress?: (percent: number) => void;
    } = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      if (options.onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            options.onProgress!(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(res);
          } else {
            reject(new Error(res.details || res.error || 'Upload gagal'));
          }
        } catch {
          reject(new Error('Respon server tidak valid'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Koneksi jaringan terputus saat mengunggah'));
      };

      const formData = new FormData();
      formData.append('file', file);
      if (options.folder) formData.append('folder', options.folder);
      formData.append('encrypt', options.encrypt === false ? 'false' : 'true');
      if (options.passphrase) formData.append('passphrase', options.passphrase);

      xhr.send(formData);
    });
  },

  async downloadFile(
    key: string,
    options: { decrypt?: boolean; passphrase?: string; inline?: boolean } = {}
  ): Promise<{ blob: Blob; filename: string; contentType: string }> {
    const params = new URLSearchParams();
    if (options.decrypt === false) params.append('decrypt', 'false');
    if (options.passphrase) params.append('passphrase', options.passphrase);
    if (options.inline) params.append('inline', 'true');

    const res = await fetch(`/api/files/${encodeURIComponent(key)}/download?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal mengunduh file' }));
      throw new Error(err.error || err.details || 'Gagal mengunduh file');
    }

    const contentDisposition = res.headers.get('Content-Disposition') || '';
    let filename = key.split('/').pop() || 'download';
    const match = /filename="?([^"]+)"?/.exec(contentDisposition);
    if (match && match[1]) {
      filename = match[1];
    }

    const blob = await res.blob();
    const contentType = res.headers.get('Content-Type') || 'application/octet-stream';
    return { blob, filename, contentType };
  },

  async getFileMetadata(key: string): Promise<any> {
    const res = await fetch(`/api/files/${encodeURIComponent(key)}/metadata`);
    if (!res.ok) throw new Error('Metadata file tidak ditemukan');
    return res.json();
  },

  async deleteFile(key: string): Promise<void> {
    const res = await fetch(`/api/files/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || 'Gagal menghapus file');
    }
  },

  async batchDeleteFiles(keys: string[]): Promise<{ deletedCount: number }> {
    const res = await fetch('/api/files/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) throw new Error('Gagal menghapus file terpilih');
    return res.json();
  },

  async checkSyncDiff(
    localItems: Array<{ name: string; path: string; size: number; lastModified: string; sha256?: string }>
  ): Promise<{ diff: SyncDiffItem[]; summary: any }> {
    const res = await fetch('/api/sync/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localItems }),
    });
    if (!res.ok) throw new Error('Gagal menganalisis diff sinkronisasi');
    return res.json();
  },
};
