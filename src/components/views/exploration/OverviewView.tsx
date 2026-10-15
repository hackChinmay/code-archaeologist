import React from 'react';
import {
  FolderTree,
  FileCode,
  Binary,
  Layers,
  Network,
  Cpu,
  ArrowRight,
  BookOpen,
  GitBranch,
  ShieldCheck,
  Sparkles,
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
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
      {/* Top Banner: Project Title and AI Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0e1626] to-[#090d16] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-medium">
                {repo.defaultBranch}
              </span>
              <span className="text-xs text-slate-400 font-mono">@{repo.owner}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {repo.name}
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              {repo.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => onNavigate('assistant')}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow-md shadow-cyan-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI About Repo</span>
            </button>
            <button
              onClick={() => onNavigate('architecture')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 border border-slate-700"
            >
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Architecture</span>
            </button>
          </div>
        </div>

        {/* AI-Generated Project & Architecture Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Grounded Project Purpose</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {repo.summary}
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-teal-300 uppercase tracking-wider font-mono">
              <Network className="w-3.5 h-3.5" />
              <span>Architectural Organization</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {repo.architectureSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Numerical Stats Cards (All derived from actual analyzed data) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase">Files</p>
          <p className="text-2xl font-bold text-white font-mono">{repo.stats.filesCount}</p>
          <p className="text-[10px] text-slate-500 font-mono">Source code files</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase">Classes (AST)</p>
          <p className="text-2xl font-bold text-cyan-400 font-mono">{repo.stats.classesCount}</p>
          <p className="text-[10px] text-slate-500 font-mono">Classes &amp; interfaces</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase">Functions</p>
          <p className="text-2xl font-bold text-indigo-400 font-mono">{repo.stats.functionsCount}</p>
          <p className="text-[10px] text-slate-500 font-mono">Methods &amp; handlers</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase">Dependencies</p>
          <p className="text-2xl font-bold text-amber-400 font-mono">{repo.stats.dependenciesCount}</p>
          <p className="text-[10px] text-slate-500 font-mono">Import &amp; call edges</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase">Lines of Code</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono">{repo.stats.linesOfCode}</p>
          <p className="text-[10px] text-slate-500 font-mono">Clean source lines</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-[11px] font-mono text-slate-400 uppercase">RAG Chunks</p>
          <p className="text-2xl font-bold text-teal-400 font-mono">{repo.stats.chunksCount}</p>
          <p className="text-[10px] text-slate-500 font-mono">ChromaDB indexed</p>
        </div>
      </div>

      {/* Languages Distribution */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
          Languages Distribution
        </h2>
        {/* Multi-color percentage bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800">
          {repo.stats.languages.map((lang) => (
            <div
              key={lang.name}
              style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}
              className="h-full transition-all duration-500"
              title={`${lang.name}: ${lang.percentage}%`}
            ></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          {repo.stats.languages.map((lang) => (
            <div key={lang.name} className="flex items-center space-x-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lang.color }}></span>
              <span className="font-semibold text-slate-200">{lang.name}</span>
              <span className="text-slate-400 font-mono">{lang.percentage}%</span>
              <span className="text-slate-500 font-mono text-[10px]">({lang.filesCount} files)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key Files and Detected Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Important Files List */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span>Key Source Modules</span>
            </h2>
            <button
              onClick={() => onNavigate('files')}
              className="text-xs text-cyan-400 hover:underline flex items-center space-x-1 font-mono"
            >
              <span>Explore all files</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {files.slice(0, 6).map((file) => (
              <div
                key={file.id}
                onClick={() => {
                  onSelectFile(file);
                  onNavigate('files');
                }}
                className="group cursor-pointer p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/40 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-200 font-mono group-hover:text-cyan-300 transition">
                    {file.path}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {file.language} &bull; {file.linesCount} lines &bull; {file.symbolsCount} symbols
                  </p>
                </div>
                <span className="text-[11px] font-mono text-cyan-400 opacity-0 group-hover:opacity-100 transition">
                  View &rarr;
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Action Pathways */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-teal-400" />
            <span>Analysis Capabilities</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => onNavigate('analysis')}
              className="cursor-pointer p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition space-y-1 group"
            >
              <Binary className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-semibold text-slate-200">AST Symbols</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                Inspect classes, methods, signatures, and docstrings.
              </p>
            </div>

            <div
              onClick={() => onNavigate('architecture')}
              className="cursor-pointer p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 transition space-y-1 group"
            >
              <Network className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-semibold text-slate-200">Architecture Graph</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                Interactive call graphs and module import relationships.
              </p>
            </div>

            <div
              onClick={() => onNavigate('search')}
              className="cursor-pointer p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition space-y-1 group"
            >
              <FolderTree className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-semibold text-slate-200">Semantic Search</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                Natural query code retrieval powered by ChromaDB.
              </p>
            </div>

            <div
              onClick={() => onNavigate('documentation')}
              className="cursor-pointer p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition space-y-1 group"
            >
              <BookOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <h3 className="text-xs font-semibold text-slate-200">Generate Docs</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                Synthesize structured module documentation.
              </p>
            </div>
          </div>

          <div className="p-3 bg-cyan-950/30 border border-cyan-900/40 rounded-xl flex items-center space-x-2 text-[11px] text-cyan-300 font-mono">
            <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>All metrics and graphs computed deterministically from analyzed source code.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
