import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  Binary,
  Layers,
  Code2,
  Sparkles,
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
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
              className="flex items-center space-x-1.5 py-1 px-2 hover:bg-[#262C28] rounded cursor-pointer text-xs text-[#B1B7B1] hover:text-[#F1F0E9] font-mono transition"
            >
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#78A887] shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-[#858E86] shrink-0" />
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
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`flex items-center justify-between py-1 px-2 rounded cursor-pointer text-xs font-mono transition select-none ${
            isSelected
              ? 'bg-[#263A2D] text-[#B9D9BE] border-l-2 border-[#537B5D]'
              : 'text-[#B1B7B1] hover:text-[#F1F0E9] hover:bg-[#262C28]'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate">
            <FileCode
              className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#78A887]' : 'text-[#858E86]'}`}
            />
            <span className="truncate">{child.name}</span>
          </div>
          {child.file?.symbolsCount ? (
            <span className="text-[10px] text-[#858E86] px-1 py-0.2 rounded bg-[#171A19] border border-[#343B36] shrink-0 ml-1">
              {child.file.symbolsCount}s
            </span>
          ) : null}
        </div>
      );
    });
  };

  return (
    <div className="h-[calc(100vh-3.25rem)] flex flex-col md:flex-row overflow-hidden bg-[#171A19]">
      {/* Left Tree Explorer Sidebar */}
      <div className="w-full md:w-72 border-r border-[#343B36] bg-[#202522] flex flex-col shrink-0">
        <div className="p-3 border-b border-[#343B36] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-[#F1F0E9] uppercase tracking-wider">
              Files
            </span>
            <span className="text-[11px] font-mono text-[#858E86]">{files.length} source files</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#858E86] absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search file path..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-8 py-1.5 text-xs text-[#F1F0E9] placeholder-[#858E86] focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {renderTree(fileTree)}
        </div>
      </div>

      {/* Main File Content & Code Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#171A19]">
        {selectedFile ? (
          <>
            {/* File Info Bar */}
            <div className="h-12 border-b border-[#343B36] bg-[#202522] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 truncate min-w-0 mr-3">
                <FileCode className="w-4 h-4 text-[#78A887] shrink-0" />
                <div className="truncate">
                  <span className="text-xs font-medium text-[#F1F0E9] font-mono truncate">{selectedFile.path}</span>
                  <div className="flex items-center space-x-2 text-[10px] text-[#858E86] font-mono">
                    <span>{selectedFile.language}</span>
                    <span>·</span>
                    <span>{selectedFile.linesCount} lines</span>
                    <span>·</span>
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                    <span>·</span>
                    <span className="text-[#B9D9BE]">
                      {activeFileSymbols.length} AST symbols
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => onAskAIAboutFile(selectedFile.path)}
                  className="bg-[#262C28] hover:bg-[#2B322D] text-[#F1F0E9] border border-[#414A43] hover:border-[#537B5D] text-xs px-2.5 py-1 rounded transition flex items-center space-x-1.5 font-mono cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#78A887]" />
                  <span>Ask AI</span>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Code viewer with line numbers */}
              <div className="flex-1 overflow-auto bg-[#171A19] font-mono text-xs p-3 leading-relaxed selection:bg-[#263A2D] selection:text-[#B9D9BE]">
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
                            ? 'bg-[#263A2D] text-[#B9D9BE] font-medium'
                            : 'hover:bg-[#202522] text-[#F1F0E9]'
                        }`}
                      >
                        <span className="table-cell select-none pr-3 text-right text-[#858E86] font-mono text-[11px] w-12 border-r border-[#343B36]">
                          {lineNum}
                        </span>
                        <span className="table-cell pl-3 whitespace-pre font-mono">
                          {line || ' '}
                        </span>
                      </div>
                    );
                  })}
                </pre>
              </div>

              {/* Symbol Outline & Metadata Sidebar for selected file */}
              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-[#343B36] bg-[#202522] flex flex-col shrink-0 overflow-y-auto p-3.5 space-y-4">
                <div>
                  <h3 className="text-xs font-mono font-semibold text-[#F1F0E9] uppercase tracking-wider flex items-center space-x-1.5 pb-2 border-b border-[#343B36]">
                    <Binary className="w-3.5 h-3.5 text-[#78A887]" />
                    <span>AST Symbols ({activeFileSymbols.length})</span>
                  </h3>
                  <div className="space-y-1.5 mt-2">
                    {activeFileSymbols.length > 0 ? (
                      activeFileSymbols.map((sym) => (
                        <div
                          key={sym.id}
                          className="p-2 rounded bg-[#262C28] border border-[#343B36] space-y-1 hover:border-[#537B5D] transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#F1F0E9] font-mono truncate">{sym.name}</span>
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#171A19] text-[#858E86] border border-[#343B36] shrink-0 ml-1">
                              {sym.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#858E86] font-mono truncate">
                            Lines {sym.startLine}–{sym.endLine}
                          </p>
                          {sym.signature && (
                            <p className="text-[10px] text-[#B1B7B1] font-mono truncate">
                              {sym.signature}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#858E86] font-mono py-2">No symbols extracted</p>
                    )}
                  </div>
                </div>

                {/* Imports in this file */}
                <div>
                  <h3 className="text-xs font-mono font-semibold text-[#F1F0E9] uppercase tracking-wider flex items-center space-x-1.5 pb-2 border-b border-[#343B36]">
                    <Layers className="w-3.5 h-3.5 text-[#D6A85F]" />
                    <span>Imports ({selectedFile.imports.length})</span>
                  </h3>
                  <div className="space-y-1 mt-2">
                    {selectedFile.imports.map((imp, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono text-[#B1B7B1] bg-[#262C28] border border-[#343B36] px-2 py-1 rounded truncate"
                        title={imp}
                      >
                        {imp}
                      </div>
                    ))}
                    {selectedFile.imports.length === 0 && (
                      <p className="text-xs text-[#858E86] font-mono py-1">No imports detected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <Code2 className="w-8 h-8 text-[#858E86]" />
            <p className="text-xs text-[#858E86] font-mono">Select a file from the explorer tree to view code</p>
          </div>
        )}
      </div>
    </div>
  );
};
