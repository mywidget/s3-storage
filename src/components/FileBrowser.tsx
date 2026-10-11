import React, { useState, useMemo } from 'react';
import {
  Search,
  Lock,
  Download,
  Eye,
  Trash2,
  FileCode,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  File,
  ShieldAlert,
  ShieldCheck,
  Folder,
  FolderPlus,
  FolderTree,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  Globe,
  Link2,
  Check,
  ArrowUpLeft,
  SlidersHorizontal,
  Layers,
  ChevronDown,
  PieChart,
} from 'lucide-react';
import { StorageFile, StorageUsageSummary } from '../types';
import { formatBytes, formatDate, truncateHash, getFileCategory } from '../services/cryptoClient';
import { FileTableSkeleton, FolderCardsSkeleton } from './Skeletons';

interface FileBrowserProps {
  files: StorageFile[];
  folders: string[];
  currentPrefix: string;
  onNavigateFolder: (prefix: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onDownloadDecrypted: (file: StorageFile) => void;
  onDownloadRaw: (file: StorageFile) => void;
  onPreview: (file: StorageFile) => void;
  onInspectCrypto: (file: StorageFile) => void;
  onDelete: (file: StorageFile) => void;
  onBatchDelete: (keys: string[]) => void;
  onOpenUpload: () => void;
  limit: number;
  onChangeLimit: (newLimit: number) => void;
  isRecursive: boolean;
  onToggleRecursive: (recursive: boolean) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
  isTruncated?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  summary?: StorageUsageSummary | null;
  onOpenSummaryModal?: () => void;
  folderStatsMap?: Record<string, { fileCount: number; totalSizeBytes: number }>;
  filesError?: string | null;
  onOpenSettings?: () => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  files,
  folders,
  currentPrefix,
  onNavigateFolder,
  isLoading,
  onRefresh,
  onDownloadDecrypted,
  onDownloadRaw,
  onPreview,
  onInspectCrypto,
  onDelete,
  onBatchDelete,
  onOpenUpload,
  limit,
  onChangeLimit,
  isRecursive,
  onToggleRecursive,
  onCreateFolder,
  isTruncated,
  onLoadMore,
  isLoadingMore,
  summary,
  onOpenSummaryModal,
  folderStatsMap,
  filesError,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'encrypted' | 'unencrypted'>('all');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [copiedUrlKey, setCopiedUrlKey] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolderLoading, setCreatingFolderLoading] = useState(false);

  const handleCopyPublicUrl = (file: StorageFile) => {
    const url = file.publicUrl || `https://storage.printpro.my.id/${file.key}`;
    navigator.clipboard.writeText(url);
    setCopiedUrlKey(file.key);
    setTimeout(() => setCopiedUrlKey(null), 2000);
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolderLoading(true);
    try {
      const fullPath = currentPrefix ? `${currentPrefix.replace(/\/$/, '')}/${newFolderName.trim()}` : newFolderName.trim();
      await onCreateFolder(fullPath);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } finally {
      setCreatingFolderLoading(false);
    }
  };

  const handleGoToParent = () => {
    if (!currentPrefix) return;
    const parts = currentPrefix.replace(/\/$/, '').split('/');
    parts.pop();
    const parentPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
    onNavigateFolder(parentPrefix);
  };

  // Filter files
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchSearch =
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.key.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filterType === 'encrypted') return f.isEncrypted;
      if (filterType === 'unencrypted') return !f.isEncrypted;
      return true;
    });
  }, [files, searchQuery, filterType]);

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredFiles.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredFiles.map((f) => f.key)));
    }
  };

  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  // Helper for MIME Icon
  const renderFileIcon = (file: StorageFile) => {
    const category = getFileCategory(file.name, file.mimeType);
    const className = 'w-4 h-4 text-slate-400';
    switch (category) {
      case 'image':
        return <FileImage className={`${className} text-sky-400`} />;
      case 'document':
        return <FileText className={`${className} text-emerald-400`} />;
      case 'code':
        return <FileCode className={`${className} text-amber-400`} />;
      case 'archive':
        return <FileArchive className={`${className} text-purple-400`} />;
      case 'video':
        return <FileVideo className={`${className} text-rose-400`} />;
      default:
        return <File className={className} />;
    }
  };

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!currentPrefix) return [{ label: 'Root Bucket', prefix: '' }];
    const parts = currentPrefix.replace(/\/$/, '').split('/');
    const crumbs = [{ label: 'Root Bucket', prefix: '' }];
    let acc = '';
    parts.forEach((p) => {
      acc += `${p}/`;
      crumbs.push({ label: p, prefix: acc });
    });
    return crumbs;
  }, [currentPrefix]);

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Top Filter and Search Bar */}
      <div className="p-3 sm:p-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari file terenkripsi, hash SHA-256, atau nama..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Filter Controls: Limit, Type, View Mode, Refresh */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
          {/* View Mode Toggle (Folder vs Flat) */}
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => onToggleRecursive(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                !isRecursive ? 'bg-slate-800 text-emerald-400 shadow-sm font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilkan berdasarkan folder hirarkis"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Folder</span>
            </button>
            <button
              onClick={() => onToggleRecursive(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                isRecursive ? 'bg-slate-800 text-sky-400 shadow-sm font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilkan semua file tanpa hirarki (Flat)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua File</span>
            </button>
          </div>

          {/* Limit Filter Dropdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 text-[11px]">Limit:</span>
            <select
              value={limit}
              onChange={(e) => onChangeLimit(parseInt(e.target.value, 10))}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value={15} className="bg-slate-900 text-slate-200">15</option>
              <option value={30} className="bg-slate-900 text-slate-200">30</option>
              <option value={50} className="bg-slate-900 text-slate-200">50</option>
              <option value={100} className="bg-slate-900 text-slate-200">100</option>
              <option value={250} className="bg-slate-900 text-slate-200">250</option>
              <option value={500} className="bg-slate-900 text-slate-200">500</option>
            </select>
          </div>

          {/* Encryption Type Filter */}
          <div className="hidden sm:flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterType === 'all' ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({files.length})
            </button>
            <button
              onClick={() => setFilterType('encrypted')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                filterType === 'encrypted'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Terenkripsi</span>
            </button>
            <button
              onClick={() => setFilterType('unencrypted')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filterType === 'unencrypted'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Standar
            </button>
          </div>

          {/* Ringkasan Folder Modal Button */}
          {onOpenSummaryModal && (
            <button
              onClick={onOpenSummaryModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 text-xs font-medium transition-colors"
              title="Lihat total pemakaian storage dan rincian tiap folder"
            >
              <PieChart className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Ringkasan Folder</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors disabled:opacity-50"
            title="Muat ulang daftar objek"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs Navigation & Folder Management Bar */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs min-w-0">
        {/* Breadcrumb Path & Parent Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full py-0.5 flex-1 min-w-0">
          {currentPrefix && (
            <button
              onClick={handleGoToParent}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex-shrink-0"
              title="Kembali ke folder induk (..)"
            >
              <ArrowUpLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Induk</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-slate-400 min-w-0 flex-shrink-0">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.prefix}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                <button
                  onClick={() => onNavigateFolder(crumb.prefix)}
                  className={`hover:text-emerald-400 transition-colors flex items-center gap-1 truncate ${
                    idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-200' : ''
                  }`}
                >
                  {idx === 0 ? <Folder className="w-3 h-3 text-slate-500 flex-shrink-0" /> : null}
                  <span className="truncate">{crumb.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Folder Creator & Batch Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedKeys.size > 0 && (
            <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
              <span className="text-slate-400">{selectedKeys.size} dipilih</span>
              <button
                onClick={() => {
                  if (confirm(`Hapus ${selectedKeys.size} file terpilih dari Cloudflare R2?`)) {
                    onBatchDelete(Array.from(selectedKeys));
                    setSelectedKeys(new Set());
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/50 border border-rose-900 text-rose-300 hover:bg-rose-900/50 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Terpilih</span>
              </button>
            </div>
          )}

          {/* New Folder Action Button */}
          {!isCreatingFolder ? (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Buat folder baru di path saat ini"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Folder Baru</span>
            </button>
          ) : (
            <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nama folder..."
                autoFocus
                className="px-2 py-0.5 bg-slate-950 border border-emerald-500 rounded text-xs text-slate-200 focus:outline-none w-36"
              />
              <button
                type="submit"
                disabled={creatingFolderLoading || !newFolderName.trim()}
                className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-medium rounded text-xs hover:bg-emerald-400 disabled:opacity-50"
              >
                {creatingFolderLoading ? '...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="px-1.5 py-0.5 text-slate-500 hover:text-slate-300 text-xs"
              >
                Batal
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Error Alert Banner when storage/bucket is inaccessible */}
      {filesError && (
        <div className="p-4 mx-4 my-3 rounded-xl bg-rose-950/40 border border-rose-800/70 text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-700/50 text-rose-300 flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-200 flex items-center gap-1.5">
                <span>Koneksi Storage Bermasalah</span>
              </h4>
              <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed">{filesError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 text-xs font-medium transition-colors"
              >
                Atur Endpoint / .env
              </button>
            )}
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Loading Progress Shimmer Bar */}
      {isLoading && (
        <div className="h-0.5 w-full bg-slate-800 overflow-hidden relative">
          <div className="h-full bg-emerald-400 animate-pulse w-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </div>
      )}

      {/* Subfolder Cards Grid (When in hierarchical folder mode) */}
      {!isRecursive && (
        <>
          {isLoading && folders.length === 0 ? (
            <div className="p-4 bg-slate-950/30 border-b border-slate-800/60">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span>Memuat Direktori...</span>
              </div>
              <FolderCardsSkeleton count={4} />
            </div>
          ) : folders.length > 0 ? (
            <div className="p-4 bg-slate-950/30 border-b border-slate-800/60">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                <span>Subdirektori ({folders.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {folders.map((folderPrefix) => {
                  const folderName = folderPrefix.replace(currentPrefix, '').replace(/\/$/, '');
                  const stats =
                    folderStatsMap?.[folderPrefix] ||
                    summary?.folders.find(
                      (f) =>
                        f.prefix === folderPrefix ||
                        f.prefix === `${folderPrefix}`.replace(/^\/+/, '') ||
                        f.prefix.endsWith(folderPrefix)
                    );

                  return (
                    <button
                      key={folderPrefix}
                      onClick={() => onNavigateFolder(folderPrefix)}
                      className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-left transition-all group shadow-sm"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Folder className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                          <span className="text-xs text-slate-100 font-semibold truncate">{folderName}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 flex-shrink-0 ml-1" />
                      </div>

                      {stats ? (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/60 w-full">
                          <span className="text-slate-300">{stats.fileCount.toLocaleString('id-ID')} file</span>
                          <span className="text-emerald-400 font-medium">
                            {formatBytes(stats.totalSizeBytes)}
                          </span>
                        </div>
                      ) : isLoading ? (
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800/60 w-full">
                          <span className="animate-pulse text-emerald-500/80">Menghitung...</span>
                          <span className="text-slate-600 font-mono animate-pulse">...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800/60 w-full">
                          <span>0 file</span>
                          <span className="text-slate-400 font-medium">0 B</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Mobile Card List (Khusus layar HP agar konten tidak terpotong dan mudah disentuh) */}
      <div className="sm:hidden divide-y divide-slate-800/60 min-w-0">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-slate-800" />
                  <div className="h-3.5 bg-slate-800 rounded w-3/4" />
                </div>
                <div className="h-2.5 bg-slate-800/60 rounded w-1/2" />
                <div className="flex justify-between pt-2 border-t border-slate-800/40">
                  <div className="h-3 bg-slate-800/60 rounded w-16" />
                  <div className="h-3 bg-slate-800/60 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filesError ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-rose-200">Gagal Memuat Objek</p>
            <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">{filesError}</p>
            <button
              onClick={onRefresh}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700"
            >
              Coba Muat Ulang
            </button>
          </div>
        ) : filteredFiles.length === 0 && folders.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Folder className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              {currentPrefix ? `Folder kosong` : 'Bucket ini belum memiliki file'}
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Unggah file baru ke direktori ini.
            </p>
            <button
              onClick={onOpenUpload}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
            >
              Unggah File
            </button>
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedKeys.has(file.key);
            return (
              <div
                key={file.key}
                className={`p-3 space-y-2.5 transition-colors ${
                  isSelected ? 'bg-emerald-950/20' : 'hover:bg-slate-850/40'
                }`}
              >
                {/* Header: Checkbox + Icon + Title + Encrypted Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={() => toggleSelect(file.key)}
                      className="mt-0.5 text-slate-500 hover:text-slate-300 flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {renderFileIcon(file)}
                        <h4
                          onClick={() => onPreview(file)}
                          className="font-medium text-slate-200 text-xs truncate hover:text-emerald-400 cursor-pointer"
                          title={file.name}
                        >
                          {file.name}
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        {file.key}
                      </p>
                    </div>
                  </div>

                  {file.isEncrypted ? (
                    <button
                      onClick={() => onInspectCrypto(file)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-[10px] font-mono text-emerald-400 flex-shrink-0"
                      title="Lihat Audit Kripto"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>AES-256</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded flex-shrink-0">
                      Standar
                    </span>
                  )}
                </div>

                {/* Metadata Row: File Size & Modified Date */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/50">
                  <div>
                    <span className="text-slate-200 font-medium">
                      {formatBytes(file.originalSize || file.size)}
                    </span>
                    {file.isEncrypted && file.originalSize !== file.size && (
                      <span className="text-[10px] text-slate-500 ml-1">
                        (R2: {formatBytes(file.size)})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{formatDate(file.lastModified)}</span>
                </div>

                {/* Mobile Tap-Friendly Actions */}
                <div className="flex items-center justify-between pt-1 gap-1.5 border-t border-slate-800/40">
                  <button
                    onClick={() => onPreview(file)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Lihat</span>
                  </button>

                  <button
                    onClick={() => onDownloadDecrypted(file)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-emerald-400 text-xs flex items-center justify-center gap-1 font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh</span>
                  </button>

                  <button
                    onClick={() => handleCopyPublicUrl(file)}
                    className={`p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-center ${
                      copiedUrlKey === file.key
                        ? 'text-emerald-400 border-emerald-500/50'
                        : 'text-slate-400 hover:text-sky-300'
                    }`}
                    title="Salin Public URL"
                  >
                    {copiedUrlKey === file.key ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => onInspectCrypto(file)}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-emerald-400 text-xs flex items-center justify-center"
                    title="Audit Integritas"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Hapus file "${file.name}" secara permanen dari Cloudflare R2?`)) {
                        onDelete(file);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-400 text-xs flex items-center justify-center"
                    title="Hapus File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop File List Table (Tampil pada layar tablet & desktop) */}
      <div className="hidden sm:block overflow-x-auto min-w-0">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/40">
              <th className="py-3 px-4 w-10">
                <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-300">
                  {selectedKeys.size > 0 && selectedKeys.size === filteredFiles.length ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 font-medium">Nama Objek & Lokasi</th>
              <th className="py-3 px-4 font-medium">Status Enkripsi</th>
              <th className="py-3 px-4 font-medium">Ukuran (Asli / Sandi)</th>
              <th className="py-3 px-4 font-medium">Dimodifikasi</th>
              <th className="py-3 px-4 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <FileTableSkeleton rows={Math.min(limit, 8)} />
            ) : filesError ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="max-w-md mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mb-3">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-rose-200">
                      Gagal Memuat Objek dari Bucket
                    </p>
                    <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed max-w-sm">
                      {filesError}
                    </p>
                    <div className="flex items-center gap-2">
                      {onOpenSettings && (
                        <button
                          onClick={onOpenSettings}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors"
                        >
                          Buka Pengaturan Endpoint
                        </button>
                      )}
                      <button
                        onClick={onRefresh}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-semibold text-xs hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Muat Ulang</span>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : filteredFiles.length === 0 && folders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                      <Folder className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-300">
                      {currentPrefix ? `Folder "${currentPrefix}" kosong` : 'Bucket ini belum memiliki file'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Unggah file baru ke direktori ini atau buat subfolder.
                    </p>
                    <button
                      onClick={onOpenUpload}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs hover:bg-emerald-400 transition-colors"
                    >
                      Unggah File ke Sini
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedKeys.has(file.key);
                return (
                  <tr
                    key={file.key}
                    className={`hover:bg-slate-800/40 transition-colors group ${
                      isSelected ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4">
                      <button onClick={() => toggleSelect(file.key)} className="text-slate-500 hover:text-slate-300">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* File Name & Path */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {renderFileIcon(file)}
                        <div className="min-w-0">
                          <p
                            className="font-medium text-slate-200 truncate cursor-pointer hover:text-emerald-400 transition-colors"
                            onClick={() => onPreview(file)}
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{file.key}</p>
                        </div>
                      </div>
                    </td>

                    {/* Encryption Status & Algorithm */}
                    <td className="py-3 px-4">
                      {file.isEncrypted ? (
                        <div
                          className="flex items-center gap-1.5 cursor-pointer group/crypto"
                          onClick={() => onInspectCrypto(file)}
                          title="Klik untuk melihat Audit Kriptografi (IV, Auth Tag, SHA-256)"
                        >
                          <div className="w-5 h-5 rounded bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 group-hover/crypto:border-emerald-500 transition-colors">
                            <Lock className="w-3 h-3" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-emerald-400 font-medium text-[11px]">
                                {file.algorithm}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                ({file.keyMode === 'passphrase' ? 'Passphrase' : 'Vault Key'})
                              </span>
                            </div>
                            {file.originalSha256 && (
                              <p className="text-[10px] text-slate-500 font-mono">
                                SHA: {truncateHash(file.originalSha256, 4)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                          <span>Standar (Tanpa Enkripsi)</span>
                        </div>
                      )}
                    </td>

                    {/* Size: Plaintext vs Ciphertext */}
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <div>
                        <span>{formatBytes(file.originalSize || file.size)}</span>
                        {file.isEncrypted && file.originalSize !== file.size && (
                          <span className="text-[10px] text-slate-500 block">
                            (R2: {formatBytes(file.size)})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Modified */}
                    <td className="py-3 px-4 text-slate-400">
                      <span>{formatDate(file.lastModified)}</span>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Preview */}
                        <button
                          onClick={() => onPreview(file)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Pratinjau Didekripsi"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Copy Public URL */}
                        <button
                          onClick={() => handleCopyPublicUrl(file)}
                          className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${
                            copiedUrlKey === file.key
                              ? 'text-emerald-400 bg-emerald-950/40'
                              : 'text-slate-400 hover:text-sky-300'
                          }`}
                          title={`Salin Public URL (${file.publicUrl || `https://storage.printpro.my.id/${file.key}`})`}
                        >
                          {copiedUrlKey === file.key ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Download Decrypted */}
                        <button
                          onClick={() => onDownloadDecrypted(file)}
                          className="p-1.5 rounded hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
                          title="Unduh & Dekripsi Otomatis (Format Asli)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Crypto Audit */}
                        <button
                          onClick={() => onInspectCrypto(file)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Rincian Kriptografi & Verifikasi Integritas"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirm(`Hapus file "${file.name}" secara permanen dari Cloudflare R2?`)) {
                              onDelete(file);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Hapus File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Limit Footer Status */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span>
            Menampilkan <strong className="text-slate-200">{filteredFiles.length}</strong> file
            {!isRecursive && folders.length > 0 && (
              <> dan <strong className="text-slate-200">{folders.length}</strong> folder</>
            )}
            {' '}(Limit per pindaian: <strong className="text-slate-200">{limit}</strong>)
          </span>
          {isRecursive && (
            <span className="px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 text-[10px]">
              Semua Path
            </span>
          )}
        </div>

        {isTruncated && onLoadMore && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memuat...</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Muat Objek Berikutnya (S3 Pagination)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
