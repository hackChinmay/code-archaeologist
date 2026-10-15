import React from 'react';
import {
  Home,
  LayoutDashboard,
  Cpu,
  FolderTree,
  Binary,
  Network,
  Search,
  MessageSquareCode,
  FileText,
  GitFork,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

export type NavTab =
  | 'landing'
  | 'overview'
  | 'pipeline'
  | 'files'
  | 'analysis'
  | 'architecture'
  | 'search'
  | 'assistant'
  | 'documentation'
  | 'dependencies'
  | 'evaluation';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  repoLoaded: boolean;
  repoStatus?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  repoLoaded,
  repoStatus,
}) => {
  const pipelineBadge =
    repoStatus === 'COMPLETED'
      ? '✓ Indexed'
      : repoStatus
      ? '◐ Analyzing'
      : 'Stages';

  const navItems: { id: NavTab; label: string; icon: React.ElementType; section?: string; badge?: string }[] = [
    { section: 'START', id: 'landing', label: 'Ingest / Home', icon: Home },
    { id: 'pipeline', label: 'Analysis Pipeline', icon: Cpu, badge: pipelineBadge },

    { section: 'CODEBASE EXPLORATION', id: 'overview', label: 'Project Overview', icon: LayoutDashboard },
    { id: 'files', label: 'File Explorer', icon: FolderTree },
    { id: 'analysis', label: 'Code Analysis (AST)', icon: Binary, badge: 'Tree-sitter' },
    { id: 'architecture', label: 'Architecture & Flow', icon: Network, badge: 'Flowchart' },
    { id: 'dependencies', label: 'Dependency View', icon: GitFork },

    { section: 'INTELLIGENCE & RAG', id: 'search', label: 'Semantic Search', icon: Search, badge: 'ChromaDB' },
    { id: 'assistant', label: 'AI Assistant & Evidence', icon: MessageSquareCode, badge: 'Gemini RAG' },
    { id: 'documentation', label: 'Doc Generator', icon: FileText },

    { section: 'RESEARCH & EVALUATION', id: 'evaluation', label: 'Academic Evaluation', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#090d16] flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] select-none">
      <div className="py-4 overflow-y-auto px-3 space-y-6">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <React.Fragment key={item.id}>
              {item.section && (
                <div className={`px-2 text-[10px] font-mono tracking-wider font-semibold text-slate-500 uppercase ${index > 0 ? 'pt-2' : ''}`}>
                  {item.section}
                </div>
              )}
              <button
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      isActive
                        ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/50">
        <div className="rounded-lg bg-slate-900/60 border border-slate-800/80 p-2.5 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-mono text-[10px]">
            <span>REPOMIND PIPELINE</span>
            <span className="text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
              <span>ACTIVE</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
            Tree-sitter AST &bull; ChromaDB &bull; Gemini RAG
          </p>
        </div>
      </div>
    </aside>
  );
};
