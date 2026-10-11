import React, { useState, useEffect } from 'react';
import {
  X,
  FolderSync,
  FolderOpen,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Clock,
  ShieldCheck,
  FileCheck,
  HardDrive,
} from 'lucide-react';
import { SyncDiffItem, StorageFile } from '../types';
import { formatBytes, formatDate } from '../services/cryptoClient';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cloudFiles: StorageFile[];
  onSyncComplete: () => void;
  autoSyncActive: boolean;
  onToggleAutoSync: (active: boolean) => void;
  syncIntervalSec: number;
  onChangeSyncInterval: (intervalSec: number) => void;
  localFiles: Array<{ name: string; path: string; size: number; lastModified: string; file: File }>;
  onSetLocalFiles: (files: Array<{ name: string; path: string; size: number; lastModified: string; file: File }>) => void;
  localFolderName: string;
  onSetLocalFolderName: (name: string) => void;
  onAddLog: (log: any) => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({
  isOpen,
  onClose,
  cloudFiles,
  onSyncComplete,
  autoSyncActive,
  onToggleAutoSync,
  syncIntervalSec,
  onChangeSyncInterval,
  localFiles,
  onSetLocalFiles,
  localFolderName,
  onSetLocalFolderName,
  onAddLog,
}) => {
  const [diffItems, setDiffItems] = useState<SyncDiffItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSyncIndex, setActiveSyncIndex] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(syncIntervalSec);

  // Scan diff between local items and cloud files
  const runDiffScan = async () => {
    setIsScanning(true);
    try {
      const { api } = await import('../services/api');
      const payload = localFiles.map((l) => ({
        name: l.name,
        path: l.path,
        size: l.size,
        lastModified: l.lastModified,
      }));

      const res = await api.checkSyncDiff(payload);
      // Map local File reference back to diff items
      const enriched = res.diff.map((item) => {
        const found = localFiles.find((l) => l.path === item.key || l.name === item.name);
        return {
          ...item,
          localFile: found?.file,
        };
      });

      setDiffItems(enriched);
      onAddLog({
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        type: 'diff',
        fileName: `${localFiles.length} item lokal vs ${cloudFiles.length} item cloud`,
        status: 'success',
        message: `Pindaian diff selesai: ${res.summary.synced} sinkron, ${res.summary.pendingUpload} pending upload, ${res.summary.modified} termodifikasi.`,
      });
    } catch (err: any) {
      console.error('Diff scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Re-run diff whenever localFiles change
  useEffect(() => {
    if (localFiles.length > 0) {
      runDiffScan();
    } else {
      // If no local files selected, cloud files are all 'cloud_only'
      const cloudOnly = cloudFiles.map((c) => ({
        key: c.key,
        name: c.name,
        status: 'cloud_only' as const,
        cloudSize: c.size,
        cloudModified: c.lastModified,
      }));
      setDiffItems(cloudOnly);
    }
  }, [localFiles, cloudFiles]);

  // Auto-sync countdown timer
  useEffect(() => {
    if (!autoSyncActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger auto-sync execution
          executeSyncQueue();
          return syncIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoSyncActive, syncIntervalSec, diffItems]);

  // Pick local directory using File System Access API or file input fallback
  const handleSelectLocalFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        // Modern File System Access API
        const dirHandle = await (window as any).showDirectoryPicker();
        onSetLocalFolderName(dirHandle.name);

        const scannedFiles: Array<{
          name: string;
          path: string;
          size: number;
          lastModified: string;
          file: File;
        }> = [];

        async function readDirectory(entry: any, currentPath = '') {
          for await (const child of entry.values()) {
            if (child.kind === 'file') {
              const file: File = await child.getFile();
              const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
              scannedFiles.push({
                name: file.name,
                path: relativePath,
                size: file.size,
                lastModified: new Date(file.lastModified).toISOString(),
                file,
              });
            } else if (child.kind === 'directory') {
              const nextPath = currentPath ? `${currentPath}/${child.name}` : child.name;
              await readDirectory(child, nextPath);
            }
          }
        }

        await readDirectory(dirHandle);
        onSetLocalFiles(scannedFiles);
      } else {
        // Fallback file input
        const input = document.createElement('input');
        input.type = 'file';
        (input as any).webkitdirectory = true;
        input.multiple = true;
        input.onchange = (e: any) => {
          const files: FileList = e.target.files;
          if (files && files.length > 0) {
            const list = Array.from(files).map((f) => ({
              name: f.name,
              path: (f as any).webkitRelativePath || f.name,
              size: f.size,
              lastModified: new Date(f.lastModified).toISOString(),
              file: f,
            }));
            const folderName = list[0].path.split('/')[0] || 'LocalWorkspace';
            onSetLocalFolderName(folderName);
            onSetLocalFiles(list);
          }
        };
        input.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert('Gagal membaca direktori lokal: ' + err.message);
      }
    }
  };

  // Perform Synchronization on pending items
  const executeSyncQueue = async () => {
    const pendingItems = diffItems.filter(
      (item) => item.status === 'pending_upload' || item.status === 'modified'
    );

    if (pendingItems.length === 0) return;

    setIsSyncing(true);
    const { api } = await import('../services/api');

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      if (!item.localFile) continue;

      setActiveSyncIndex(i);
      setSyncProgress(10);
      const startTime = Date.now();

      try {
        await api.uploadFile(item.localFile, {
          folder: item.key.includes('/') ? item.key.substring(0, item.key.lastIndexOf('/')) : '',
          encrypt: true,
          onProgress: (p) => setSyncProgress(p),
        });

        // Mark this item as synced
        setDiffItems((prev) =>
          prev.map((d) => (d.key === item.key ? { ...d, status: 'synced' } : d))
        );

        onAddLog({
          id: Math.random().toString(36).slice(2),
          timestamp: new Date().toISOString(),
          type: 'upload',
          fileName: item.name,
          fileSize: item.localSize,
          status: 'success',
          message: `Berhasil dienkripsi (AES-256-GCM) & disinkronkan ke Cloudflare R2`,
          durationMs: Date.now() - startTime,
        });
      } catch (err: any) {
        setDiffItems((prev) =>
          prev.map((d) => (d.key === item.key ? { ...d, status: 'error', error: err.message } : d))
        );
        onAddLog({
          id: Math.random().toString(36).slice(2),
          timestamp: new Date().toISOString(),
          type: 'upload',
          fileName: item.name,
          status: 'failed',
          message: `Gagal sinkronisasi: ${err.message}`,
        });
      }
    }

    setIsSyncing(false);
    setActiveSyncIndex(null);
    setSyncProgress(0);
    onSyncComplete();
  };

  if (!isOpen) return null;

  const counts = {
    synced: diffItems.filter((d) => d.status === 'synced').length,
    pending: diffItems.filter((d) => d.status === 'pending_upload').length,
    modified: diffItems.filter((d) => d.status === 'modified').length,
    cloudOnly: diffItems.filter((d) => d.status === 'cloud_only').length,
  };

  const hasItemsToSync = counts.pending > 0 || counts.modified > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <FolderSync className="w-4 sm:w-5 h-4 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm truncate">Pusat Sinkronisasi File</h3>
              <p className="text-xs text-slate-400 truncate">
                Pencocokan diff otomatis antara folder lokal & bucket Cloudflare R2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 min-w-0">
          {/* Top Control Bar: Folder Picker & Auto-Sync Switch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Folder Source Card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Folder Kerja Lokal (Sinkronisasi)
                </span>
                <p className="text-[11px] text-slate-500 mb-3">
                  Pilih direktori di komputer untuk memantau perubahan file secara otomatis.
                </p>
                <div className="flex items-center gap-2 text-xs bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 mb-3">
                  <FolderOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="font-mono text-slate-200 truncate font-medium">
                    {localFolderName || 'Belum memilih folder'}
                  </span>
                  <span className="text-slate-500 text-[11px] ml-auto">
                    {localFiles.length} file
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSelectLocalFolder}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>{localFolderName ? 'Ganti Folder Lokal' : 'Pilih Folder Lokal'}</span>
              </button>
            </div>

            {/* Auto-Sync Configuration Card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-300">Sinkronisasi Otomatis (Periodic Auto-Sync)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSyncActive}
                      onChange={(e) => onToggleAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Memindai dan mengunggah versi terbaru secara terenkripsi di latar belakang.
                </p>

                {/* Interval Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 text-[11px]">Interval:</span>
                  <div className="flex items-center gap-1">
                    {[15, 30, 60, 300].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => onChangeSyncInterval(sec)}
                        className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          syncIntervalSec === sec
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {autoSyncActive && (
                <div className="mt-3 flex items-center justify-between text-[11px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Auto-Sync Aktif</span>
                  </div>
                  <span className="text-slate-400 font-mono">Pindaian berikutnya: {countdown}s</span>
                </div>
              )}
            </div>
          </div>

          {/* Diff Summary Bar */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              <span className="text-[11px] text-emerald-400 block font-medium">Sinkron (Up-to-Date)</span>
              <span className="text-lg font-bold text-slate-100">{counts.synced}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/40">
              <span className="text-[11px] text-amber-400 block font-medium">Pending Upload</span>
              <span className="text-lg font-bold text-slate-100">{counts.pending}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-900/40">
              <span className="text-[11px] text-blue-400 block font-medium">Termodifikasi</span>
              <span className="text-lg font-bold text-slate-100">{counts.modified}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-900/40">
              <span className="text-[11px] text-purple-400 block font-medium">Hanya di Cloud</span>
              <span className="text-lg font-bold text-slate-100">{counts.cloudOnly}</span>
            </div>
          </div>

          {/* Diff Items Table */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Status File Sinkronisasi</span>
              <button
                type="button"
                onClick={runDiffScan}
                disabled={isScanning}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>Pindai Ulang Perbedaan</span>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-500 text-[11px] bg-slate-900/40 uppercase">
                    <th className="py-2.5 px-4 font-medium">File</th>
                    <th className="py-2.5 px-4 font-medium">Status Diff</th>
                    <th className="py-2.5 px-4 font-medium">Ukuran Lokal</th>
                    <th className="py-2.5 px-4 font-medium">Ukuran Cloud</th>
                    <th className="py-2.5 px-4 font-medium">Perlindungan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                  {diffItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                        Belum ada item untuk dibandingkan. Pilih folder lokal untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    diffItems.map((item, idx) => (
                      <tr key={item.key} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-4 text-slate-200 font-sans font-medium">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block">{item.key}</span>
                        </td>

                        <td className="py-2.5 px-4">
                          {item.status === 'synced' && (
                            <span className="text-emerald-400 flex items-center gap-1 font-sans">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Sinkron
                            </span>
                          )}
                          {item.status === 'pending_upload' && (
                            <span className="text-amber-400 flex items-center gap-1 font-sans">
                              <ArrowUpCircle className="w-3.5 h-3.5" /> Pending Upload
                            </span>
                          )}
                          {item.status === 'modified' && (
                            <span className="text-blue-400 flex items-center gap-1 font-sans">
                              <AlertTriangle className="w-3.5 h-3.5" /> Termodifikasi
                            </span>
                          )}
                          {item.status === 'cloud_only' && (
                            <span className="text-purple-400 flex items-center gap-1 font-sans">
                              <HardDrive className="w-3.5 h-3.5" /> Hanya di Cloud
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-rose-400 font-sans">{item.error || 'Error'}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-slate-400">
                          {item.localSize !== undefined ? formatBytes(item.localSize) : '-'}
                        </td>

                        <td className="py-2.5 px-4 text-slate-400">
                          {item.cloudSize !== undefined ? formatBytes(item.cloudSize) : '-'}
                        </td>

                        <td className="py-2.5 px-4 text-emerald-400 font-sans text-[10px]">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" /> AES-256-GCM
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-2">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            {hasItemsToSync ? (
              <span className="text-amber-300">
                Ada {counts.pending + counts.modified} file yang perlu disinkronkan ke Cloudflare R2.
              </span>
            ) : (
              <span className="text-emerald-400">Semua file lokal telah sinkron dengan cloud!</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={executeSyncQueue}
              disabled={isSyncing || !hasItemsToSync}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {isSyncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>
                    Sync ({activeSyncIndex! + 1}/{counts.pending + counts.modified})...
                  </span>
                </>
              ) : (
                <>
                  <FolderSync className="w-3.5 h-3.5" />
                  <span>Sinkronkan ({counts.pending + counts.modified})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
