import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  Binary,
  Layers,
  Sparkles,
  ExternalLink,
  Code2,
} from 'lucide-react';
import type { RepoFile, SymbolItem } from '../../../types/index.ts';

interface FileExplorerViewProps {
  files: RepoFile[];
  symbols: SymbolItem[];
  selectedFile: RepoFile | null;
  onSelectFile: (file: RepoFile) => void;
  onAskAIAboutFile: (filePath: string) => void;
  highlightedLine?: number;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  file?: RepoFile;
  children: Map<string, TreeNode>;
}

export const FileExplorerView: React.FC<FileExplorerViewProps> = ({
  files,
  symbols,
  selectedFile,
  onSelectFile,
  onAskAIAboutFile,
  highlightedLine,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['', 'app', 'src']));

  // Filter files by search term
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;
    const term = searchTerm.toLowerCase();
    return files.filter(
      (f) => f.path.toLowerCase().includes(term) || f.language.toLowerCase().includes(term),
    );
  }, [files, searchTerm]);

  // Build tree from files
  const fileTree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', isFolder: true, children: new Map() };

    for (const f of filteredFiles) {
      const parts = f.path.split('/');
      let current = root;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = i === parts.length - 1;

        if (isLast) {
          current.children.set(part, {
            name: part,
            path: currentPath,
            isFolder: false,
            file: f,
            children: new Map(),
          });
        } else {
          if (!current.children.has(part)) {
            current.children.set(part, {
              name: part,
              path: currentPath,
              isFolder: true,
              children: new Map(),
            });
          }
          current = current.children.get(part)!;
        }
      }
    }
    return root;
  }, [filteredFiles]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const activeFileSymbols = useMemo(() => {
    if (!selectedFile) return [];
    return symbols.filter((s) => s.filePath === selectedFile.path);
  }, [selectedFile, symbols]);

  const renderTree = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const childNodes = Array.from(node.children.values());
    childNodes.sort((a, b) => {
      if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
      return a.isFolder ? -1 : 1;
    });

    return childNodes.map((child) => {
      const isExpanded = expandedFolders.has(child.path);
      const isSelected = selectedFile?.path === child.path;

      if (child.isFolder) {
        return (
          <div key={child.path} className="select-none">
            <div
              onClick={() => toggleFolder(child.path)}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className="flex items-center space-x-1.5 py-1 px-2 hover:bg-slate-800/60 rounded-md cursor-pointer text-xs text-slate-300 font-mono transition"
            >
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{child.name}</span>
            </div>
            {isExpanded && renderTree(child, depth + 1)}
          </div>
        );
      }

      return (
        <div
          key={child.path}
          onClick={() => child.file && onSelectFile(child.file)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`flex items-center justify-between py-1 px-2 rounded-md cursor-pointer text-xs font-mono transition group select-none ${
            isSelected
              ? 'bg-cyan-500/15 text-cyan-300 border-l-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate">
            <FileCode
              className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}
            />
            <span className="truncate">{child.name}</span>
          </div>
          {child.file?.symbolsCount ? (
            <span className="text-[10px] text-slate-500 px-1 py-0.2 rounded bg-slate-900 border border-slate-800 shrink-0">
              {child.file.symbolsCount}s
            </span>
          ) : null}
        </div>
      );
    });
  };

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col md:flex-row overflow-hidden">
      {/* Left Tree Explorer Sidebar */}
      <div className="w-full md:w-80 border-r border-slate-800 bg-[#090d16] flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              File Explorer
            </span>
            <span className="text-[11px] font-mono text-slate-500">{files.length} files</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search files by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {renderTree(fileTree)}
        </div>
      </div>

      {/* Main File Content & Code Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b0f17]">
        {selectedFile ? (
          <>
            {/* File Info Bar */}
            <div className="h-14 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 truncate">
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="truncate">
                  <span className="text-xs font-bold text-slate-100 font-mono">{selectedFile.path}</span>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                    <span>{selectedFile.language}</span>
                    <span>&bull;</span>
                    <span>{selectedFile.linesCount} lines</span>
                    <span>&bull;</span>
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                    <span>&bull;</span>
                    <span className="text-cyan-400 font-medium">
                      {activeFileSymbols.length} AST symbols detected
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onAskAIAboutFile(selectedFile.path)}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 hover:border-cyan-500 text-xs px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 font-mono"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Ask AI About File</span>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Code viewer with line numbers */}
              <div className="flex-1 overflow-auto bg-[#070a10] font-mono text-xs p-4 leading-relaxed selection:bg-cyan-500/30">
                <pre className="table w-full">
                  {selectedFile.content.split('\n').map((line, idx) => {
                    const lineNum = idx + 1;
                    const isTargetLine = highlightedLine === lineNum;

                    return (
                      <div
                        key={lineNum}
                        id={`L${lineNum}`}
                        className={`table-row transition-colors ${
                          isTargetLine
                            ? 'bg-cyan-500/20 text-cyan-100 font-semibold'
                            : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <span className="table-cell select-none pr-4 text-right text-slate-600 font-mono text-[11px] w-12 border-r border-slate-800/80">
                          {lineNum}
                        </span>
                        <span className="table-cell pl-4 whitespace-pre font-mono">
                          {line || ' '}
                        </span>
                      </div>
                    );
                  })}
                </pre>
              </div>

              {/* Symbol Outline & Metadata Sidebar for selected file */}
              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#090d16] flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 pb-2 border-b border-slate-800">
                    <Binary className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Symbols in this File ({activeFileSymbols.length})</span>
                  </h3>
                  <div className="space-y-1.5 mt-2">
                    {activeFileSymbols.length > 0 ? (
                      activeFileSymbols.map((sym) => (
                        <div
                          key={sym.id}
                          className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1 hover:border-slate-700 transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-cyan-300 font-mono">{sym.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {sym.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            Lines {sym.startLine}–{sym.endLine}
                          </p>
                          {sym.signature && (
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {sym.signature}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 font-mono py-2">No symbols extracted</p>
                    )}
                  </div>
                </div>

                {/* Imports in this file */}
                <div>
                  <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5 pb-2 border-b border-slate-800">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Detected Imports ({selectedFile.imports.length})</span>
                  </h3>
                  <div className="space-y-1 mt-2">
                    {selectedFile.imports.map((imp, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono text-slate-300 bg-slate-900/40 border border-slate-800 px-2 py-1 rounded truncate"
                      >
                        {imp}
                      </div>
                    ))}
                    {selectedFile.imports.length === 0 && (
                      <p className="text-xs text-slate-500 font-mono py-1">No imports detected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Code2 className="w-10 h-10 text-slate-600" />
            <p className="text-sm text-slate-400 font-mono">Select a file from the explorer tree to view code</p>
          </div>
        )}
      </div>
    </div>
  );
};
