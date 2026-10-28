import React, { useState, useMemo } from 'react';
import {
  Binary,
  Search,
  FileCode,
  ArrowRight,
  Code,
} from 'lucide-react';
import type { SymbolItem, RepoFile } from '../../../types/index.ts';

interface CodeAnalysisViewProps {
  symbols: SymbolItem[];
  files: RepoFile[];
  onSelectFileSymbol: (file: RepoFile, line: number) => void;
}

export const CodeAnalysisView: React.FC<CodeAnalysisViewProps> = ({
  symbols,
  files,
  onSelectFileSymbol,
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFileFilter, setSelectedFileFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSymbols = useMemo(() => {
    return symbols.filter((s) => {
      if (selectedType !== 'all' && s.type !== selectedType) return false;
      if (selectedFileFilter !== 'all' && s.filePath !== selectedFileFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.filePath.toLowerCase().includes(q) ||
          (s.signature && s.signature.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [symbols, selectedType, selectedFileFilter, searchQuery]);

  const handleJumpToSource = (sym: SymbolItem) => {
    const file = files.find((f) => f.path === sym.filePath);
    if (file) {
      onSelectFileSymbol(file, sym.startLine);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-[#F1F0E9] flex items-center space-x-2 font-mono">
                <Binary className="w-4 h-4 text-[#78A887]" />
                <span>AST Symbol Explorer</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#263A2D] text-[#81C995] border border-[#537B5D] font-medium">
                Tree-sitter AST
              </span>
            </div>
            <p className="text-xs text-[#858E86] mt-0.5">
              Deterministic symbol tables extracted directly from AST syntax trees with line-level grounding.
            </p>
          </div>
          <div className="text-xs font-mono text-[#858E86]">
            Total Extracted Symbols: <span className="text-[#F1F0E9] font-medium">{symbols.length}</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[#343B36]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#858E86] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter symbol name or signature..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-8 py-1.5 text-xs text-[#F1F0E9] placeholder-[#858E86] font-mono focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-2.5 py-1.5 text-xs text-[#F1F0E9] font-mono focus:outline-none cursor-pointer"
            >
              <option value="all">All Symbol Types</option>
              <option value="class">Classes</option>
              <option value="function">Functions</option>
              <option value="method">Methods</option>
              <option value="interface">Interfaces</option>
            </select>
          </div>

          <div>
            <select
              value={selectedFileFilter}
              onChange={(e) => setSelectedFileFilter(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-2.5 py-1.5 text-xs text-[#F1F0E9] font-mono focus:outline-none cursor-pointer"
            >
              <option value="all">All Files ({files.length})</option>
              {files.map((f) => (
                <option key={f.id} value={f.path}>
                  {f.path}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Symbols Table / Dense List */}
      <div className="space-y-2.5">
        {filteredSymbols.length > 0 ? (
          filteredSymbols.map((sym) => (
            <div
              key={sym.id}
              className="bg-[#262C28] border border-[#414A43] hover:border-[#537B5D] rounded-lg p-3.5 transition space-y-2 group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span
                    className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                      sym.type === 'class'
                        ? 'bg-[#263A2D] text-[#81C995] border-[#537B5D]'
                        : sym.type === 'method'
                        ? 'bg-[#202522] text-[#D6A85F] border-[#343B36]'
                        : 'bg-[#202522] text-[#91B8D2] border-[#343B36]'
                    }`}
                  >
                    {sym.type}
                  </span>
                  <h3 className="text-xs font-semibold text-[#F1F0E9] font-mono group-hover:text-[#B9D9BE] transition truncate">
                    {sym.name}
                  </h3>
                  {sym.parentSymbol && (
                    <span className="text-[11px] text-[#858E86] font-mono truncate">
                      (in {sym.parentSymbol})
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] font-mono text-[#858E86]">
                    {sym.detectedFrom}
                  </span>
                  <button
                    onClick={() => handleJumpToSource(sym)}
                    className="text-xs font-mono text-[#F1F0E9] hover:text-[#B9D9BE] flex items-center space-x-1 bg-[#202522] hover:bg-[#2B322D] px-2.5 py-1 rounded transition border border-[#414A43] cursor-pointer"
                  >
                    <span>View in Source</span>
                    <ArrowRight className="w-3 h-3 text-[#78A887]" />
                  </button>
                </div>
              </div>

              {/* Signature */}
              {sym.signature && (
                <div className="bg-[#171A19] border border-[#343B36] rounded p-2 font-mono text-xs text-[#B1B7B1] overflow-x-auto">
                  <code>{sym.signature}</code>
                </div>
              )}

              {/* Location metadata & details */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#858E86]">
                <span className="flex items-center space-x-1 text-[#F1F0E9]">
                  <FileCode className="w-3 h-3 text-[#78A887]" />
                  <span>{sym.filePath}</span>
                </span>
                <span>Lines {sym.startLine}–{sym.endLine}</span>
                {sym.inherits && sym.inherits.length > 0 && (
                  <span className="text-[#D6A85F]">
                    Inherits: {sym.inherits.join(', ')}
                  </span>
                )}
                {sym.calls && sym.calls.length > 0 && (
                  <span className="text-[#91B8D2]">
                    Calls: {sym.calls.join(', ')}
                  </span>
                )}
              </div>

              {sym.docstring && (
                <p className="text-xs text-[#858E86] italic pt-1 border-t border-[#343B36]">
                  &ldquo;{sym.docstring}&rdquo;
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="p-8 text-center bg-[#262C28] border border-[#414A43] rounded-lg space-y-1.5">
            <Code className="w-6 h-6 text-[#858E86] mx-auto" />
            <p className="text-xs font-mono text-[#858E86]">No symbols matching the selected filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};
