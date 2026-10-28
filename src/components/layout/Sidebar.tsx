import React from 'react';
import {
  Home,
  LayoutDashboard,
  GitBranch,
  FolderTree,
  Binary,
  Network,
  Search,
  MessageSquareCode,
  FileText,
  GitFork,
  BarChart3,
  Cpu,
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
  const navItems: { id: NavTab; label: string; icon: React.ElementType; section?: string; badge?: string }[] = [
    { section: 'START', id: 'landing', label: 'Ingest / Home', icon: Home },
    {
      id: 'pipeline',
      label: 'Analysis Pipeline',
      icon: Cpu,
      badge: repoStatus === 'COMPLETED' ? '100%' : repoStatus ? 'Running' : undefined,
    },

    { section: 'CODEBASE EXPLORATION', id: 'overview', label: 'Project Overview', icon: LayoutDashboard },
    { id: 'files', label: 'File Explorer', icon: FolderTree },
    { id: 'analysis', label: 'Code Analysis (AST)', icon: Binary },
    { id: 'architecture', label: 'Architecture & Flow', icon: Network },
    { id: 'dependencies', label: 'Dependency View', icon: GitFork },

    { section: 'INTELLIGENCE & RAG', id: 'search', label: 'Semantic Search', icon: Search },
    { id: 'assistant', label: 'AI Assistant & Evidence', icon: MessageSquareCode },
    { id: 'documentation', label: 'Documentation Generator', icon: FileText },

    { section: 'RESEARCH & EVALUATION', id: 'evaluation', label: 'Academic Evaluation', icon: BarChart3 },
  ];

  return (
    <aside className="w-60 border-r border-[#343B36] bg-[#202522] flex flex-col justify-between shrink-0 h-[calc(100vh-3.25rem)] select-none">
      <div className="py-3 overflow-y-auto px-2 space-y-4">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <React.Fragment key={item.id}>
              {item.section && (
                <div className={`px-2.5 text-[10px] font-mono tracking-wider font-semibold text-[#858E86] uppercase ${index > 0 ? 'pt-3' : 'pt-1'}`}>
                  {item.section}
                </div>
              )}
              <button
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-[#263A2D] text-[#B9D9BE] border border-[#537B5D]'
                    : 'text-[#B1B7B1] hover:text-[#F1F0E9] hover:bg-[#262C28] border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#78A887]' : 'text-[#858E86]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                      isActive
                        ? 'border-[#537B5D] text-[#B9D9BE] bg-[#202522]'
                        : 'border-[#343B36] text-[#858E86] bg-[#171A19]'
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

      {/* Footer repository quick status */}
      <div className="p-3 border-t border-[#343B36] bg-[#171A19] text-[11px] font-mono text-[#858E86]">
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${repoLoaded ? 'bg-[#81C995]' : 'bg-[#687069]'}`}></span>
            <span>{repoLoaded ? 'Engine Online' : 'No Repository'}</span>
          </span>
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
