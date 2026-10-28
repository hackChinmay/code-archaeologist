import React, { useState } from 'react';
import {
  Search,
  FileCode,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { SearchResult, RepoFile } from '../../../types/index.ts';
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
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header and Input Bar */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-semibold text-[#F1F0E9] font-mono flex items-center space-x-2">
              <Search className="w-4 h-4 text-[#78A887]" />
              <span>Semantic Code Search</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#263A2D] text-[#81C995] border border-[#537B5D] font-medium">
              ChromaDB Vector Retrieval
            </span>
          </div>
          <p className="text-xs text-[#858E86]">
            Semantic similarity search across AST-bounded code chunks with cosine distance ranking.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#858E86] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="e.g. 'Where is JWT token verification executed?'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded-md pl-9 pr-3.5 py-2 text-xs sm:text-sm text-[#F1F0E9] placeholder-[#858E86] font-mono focus:outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="bg-[#78A887] hover:bg-[#8AB898] disabled:opacity-50 text-[#171A19] font-medium px-4 py-2 rounded-md text-xs font-mono transition flex items-center space-x-1.5 shrink-0 cursor-pointer"
          >
            {isSearching ? (
              <span>Searching...</span>
            ) : (
              <>
                <span>Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Preset Prompt Suggestions */}
        <div className="space-y-2 pt-2 border-t border-[#343B36]">
          <p className="text-[11px] font-mono text-[#858E86]">Example queries:</p>
          <div className="flex flex-wrap gap-1.5">
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="text-xs text-[#B1B7B1] bg-[#202522] hover:bg-[#2B322D] border border-[#343B36] hover:border-[#537B5D] px-2.5 py-1 rounded transition font-mono text-left cursor-pointer"
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
          <div className="flex items-center justify-between text-xs font-mono text-[#858E86] px-1">
            <span>
              Retrieved <span className="text-[#F1F0E9] font-medium">{searchResult.results.length}</span> matching chunks for query: &ldquo;{searchResult.query}&rdquo;
            </span>
            <button
              onClick={() => onAskAI(searchResult.query)}
              className="text-[#78A887] hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI to synthesize answer &rarr;</span>
            </button>
          </div>

          <div className="space-y-3">
            {searchResult.results.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#262C28] border border-[#414A43] hover:border-[#537B5D] rounded-lg p-4 space-y-2.5 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-[10px] font-mono text-[#81C995] bg-[#263A2D] border border-[#537B5D] px-1.5 py-0.2 rounded font-medium shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#F1F0E9] font-mono truncate">{item.chunk.filePath}</span>
                    <span className="text-xs text-[#858E86] font-mono shrink-0">
                      (Lines {item.chunk.startLine}–{item.chunk.endLine})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[10px] font-mono text-[#B1B7B1] bg-[#202522] border border-[#343B36] px-1.5 py-0.2 rounded">
                      Score: {item.score}
                    </span>
                    <button
                      onClick={() => onSelectFileChunk(item.chunk.filePath, item.chunk.startLine)}
                      className="text-xs font-mono text-[#F1F0E9] hover:text-[#B9D9BE] bg-[#202522] hover:bg-[#2B322D] px-2.5 py-1 rounded transition border border-[#414A43] cursor-pointer"
                    >
                      View in Source
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#B1B7B1] font-mono">{item.explanation}</p>

                {/* Code Chunk Snippet */}
                <div className="bg-[#171A19] border border-[#343B36] rounded p-2.5 overflow-x-auto text-xs font-mono text-[#F1F0E9]">
                  <pre>{item.chunk.content}</pre>
                </div>
              </div>
            ))}

            {searchResult.results.length === 0 && (
              <div className="p-8 text-center bg-[#262C28] border border-[#414A43] rounded-lg">
                <p className="text-xs text-[#858E86] font-mono">
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
