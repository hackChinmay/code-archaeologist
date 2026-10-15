import React, { useState, useMemo } from 'react';
import {
  Binary,
  Layers,
  Search,
  CheckCircle2,
  FileCode,
  Tag,
  ArrowRight,
  ShieldCheck,
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
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
                <Binary className="w-5 h-5 text-cyan-400" />
                <span>Source Code Analysis &amp; AST Symbols</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-semibold">
                Detected from source code
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic symbol tables extracted using Tree-sitter grammar parsers. Zero hallucinations.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Total Symbols: <span className="text-cyan-400 font-bold">{symbols.length}</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search symbol name or signature..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
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
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Files</option>
              {files.map((f) => (
                <option key={f.id} value={f.path}>
                  {f.path}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Symbols Table / Card List */}
      <div className="space-y-3">
        {filteredSymbols.length > 0 ? (
          filteredSymbols.map((sym) => (
            <div
              key={sym.id}
              className="bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-4 transition space-y-2 group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${
                      sym.type === 'class'
                        ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60'
                        : sym.type === 'method'
                        ? 'bg-purple-950/70 text-purple-300 border-purple-800/60'
                        : 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                    }`}
                  >
                    {sym.type}
                  </span>
                  <h3 className="text-sm font-bold text-white font-mono group-hover:text-cyan-300 transition">
                    {sym.name}
                  </h3>
                  {sym.parentSymbol && (
                    <span className="text-xs text-slate-500 font-mono">
                      (in class {sym.parentSymbol})
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                    {sym.detectedFrom}
                  </span>
                  <button
                    onClick={() => handleJumpToSource(sym)}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition border border-slate-700"
                  >
                    <span>View in Source</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Signature */}
              {sym.signature && (
                <div className="bg-[#080c14] border border-slate-800/80 rounded-lg p-2 font-mono text-xs text-slate-300 overflow-x-auto">
                  <code>{sym.signature}</code>
                </div>
              )}

              {/* Location metadata & details */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                <span className="flex items-center space-x-1 text-slate-300">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{sym.filePath}</span>
                </span>
                <span>Lines {sym.startLine}–{sym.endLine}</span>
                {sym.inherits && sym.inherits.length > 0 && (
                  <span className="text-amber-400">
                    Inherits: {sym.inherits.join(', ')}
                  </span>
                )}
                {sym.calls && sym.calls.length > 0 && (
                  <span className="text-indigo-400">
                    Calls: {sym.calls.join(', ')}
                  </span>
                )}
              </div>

              {sym.docstring && (
                <p className="text-xs text-slate-400 italic pt-1 border-t border-slate-800/60">
                  &ldquo;{sym.docstring}&rdquo;
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
            <Code className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-mono text-slate-400">No symbols found matching your filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};
