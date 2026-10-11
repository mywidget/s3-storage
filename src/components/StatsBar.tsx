import React from 'react';
import { Database, Lock, FolderSync, HardDrive, Folder, PieChart, ArrowUpRight } from 'lucide-react';
import { formatBytes } from '../services/cryptoClient';
import { StorageFile, StorageUsageSummary } from '../types';

interface StatsBarProps {
  files: StorageFile[];
  autoSyncActive: boolean;
  syncIntervalSec: number;
  summary?: StorageUsageSummary | null;
  isLoadingSummary?: boolean;
  onOpenSummary?: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  files,
  autoSyncActive,
  syncIntervalSec,
  summary,
  isLoadingSummary,
  onOpenSummary,
}) => {
  const totalEncryptedSize = files.reduce((acc, f) => acc + f.size, 0);
  const totalOriginalSize = files.reduce((acc, f) => acc + (f.originalSize || f.size), 0);
  const encryptedCount = files.filter((f) => f.isEncrypted).length;

  // Real aggregate numbers from summary if available
  const totalBucketFiles = summary ? summary.totalBucketFiles : files.length;
  const totalBucketSize = summary ? summary.totalBucketSize : totalEncryptedSize;
  const totalFoldersCount = summary ? summary.folders.length : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 my-3 sm:my-6">
      {/* Total Objects in Bucket */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between min-w-0">
        <div>
          <p className="text-xs font-medium text-slate-400">Total Objek di Cloud</p>
          <div className="mt-1 flex items-baseline gap-2">
            {isLoadingSummary && !summary ? (
              <span className="h-7 w-16 bg-slate-800/80 rounded animate-pulse inline-block" />
            ) : (
              <span className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {totalBucketFiles.toLocaleString('id-ID')}
              </span>
            )}
            <span className="text-xs text-slate-500 font-mono">
              {summary ? 'seluruh bucket' : 'file tersimpan'}
            </span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-slate-300">
          <Database className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Storage Used (All Files) */}
      <div
        onClick={onOpenSummary}
        className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between cursor-pointer hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all group min-w-0"
        title="Klik untuk melihat ringkasan total tiap folder"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-slate-400">Total Pemakaian Storage</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            {isLoadingSummary && !summary ? (
              <span className="h-7 w-24 bg-slate-800/80 rounded animate-pulse inline-block" />
            ) : (
              <span className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {formatBytes(totalBucketSize)}
              </span>
            )}
            <span className="text-[11px] text-emerald-400 font-medium group-hover:underline">
              Rincian Folder
            </span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
          <HardDrive className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* Folders Summary */}
      <div
        onClick={onOpenSummary}
        className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between cursor-pointer hover:border-sky-500/40 hover:bg-slate-900/90 transition-all group min-w-0"
        title="Klik untuk membuka tabel pemakaian per folder"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-slate-400">Total Folder Terdaftar</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
          </div>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            {isLoadingSummary && !summary ? (
              <span className="h-7 w-12 bg-slate-800/80 rounded animate-pulse inline-block" />
            ) : (
              <span className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
                {totalFoldersCount.toLocaleString('id-ID')}
              </span>
            )}
            <span className="text-xs text-sky-400/90 font-mono">
              {summary ? `${summary.folders.length} direktori` : 'folder'}
            </span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-sky-950/30 border border-sky-800/40 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform flex-shrink-0">
          <Folder className="w-5 h-5 text-sky-400" />
        </div>
      </div>

      {/* Sync Engine / Encryption Status */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between min-w-0">
        <div>
          <p className="text-xs font-medium text-slate-400">Mesin Sinkronisasi</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-100">
              {autoSyncActive ? 'Aktif' : 'On-Demand'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {autoSyncActive ? `tiap ${syncIntervalSec}s` : 'AES-256-GCM'}
            </span>
          </div>
        </div>
        <div
          className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
            autoSyncActive
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
              : 'bg-slate-800/80 border-slate-700/50 text-slate-400'
          }`}
        >
          <FolderSync className={`w-5 h-5 ${autoSyncActive ? 'animate-spin-slow' : ''}`} />
        </div>
      </div>
    </div>
  );
};
