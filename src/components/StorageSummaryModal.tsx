import React from 'react';
import {
  X,
  PieChart,
  HardDrive,
  Folder,
  File,
  RefreshCw,
  ArrowRight,
  Database,
  Layers,
  Clock,
  Sparkles,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';
import { StorageUsageSummary } from '../types';
import { formatBytes, formatDate } from '../services/cryptoClient';

interface StorageSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: StorageUsageSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToFolder: (prefix: string) => void;
  onDeleteFolder?: (prefix: string) => void;
  onMoveFolder?: (folder: { name: string; prefix: string; fileCount: number; totalSizeBytes: number }) => void;
}

const FOLDER_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
];

export const StorageSummaryModal: React.FC<StorageSummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  isLoading,
  onRefresh,
  onNavigateToFolder,
  onDeleteFolder,
  onMoveFolder,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <PieChart className="w-4 sm:w-5 h-4 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 truncate">
                <span className="truncate">Ringkasan Pemakaian Storage</span>
                <span className="hidden sm:inline-block text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded flex-shrink-0">
                  Cloudflare R2
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate">
                Bucket: <span className="text-slate-300 font-semibold">{summary?.bucket || 'printpro-storage'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700 disabled:opacity-50"
              title="Pindai ulang seluruh bucket"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isLoading ? 'Memindai...' : 'Pindai Ulang'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs min-w-0">
          {isLoading && !summary ? (
            <div className="space-y-6 animate-pulse">
              {/* Skeleton Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="h-3 w-20 bg-slate-800 rounded" />
                    <div className="h-6 w-24 bg-slate-800 rounded font-mono" />
                    <div className="h-2 w-16 bg-slate-800/60 rounded" />
                  </div>
                ))}
              </div>

              {/* Skeleton Distribution Bar */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="h-3 w-40 bg-slate-800 rounded" />
                <div className="h-3.5 w-full bg-slate-800 rounded-full" />
              </div>

              {/* Skeleton Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40 p-4 space-y-3">
                <div className="h-4 w-32 bg-slate-800 rounded mb-2" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50">
                    <div className="h-3.5 w-36 bg-slate-800 rounded" />
                    <div className="h-3.5 w-16 bg-slate-800 rounded" />
                    <div className="h-3.5 w-20 bg-slate-800 rounded" />
                    <div className="h-3.5 w-24 bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : summary ? (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Total Storage Used */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-medium">Total Pemakaian</span>
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-100 font-mono">
                    {formatBytes(summary.totalBucketSize)}
                  </div>
                  <span className="text-[10px] text-slate-500">Seluruh isi bucket</span>
                </div>

                {/* Total Objects */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-medium">Total Objek/File</span>
                    <Database className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-100 font-mono">
                    {summary.totalBucketFiles}
                  </div>
                  <span className="text-[10px] text-slate-500">Berkas aktif tersimpan</span>
                </div>

                {/* Total Folders */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-medium">Total Folder</span>
                    <Folder className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-100 font-mono">
                    {summary.folders.length}
                  </div>
                  <span className="text-[10px] text-slate-500">Direktori terdaftar</span>
                </div>

                {/* Root Files */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-medium">File di Direktori Root</span>
                    <File className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xl font-bold text-slate-100 font-mono">
                    {summary.rootFilesCount}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {formatBytes(summary.rootFilesSize)} ({summary.rootPercentage}%)
                  </span>
                </div>
              </div>

              {/* Visual Storage Distribution Bar */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Distribusi Pemakaian Berdasarkan Folder</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total: {formatBytes(summary.totalBucketSize)}
                  </span>
                </div>

                {/* Stacked Percentage Bar */}
                <div className="h-3.5 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                  {summary.rootPercentage > 0 && (
                    <div
                      style={{ width: `${Math.max(summary.rootPercentage, 1)}%` }}
                      className="bg-slate-400 h-full transition-all duration-500"
                      title={`Root: ${formatBytes(summary.rootFilesSize)} (${summary.rootPercentage}%)`}
                    />
                  )}
                  {summary.folders.map((f, i) => (
                    <div
                      key={f.prefix}
                      style={{ width: `${Math.max(f.percentage, 1)}%` }}
                      className={`${FOLDER_COLORS[i % FOLDER_COLORS.length]} h-full transition-all duration-500`}
                      title={`${f.name}: ${formatBytes(f.totalSizeBytes)} (${f.percentage}%)`}
                    />
                  ))}
                </div>

                {/* Legend Chips */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                  {summary.rootFilesCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <span className="text-slate-300">Root / Berkas Utama</span>
                      <span className="text-slate-500 font-mono">({summary.rootPercentage}%)</span>
                    </div>
                  )}
                  {summary.folders.map((f, i) => (
                    <div key={f.prefix} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${FOLDER_COLORS[i % FOLDER_COLORS.length]}`} />
                      <span className="text-slate-300 font-medium">{f.name}</span>
                      <span className="text-slate-500 font-mono">({f.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folder Breakdown Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
                <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Rincian Total Tiap Folder</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Dipindai: {new Date(summary.scannedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/60">
                        <th className="py-2.5 px-4 font-medium">Folder / Path Direktori</th>
                        <th className="py-2.5 px-4 font-medium text-center">Jumlah File</th>
                        <th className="py-2.5 px-4 font-medium text-right">Total Ukuran</th>
                        <th className="py-2.5 px-4 font-medium">Porsi Pemakaian</th>
                        <th className="py-2.5 px-4 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {/* Root Row */}
                      {summary.rootFilesCount > 0 && (
                        <tr className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-200 flex items-center gap-2">
                            <File className="w-4 h-4 text-slate-400" />
                            <span>/ (Root Bucket)</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-300">
                            {summary.rootFilesCount} file
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                            {formatBytes(summary.rootFilesSize)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="bg-slate-400 h-full rounded-full"
                                  style={{ width: `${summary.rootPercentage}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] text-slate-400">
                                {summary.rootPercentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                onNavigateToFolder('');
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] inline-flex items-center gap-1 font-medium"
                            >
                              <span>Buka</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      )}

                      {/* Folder Rows */}
                      {summary.folders.map((folder, index) => (
                        <tr key={folder.prefix} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-200 flex items-center gap-2">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                FOLDER_COLORS[index % FOLDER_COLORS.length]
                              }`}
                            />
                            <Folder className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="font-semibold text-slate-100">{folder.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({folder.prefix})</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                              {folder.fileCount} file
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                            {formatBytes(folder.totalSizeBytes)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`${
                                    FOLDER_COLORS[index % FOLDER_COLORS.length]
                                  } h-full rounded-full`}
                                  style={{ width: `${Math.max(folder.percentage, 1)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] text-slate-300 font-semibold">
                                {folder.percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  onNavigateToFolder(folder.prefix);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-colors text-[11px] inline-flex items-center gap-1 font-semibold"
                              >
                                <span>Buka Folder</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              {onMoveFolder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onMoveFolder({
                                      name: folder.name,
                                      prefix: folder.prefix,
                                      fileCount: folder.fileCount,
                                      totalSizeBytes: folder.totalSizeBytes,
                                    });
                                    onClose();
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-sky-950/70 border border-slate-800 hover:border-sky-800 text-slate-400 hover:text-sky-400 transition-colors"
                                  title={`Pindahkan folder ${folder.name} ke bucket atau endpoint lain`}
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteFolder && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Hapus folder "${folder.name}" (${folder.fileCount} file, ${formatBytes(
                                          folder.totalSizeBytes
                                        )}) beserta seluruh isinya secara permanen dari Cloudflare R2 / S3?`
                                      )
                                    ) {
                                      onDeleteFolder(folder.prefix);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-colors"
                                  title={`Hapus folder ${folder.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Gagal memuat ringkasan. Silakan coba klik tombol "Pindai Ulang".
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            {summary
              ? `${summary.totalBucketFiles} total file tersimpan (${formatBytes(summary.totalBucketSize)})`
              : 'Menghubungkan ke Cloudflare R2...'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
