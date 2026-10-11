import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  Copy,
  Folder,
  FileText,
  HardDrive,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Database,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { StorageEndpointProfile, MoveItemTarget, MoveItemResponse } from '../types';
import { api } from '../services/api';
import { formatBytes } from '../services/cryptoClient';

interface MoveStorageItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: MoveItemTarget | null;
  endpoints: StorageEndpointProfile[];
  activeEndpointId: string;
  currentBucket?: string;
  onSuccess: (res: MoveItemResponse) => void;
}

export const MoveStorageItemModal: React.FC<MoveStorageItemModalProps> = ({
  isOpen,
  onClose,
  target,
  endpoints,
  activeEndpointId,
  currentBucket = 'printpro',
  onSuccess,
}) => {
  const [destType, setDestType] = useState<'preset' | 'custom'>('preset');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(activeEndpointId || '');
  const [targetBucket, setTargetBucket] = useState<string>('');
  const [targetFolderPrefix, setTargetFolderPrefix] = useState<string>('');
  const [operation, setOperation] = useState<'move' | 'copy'>('move');

  // Custom endpoint form fields
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customRegion, setCustomRegion] = useState('auto');
  const [customAccessKeyId, setCustomAccessKeyId] = useState('');
  const [customSecretAccessKey, setCustomSecretAccessKey] = useState('');

  // Status and testing
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize selected endpoint and target bucket when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeEp = endpoints.find((e) => e.id === activeEndpointId) || endpoints[0];
      if (activeEp) {
        setSelectedEndpointId(activeEp.id);
        setTargetBucket(activeEp.bucket || currentBucket);
      } else {
        setTargetBucket(currentBucket);
      }
      setTargetFolderPrefix('');
      setOperation('move');
      setVerificationResult(null);
      setSubmitError(null);
    }
  }, [isOpen, activeEndpointId, endpoints, currentBucket]);

  // When selected endpoint profile changes, update target bucket default
  const handleEndpointSelect = (id: string) => {
    setSelectedEndpointId(id);
    const chosen = endpoints.find((e) => e.id === id);
    if (chosen) {
      setTargetBucket(chosen.bucket);
      setVerificationResult(null);
    }
  };

  if (!isOpen || !target) return null;

  const currentEndpointProfile = endpoints.find((e) => e.id === activeEndpointId) || endpoints[0];
  const targetEndpointProfile =
    destType === 'preset' ? endpoints.find((e) => e.id === selectedEndpointId) : null;

  const isSameEndpoint =
    destType === 'preset' &&
    currentEndpointProfile &&
    targetEndpointProfile &&
    currentEndpointProfile.endpoint === targetEndpointProfile.endpoint;

  const isSameBucket = isSameEndpoint && currentBucket === targetBucket.trim();

  // Test target bucket connection
  const handleVerifyTarget = async () => {
    if (!targetBucket.trim()) {
      setVerificationResult({ success: false, message: 'Masukkan nama bucket tujuan terlebih dahulu.' });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await api.verifyTargetBucket({
        endpointId: destType === 'preset' ? selectedEndpointId : undefined,
        endpoint: destType === 'custom' ? customEndpoint.trim() : undefined,
        region: destType === 'custom' ? customRegion.trim() : undefined,
        bucket: targetBucket.trim(),
        accessKeyId: destType === 'custom' ? customAccessKeyId.trim() : undefined,
        secretAccessKey: destType === 'custom' ? customSecretAccessKey.trim() : undefined,
      });
      setVerificationResult({ success: true, message: res.message });
    } catch (err: any) {
      setVerificationResult({ success: false, message: err.message || 'Gagal mengakses bucket tujuan' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Submit Move / Copy
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBucket.trim()) {
      setSubmitError('Nama bucket tujuan wajib diisi.');
      return;
    }

    if (destType === 'custom' && !customEndpoint.trim()) {
      setSubmitError('S3 Endpoint URL wajib diisi untuk endpoint kustom.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let payload: any = {
        type: target.type,
        operation,
        targetBucket: targetBucket.trim(),
        targetFolderPrefix: targetFolderPrefix.trim(),
      };

      if (destType === 'preset') {
        payload.targetEndpointId = selectedEndpointId;
      } else {
        payload.targetEndpoint = customEndpoint.trim();
        payload.targetRegion = customRegion.trim() || 'auto';
        payload.targetAccessKeyId = customAccessKeyId.trim();
        payload.targetSecretAccessKey = customSecretAccessKey.trim();
      }

      if (target.type === 'file') {
        payload.sourceKey = target.sourcePath;
      } else if (target.type === 'batch_files') {
        payload.sourceKeys = target.keys || [target.sourcePath];
      } else if (target.type === 'folder') {
        payload.sourceFolder = target.sourcePath;
      }

      const res = await api.moveItem(payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal memproses pemindahan storage');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute preview destination key/folder
  const cleanTargetPrefix = targetFolderPrefix.replace(/^\/+/, '').replace(/\/+$/, '');
  const destinationPreviewPath = () => {
    if (target.type === 'file') {
      const fileName = target.name;
      return cleanTargetPrefix ? `${cleanTargetPrefix}/${fileName}` : fileName;
    }
    if (target.type === 'batch_files') {
      const count = target.keys?.length || 1;
      return cleanTargetPrefix ? `${cleanTargetPrefix}/[${count} file]` : `/[${count} file di root]`;
    }
    if (target.type === 'folder') {
      const folderBase = target.name;
      return cleanTargetPrefix ? `${cleanTargetPrefix}/${folderBase}/` : `${folderBase}/`;
    }
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>Pindahkan / Salin Objek Storage</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-normal uppercase bg-slate-800 text-sky-400 border border-slate-700">
                  {target.type === 'folder'
                    ? 'Folder'
                    : target.type === 'batch_files'
                    ? 'Batch File'
                    : 'File'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pindahkan ke bucket lain dalam endpoint yang sama atau ke endpoint multi-cloud berbeda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs flex-1">
          {/* Source Item Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">Sumber Asal</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                Bucket: <strong className="text-emerald-400">{currentBucket}</strong>
              </span>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex-shrink-0 mt-0.5">
                {target.type === 'folder' ? (
                  <Folder className="w-4 h-4 text-emerald-400" />
                ) : (
                  <FileText className="w-4 h-4 text-sky-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-200 truncate text-sm">{target.name}</div>
                <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  Path: {target.sourcePath}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                  {target.fileCount !== undefined && (
                    <span>
                      Jumlah File: <strong className="text-slate-200">{target.fileCount}</strong>
                    </span>
                  )}
                  {target.totalSize !== undefined && (
                    <span>
                      Total Ukuran: <strong className="text-slate-200">{formatBytes(target.totalSize)}</strong>
                    </span>
                  )}
                  <span>
                    Endpoint:{' '}
                    <strong className="text-slate-200">
                      {currentEndpointProfile ? currentEndpointProfile.name : 'Endpoint Aktif'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Operation Mode Selector: Move vs Copy */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Metode Eksekusi:</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setOperation('move')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                  operation === 'move'
                    ? 'bg-sky-950/30 border-sky-500/80 text-sky-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${operation === 'move' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-900 text-slate-500'}`}>
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Pindahkan (Move)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Salin ke tujuan, lalu hapus berkas sumber (True Move).
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOperation('copy')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                  operation === 'copy'
                    ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${operation === 'copy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-900 text-slate-500'}`}>
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Salin Saja (Copy)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Gandakan ke tujuan tanpa menghapus berkas asal.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Destination Selection Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-300 font-medium">Pilih Endpoint Tujuan:</label>
              <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setDestType('preset')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    destType === 'preset'
                      ? 'bg-slate-800 text-slate-200 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Endpoint Tersimpan ({endpoints.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('custom')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    destType === 'custom'
                      ? 'bg-slate-800 text-slate-200 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Kustom S3 Endpoint
                </button>
              </div>
            </div>

            {destType === 'preset' ? (
              <div className="space-y-3">
                <select
                  value={selectedEndpointId}
                  onChange={(e) => handleEndpointSelect(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                >
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name} — {ep.bucket} ({ep.endpoint.replace('https://', '')})
                      {ep.id === activeEndpointId ? ' [Endpoint Saat Ini]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Endpoint URL (e.g. MinIO / Wasabi / AWS):
                    </label>
                    <input
                      type="text"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="https://s3.ap-southeast-1.amazonaws.com"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Region:</label>
                    <input
                      type="text"
                      value={customRegion}
                      onChange={(e) => setCustomRegion(e.target.value)}
                      placeholder="auto atau us-east-1"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Access Key ID:</label>
                    <input
                      type="text"
                      value={customAccessKeyId}
                      onChange={(e) => setCustomAccessKeyId(e.target.value)}
                      placeholder="S3 Access Key"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Secret Access Key:</label>
                    <input
                      type="password"
                      value={customSecretAccessKey}
                      onChange={(e) => setCustomSecretAccessKey(e.target.value)}
                      placeholder="S3 Secret Key"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Destination Bucket & Route Pill */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Nama Bucket Tujuan:</span>
              </label>

              {/* Dynamic Route Pill Indicator */}
              {isSameBucket ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  📁 Dalam Bucket yang Sama
                </span>
              ) : isSameEndpoint ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/80">
                  🔄 Satu Endpoint • Beda Bucket
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/60 text-sky-300 border border-sky-800/80">
                  🌐 Lintas Multi-Cloud S3
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={targetBucket}
                onChange={(e) => {
                  setTargetBucket(e.target.value);
                  setVerificationResult(null);
                }}
                placeholder="Nama bucket tujuan..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={handleVerifyTarget}
                disabled={isVerifying || !targetBucket.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
                title="Periksa apakah bucket tujuan dapat diakses dan valid"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Uji Akses Bucket</span>
                  </>
                )}
              </button>
            </div>

            {/* Verification result feedback */}
            {verificationResult && (
              <div
                className={`mt-2 p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                  verificationResult.success
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                {verificationResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{verificationResult.message}</span>
              </div>
            )}
          </div>

          {/* Destination Folder / Path Prefix */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">
              Direktori / Folder Tujuan di Bucket:
            </label>
            <div className="relative">
              <Folder className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={targetFolderPrefix}
                onChange={(e) => setTargetFolderPrefix(e.target.value)}
                placeholder="Kosongkan untuk root bucket (/), atau ketik nama folder (e.g. backup/2026/)"
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>

            {/* Quick folder shortcut chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] text-slate-500">Pintasan:</span>
              <button
                type="button"
                onClick={() => setTargetFolderPrefix('')}
                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-[10px]"
              >
                / (Root Bucket)
              </button>
              <button
                type="button"
                onClick={() => setTargetFolderPrefix('backup/')}
                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-[10px]"
              >
                backup/
              </button>
              <button
                type="button"
                onClick={() => setTargetFolderPrefix('archives/')}
                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-[10px]"
              >
                archives/
              </button>
            </div>
          </div>

          {/* Live Visual Route Flow Preview */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Pratinjau Alur Pemindahan:
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex-1 min-w-0">
                <span className="text-[10px] text-slate-500 block">Dari:</span>
                <span className="font-mono text-emerald-400 font-medium truncate block">
                  [{currentBucket}] / {target.sourcePath}
                </span>
              </div>

              <div className="flex items-center justify-center p-1 text-sky-400">
                <ArrowRight className="w-4 h-4 hidden sm:block" />
                <span className="sm:hidden text-[10px] text-sky-400">menuju ke</span>
              </div>

              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex-1 min-w-0">
                <span className="text-[10px] text-slate-500 block">Ke:</span>
                <span className="font-mono text-sky-400 font-medium truncate block">
                  [{targetBucket || '...'}] / {destinationPreviewPath()}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Gagal Memproses Pemindahan</p>
                <p className="mt-0.5 leading-relaxed text-rose-300/90">{submitError}</p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetBucket.trim()}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-md shadow-sky-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Sedang {operation === 'move' ? 'Memindahkan' : 'Menyalin'}...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4 text-slate-950" />
                  <span>
                    {operation === 'move' ? 'Mulai Pindahkan Objek' : 'Mulai Salin Objek'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
