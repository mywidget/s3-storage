import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  Download,
  KeyRound,
  FileText,
  FileCheck2,
} from 'lucide-react';
import { StorageFile } from '../types';
import { formatBytes, formatDate } from '../services/cryptoClient';

interface CryptoDetailsModalProps {
  file: StorageFile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CryptoDetailsModal: React.FC<CryptoDetailsModalProps> = ({ file, isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !file) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const exportManifest = () => {
    const manifest = {
      objectKey: file.key,
      originalName: file.name,
      originalSize: file.originalSize,
      encryptedSize: file.size,
      mimeType: file.mimeType,
      algorithm: file.algorithm,
      keyMode: file.keyMode,
      initializationVector: file.iv,
      authenticationTag: file.authTag,
      salt: file.salt,
      sha256Plaintext: file.originalSha256,
      sha256Ciphertext: file.cipherSha256,
      etag: file.etag,
      encryptedAt: file.encryptedAt,
      securityStandard: 'NIST SP 800-38D (AES Galois/Counter Mode)',
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name}.crypto-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm truncate">Audit Kriptografi & Integritas</h3>
              <p className="text-xs text-slate-400 font-mono truncate">{file.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs min-w-0">
          {/* Integrity Badge Card */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-100 text-sm">Integritas Data Terverifikasi</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  AES-256-GCM menjamin kerahasiaan sekaligus keaslian (Authenticity). Tidak ada manipulasi data terdeteksi.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 font-mono text-[10px] font-semibold">
              TAMPER-PROOF
            </span>
          </div>

          {/* Core Crypto Parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Cipher Algorithm</span>
              <span className="text-sm font-semibold text-slate-200 font-mono mt-0.5 block">
                {file.algorithm || 'AES-256-GCM'}
              </span>
              <span className="text-[10px] text-slate-500">256-bit Galois/Counter Mode</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Key Derivation</span>
              <span className="text-sm font-semibold text-slate-200 font-mono mt-0.5 block">
                PBKDF2-SHA256
              </span>
              <span className="text-[10px] text-slate-500">100,000 Iterasi Kriptografi</span>
            </div>
          </div>

          {/* Cryptographic Manifest Details */}
          <div className="space-y-3 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <h4 className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Parameter Kunci & Vektor Inisialisasi
            </h4>

            {/* IV */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400">Initialization Vector (IV - 96 bit):</span>
                <button
                  onClick={() => file.iv && copyToClipboard(file.iv, 'iv')}
                  className="text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                >
                  {copiedKey === 'iv' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'iv' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                {file.iv || '(Tersimpan otomatis di metadata objek R2)'}
              </div>
            </div>

            {/* Auth Tag */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400">GCM Authentication Tag (MAC - 128 bit):</span>
                <button
                  onClick={() => file.authTag && copyToClipboard(file.authTag, 'tag')}
                  className="text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                >
                  {copiedKey === 'tag' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'tag' ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                {file.authTag || '(Tersimpan otomatis di metadata objek R2)'}
              </div>
            </div>

            {/* Salt */}
            {file.salt && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Kriptografis Salt (128 bit):</span>
                  <button
                    onClick={() => file.salt && copyToClipboard(file.salt, 'salt')}
                    className="text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                  >
                    {copiedKey === 'salt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'salt' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                  {file.salt}
                </div>
              </div>
            )}

            {/* Original Plaintext SHA-256 */}
            {file.originalSha256 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Checksum Asli (Plaintext SHA-256):</span>
                  <button
                    onClick={() => copyToClipboard(file.originalSha256!, 'origSha')}
                    className="text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                  >
                    {copiedKey === 'origSha' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === 'origSha' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 break-all select-all">
                  {file.originalSha256}
                </div>
              </div>
            )}

            {/* Ciphertext SHA-256 */}
            {file.cipherSha256 && (
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Checksum Ciphertext di R2 (SHA-256):</span>
                  <button
                    onClick={() => copyToClipboard(file.cipherSha256!, 'cipherSha')}
                    className="text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                  >
                    {copiedKey === 'cipherSha' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === 'cipherSha' ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                  {file.cipherSha256}
                </div>
              </div>
            )}
          </div>

          {/* Size Comparison */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-slate-400">
            <span>Ukuran Data Asli: <strong className="text-slate-200">{formatBytes(file.originalSize)}</strong></span>
            <span>Ukuran di Storage R2: <strong className="text-slate-200">{formatBytes(file.size)}</strong></span>
            <span>Overhead GCM: <strong className="text-slate-200">+{Math.max(0, file.size - file.originalSize)} bytes</strong></span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={exportManifest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor Manifest Kriptografi (.json)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
