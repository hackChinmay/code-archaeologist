import React from 'react';
import {
  FolderTree,
  FileCode,
  Binary,
  Network,
  Cpu,
  ArrowRight,
  BookOpen,
  GitBranch,
  ShieldCheck,
  Search,
} from 'lucide-react';
import type { Repository, RepoFile } from '../../../types/index.ts';

interface OverviewViewProps {
  repo: Repository;
  files: RepoFile[];
  onNavigate: (tab: any) => void;
  onSelectFile: (file: RepoFile) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  repo,
  files,
  onNavigate,
  onSelectFile,
}) => {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Banner: Project Title and AI Summary */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-[#202522] text-[#B1B7B1] border border-[#343B36]">
                branch: {repo.defaultBranch}
              </span>
              <span className="text-[#858E86]">@{repo.owner}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-[#F1F0E9] tracking-tight">
              {repo.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#B1B7B1] max-w-3xl leading-relaxed">
              {repo.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => onNavigate('assistant')}
              className="bg-[#78A887] hover:bg-[#8AB898] text-[#171A19] font-medium text-xs px-3.5 py-2 rounded-md transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <span>Ask Codebase Assistant</span>
            </button>
            <button
              onClick={() => onNavigate('architecture')}
              className="bg-[#2B322D] hover:bg-[#343B36] text-[#F1F0E9] text-xs px-3.5 py-2 rounded-md transition flex items-center space-x-1.5 border border-[#414A43] cursor-pointer"
            >
              <Network className="w-3.5 h-3.5 text-[#78A887]" />
              <span>Architecture &amp; Flow</span>
            </button>
          </div>
        </div>

        {/* Grounded Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-[#343B36]">
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3.5 space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#B9D9BE] font-mono">
              <BookOpen className="w-3.5 h-3.5 text-[#78A887]" />
              <span>Grounded Codebase Purpose</span>
            </div>
            <p className="text-xs text-[#B1B7B1] leading-relaxed">
              {repo.summary}
            </p>
          </div>

          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3.5 space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#B9D9BE] font-mono">
              <Network className="w-3.5 h-3.5 text-[#78A887]" />
              <span>Architectural Organization</span>
            </div>
            <p className="text-xs text-[#B1B7B1] leading-relaxed">
              {repo.architectureSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Compact Numerical Metric Panels */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#262C28] border border-[#414A43] rounded-md p-3.5 space-y-1">
          <p className="text-[10px] font-mono text-[#858E86] uppercase tracking-wide">Files</p>
          <p className="text-xl font-semibold text-[#F1F0E9] font-mono">{repo.stats.filesCount}</p>
          <p className="text-[10px] text-[#858E86]">Source code files</p>
        </div>

        <div className="bg-[#262C28] border border-[#414A43] rounded-md p-3.5 space-y-1">
          <p className="text-[10px] font-mono text-[#858E86] uppercase tracking-wide">Classes (AST)</p>
          <p className="text-xl font-semibold text-[#B9D9BE] font-mono">{repo.stats.classesCount}</p>
          <p className="text-[10px] text-[#858E86]">Classes &amp; interfaces</p>
        </div>

        <div className="bg-[#262C28] border border-[#414A43] rounded-md p-3.5 space-y-1">
          <p className="text-[10px] font-mono text-[#858E86] uppercase tracking-wide">Functions</p>
          <p className="text-xl font-semibold text-[#F1F0E9] font-mono">{repo.stats.functionsCount}</p>
          <p className="text-[10px] text-[#858E86]">Methods &amp; handlers</p>
        </div>

        <div className="bg-[#262C28] border border-[#414A43] rounded-md p-3.5 space-y-1">
          <p className="text-[10px] font-mono text-[#858E86] uppercase tracking-wide">Dependencies</p>
          <p className="text-xl font-semibold text-[#D6A85F] font-mono">{repo.stats.dependenciesCount}</p>
          <p className="text-[10px] text-[#858E86]">Imports &amp; calls</p>
        </div>

        <div className="bg-[#262C28] border border-[#414A43] rounded-md p-3.5 space-y-1">
          <p className="text-[10px] font-mono text-[#858E86] uppercase tracking-wide">Lines of Code</p>
          <p className="text-xl font-semibold text-[#81C995] font-mono">{repo.stats.linesOfCode.toLocaleString()}</p>
          <p className="text-[10px] text-[#858E86]">Executable lines</p>
        </div>

        <div className="bg-[#262C28] border border-[#414A43] rounded-md p-3.5 space-y-1">
          <p className="text-[10px] font-mono text-[#858E86] uppercase tracking-wide">RAG Chunks</p>
          <p className="text-xl font-semibold text-[#B9D9BE] font-mono">{repo.stats.chunksCount}</p>
          <p className="text-[10px] text-[#858E86]">ChromaDB indexed</p>
        </div>
      </div>

      {/* Languages Distribution */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-3">
        <h2 className="text-xs font-mono font-semibold text-[#F1F0E9] uppercase tracking-wider">
          Language Breakdown
        </h2>
        {/* Subtle multi-color bar */}
        <div className="h-2 w-full rounded-full overflow-hidden flex bg-[#171A19] border border-[#343B36]">
          {repo.stats.languages.map((lang) => (
            <div
              key={lang.name}
              style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}
              className="h-full transition-all duration-300"
              title={`${lang.name}: ${lang.percentage}%`}
            ></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          {repo.stats.languages.map((lang) => (
            <div key={lang.name} className="flex items-center space-x-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lang.color }}></span>
              <span className="font-medium text-[#F1F0E9]">{lang.name}</span>
              <span className="text-[#B1B7B1] font-mono">{lang.percentage}%</span>
              <span className="text-[#858E86] font-mono text-[10px]">({lang.filesCount} files)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Files and Capabilities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Important Files List */}
        <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#343B36] pb-2.5">
            <h2 className="text-xs font-mono font-semibold text-[#F1F0E9] uppercase tracking-wider flex items-center space-x-2">
              <FileCode className="w-3.5 h-3.5 text-[#78A887]" />
              <span>Key Source Modules</span>
            </h2>
            <button
              onClick={() => onNavigate('files')}
              className="text-xs text-[#78A887] hover:underline flex items-center space-x-1 font-mono cursor-pointer"
            >
              <span>Explore all files</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5">
            {files.slice(0, 6).map((file) => (
              <div
                key={file.id}
                onClick={() => {
                  onSelectFile(file);
                  onNavigate('files');
                }}
                className="group cursor-pointer p-2.5 rounded-md bg-[#202522] hover:bg-[#2B322D] border border-[#343B36] hover:border-[#537B5D] transition flex items-center justify-between"
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <p className="text-xs font-mono font-medium text-[#F1F0E9] group-hover:text-[#B9D9BE] transition truncate">
                    {file.path}
                  </p>
                  <p className="text-[10px] text-[#858E86] font-mono truncate">
                    {file.language} · {file.linesCount} lines · {file.symbolsCount} symbols
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[#78A887] opacity-0 group-hover:opacity-100 transition shrink-0">
                  Inspect &rarr;
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Tools Grid */}
        <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-3">
          <div className="border-b border-[#343B36] pb-2.5">
            <h2 className="text-xs font-mono font-semibold text-[#F1F0E9] uppercase tracking-wider flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-[#78A887]" />
              <span>Analysis Workspaces</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              onClick={() => onNavigate('analysis')}
              className="cursor-pointer p-3 rounded-md bg-[#202522] border border-[#343B36] hover:border-[#537B5D] transition space-y-1 group"
            >
              <div className="flex items-center space-x-1.5">
                <Binary className="w-3.5 h-3.5 text-[#78A887]" />
                <h3 className="text-xs font-semibold text-[#F1F0E9] group-hover:text-[#B9D9BE]">AST Symbols</h3>
              </div>
              <p className="text-[11px] text-[#858E86] leading-normal">
                Inspect classes, methods, AST signatures, and docstrings.
              </p>
            </div>

            <div
              onClick={() => onNavigate('architecture')}
              className="cursor-pointer p-3 rounded-md bg-[#202522] border border-[#343B36] hover:border-[#537B5D] transition space-y-1 group"
            >
              <div className="flex items-center space-x-1.5">
                <Network className="w-3.5 h-3.5 text-[#78A887]" />
                <h3 className="text-xs font-semibold text-[#F1F0E9] group-hover:text-[#B9D9BE]">Architecture Graph</h3>
              </div>
              <p className="text-[11px] text-[#858E86] leading-normal">
                Interactive module call graphs and dependency flowcharts.
              </p>
            </div>

            <div
              onClick={() => onNavigate('search')}
              className="cursor-pointer p-3 rounded-md bg-[#202522] border border-[#343B36] hover:border-[#537B5D] transition space-y-1 group"
            >
              <div className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-[#78A887]" />
                <h3 className="text-xs font-semibold text-[#F1F0E9] group-hover:text-[#B9D9BE]">Semantic Search</h3>
              </div>
              <p className="text-[11px] text-[#858E86] leading-normal">
                Natural-language code snippet retrieval powered by ChromaDB.
              </p>
            </div>

            <div
              onClick={() => onNavigate('documentation')}
              className="cursor-pointer p-3 rounded-md bg-[#202522] border border-[#343B36] hover:border-[#537B5D] transition space-y-1 group"
            >
              <div className="flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#78A887]" />
                <h3 className="text-xs font-semibold text-[#F1F0E9] group-hover:text-[#B9D9BE]">Documentation</h3>
              </div>
              <p className="text-[11px] text-[#858E86] leading-normal">
                Synthesize structured module and project documentation.
              </p>
            </div>
          </div>

          <div className="p-2.5 bg-[#202522] border border-[#343B36] rounded-md flex items-center space-x-2 text-[11px] text-[#858E86] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#81C995]" />
            <span>All metrics extracted deterministically from parsed source code.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
