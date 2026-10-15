import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  Layers,
  Database,
  Binary,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type { Repository } from '../../../types/index.ts';

interface AnalysisPipelineViewProps {
  repo: Repository;
  onExploreCode: () => void;
  onAskAI: () => void;
}

export const AnalysisPipelineView: React.FC<AnalysisPipelineViewProps> = ({
  repo,
  onExploreCode,
  onAskAI,
}) => {
  const stages = [
    { id: 'ingest', title: 'Repository detected & ingested', desc: 'Validated URL, cloned tree, filtered non-source artifacts' },
    { id: 'scan', title: 'Files collected & filtered', desc: `Found ${repo.stats.filesCount} source files across ${repo.stats.dirsCount} directories` },
    { id: 'parse', title: 'Parsing source code (Tree-sitter)', desc: 'Generating AST nodes for Python, TypeScript, JavaScript, Java' },
    { id: 'symbols', title: 'Extracting symbols', desc: `Extracted ${repo.stats.classesCount} classes and ${repo.stats.functionsCount} functions` },
    { id: 'deps', title: 'Analyzing dependencies', desc: `Identified ${repo.stats.dependenciesCount} imports, inherits, and call edges` },
    { id: 'chunks', title: 'Creating semantic code chunks', desc: `Sliced ${repo.stats.chunksCount} logical class & function chunks` },
    { id: 'embed', title: 'Generating embeddings', desc: 'Computing high-dimensional token and semantic vectors' },
    { id: 'index', title: 'Building searchable knowledge base', desc: 'Persisting into ChromaDB isolated repository collection' },
    { id: 'done', title: 'Analysis completed', desc: repo.statusMessage },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8">
      {/* Header Info Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white font-mono">{repo.name}</h1>
              <span className="text-xs text-slate-400 font-mono">by @{repo.owner}</span>
            </div>
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-cyan-400 hover:underline flex items-center space-x-1 font-mono mt-0.5"
            >
              <span>{repo.url}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center text-xs font-mono font-medium px-3 py-1 rounded-full border ${
                repo.status === 'COMPLETED'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60 animate-pulse'
              }`}
            >
              {repo.status === 'COMPLETED' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  ANALYSIS COMPLETED (100%)
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  STATUS: {repo.status} ({repo.progress}%)
                </>
              )}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${repo.progress}%` }}
          ></div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase">Files Scanned</p>
            <p className="text-lg font-bold text-white font-mono">{repo.stats.filesCount}</p>
          </div>
          <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase">Directories</p>
            <p className="text-lg font-bold text-white font-mono">{repo.stats.dirsCount}</p>
          </div>
          <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase">Classes (AST)</p>
            <p className="text-lg font-bold text-cyan-400 font-mono">{repo.stats.classesCount}</p>
          </div>
          <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase">Functions</p>
            <p className="text-lg font-bold text-indigo-400 font-mono">{repo.stats.functionsCount}</p>
          </div>
          <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase">Dependencies</p>
            <p className="text-lg font-bold text-amber-400 font-mono">{repo.stats.dependenciesCount}</p>
          </div>
          <div className="bg-[#0b0f17] border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-mono text-slate-400 uppercase">Chunks Indexed</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">{repo.stats.chunksCount}</p>
          </div>
        </div>
      </div>

      {/* Sequential Processing Pipeline (As required by Screen 2) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">Sequential Analysis Pipeline Execution</h2>
            <p className="text-xs text-slate-400">Step-by-step progress from raw source files to searchable ChromaDB knowledge base</p>
          </div>
          <span className="text-xs font-mono text-slate-500">9 Stages Verified</span>
        </div>

        <div className="space-y-4">
          {stages.map((st, idx) => {
            const isCompleted = repo.status === 'COMPLETED';
            return (
              <div
                key={st.id}
                className="flex items-start space-x-3.5 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700 transition"
              >
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                  )}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 font-mono">
                      Stage 0{idx + 1}: {st.title}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.2 rounded">
                      SUCCESS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick action buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            onClick={onExploreCode}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Explore Files &amp; Symbols
          </button>
          <button
            onClick={onAskAI}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition flex items-center space-x-1.5"
          >
            <span>Ask AI Assistant</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
