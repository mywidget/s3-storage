import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Sliders,
  FileClock,
  HardDrive,
  FolderSync,
  LogOut,
  Globe,
  KeyRound,
  ExternalLink,
  ChevronDown,
  Upload,
  Check,
  Layers,
  Zap,
  Menu,
  X,
} from 'lucide-react';
import { StorageHealth, AuthUser, StorageEndpointProfile } from '../types';

interface HeaderProps {
  health: StorageHealth;
  isCheckingHealth: boolean;
  onRefreshHealth: () => void;
  onOpenSync: () => void;
  onOpenUpload: () => void;
  onOpenLogs: () => void;
  onOpenSettings: () => void;
  autoSyncActive: boolean;
  pendingSyncCount: number;
  user?: AuthUser | null;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  endpoints?: StorageEndpointProfile[];
  activeEndpointId?: string;
  onSwitchEndpoint?: (endpointId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  isCheckingHealth,
  onRefreshHealth,
  onOpenSync,
  onOpenUpload,
  onOpenLogs,
  onOpenSettings,
  autoSyncActive,
  pendingSyncCount,
  user,
  onLogout,
  onOpenChangePassword,
  endpoints = [],
  activeEndpointId,
  onSwitchEndpoint,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isEndpointMenuOpen, setIsEndpointMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const endpointDropdownRef = useRef<HTMLDivElement>(null);
  const isConnected = health.status === 'connected';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (endpointDropdownRef.current && !endpointDropdownRef.current.contains(event.target as Node)) {
        setIsEndpointMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeEndpoint =
    endpoints.find((e) => e.id === (activeEndpointId || health.activeEndpointId)) ||
    endpoints[0];

  const currentPublicUrl = health.publicUrl || activeEndpoint?.publicUrl || 'https://storage.printpro.my.id';
  const publicDomain = currentPublicUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-slate-100 tracking-tight text-sm sm:text-base">CloudVault</span>
            <span className="hidden sm:inline-block text-[10px] font-mono tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
              AES-256
            </span>
          </div>
        </div>

        {/* Center: Consolidated Status Pill & Endpoint Switcher */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/90 text-xs shadow-inner">
          {/* Endpoint Switcher Dropdown */}
          <div className="relative" ref={endpointDropdownRef}>
            <button
              onClick={() => setIsEndpointMenuOpen(!isEndpointMenuOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-slate-200 transition-all font-medium"
              title="Klik untuk berpindah ke endpoint storage lain"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
                }`}
              />
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate max-w-[140px] text-xs">
                {activeEndpoint?.name || health.activeEndpointName || health.bucket || 'Storage'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {isEndpointMenuOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-fade-in text-xs">
                <div className="px-2 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Pilih Endpoint Storage</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{endpoints.length} Profil</span>
                </div>

                <div className="py-1 max-h-56 overflow-y-auto space-y-1">
                  {endpoints.map((ep) => {
                    const isSelected = ep.id === (activeEndpointId || health.activeEndpointId);
                    return (
                      <button
                        key={ep.id}
                        onClick={() => {
                          if (onSwitchEndpoint && !isSelected) {
                            onSwitchEndpoint(ep.id);
                          }
                          setIsEndpointMenuOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-emerald-950/60 border border-emerald-800/60 text-slate-100 font-medium'
                            : 'hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold">{ep.name}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                            Bucket: {ep.bucket}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setIsEndpointMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full py-1.5 px-2 text-center text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-slate-800/60 rounded-md transition-colors flex items-center justify-center gap-1"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Kelola / Tambah Endpoint (.env)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="text-slate-700">|</span>

          {/* Status & Ping */}
          <button
            onClick={onRefreshHealth}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
            title="Klik untuk ping koneksi storage aktif"
          >
            <span className="font-medium whitespace-nowrap">
              {isConnected ? 'Online' : 'Terputus'}
            </span>
            {health.latencyMs !== undefined && (
              <span className="text-slate-500 font-mono text-[10px]">({health.latencyMs}ms)</span>
            )}
            <RefreshCw className={`w-3 h-3 text-slate-500 ${isCheckingHealth ? 'animate-spin' : ''}`} />
          </button>

          <span className="text-slate-700">|</span>

          {/* Public Custom Domain Link */}
          <a
            href={currentPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono text-xs whitespace-nowrap transition-colors"
            title={`Buka Public CDN: ${currentPublicUrl}`}
          >
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-[150px]">{publicDomain}</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
          </a>
        </div>

        {/* Right Navigation & Action Triggers */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm"
            title="Unggah File ke Cloud"
          >
            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xs:inline">Unggah</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={onOpenSync}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              pendingSyncCount > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : autoSyncActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Pusat Sinkronisasi File"
          >
            <FolderSync className={`w-3.5 h-3.5 flex-shrink-0 ${autoSyncActive ? 'animate-pulse text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Sinkronisasi</span>
            {pendingSyncCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Desktop User Account Dropdown (Visible on md and up) */}
          {user && (
            <div className="hidden md:block relative pl-1 border-l border-slate-800">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs transition-colors"
                title="Menu Pengguna"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  {user.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <span className="font-medium text-slate-200 text-xs truncate max-w-[100px]">
                  {user.username}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu Modal / Popover */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-fade-in">
                    {/* User Summary Header */}
                    <div className="px-3 py-2.5 border-b border-slate-800 mb-1 bg-slate-950/40 rounded-lg">
                      <p className="font-semibold text-slate-100">{user.username}</p>
                      <p className="text-[11px] text-emerald-400 font-medium">{user.role}</p>
                      {user.email && (
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          {user.email}
                        </p>
                      )}
                    </div>

                    {/* Change Password */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenChangePassword?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
                    >
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                      <span>Ganti Kata Sandi</span>
                    </button>

                    {/* Storage Settings */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
                    >
                      <Sliders className="w-4 h-4 text-slate-400" />
                      <span>Pengaturan Storage</span>
                    </button>

                    {/* Audit Logs */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenLogs();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left"
                    >
                      <FileClock className="w-4 h-4 text-slate-400" />
                      <span>Riwayat Audit & Log</span>
                    </button>

                    {/* Logout */}
                    <div className="border-t border-slate-800/80 pt-1 mt-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile Menu Toggle Button (Visible only on mobile/tablet < md) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 transition-colors flex items-center gap-1.5"
            title="Buka Menu Mobile"
            aria-label="Menu Mobile"
          >
            {user && (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[9px]">
                {user.username ? user.username.slice(0, 1).toUpperCase() : 'U'}
              </div>
            )}
            {isMobileMenuOpen ? (
              <X className="w-4 h-4 text-slate-300" />
            ) : (
              <Menu className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/98 backdrop-blur-xl px-4 py-4 space-y-3.5 shadow-2xl animate-fade-in max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* User Profile Card */}
          {user && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 text-xs truncate">{user.username}</div>
                  <div className="text-[10px] text-emerald-400 font-mono">{user.role}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout?.();
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-[11px] hover:bg-rose-900/50 flex items-center gap-1 flex-shrink-0"
              >
                <LogOut className="w-3 h-3" />
                <span>Keluar</span>
              </button>
            </div>
          )}

          {/* Storage Endpoint Switcher */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Endpoint Storage Aktif</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">{endpoints.length} Profil</span>
            </div>

            <div className="space-y-1.5">
              {endpoints.map((ep) => {
                const isSelected = ep.id === (activeEndpointId || health.activeEndpointId);
                return (
                  <button
                    key={ep.id}
                    onClick={() => {
                      if (onSwitchEndpoint && !isSelected) {
                        onSwitchEndpoint(ep.id);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/60 border border-emerald-800/60 text-slate-100'
                        : 'bg-slate-950/60 border border-slate-800/80 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium truncate flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                        <span>{ep.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                        Bucket: {ep.bucket}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Storage Connection Status & Ping */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
                }`}
              />
              <span className="font-medium text-slate-200">
                {isConnected ? 'Storage Terhubung (Online)' : 'Koneksi Terputus'}
              </span>
              {health.latencyMs !== undefined && (
                <span className="text-slate-500 font-mono text-[10px]">({health.latencyMs}ms)</span>
              )}
            </div>
            <button
              onClick={onRefreshHealth}
              disabled={isCheckingHealth}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
              title="Ping koneksi storage"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span className="text-[10px]">Ping</span>
            </button>
          </div>

          {/* Public CDN Link */}
          <a
            href={currentPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-sky-400 hover:text-sky-300 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate text-[11px] font-mono">{publicDomain}</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          </a>

          {/* Navigation Action Links */}
          <div className="pt-2 border-t border-slate-800 space-y-1">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenChangePassword?.();
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-850 transition-colors text-left"
            >
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Ganti Kata Sandi</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenSettings();
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-850 transition-colors text-left"
            >
              <Sliders className="w-4 h-4 text-slate-400" />
              <span>Pengaturan Storage (.env)</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenLogs();
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-850 transition-colors text-left"
            >
              <FileClock className="w-4 h-4 text-slate-400" />
              <span>Riwayat Audit & Log</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
