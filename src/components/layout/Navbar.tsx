import React from 'react';
import {
  GitBranch,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  Terminal,
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
    <header className="h-13 border-b border-[#343B36] bg-[#202522] px-4 flex items-center justify-between z-30 sticky top-0 shrink-0">
      {/* Brand logo & title */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="w-7 h-7 rounded bg-[#263A2D] border border-[#537B5D] flex items-center justify-center text-[#B9D9BE]">
          <Terminal className="w-4 h-4 text-[#78A887]" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-sm tracking-tight text-[#F1F0E9]">
            RepoMind
          </span>
          <span className="text-[11px] text-[#858E86] font-mono hidden md:inline">
            codebase-analysis
          </span>
        </div>
      </div>

      {/* Center: Repository Selector & Status */}
      <div className="flex items-center space-x-2.5 min-w-0 mx-2">
        {currentRepo ? (
          <div className="flex items-center bg-[#262C28] border border-[#414A43] rounded-md px-2.5 py-1 space-x-2 min-w-0">
            <GitBranch className="w-3.5 h-3.5 text-[#78A887] shrink-0" />
            <select
              value={currentRepo.id}
              onChange={(e) => onSelectRepo(e.target.value)}
              className="bg-transparent text-xs font-mono font-medium text-[#F1F0E9] focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[240px] truncate"
              title={currentRepo.name}
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#262C28] text-[#F1F0E9]">
                  {r.name}
                </option>
              ))}
            </select>

            <div className="h-3 w-[1px] bg-[#343B36] shrink-0"></div>

            {/* Status Badge */}
            <div className="flex items-center shrink-0">
              {currentRepo.status === 'COMPLETED' ? (
                <span className="inline-flex items-center text-[10px] text-[#81C995] font-mono">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-[#81C995]" />
                  <span>Indexed</span>
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] text-[#E6B566] font-mono">
                  <Clock className="w-3 h-3 mr-1 text-[#E6B566]" />
                  <span>{currentRepo.status}</span>
                </span>
              )}
            </div>

            {/* Primary Language */}
            {currentRepo.stats?.languages?.[0]?.name && (
              <>
                <div className="h-3 w-[1px] bg-[#343B36] hidden lg:block shrink-0"></div>
                <span className="text-[11px] font-mono text-[#B1B7B1] hidden lg:inline">
                  {currentRepo.stats.languages[0].name}
                </span>
              </>
            )}

            {/* Last Analyzed Timestamp */}
            <div className="h-3 w-[1px] bg-[#343B36] hidden xl:block shrink-0"></div>
            <span className="text-[10px] font-mono text-[#858E86] hidden xl:inline">
              Updated {new Date(currentRepo.updatedAt || currentRepo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[#858E86] font-mono">No repository loaded</span>
        )}

        {/* Global Semantic Search Trigger Button */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center space-x-2 bg-[#262C28] hover:bg-[#2B322D] border border-[#414A43] hover:border-[#537B5D] text-[#B1B7B1] hover:text-[#F1F0E9] px-2.5 py-1 rounded-md text-xs transition"
          title="Open Semantic Search"
        >
          <Search className="w-3.5 h-3.5 text-[#858E86]" />
          <span className="text-[11px] font-mono">Search code...</span>
          <kbd className="text-[10px] bg-[#171A19] border border-[#343B36] px-1.5 py-0.2 rounded text-[#858E86] font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2 shrink-0">
        <button
          onClick={onNewAnalysis}
          className="flex items-center space-x-1.5 bg-[#78A887] hover:bg-[#8AB898] text-[#171A19] font-medium text-xs px-3 py-1.5 rounded-md transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Ingest Repository</span>
        </button>
      </div>
    </header>
  );
};
