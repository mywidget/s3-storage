import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  Copy,
  Plus,
  Trash2,
  Radio,
  ExternalLink,
  Layers,
  FileCode,
  Globe,
  Activity,
  Zap,
} from 'lucide-react';
import { StorageEndpointProfile } from '../types';
import { api } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
  onSwitchEndpoint?: (endpointId: string) => void;
  activeEndpointId?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
  onSwitchEndpoint,
  activeEndpointId: propActiveEndpointId,
}) => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'add' | 'env'>('endpoints');
  const [endpoints, setEndpoints] = useState<StorageEndpointProfile[]>([]);
  const [activeId, setActiveId] = useState<string>(propActiveEndpointId || '');
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});
  const [copiedEnv, setCopiedEnv] = useState(false);

  // New endpoint form state
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [newRegion, setNewRegion] = useState('auto');
  const [newBucket, setNewBucket] = useState('');
  const [newPublicUrl, setNewPublicUrl] = useState('');
  const [newAccessKeyId, setNewAccessKeyId] = useState('');
  const [newSecretAccessKey, setNewSecretAccessKey] = useState('');
  const [newMakeActive, setNewMakeActive] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadEndpointsList();
    }
  }, [isOpen]);

  useEffect(() => {
    if (propActiveEndpointId) {
      setActiveId(propActiveEndpointId);
    }
  }, [propActiveEndpointId]);

  const loadEndpointsList = async () => {
    setIsLoadingEndpoints(true);
    try {
      const data = await api.getEndpoints();
      setEndpoints(data.endpoints);
      setActiveId(data.activeEndpointId);
    } catch (err) {
      console.error('Failed to load endpoints:', err);
    } finally {
      setIsLoadingEndpoints(false);
    }
  };

  const handleSwitch = async (id: string) => {
    setSwitchingId(id);
    try {
      const res = await api.switchEndpoint(id);
      setActiveId(res.activeEndpointId);
      await loadEndpointsList();
      onConfigUpdated();
      if (onSwitchEndpoint) {
        onSwitchEndpoint(id);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal beralih endpoint');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.testEndpoint({ endpointId: id });
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: true, message: `Terhubung (${res.latencyMs}ms)`, latencyMs: res.latencyMs },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err.message || 'Koneksi gagal' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus endpoint "${name}" dari daftar?`)) return;
    try {
      await api.deleteEndpoint(id);
      await loadEndpointsList();
      onConfigUpdated();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus endpoint');
    }
  };

  const handleCreateEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndpoint.trim() || !newBucket.trim()) {
      setSubmitError('S3 Endpoint URL dan Nama Bucket wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        name: newName.trim() || `Storage (${newBucket.trim()})`,
        endpoint: newEndpoint.trim(),
        region: newRegion.trim() || 'auto',
        bucket: newBucket.trim(),
        publicUrl: newPublicUrl.trim(),
        accessKeyId: newAccessKeyId.trim(),
        secretAccessKey: newSecretAccessKey.trim(),
        makeActive: newMakeActive,
      };

      await api.upsertEndpoint(payload);
      await loadEndpointsList();
      onConfigUpdated();
      // Reset form
      setNewName('');
      setNewEndpoint('');
      setNewBucket('');
      setNewPublicUrl('');
      setNewAccessKeyId('');
      setNewSecretAccessKey('');
      setActiveTab('endpoints');
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menyimpan dan memverifikasi endpoint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const envSampleCode = `# ==========================================
# CloudVault Multi-Endpoint Environment (.env)
# ==========================================
PORT=3000
VAULT_MASTER_KEY=cloudvault-auto-encryption-master-key-2026

# Tentukan ID endpoint default yang aktif saat startup
ACTIVE_STORAGE_ENDPOINT_ID=printpro

# === ENDPOINT 1 (PrintPro Cloudflare R2) ===
ENDPOINT_1_ID=printpro
ENDPOINT_1_NAME=Cloudflare R2 - PrintPro
ENDPOINT_1_URL=https://5bf2ce4e6d2a743ce9d1a930dcc5161a.r2.cloudflarestorage.com
ENDPOINT_1_REGION=auto
ENDPOINT_1_BUCKET=printpro-storage
ENDPOINT_1_KEY_ID=92e5bda32b3c2c5ee7442f2a47aa17ff
ENDPOINT_1_SECRET=205529c3e3b1f53c1d0a58fd3718bec7c986b758e3a8feccea1595f0f572efd9
ENDPOINT_1_PUBLIC_URL=https://storage.printpro.my.id

# === ENDPOINT 2 (VPS Murah Cloudflare R2) ===
ENDPOINT_2_ID=vpsmurah
ENDPOINT_2_NAME=Cloudflare R2 - VPS Murah
ENDPOINT_2_URL=https://2d7cdfae18c56d61c8d3ceaa4526dc2a.r2.cloudflarestorage.com
ENDPOINT_2_REGION=auto
ENDPOINT_2_BUCKET=print-pro-storage-dsao97
ENDPOINT_2_KEY_ID=c39982a1c0248fb47ab8996e18b8f45a
ENDPOINT_2_SECRET=cc86be7ec75ba9acd487311887d4b5748711543f609b914ab2178664988325a3
ENDPOINT_2_PUBLIC_URL=https://storage.vpsmurah.co.id

# === ENDPOINT 3 (Tambahkan ENDPOINT_3_*, ENDPOINT_4_*, dst jika diperlukan) ===
# ENDPOINT_3_ID=backup-aws
# ENDPOINT_3_NAME=AWS S3 Backup
# ENDPOINT_3_URL=https://s3.ap-southeast-1.amazonaws.com
# ENDPOINT_3_REGION=ap-southeast-1
# ENDPOINT_3_BUCKET=my-backup-bucket
# ENDPOINT_3_KEY_ID=...
# ENDPOINT_3_SECRET=...
# ENDPOINT_3_PUBLIC_URL=https://cdn.example.com`;

  const copyEnvToClipboard = () => {
    navigator.clipboard.writeText(envSampleCode);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2 truncate">
                <span className="truncate">Pengaturan Storage</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded flex-shrink-0">
                  {endpoints.length} Profil
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate">Kelola dan beralih antar endpoint Cloudflare R2 / AWS S3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-2.5 border-b border-slate-800 flex items-center gap-1 sm:gap-2 bg-slate-950/40 text-xs overflow-x-auto whitespace-nowrap min-w-0">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition-colors flex-shrink-0 ${
              activeTab === 'endpoints'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Daftar Endpoint ({endpoints.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition-colors flex-shrink-0 ${
              activeTab === 'add'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Endpoint</span>
          </button>

          <button
            onClick={() => setActiveTab('env')}
            className={`px-3 py-2 border-b-2 font-medium flex items-center gap-1.5 transition-colors flex-shrink-0 ${
              activeTab === 'env'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Format .env</span>
          </button>
        </div>

        {/* Tab 1: Endpoints List */}
        {activeTab === 'endpoints' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 text-xs min-w-0">
            {isLoadingEndpoints ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Memuat daftar endpoint...</span>
              </div>
            ) : endpoints.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p>Belum ada endpoint yang dikonfigurasi.</p>
              </div>
            ) : (
              endpoints.map((ep) => {
                const isActive = ep.id === activeId;
                const test = testResults[ep.id];
                const isSwitching = switchingId === ep.id;
                const isTesting = testingId === ep.id;

                return (
                  <div
                    key={ep.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-slate-900 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-100 truncate text-sm">{ep.name}</h4>
                            {isActive ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" />
                                <span>Aktif</span>
                              </span>
                            ) : null}
                          </div>
                          <p className="text-slate-400 font-mono text-[11px] truncate mt-0.5">
                            Bucket: <span className="text-slate-200 font-semibold">{ep.bucket}</span> ({ep.region})
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => handleTest(ep.id)}
                          disabled={isTesting}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Uji ping latency ke endpoint ini"
                        >
                          <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                          <span>{isTesting ? 'Menguji...' : 'Uji Ping'}</span>
                        </button>

                        {!isActive ? (
                          <button
                            onClick={() => handleSwitch(ep.id)}
                            disabled={isSwitching}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{isSwitching ? 'Beralih...' : 'Gunakan'}</span>
                          </button>
                        ) : null}

                        {endpoints.length > 1 && (
                          <button
                            onClick={() => handleDelete(ep.id, ep.name)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Hapus endpoint dari profil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-slate-800/60 font-mono text-[11px] text-slate-400">
                      <div className="truncate">
                        <span className="text-slate-500">Endpoint: </span>
                        <span className="text-slate-300 truncate">{ep.endpoint}</span>
                      </div>
                      {ep.publicUrl && (
                        <div className="truncate flex items-center gap-1">
                          <span className="text-slate-500">Public CDN: </span>
                          <a
                            href={ep.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:underline flex items-center gap-0.5 truncate"
                          >
                            <span>{ep.publicUrl.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Test feedback */}
                    {test && (
                      <div
                        className={`mt-2.5 p-2 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                          test.success
                            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                        }`}
                      >
                        {test.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{test.message}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <div className="pt-2">
              <button
                onClick={() => setActiveTab('add')}
                className="w-full py-2.5 border border-dashed border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/50 rounded-xl text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-2 transition-all font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Endpoint Storage Lainnya</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Add New Endpoint */}
        {activeTab === 'add' && (
          <form onSubmit={handleCreateEndpoint} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs min-w-0">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Nama Profil Endpoint</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="cth: Cloudflare R2 - Secondary atau AWS S3 Jakarta"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">S3 Endpoint URL *</label>
              <input
                type="text"
                value={newEndpoint}
                onChange={(e) => setNewEndpoint(e.target.value)}
                required
                placeholder="https://<account-id>.r2.cloudflarestorage.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Format Cloudflare R2: https://&lt;account-id&gt;.r2.cloudflarestorage.com
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Bucket S3 *</label>
                <input
                  type="text"
                  value={newBucket}
                  onChange={(e) => setNewBucket(e.target.value)}
                  required
                  placeholder="nama-bucket"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Region</label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="auto"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Gunakan 'auto' untuk Cloudflare R2</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Public Custom Domain / CDN URL</label>
              <input
                type="text"
                value={newPublicUrl}
                onChange={(e) => setNewPublicUrl(e.target.value)}
                placeholder="https://storage.domainanda.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Base URL publik untuk tautan langsung objek (opsional)
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">S3 Access Key ID</label>
              <input
                type="text"
                value={newAccessKeyId}
                onChange={(e) => setNewAccessKeyId(e.target.value)}
                placeholder="Kunci akses S3 / R2"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">S3 Secret Access Key</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={newSecretAccessKey}
                  onChange={(e) => setNewSecretAccessKey(e.target.value)}
                  placeholder="Kunci rahasia S3 / R2"
                  className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-300">
              <input
                type="checkbox"
                checked={newMakeActive}
                onChange={(e) => setNewMakeActive(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              <span>Langsung beralih dan jadikan endpoint ini aktif setelah disimpan</span>
            </label>

            {submitError && (
              <div className="p-3 rounded-lg border bg-rose-950/40 border-rose-800 text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('endpoints')}
                className="px-4 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memverifikasi Koneksi...</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Uji & Simpan Endpoint</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Environment .env Guide */}
        {activeTab === 'env' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs min-w-0">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Cara Mengatur Multi-Endpoint di Berkas .env</span>
              </h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Anda dapat menambahkan beberapa endpoint storage langsung ke berkas <code>.env</code> Anda.
                Gunakan format awalan <code>ENDPOINT_1_*</code>, <code>ENDPOINT_2_*</code>, dan seterusnya.
                Aplikasi akan otomatis memuat seluruh endpoint saat startup dan Anda dapat berpindah kapan saja dari UI.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 rounded-t-xl border border-b-0 border-slate-800 text-slate-400">
                <span className="font-mono text-[11px]">.env (Contoh Konfigurasi Lengkap)</span>
                <button
                  onClick={copyEnvToClipboard}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
                >
                  {copiedEnv ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin Template</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-slate-950/90 border border-slate-800 rounded-b-xl font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed max-h-64">
                {envSampleCode}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-slate-500">Endpoint Aktif:</span>
            <span className="text-emerald-400 font-semibold">
              {endpoints.find((e) => e.id === activeId)?.name || activeId || 'Default'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
