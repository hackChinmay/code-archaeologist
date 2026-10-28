import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Loader2,
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
  const stageDefs = [
    { key: 'CLONING', title: 'Repository Ingestion', desc: 'Validated URL, cloned tree, filtered non-source artifacts' },
    { key: 'SCANNING', title: 'File Scanning & Collection', desc: `Identified ${repo.stats.filesCount} source files across ${repo.stats.dirsCount} directories` },
    { key: 'PARSING', title: 'Tree-sitter AST Parsing', desc: 'Generated AST syntax trees for Python, TypeScript, JavaScript, and Java' },
    { key: 'ANALYZING', title: 'Symbol & Dependency Extraction', desc: `Extracted ${repo.stats.classesCount} classes, ${repo.stats.functionsCount} functions, ${repo.stats.dependenciesCount} dependency edges` },
    { key: 'CHUNKING', title: 'Semantic Code Chunking', desc: `Divided codebase into ${repo.stats.chunksCount} contextual function and class chunks` },
    { key: 'EMBEDDING', title: 'Dense Embedding Generation', desc: 'Generated semantic vector embeddings preserving syntax boundaries' },
    { key: 'INDEXING', title: 'ChromaDB Collection Indexing', desc: 'Persisted vector chunks into isolated repository collection' },
    { key: 'COMPLETED', title: 'Pipeline Finalization', desc: repo.statusMessage || 'Analysis complete. Ready for semantic search and grounded RAG.' },
  ];

  // Stage order mapping
  const stageOrder = ['QUEUED', 'CLONING', 'SCANNING', 'PARSING', 'ANALYZING', 'CHUNKING', 'EMBEDDING', 'INDEXING', 'COMPLETED'];
  const currentIdx = stageOrder.indexOf(repo.status);

  const getStageState = (stageKey: string, idx: number) => {
    if (repo.status === 'COMPLETED') return 'SUCCESS';
    if (repo.status === 'FAILED') {
      if (idx < currentIdx) return 'SUCCESS';
      if (idx === currentIdx) return 'FAILED';
      return 'PENDING';
    }
    const thisIdx = stageOrder.indexOf(stageKey);
    if (currentIdx > thisIdx) return 'SUCCESS';
    if (currentIdx === thisIdx) return 'RUNNING';
    return 'PENDING';
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header Info Panel */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-[#F1F0E9] font-mono">{repo.name}</h1>
              <span className="text-xs text-[#858E86] font-mono">@{repo.owner}</span>
            </div>
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#78A887] hover:underline flex items-center space-x-1 font-mono"
            >
              <span className="truncate max-w-sm sm:max-w-md">{repo.url}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center text-xs font-mono font-medium px-2.5 py-1 rounded border ${
                repo.status === 'COMPLETED'
                  ? 'bg-[#263A2D] text-[#81C995] border-[#537B5D]'
                  : repo.status === 'FAILED'
                  ? 'bg-[#202522] text-[#E58C83] border-[#E58C83]'
                  : 'bg-[#202522] text-[#E6B566] border-[#E6B566]'
              }`}
            >
              {repo.status === 'COMPLETED' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#81C995]" />
                  <span>ANALYSIS COMPLETE (100%)</span>
                </>
              ) : repo.status === 'FAILED' ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-[#E58C83]" />
                  <span>FAILED ({repo.progress}%)</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-[#E6B566]" />
                  <span>{repo.status} ({repo.progress}%)</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#171A19] h-2 rounded-full overflow-hidden border border-[#343B36]">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              repo.status === 'FAILED' ? 'bg-[#E58C83]' : 'bg-[#78A887]'
            }`}
            style={{ width: `${repo.progress}%` }}
          ></div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3">
            <p className="text-[10px] font-mono text-[#858E86] uppercase">Files Scanned</p>
            <p className="text-base font-semibold text-[#F1F0E9] font-mono mt-0.5">{repo.stats.filesCount}</p>
          </div>
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3">
            <p className="text-[10px] font-mono text-[#858E86] uppercase">Directories</p>
            <p className="text-base font-semibold text-[#F1F0E9] font-mono mt-0.5">{repo.stats.dirsCount}</p>
          </div>
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3">
            <p className="text-[10px] font-mono text-[#858E86] uppercase">Classes (AST)</p>
            <p className="text-base font-semibold text-[#B9D9BE] font-mono mt-0.5">{repo.stats.classesCount}</p>
          </div>
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3">
            <p className="text-[10px] font-mono text-[#858E86] uppercase">Functions</p>
            <p className="text-base font-semibold text-[#F1F0E9] font-mono mt-0.5">{repo.stats.functionsCount}</p>
          </div>
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3">
            <p className="text-[10px] font-mono text-[#858E86] uppercase">Dependencies</p>
            <p className="text-base font-semibold text-[#D6A85F] font-mono mt-0.5">{repo.stats.dependenciesCount}</p>
          </div>
          <div className="bg-[#202522] border border-[#343B36] rounded-md p-3">
            <p className="text-[10px] font-mono text-[#858E86] uppercase">Chunks Indexed</p>
            <p className="text-base font-semibold text-[#81C995] font-mono mt-0.5">{repo.stats.chunksCount}</p>
          </div>
        </div>
      </div>

      {/* Sequential Processing Pipeline Timeline */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#343B36] pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F1F0E9]">Sequential Analysis Pipeline Timeline</h2>
            <p className="text-xs text-[#858E86]">Deterministic execution from raw repository tree to ChromaDB vector index</p>
          </div>
          <span className="text-xs font-mono text-[#858E86]">{stageDefs.length} Execution Stages</span>
        </div>

        <div className="space-y-2.5">
          {stageDefs.map((st, idx) => {
            const state = getStageState(st.key, idx);

            return (
              <div
                key={st.key}
                className={`flex items-start space-x-3 p-3 rounded-md border transition-colors ${
                  state === 'SUCCESS'
                    ? 'bg-[#202522] border-[#343B36]'
                    : state === 'RUNNING'
                    ? 'bg-[#263A2D] border-[#537B5D]'
                    : state === 'FAILED'
                    ? 'bg-[#202522] border-[#E58C83]'
                    : 'bg-[#171A19] border-[#343B36]/60 opacity-60'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {state === 'SUCCESS' && (
                    <CheckCircle2 className="w-4 h-4 text-[#81C995]" />
                  )}
                  {state === 'RUNNING' && (
                    <Loader2 className="w-4 h-4 text-[#E6B566] animate-spin" />
                  )}
                  {state === 'FAILED' && (
                    <AlertCircle className="w-4 h-4 text-[#E58C83]" />
                  )}
                  {state === 'PENDING' && (
                    <div className="w-4 h-4 rounded-full border border-[#687069] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#687069]"></div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-medium text-[#F1F0E9] truncate">
                      Stage 0{idx + 1}: {st.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.2 rounded border shrink-0 ${
                        state === 'SUCCESS'
                          ? 'text-[#81C995] bg-[#263A2D] border-[#537B5D]'
                          : state === 'RUNNING'
                          ? 'text-[#E6B566] bg-[#202522] border-[#E6B566]'
                          : state === 'FAILED'
                          ? 'text-[#E58C83] bg-[#202522] border-[#E58C83]'
                          : 'text-[#687069] bg-[#171A19] border-[#343B36]'
                      }`}
                    >
                      {state}
                    </span>
                  </div>
                  <p className="text-xs text-[#B1B7B1] font-mono">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="pt-4 border-t border-[#343B36] flex items-center justify-end space-x-2.5">
          <button
            onClick={onExploreCode}
            className="px-3.5 py-2 rounded-md bg-[#2B322D] hover:bg-[#343B36] text-[#F1F0E9] text-xs font-medium border border-[#414A43] transition cursor-pointer"
          >
            Explore Files &amp; Symbols
          </button>
          <button
            onClick={onAskAI}
            className="px-3.5 py-2 rounded-md bg-[#78A887] hover:bg-[#8AB898] text-[#171A19] text-xs font-medium transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <span>Ask AI Assistant</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
