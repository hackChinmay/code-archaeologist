import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  FolderTree,
  FileCode,
  Binary,
  Layers,
} from 'lucide-react';
import type { RepoFile, SymbolItem, DocumentationResult } from '../../../types/index.ts';
import { api } from '../../../services/api.ts';

interface DocumentationViewProps {
  repoId: string;
  files: RepoFile[];
  symbols: SymbolItem[];
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({
  repoId,
  files,
  symbols,
}) => {
  const [scope, setScope] = useState<'project' | 'file' | 'symbol'>('project');
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path || '');
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbols[0]?.name || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [docResult, setDocResult] = useState<DocumentationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await api.generateDocumentation(repoId, {
        scope,
        targetPath: scope === 'file' ? selectedPath : undefined,
        symbolName: scope === 'symbol' ? selectedSymbol : undefined,
      });
      setDocResult(res);
    } catch (err) {
      console.error('Doc gen failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!docResult) return;
    navigator.clipboard.writeText(docResult.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!docResult) return;
    const blob = new Blob([docResult.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docResult.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span>Structured Documentation Generator</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
              Grounded Markdown Synthesis
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Synthesize developer documentation covering purpose, inputs/outputs, dependencies, and flow diagrams.
          </p>
        </div>

        {/* Scope selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">DOC SCOPE</label>
            <div className="grid grid-cols-3 gap-1 bg-[#0b0f17] border border-slate-700 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setScope('project')}
                className={`text-xs py-1 rounded font-mono transition ${
                  scope === 'project' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Project
              </button>
              <button
                type="button"
                onClick={() => setScope('file')}
                className={`text-xs py-1 rounded font-mono transition ${
                  scope === 'file' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                File
              </button>
              <button
                type="button"
                onClick={() => setScope('symbol')}
                className={`text-xs py-1 rounded font-mono transition ${
                  scope === 'symbol' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Symbol
              </button>
            </div>
          </div>

          {scope === 'file' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">SELECT FILE</label>
              <select
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                {files.map((f) => (
                  <option key={f.id} value={f.path}>
                    {f.path}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'symbol' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">SELECT SYMBOL</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                {symbols.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.type}) in {s.filePath}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-xs font-mono transition flex items-center justify-center space-x-2 shadow-md shadow-cyan-950/40"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Documentation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Generated Documentation Viewer */}
      {docResult ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white font-mono">{docResult.title}</h2>
              <span className="text-[11px] text-slate-500 font-mono">Scope: {docResult.scope}</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono flex items-center space-x-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy MD'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export .md</span>
              </button>
            </div>
          </div>

          <div className="bg-[#070a10] border border-slate-800/80 rounded-xl p-6 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30 overflow-x-auto">
            {docResult.markdown}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-2xl space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 font-mono">
            Click &ldquo;Generate Documentation&rdquo; above to assemble AST symbols and grounded context into Markdown docs.
          </p>
        </div>
      )}
    </div>
  );
};
