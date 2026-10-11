import React, { useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  X,
  FileText,
  Folder,
  Layers,
  Database,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { formatBytes } from '../services/cryptoClient';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'file' | 'folder' | 'batch' | 'endpoint';
  title?: string;
  name: string;
  path?: string;
  size?: number;
  fileCount?: number;
  itemsList?: string[];
  warningMessage?: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  targetType,
  title,
  name,
  path,
  size,
  fileCount,
  itemsList = [],
  warningMessage,
  confirmText,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Caller should handle error toasts
    } finally {
      setIsDeleting(false);
    }
  };

  const getHeaderInfo = () => {
    switch (targetType) {
      case 'file':
        return {
          defaultTitle: 'Hapus File Secara Permanen',
          icon: <FileText className="w-5 h-5 text-rose-400" />,
          badge: 'Berkas Cloud',
          badgeColor: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
        };
      case 'folder':
        return {
          defaultTitle: 'Hapus Folder & Isinya',
          icon: <Folder className="w-5 h-5 text-amber-400" />,
          badge: 'Folder Cloud',
          badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
        };
      case 'batch':
        return {
          defaultTitle: 'Hapus Berkas Terpilih',
          icon: <Layers className="w-5 h-5 text-rose-400" />,
          badge: 'Batch Delete',
          badgeColor: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
        };
      case 'endpoint':
        return {
          defaultTitle: 'Hapus Profil Endpoint',
          icon: <Database className="w-5 h-5 text-indigo-400" />,
          badge: 'S3 / R2 Endpoint',
          badgeColor: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60',
        };
    }
  };

  const { defaultTitle, icon, badge, badgeColor } = getHeaderInfo();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div
        className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl shadow-rose-950/20 overflow-hidden animate-scale-in transition-all flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-start justify-between gap-3 bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex-shrink-0 shadow-inner">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-base font-bold text-slate-100">
                  {title || defaultTitle}
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${badgeColor}`}>
                  {badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">
                {name}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors disabled:opacity-50 flex-shrink-0"
            title="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          {/* Critical Warning Box */}
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-200 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-rose-300">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>Konfirmasi Tindakan Permanen</span>
            </div>
            <p className="text-rose-200/90 leading-relaxed text-[11px]">
              {warningMessage ||
                (targetType === 'folder'
                  ? `Folder "${name}" dan seluruh berkas di dalamnya akan dihapus dari storage. Berkas terenkripsi yang sudah dihapus tidak dapat dipulihkan kembali.`
                  : targetType === 'batch'
                  ? `${itemsList.length || 'Berkas-berkas'} yang dipilih akan dihapus secara permanen dari storage tanpa bisa dikembalikan.`
                  : targetType === 'endpoint'
                  ? `Profil endpoint "${name}" akan dihapus dari konfigurasi. Data di cloud tidak terhapus, tetapi aplikasi tidak lagi terhubung ke endpoint ini.`
                  : `Berkas "${name}" akan dihapus secara permanen dari Cloudflare R2 / S3 storage.`)}
            </p>
          </div>

          {/* Target Item Details Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/60 pb-2">
              <span className="flex items-center gap-1.5 font-medium">
                {icon}
                <span className="text-slate-300">Target Penghapusan:</span>
              </span>
              {size !== undefined && size > 0 && (
                <span className="font-mono text-emerald-400 font-semibold text-xs">
                  {formatBytes(size)}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2 text-[11px]">
                <span className="text-slate-500 flex-shrink-0">Nama:</span>
                <span className="font-medium text-slate-200 text-right break-all">
                  {name}
                </span>
              </div>

              {path && (
                <div className="flex items-start justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 flex-shrink-0">Path / Key:</span>
                  <span className="font-mono text-slate-400 text-right break-all text-[10px]">
                    {path}
                  </span>
                </div>
              )}

              {fileCount !== undefined && (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Jumlah Isi:</span>
                  <span className="font-medium text-amber-400">
                    {fileCount.toLocaleString('id-ID')} berkas
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Batch Files Preview List (if batch deletion) */}
          {targetType === 'batch' && itemsList.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Daftar Berkas Terpilih ({itemsList.length}):</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-slate-950/50 p-2 rounded-xl border border-slate-800/80 font-mono text-[10px]">
                {itemsList.map((itemKey, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 py-1 px-2 rounded bg-slate-900/80 border border-slate-800 text-slate-300 truncate"
                  >
                    <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="truncate flex-1">{itemKey}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Pastikan Anda telah mengunduh cadangan jika berkas ini masih dibutuhkan.</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleExecute}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-950/50 transition-all flex items-center gap-1.5 disabled:opacity-50 hover:shadow-rose-600/30"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmText || 'Ya, Hapus Permanen'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
