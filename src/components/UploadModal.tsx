import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Lock,
  KeyRound,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
  File,
  Shield,
  Trash2,
} from 'lucide-react';
import { formatBytes, calculateFileSha256 } from '../services/cryptoClient';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  currentFolder: string;
}

interface QueuedFile {
  file: File;
  sha256?: string;
  status: 'idle' | 'calculating' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  currentFolder,
}) => {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [targetFolder, setTargetFolder] = useState(currentFolder);
  const [autoEncrypt, setAutoEncrypt] = useState(true);
  const [keyMode, setKeyMode] = useState<'master' | 'passphrase'>('master');
  const [customPassphrase, setCustomPassphrase] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetFolder(currentFolder);
    }
  }, [isOpen, currentFolder]);

  if (!isOpen) return null;

  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: QueuedFile[] = fileArray.map((f) => ({
      file: f,
      status: 'calculating',
      progress: 0,
    }));

    setQueue((prev) => [...prev, ...newItems]);

    // Calculate SHA-256 hashes asynchronously
    for (const item of newItems) {
      try {
        const hash = await calculateFileSha256(item.file);
        setQueue((prev) =>
          prev.map((q) => (q.file === item.file ? { ...q, sha256: hash, status: 'idle' } : q))
        );
      } catch {
        setQueue((prev) =>
          prev.map((q) => (q.file === item.file ? { ...q, status: 'idle' } : q))
        );
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeQueueItem = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartUpload = async () => {
    if (queue.length === 0) return;
    if (keyMode === 'passphrase' && autoEncrypt && !customPassphrase) {
      alert('Harap masukkan passphrase kustom untuk enkripsi!');
      return;
    }

    setIsProcessingBatch(true);

    const { api } = await import('../services/api');

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'success') continue;

      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading', progress: 5 } : q))
      );

      try {
        await api.uploadFile(item.file, {
          folder: targetFolder,
          encrypt: autoEncrypt,
          passphrase: keyMode === 'passphrase' ? customPassphrase : undefined,
          onProgress: (percent) => {
            setQueue((prev) =>
              prev.map((q, idx) => (idx === i ? { ...q, progress: percent } : q))
            );
          },
        });

        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'success', progress: 100 } : q))
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: 'error', errorMessage: err.message || 'Upload gagal' }
              : q
          )
        );
      }
    }

    setIsProcessingBatch(false);
    onUploadSuccess();
  };

  const hasPending = queue.some((q) => q.status === 'idle' || q.status === 'error');
  const allSucceeded = queue.length > 0 && queue.every((q) => q.status === 'success');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm truncate">Unggah File ke Cloudflare R2</h3>
              <p className="text-xs text-slate-400 truncate">Enkripsi otomatis AES-256-GCM sebelum disimpan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 min-w-0">
          {/* Target Folder Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Direktori / Folder Tujuan</label>
            <div className="relative">
              <FolderPlus className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                placeholder="cth: documents/ atau backups/ (kosongkan untuk root)"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Encryption Settings Card */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">Enkripsi Otomatis (AES-256-GCM)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEncrypt}
                  onChange={(e) => setAutoEncrypt(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {autoEncrypt && (
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                <p className="text-[11px] text-slate-400">
                  Data file dienkripsi dengan Galois/Counter Mode (GCM) 256-bit dan menghasilkan Authentication Tag untuk menjamin integritas anti-tampering.
                </p>

                {/* Key Mode Selection */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setKeyMode('master')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      keyMode === 'master'
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium mb-0.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Vault Master Key</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Transparan & otomatis didekripsi saat diunduh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKeyMode('passphrase')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      keyMode === 'passphrase'
                        ? 'bg-emerald-950/30 border-emerald-500/50 text-slate-100'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium mb-0.5">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kunci Passphrase Pribadi</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Memerlukan password untuk mendekripsi kembali</span>
                  </button>
                </div>

                {keyMode === 'passphrase' && (
                  <div>
                    <input
                      type="password"
                      value={customPassphrase}
                      onChange={(e) => setCustomPassphrase(e.target.value)}
                      placeholder="Masukkan passphrase rahasia untuk file ini..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-amber-400/90 mt-1">
                      ⚠️ Catatan: Jika passphrase hilang, file tidak dapat didekripsi kembali.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-emerald-500 bg-emerald-950/20'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
            }`}
          >
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-300">Tarik dan lepas file ke sini, atau klik untuk memilih</p>
            <p className="text-[11px] text-slate-500 mt-1">Mendukung multi-file upload hingga 150MB per file</p>
          </div>

          {/* Queued Files List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Antrean File ({queue.length})</span>
                <button
                  type="button"
                  onClick={() => setQueue([])}
                  disabled={isProcessingBatch}
                  className="text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50"
                >
                  Bersihkan
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {queue.map((item, idx) => (
                  <div
                    key={`${item.file.name}-${idx}`}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-200 truncate">{item.file.name}</p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatBytes(item.file.size)}
                          </span>
                        </div>
                        {item.sha256 && (
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            SHA-256: {item.sha256}
                          </p>
                        )}
                        {/* Progress bar if uploading */}
                        {item.status === 'uploading' && (
                          <div className="w-full bg-slate-800 rounded-full h-1 mt-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1 transition-all duration-200"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}
                        {item.status === 'error' && (
                          <p className="text-[10px] text-rose-400 mt-0.5">{item.errorMessage}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      {item.status === 'calculating' && (
                        <span className="text-[10px] text-slate-500 font-mono">menghitung hash...</span>
                      )}
                      {item.status !== 'uploading' && item.status !== 'success' && (
                        <button
                          type="button"
                          onClick={() => removeQueueItem(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-2">
          <p className="text-[11px] text-slate-500 text-center sm:text-left">
            {autoEncrypt ? '🔒 AES-256-GCM terproteksi' : '⚠️ Enkripsi dinonaktifkan'}
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessingBatch}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs transition-colors"
            >
              {allSucceeded ? 'Tutup' : 'Batal'}
            </button>

            {hasPending && (
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={isProcessingBatch || queue.length === 0}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {isProcessingBatch ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Mengunggah...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload ({queue.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
