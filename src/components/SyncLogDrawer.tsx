import React, { useState } from 'react';
import {
  X,
  FileClock,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Filter,
} from 'lucide-react';
import { SyncLogEntry } from '../types';
import { formatDate, formatBytes } from '../services/cryptoClient';

interface SyncLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SyncLogEntry[];
  onClearLogs: () => void;
}

export const SyncLogDrawer: React.FC<SyncLogDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'all') return true;
    return log.type === filterType;
  });

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudvault-sync-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (type: string, status: string) => {
    if (status === 'failed') return <AlertCircle className="w-4 h-4 text-rose-400" />;
    switch (type) {
      case 'upload':
        return <ArrowUpCircle className="w-4 h-4 text-emerald-400" />;
      case 'download':
        return <ArrowDownCircle className="w-4 h-4 text-sky-400" />;
      case 'diff':
        return <RefreshCw className="w-4 h-4 text-amber-400" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-l border-slate-800 w-full sm:max-w-xl h-full flex flex-col shadow-2xl min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <FileClock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 text-sm truncate">Riwayat Audit & Sinkronisasi</h3>
              <p className="text-xs text-slate-400 truncate">Log aktivitas transfer, enkripsi, dan diff</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
            <button
              onClick={exportLogs}
              disabled={logs.length === 0}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              title="Ekspor Log JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              title="Bersihkan Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 text-xs overflow-x-auto whitespace-nowrap min-w-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-slate-500 text-[11px] flex-shrink-0">Filter:</span>
          {['all', 'upload', 'download', 'diff', 'delete'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                filterType === type
                  ? 'bg-slate-800 text-slate-100 font-semibold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Log Entries */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              Belum ada riwayat aktivitas yang tercatat.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-slate-200">
                    {getLogIcon(log.type, log.status)}
                    <span className="truncate max-w-[280px]">{log.fileName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatDate(log.timestamp)}
                  </span>
                </div>

                <p className="text-slate-400 text-[11px] pl-6">{log.message}</p>

                <div className="pl-6 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                  {log.fileSize !== undefined && <span>{formatBytes(log.fileSize)}</span>}
                  {log.durationMs !== undefined && <span>{log.durationMs}ms</span>}
                  <span
                    className={`uppercase font-semibold ${
                      log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Total: {logs.length} entri riwayat</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
