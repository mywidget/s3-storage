import React from 'react';

export const FileTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} className="border-b border-slate-800/40 animate-pulse">
          {/* Checkbox */}
          <td className="py-3.5 px-4 w-10">
            <div className="w-4 h-4 rounded bg-slate-800/80" />
          </td>

          {/* Name & Path */}
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-slate-800/90 flex-shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div
                  className="h-3.5 rounded bg-slate-800"
                  style={{ width: `${Math.floor(40 + (idx % 4) * 15)}%` }}
                />
                <div
                  className="h-2.5 rounded bg-slate-800/60"
                  style={{ width: `${Math.floor(25 + (idx % 3) * 12)}%` }}
                />
              </div>
            </div>
          </td>

          {/* Encryption status */}
          <td className="py-3.5 px-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-950/40 border border-emerald-800/30" />
              <div className="h-3 w-20 rounded bg-slate-800/70" />
            </div>
          </td>

          {/* Size */}
          <td className="py-3.5 px-4">
            <div className="space-y-1">
              <div className="h-3 w-16 rounded bg-slate-800 font-mono" />
              <div className="h-2 w-12 rounded bg-slate-800/50" />
            </div>
          </td>

          {/* Modified */}
          <td className="py-3.5 px-4">
            <div className="h-3 w-24 rounded bg-slate-800/70" />
          </td>

          {/* Actions */}
          <td className="py-3.5 px-4 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <div className="w-6 h-6 rounded bg-slate-800/60" />
              <div className="w-6 h-6 rounded bg-slate-800/60" />
              <div className="w-6 h-6 rounded bg-slate-800/60" />
              <div className="w-6 h-6 rounded bg-slate-800/60" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
};

export const FolderCardsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse shadow-sm h-16"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-4 h-4 rounded bg-emerald-900/40" />
              <div className="h-3 rounded bg-slate-800 w-16" />
            </div>
            <div className="w-3 h-3 rounded bg-slate-800/60" />
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/50">
            <div className="h-2 rounded bg-slate-800/60 w-10" />
            <div className="h-2 rounded bg-slate-800/70 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-6 animate-pulse">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
        >
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 bg-slate-800 rounded" />
            <div className="flex items-baseline gap-2">
              <div className="h-6 w-16 bg-slate-800 rounded font-mono" />
              <div className="h-2.5 w-12 bg-slate-800/60 rounded" />
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50" />
        </div>
      ))}
    </div>
  );
};
