import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { FileBrowser } from './components/FileBrowser';
import { UploadModal } from './components/UploadModal';
import { SyncPanel } from './components/SyncPanel';
import { CryptoDetailsModal } from './components/CryptoDetailsModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { SyncLogDrawer } from './components/SyncLogDrawer';
import { LoginForm } from './components/LoginForm';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { StorageSummaryModal } from './components/StorageSummaryModal';
import { api } from './services/api';
import { StorageFile, StorageHealth, SyncLogEntry, AuthUser, StorageUsageSummary, StorageEndpointProfile } from './types';

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const [endpoints, setEndpoints] = useState<StorageEndpointProfile[]>([]);
  const [activeEndpointId, setActiveEndpointId] = useState<string>('');

  const [files, setFiles] = useState<StorageFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folderStatsMap, setFolderStatsMap] = useState<Record<string, { fileCount: number; totalSizeBytes: number }>>({});
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(50);
  const [isRecursive, setIsRecursive] = useState<boolean>(false);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const [nextContinuationToken, setNextContinuationToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [summary, setSummary] = useState<StorageUsageSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [health, setHealth] = useState<StorageHealth>({ status: 'checking' });
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [cryptoFile, setCryptoFile] = useState<StorageFile | null>(null);

  // Sync state
  const [autoSyncActive, setAutoSyncActive] = useState<boolean>(false);
  const [syncIntervalSec, setSyncIntervalSec] = useState<number>(30);
  const [localFiles, setLocalFiles] = useState<
    Array<{ name: string; path: string; size: number; lastModified: string; file: File }>
  >([]);
  const [localFolderName, setLocalFolderName] = useState<string>('');
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);

  // Toast / notification feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const addLog = useCallback((entry: SyncLogEntry) => {
    setLogs((prev) => [entry, ...prev.slice(0, 199)]); // Keep last 200 logs
  }, []);

  // Fetch Storage Health
  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      setHealth({ status: 'error', message: 'Koneksi ke storage gagal' });
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Fetch Files
  const loadFiles = useCallback(
    async (
      targetPrefix?: string,
      customLimit?: number,
      recursive?: boolean,
      appendToken?: string | null
    ) => {
      const activePrefix = targetPrefix !== undefined ? targetPrefix : currentPrefix;
      const activeLimit = customLimit !== undefined ? customLimit : limit;
      const activeRecursive = recursive !== undefined ? recursive : isRecursive;

      if (appendToken) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingFiles(true);
      }
      try {
        const res = await api.listFiles(activePrefix, {
          limit: activeLimit,
          recursive: activeRecursive,
          continuationToken: appendToken || undefined,
        });

        if (appendToken) {
          setFiles((prev) => [...prev, ...res.files]);
        } else {
          setFiles(res.files);
        }
        setFolders(res.folders || []);
        if (res.folderStats) {
          setFolderStatsMap((prev) => ({ ...prev, ...res.folderStats }));
        }
        setCurrentPrefix(activePrefix);
        setIsTruncated(Boolean(res.isTruncated));
        setNextContinuationToken(res.nextContinuationToken || null);
        setFilesError(null);
      } catch (err: any) {
        if (!appendToken) {
          setFiles([]);
          setFolders([]);
        }
        setFilesError(err.message || 'Gagal memuat file dari Cloudflare R2 / S3');
        showToast(err.message || 'Gagal memuat file dari Cloudflare R2', 'error');
      } finally {
        setIsLoadingFiles(false);
        setIsLoadingMore(false);
      }
    },
    [currentPrefix, limit, isRecursive]
  );

  const handleCreateFolder = async (folderPath: string) => {
    try {
      const res = await api.createFolder(folderPath);
      showToast(res.message, 'success');
      handleRefreshAll();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat folder', 'error');
    }
  };

  const handleLoadMore = () => {
    if (nextContinuationToken) {
      loadFiles(currentPrefix, limit, isRecursive, nextContinuationToken);
    }
  };

  const loadStorageSummary = useCallback(async (force = false) => {
    setIsLoadingSummary(true);
    try {
      const s = await api.getStorageSummary(force);
      setSummary(s);
    } catch (err: any) {
      console.error('Failed to load storage summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setIsLoadingFiles(true);
    setIsLoadingSummary(true);
    try {
      await Promise.all([
        loadFiles(currentPrefix, limit, isRecursive),
        loadStorageSummary(true),
        checkHealth(),
      ]);
      showToast('Daftar berkas & total storage berhasil disinkronkan!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat ulang data storage', 'error');
    } finally {
      setIsLoadingFiles(false);
      setIsLoadingSummary(false);
    }
  }, [currentPrefix, limit, isRecursive, loadFiles, loadStorageSummary, checkHealth]);

  const loadEndpoints = useCallback(async () => {
    try {
      const data = await api.getEndpoints();
      setEndpoints(data.endpoints);
      setActiveEndpointId(data.activeEndpointId);
    } catch (err) {
      console.error('Failed to load endpoints:', err);
    }
  }, []);

  const handleSwitchEndpoint = async (endpointId: string) => {
    try {
      setIsLoadingFiles(true);
      const res = await api.switchEndpoint(endpointId);
      setActiveEndpointId(res.activeEndpointId);
      setCurrentPrefix('');
      showToast(res.message || `Beralih ke endpoint: ${res.activeEndpoint.name}`, 'info');
      await Promise.all([
        loadEndpoints(),
        checkHealth(),
        loadFiles('', limit, isRecursive),
        loadStorageSummary(true),
      ]);
    } catch (err: any) {
      showToast(err.message || 'Gagal beralih endpoint', 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Auth & Initial Load on Mount Only
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await api.getMe();
        setAuthUser(user);
        checkHealth();
        loadEndpoints();
        loadFiles('', 50, false);
        loadStorageSummary();
      } catch {
        setAuthUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    showToast(`Selamat datang kembali, ${user.username}!`, 'success');
    checkHealth();
    loadEndpoints();
    loadFiles('');
    loadStorageSummary();
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthUser(null);
    showToast('Berhasil keluar dari CloudVault', 'info');
  };

  // Handlers
  const handleDownloadDecrypted = async (file: StorageFile) => {
    const startTime = Date.now();
    try {
      showToast(`Mendekripsi AES-256-GCM & mengunduh "${file.name}"...`, 'info');
      const { blob, filename } = await api.downloadFile(file.key, { decrypt: true });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      showToast(`"${file.name}" berhasil didekripsi & disimpan!`, 'success');
      addLog({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        type: 'download',
        fileName: file.name,
        fileSize: blob.size,
        status: 'success',
        message: 'File berhasil didekripsi on-the-fly dengan verifikasi integritas hash SHA-256',
        durationMs: Date.now() - startTime,
      });
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh file', 'error');
      addLog({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        type: 'download',
        fileName: file.name,
        status: 'failed',
        message: `Gagal mendekripsi: ${err.message}`,
      });
    }
  };

  const handleDownloadRaw = async (file: StorageFile) => {
    try {
      showToast(`Mengunduh ciphertext mentah "${file.name}"...`, 'info');
      const { blob, filename } = await api.downloadFile(file.key, { decrypt: false });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.enc') ? filename : `${filename}.enc`;
      a.click();
      URL.revokeObjectURL(url);

      showToast(`Ciphertext mentah tersimpan (${filename})`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh ciphertext', 'error');
    }
  };

  const handleDeleteFile = async (file: StorageFile) => {
    try {
      await api.deleteFile(file.key);
      showToast(`File "${file.name}" dihapus dari Cloudflare R2`, 'success');
      addLog({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        type: 'delete',
        fileName: file.name,
        status: 'success',
        message: `File objek ${file.key} berhasil dihapus dari bucket`,
      });
      loadFiles();
      loadStorageSummary();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus file', 'error');
    }
  };

  const handleBatchDelete = async (keys: string[]) => {
    try {
      const res = await api.batchDeleteFiles(keys);
      showToast(`${res.deletedCount} file berhasil dihapus`, 'success');
      addLog({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        type: 'delete',
        fileName: `${res.deletedCount} file batch`,
        status: 'success',
        message: `Batch delete berhasil untuk ${res.deletedCount} objek`,
      });
      loadFiles();
      loadStorageSummary();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus file terpilih', 'error');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-slate-500">Memverifikasi sesi CloudVault...</span>
      </div>
    );
  }

  if (!authUser) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 max-w-[calc(100vw-2rem)] sm:max-w-md px-4 py-2.5 rounded-xl border text-xs shadow-2xl flex items-center gap-2 animate-bounce-subtle ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-300'
              : 'bg-slate-900/90 border-slate-700 text-slate-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-400'
                : toast.type === 'error'
                ? 'bg-rose-400'
                : 'bg-sky-400'
            }`}
          />
          <span className="font-medium truncate">{toast.message}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        health={health}
        isCheckingHealth={isCheckingHealth}
        onRefreshHealth={handleRefreshAll}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        autoSyncActive={autoSyncActive}
        pendingSyncCount={localFiles.length}
        user={authUser}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        endpoints={endpoints}
        activeEndpointId={activeEndpointId}
        onSwitchEndpoint={handleSwitchEndpoint}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 min-w-0">
        {/* Statistics Bar */}
        <StatsBar
          files={files}
          autoSyncActive={autoSyncActive}
          syncIntervalSec={syncIntervalSec}
          summary={summary}
          isLoadingSummary={isLoadingSummary}
          onOpenSummary={() => setIsSummaryModalOpen(true)}
        />

        {/* File Browser Component */}
        <FileBrowser
          files={files}
          folders={folders}
          currentPrefix={currentPrefix}
          onNavigateFolder={(prefix) => loadFiles(prefix, limit, isRecursive)}
          isLoading={isLoadingFiles}
          onRefresh={handleRefreshAll}
          onDownloadDecrypted={handleDownloadDecrypted}
          onDownloadRaw={handleDownloadRaw}
          onPreview={(file) => setPreviewFile(file)}
          onInspectCrypto={(file) => setCryptoFile(file)}
          onDelete={handleDeleteFile}
          onBatchDelete={handleBatchDelete}
          onOpenUpload={() => setIsUploadOpen(true)}
          limit={limit}
          onChangeLimit={(newLimit) => {
            setLimit(newLimit);
            loadFiles(currentPrefix, newLimit, isRecursive);
          }}
          isRecursive={isRecursive}
          onToggleRecursive={(rec) => {
            setIsRecursive(rec);
            loadFiles(currentPrefix, limit, rec);
          }}
          onCreateFolder={handleCreateFolder}
          isTruncated={isTruncated}
          onLoadMore={handleLoadMore}
          isLoadingMore={isLoadingMore}
          summary={summary}
          onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
          folderStatsMap={folderStatsMap}
          filesError={filesError}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </main>

      {/* Modals and Drawers */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          handleRefreshAll();
          showToast('File berhasil dienkripsi dan diunggah ke Cloudflare R2!', 'success');
        }}
        currentFolder={currentPrefix}
      />

      <SyncPanel
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        cloudFiles={files}
        onSyncComplete={() => {
          loadFiles();
          showToast('Sinkronisasi file selesai!', 'success');
        }}
        autoSyncActive={autoSyncActive}
        onToggleAutoSync={setAutoSyncActive}
        syncIntervalSec={syncIntervalSec}
        onChangeSyncInterval={setSyncIntervalSec}
        localFiles={localFiles}
        onSetLocalFiles={setLocalFiles}
        localFolderName={localFolderName}
        onSetLocalFolderName={setLocalFolderName}
        onAddLog={addLog}
      />

      <CryptoDetailsModal
        file={cryptoFile}
        isOpen={Boolean(cryptoFile)}
        onClose={() => setCryptoFile(null)}
      />

      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownloadDecrypted={handleDownloadDecrypted}
        onDownloadRaw={handleDownloadRaw}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeEndpointId={activeEndpointId}
        onSwitchEndpoint={handleSwitchEndpoint}
        onConfigUpdated={() => {
          loadEndpoints();
          checkHealth();
          loadFiles('', limit, isRecursive);
          loadStorageSummary(true);
          showToast('Konfigurasi storage berhasil diperbarui & disinkronkan!', 'success');
        }}
      />

      <SyncLogDrawer
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        logs={logs}
        onClearLogs={() => setLogs([])}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        user={authUser}
        onSuccess={(msg) => showToast(msg, 'success')}
      />

      <StorageSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summary={summary}
        isLoading={isLoadingSummary}
        onRefresh={() => loadStorageSummary(true)}
        onNavigateToFolder={(prefix) => loadFiles(prefix, limit, isRecursive)}
      />
    </div>
  );
}
