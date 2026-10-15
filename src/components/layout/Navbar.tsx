import React from 'react';
import {
  Compass,
  GitBranch,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { Repository } from '../../types/index.ts';

interface NavbarProps {
  currentRepo: Repository | null;
  repositories: Repository[];
  onSelectRepo: (id: string) => void;
  onOpenSearch: () => void;
  onNewAnalysis: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRepo,
  repositories,
  onSelectRepo,
  onOpenSearch,
  onNewAnalysis,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-[#0c121e]/90 backdrop-blur-md px-4 flex items-center justify-between z-30 sticky top-0">
      {/* Brand logo & title */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold ring-1 ring-cyan-400/30">
          <Compass className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-cyan-300 via-teal-200 to-white bg-clip-text text-transparent">
              RepoMind
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
            AI-Powered Codebase Understanding &amp; Software Analysis
          </p>
        </div>
      </div>

      {/* Center: Repository Selector & Status (Section 18) */}
      <div className="flex items-center space-x-3">
        {currentRepo ? (
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-1 px-3 space-x-2.5 shadow-inner">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider hidden lg:inline">
              Repository:
            </span>
            <div className="flex items-center space-x-1.5">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={currentRepo.id}
                onChange={(e) => onSelectRepo(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-slate-200 focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {repositories.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-slate-200">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-3 w-[1px] bg-slate-800"></div>

            {/* Status Badge */}
            <div className="flex items-center space-x-1.5">
              {currentRepo.status === 'COMPLETED' ? (
                <span className="inline-flex items-center text-[10px] text-emerald-400 font-medium bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60 font-mono">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                  Indexed
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] text-amber-400 font-medium bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60 animate-pulse font-mono">
                  <Clock className="w-2.5 h-2.5 mr-1" />
                  {currentRepo.status}
                </span>
              )}
            </div>

            {/* Primary Language */}
            {currentRepo.stats?.languages?.[0]?.name && (
              <>
                <div className="h-3 w-[1px] bg-slate-800 hidden md:block"></div>
                <span className="text-[11px] font-mono text-cyan-300 hidden md:inline">
                  {currentRepo.stats.languages[0].name}
                </span>
              </>
            )}

            {/* Last Analyzed Timestamp */}
            <div className="h-3 w-[1px] bg-slate-800 hidden xl:block"></div>
            <span className="text-[10px] font-mono text-slate-400 hidden xl:inline">
              Analyzed: {new Date(currentRepo.updatedAt || currentRepo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-mono">No repository loaded</span>
        )}

        {/* Global Semantic Search Trigger Button */}
        <button
          onClick={onOpenSearch}
          className="hidden md:flex items-center space-x-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/50 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs transition shadow-sm"
        >
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-[11px]">Semantic Search...</span>
          <kbd className="text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.2 rounded text-slate-400 font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onNewAnalysis}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg shadow-md shadow-cyan-900/30 transition hover:shadow-cyan-600/20 ring-1 ring-cyan-400/20"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ingest New Repo</span>
        </button>
      </div>
    </header>
  );
};
