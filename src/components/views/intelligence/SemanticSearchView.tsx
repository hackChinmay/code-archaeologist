import React, { useState } from 'react';
import {
  Search,
  FileCode,
  Sparkles,
  ArrowRight,
  Database,
  Filter,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import type { SearchResult, RepoFile, CodeChunk } from '../../../types/index.ts';
import { api } from '../../../services/api.ts';

interface SemanticSearchViewProps {
  repoId: string;
  files: RepoFile[];
  onSelectFileChunk: (filePath: string, line: number) => void;
  onAskAI: (question: string) => void;
}

export const SemanticSearchView: React.FC<SemanticSearchViewProps> = ({
  repoId,
  files,
  onSelectFileChunk,
  onAskAI,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const sampleQueries = [
    'Where is authentication implemented and how are tokens issued?',
    'Which file handles database connections and async sessions?',
    'Where are API routes defined and mounted?',
    'How is user registration handled with password hashing?',
    'Which modules depend on the security tokens service?',
  ];

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.searchRepository(repoId, searchQuery, 6);
      setSearchResult(res);
    } catch (err) {
      console.error('Semantic search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header and Input Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>Semantic Codebase Search</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
              ChromaDB Vector Retrieval
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Vector similarity search over AST-bounded code chunks with cosine distance ranking.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="e.g. 'Where is JWT token verification executed?'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl text-xs font-mono transition flex items-center space-x-1.5 shadow-md shadow-cyan-950/40 shrink-0"
          >
            {isSearching ? (
              <span>Searching...</span>
            ) : (
              <>
                <span>Retrieve Chunks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Preset Prompt Suggestions */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <p className="text-[11px] font-mono text-slate-400">Example Questions:</p>
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 px-2.5 py-1.5 rounded-lg transition font-mono text-left"
              >
                &ldquo;{sq}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>
              Retrieved <span className="text-cyan-400 font-bold">{searchResult.results.length}</span> top-k
              chunks for query: &ldquo;{searchResult.query}&rdquo;
            </span>
            <button
              onClick={() => onAskAI(searchResult.query)}
              className="text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI to synthesize complete answer &rarr;</span>
            </button>
          </div>

          <div className="space-y-4">
            {searchResult.results.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3 hover:border-cyan-500/40 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded">
                      #{idx + 1} Match
                    </span>
                    <span className="text-xs font-bold text-white font-mono">{item.chunk.filePath}</span>
                    <span className="text-xs text-slate-500 font-mono">
                      (Lines {item.chunk.startLine}–{item.chunk.endLine})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
                      Cosine Sim: {item.score}
                    </span>
                    <button
                      onClick={() => onSelectFileChunk(item.chunk.filePath, item.chunk.startLine)}
                      className="text-xs font-mono text-cyan-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition border border-slate-700"
                    >
                      Inspect in Source
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 font-mono">{item.explanation}</p>

                {/* Code Chunk Snippet */}
                <div className="bg-[#070a10] border border-slate-800/80 rounded-lg p-3 overflow-x-auto text-xs font-mono text-slate-300">
                  <pre>{item.chunk.content}</pre>
                </div>
              </div>
            ))}

            {searchResult.results.length === 0 && (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 font-mono">
                  No matching code chunks found for this query in the repository index.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
