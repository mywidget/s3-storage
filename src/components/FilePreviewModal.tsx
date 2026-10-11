import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Eye,
  FileText,
  Lock,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Globe,
  Link2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { StorageFile } from '../types';
import { getFileCategory, formatBytes } from '../services/cryptoClient';

interface FilePreviewModalProps {
  file: StorageFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadDecrypted: (file: StorageFile) => void;
  onDownloadRaw: (file: StorageFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  isOpen,
  onClose,
  onDownloadDecrypted,
  onDownloadRaw,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);

  const publicFileUrl = file ? file.publicUrl || `https://storage.printpro.my.id/${file.key}` : '';

  const handleCopyPublicUrl = () => {
    if (!publicFileUrl) return;
    navigator.clipboard.writeText(publicFileUrl);
    setCopiedPublicUrl(true);
    setTimeout(() => setCopiedPublicUrl(false), 2000);
  };

  useEffect(() => {
    if (!isOpen || !file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setTextContent(null);
      setError(null);
      return;
    }

    if (file.keyMode === 'passphrase') {
      setNeedsPassphrase(true);
    } else {
      setNeedsPassphrase(false);
      loadFilePreview();
    }
  }, [isOpen, file]);

  const loadFilePreview = async (pass?: string) => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const { api } = await import('../services/api');
      const { blob, contentType } = await api.downloadFile(file.key, {
        decrypt: true,
        passphrase: pass || passphrase || undefined,
        inline: true,
      });

      const category = getFileCategory(file.name, contentType);

      if (category === 'code' || category === 'document' && !file.name.endsWith('.pdf')) {
        const text = await blob.text();
        setTextContent(text);
      } else {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }

      setNeedsPassphrase(false);
    } catch (err: any) {
      setError(err.message || 'Gagal mendekripsi dan memuat pratinjau');
      if (file.keyMode === 'passphrase') {
        setNeedsPassphrase(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const category = getFileCategory(file.name, file.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm truncate">{file.name}</h3>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-400 flex-wrap">
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Didekripsi
                </span>
                <span>·</span>
                <span>{formatBytes(file.originalSize || file.size)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={() => onDownloadDecrypted(file)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Unduh Asli</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Public CDN URL Banner */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between text-xs gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Globe className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="text-slate-400 text-[11px] flex-shrink-0">Public URL:</span>
            <span className="font-mono text-slate-200 text-[11px] truncate select-all">{publicFileUrl}</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            <button
              onClick={handleCopyPublicUrl}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                copiedPublicUrl
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {copiedPublicUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Link2 className="w-3 h-3" />}
              <span>{copiedPublicUrl ? 'Tersalin!' : 'Salin URL'}</span>
            </button>
            <a
              href={publicFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-3 h-3 text-slate-400" />
              <span>Buka</span>
            </a>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[350px] bg-slate-950/40 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Mengambil dari Cloudflare R2 & Mendekripsi AES-256-GCM...</span>
            </div>
          ) : needsPassphrase ? (
            <div className="max-w-sm w-full p-6 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-200 text-sm">File Dilindungi Passphrase</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Masukkan passphrase yang digunakan saat mengunggah file ini untuk mendekripsi.
                </p>
              </div>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase enkripsi..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && loadFilePreview(passphrase)}
              />
              <button
                type="button"
                onClick={() => loadFilePreview(passphrase)}
                className="w-full py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors"
              >
                Dekripsi & Buka Pratinjau
              </button>
            </div>
          ) : error ? (
            <div className="max-w-sm text-center p-6 space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-sm font-medium text-slate-200">Gagal Membuka File</p>
              <p className="text-xs text-slate-400">{error}</p>
              {file.keyMode === 'passphrase' && (
                <button
                  onClick={() => setNeedsPassphrase(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
                >
                  Coba Passphrase Lain
                </button>
              )}
            </div>
          ) : category === 'image' && previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md border border-slate-800"
            />
          ) : category === 'video' && previewUrl ? (
            <video
              src={previewUrl}
              controls
              className="max-h-[60vh] max-w-full rounded-lg shadow-md border border-slate-800"
            />
          ) : category === 'audio' && previewUrl ? (
            <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 w-full max-w-md text-center space-y-4">
              <audio src={previewUrl} controls className="w-full" />
            </div>
          ) : file.name.endsWith('.pdf') && previewUrl ? (
            <iframe
              src={previewUrl}
              title={file.name}
              className="w-full h-[65vh] rounded-lg border border-slate-800 bg-white"
            />
          ) : textContent !== null ? (
            <div className="w-full h-full max-h-[65vh] overflow-auto p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre">
              {textContent}
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-sm font-medium text-slate-300">Pratinjau tidak tersedia langsung di browser</p>
              <p className="text-xs text-slate-500 max-w-sm">
                File biner telah diverifikasi integritasnya (AES-256-GCM). Anda dapat mengunduh versi didekripsi ke komputer Anda.
              </p>
              <button
                onClick={() => onDownloadDecrypted(file)}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh File Didekripsi</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Kunci: {file.keyMode === 'passphrase' ? 'Passphrase Kustom' : 'Vault Master'}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownloadRaw(file)}
              className="text-slate-500 hover:text-slate-300 text-[11px]"
              title="Unduh ciphertext tanpa didekripsi (.enc)"
            >
              Unduh Mentah (.enc)
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
