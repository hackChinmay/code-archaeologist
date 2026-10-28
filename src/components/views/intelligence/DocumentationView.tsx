import React, { useState, useMemo } from 'react';
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
  Printer,
  Eye,
  Code2,
  BookOpen,
  List,
  ChevronRight,
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
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

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

  const handlePrint = () => {
    window.print();
  };

  // Extract table of contents headings (# and ##) from the markdown
  const tableOfContents = useMemo(() => {
    if (!docResult?.markdown) return [];
    const lines = docResult.markdown.split('\n');
    const toc: { text: string; level: number; id: string }[] = [];
    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        toc.push({ text, level, id });
      }
    });
    return toc;
  }, [docResult?.markdown]);

  // Clean structured markdown renderer
  const renderFormattedMarkdown = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent: string[] = [];

    const flushCodeBlock = (key: number) => {
      if (codeContent.length > 0) {
        elements.push(
          <div key={`code-${key}`} className="my-3 rounded-lg border border-[#343B36] bg-[#202522] overflow-hidden">
            {codeLanguage && (
              <div className="bg-[#171A19] border-b border-[#343B36] px-3 py-1 text-[11px] font-mono text-[#858E86] uppercase tracking-wider flex items-center justify-between">
                <span>{codeLanguage}</span>
                <span className="text-[10px] text-[#687069]">AST Grounded</span>
              </div>
            )}
            <pre className="p-3.5 text-xs font-mono text-[#F1F0E9] overflow-x-auto leading-relaxed">
              <code>{codeContent.join('\n')}</code>
            </pre>
          </div>
        );
        codeContent = [];
        codeLanguage = '';
      }
    };

    lines.forEach((line, idx) => {
      // Code blocks toggle
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock(idx);
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = line.trim().replace(/^```/, '').trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Headings
      if (line.startsWith('# ')) {
        const title = line.substring(2);
        const id = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        elements.push(
          <h1 key={idx} id={id} className="text-xl font-semibold text-[#F1F0E9] border-b border-[#343B36] pb-2 mt-6 mb-3 first:mt-0 font-sans">
            {title}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        const subtitle = line.substring(3);
        const id = subtitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        elements.push(
          <h2 key={idx} id={id} className="text-base font-medium text-[#B9D9BE] mt-5 mb-2 font-sans flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78A887]"></span>
            <span>{subtitle}</span>
          </h2>
        );
      } else if (line.startsWith('### ')) {
        const text = line.substring(4);
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        elements.push(
          <h3 key={idx} id={id} className="text-sm font-medium text-[#D6A85F] mt-4 mb-1 font-sans">
            {text}
          </h3>
        );
      } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        // Bullet list
        const text = line.trim().substring(2);
        elements.push(
          <div key={idx} className="flex items-start gap-2 my-1 pl-2 text-xs leading-relaxed text-[#B1B7B1]">
            <span className="text-[#78A887] font-bold mt-0.5">•</span>
            <span>{renderInlineText(text)}</span>
          </div>
        );
      } else if (line.trim().startsWith('> ')) {
        // Blockquote / note
        const text = line.trim().substring(2);
        elements.push(
          <div key={idx} className="border-l-2 border-[#78A887] bg-[#263A2D]/40 pl-3 py-1.5 my-2 text-xs text-[#B9D9BE] italic font-sans">
            {renderInlineText(text)}
          </div>
        );
      } else if (line.trim() === '') {
        // Empty space
        elements.push(<div key={idx} className="h-2" />);
      } else {
        // Regular paragraph
        elements.push(
          <p key={idx} className="text-xs leading-relaxed text-[#B1B7B1] my-1 font-sans">
            {renderInlineText(line)}
          </p>
        );
      }
    });

    if (inCodeBlock) {
      flushCodeBlock(lines.length);
    }

    return elements;
  };

  // Helper to render inline code `...`
  const renderInlineText = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-[#202522] border border-[#343B36] text-[#B9D9BE] px-1 py-0.5 rounded text-[11px] font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Page Header */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#202522] border border-[#414A43] flex items-center justify-center text-[#78A887]">
                <FileText className="w-4 h-4" />
              </div>
              <h1 className="text-base font-semibold text-[#F1F0E9]">
                Structured Documentation Generator
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#263A2D] text-[#B9D9BE] border border-[#537B5D]">
                Grounded AST Synthesis
              </span>
            </div>
            <p className="text-xs text-[#B1B7B1]">
              Synthesize formal developer documentation, component specifications, and API guides grounded in Tree-sitter AST and dependency call-graphs.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#858E86]">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-[#78A887]" />
              <strong className="text-[#F1F0E9]">{files.length}</strong> Files
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-[#D6A85F]" />
              <strong className="text-[#F1F0E9]">{symbols.length}</strong> Symbols
            </span>
          </div>
        </div>

        {/* Configuration Controls Bar */}
        <div className="pt-3 border-t border-[#343B36] grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Scope Segmented Control */}
          <div className="md:col-span-4 space-y-1">
            <label className="block text-[11px] font-mono text-[#858E86] uppercase tracking-wider">
              Documentation Scope
            </label>
            <div className="grid grid-cols-3 gap-1 bg-[#202522] border border-[#414A43] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setScope('project')}
                className={`text-xs py-1.5 rounded font-mono transition text-center ${
                  scope === 'project'
                    ? 'bg-[#263A2D] text-[#B9D9BE] border border-[#537B5D] font-medium'
                    : 'text-[#B1B7B1] hover:text-[#F1F0E9]'
                }`}
              >
                Project
              </button>
              <button
                type="button"
                onClick={() => setScope('file')}
                className={`text-xs py-1.5 rounded font-mono transition text-center ${
                  scope === 'file'
                    ? 'bg-[#263A2D] text-[#B9D9BE] border border-[#537B5D] font-medium'
                    : 'text-[#B1B7B1] hover:text-[#F1F0E9]'
                }`}
              >
                File
              </button>
              <button
                type="button"
                onClick={() => setScope('symbol')}
                className={`text-xs py-1.5 rounded font-mono transition text-center ${
                  scope === 'symbol'
                    ? 'bg-[#263A2D] text-[#B9D9BE] border border-[#537B5D] font-medium'
                    : 'text-[#B1B7B1] hover:text-[#F1F0E9]'
                }`}
              >
                Symbol
              </button>
            </div>
          </div>

          {/* Target Selector */}
          <div className="md:col-span-5 space-y-1">
            <label className="block text-[11px] font-mono text-[#858E86] uppercase tracking-wider">
              {scope === 'project' ? 'Scope Target' : scope === 'file' ? 'Target Source File' : 'Target Code Symbol'}
            </label>
            {scope === 'project' && (
              <div className="h-9 px-3 bg-[#202522] border border-[#414A43] rounded-lg text-xs font-mono text-[#B1B7B1] flex items-center">
                System-wide architecture &amp; module dependencies
              </div>
            )}
            {scope === 'file' && (
              <select
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                className="w-full h-9 bg-[#202522] border border-[#414A43] rounded-lg px-3 text-xs text-[#F1F0E9] font-mono focus:outline-none focus:border-[#78A887]"
              >
                {files.map((f) => (
                  <option key={f.id} value={f.path} className="bg-[#202522] text-[#F1F0E9]">
                    {f.path}
                  </option>
                ))}
              </select>
            )}
            {scope === 'symbol' && (
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full h-9 bg-[#202522] border border-[#414A43] rounded-lg px-3 text-xs text-[#F1F0E9] font-mono focus:outline-none focus:border-[#78A887]"
              >
                {symbols.map((s) => (
                  <option key={s.id} value={s.name} className="bg-[#202522] text-[#F1F0E9]">
                    {s.name} ({s.type}) — {s.filePath}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Action Button */}
          <div className="md:col-span-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-9 bg-[#78A887] hover:bg-[#689877] disabled:opacity-50 text-[#171A19] font-medium px-4 rounded-lg text-xs transition flex items-center justify-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#171A19]/30 border-t-[#171A19] rounded-full animate-spin"></div>
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

      {/* Generated Documentation Workspace */}
      {docResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Table of Contents & Metadata Outline */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-[#262C28] border border-[#414A43] rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-mono text-[#858E86] uppercase tracking-wider pb-2 border-b border-[#343B36]">
                <List className="w-3.5 h-3.5 text-[#78A887]" />
                <span>Table of Contents</span>
              </div>
              {tableOfContents.length > 0 ? (
                <nav className="space-y-1 text-xs">
                  {tableOfContents.map((item, idx) => (
                    <a
                      key={idx}
                      href={`#${item.id}`}
                      className={`block py-1 px-1.5 rounded transition text-[#B1B7B1] hover:text-[#F1F0E9] hover:bg-[#202522] ${
                        item.level === 1 ? 'font-medium' : item.level === 2 ? 'pl-4 text-[11px]' : 'pl-6 text-[10px] text-[#858E86]'
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              ) : (
                <p className="text-[11px] text-[#858E86] italic">No structured sections detected.</p>
              )}
            </div>

            <div className="bg-[#262C28] border border-[#414A43] rounded-xl p-4 space-y-2 text-xs font-mono">
              <div className="text-[11px] uppercase tracking-wider text-[#858E86] pb-1 border-b border-[#343B36]">
                Document Details
              </div>
              <div className="flex justify-between text-[#B1B7B1]">
                <span>Scope:</span>
                <span className="text-[#B9D9BE] font-medium capitalize">{docResult.scope}</span>
              </div>
              <div className="flex justify-between text-[#B1B7B1]">
                <span>Format:</span>
                <span className="text-[#F1F0E9]">CommonMark / AST</span>
              </div>
              <div className="flex justify-between text-[#B1B7B1]">
                <span>Characters:</span>
                <span className="text-[#F1F0E9]">{docResult.markdown.length.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Right Main Document Pane */}
          <div className="lg:col-span-9 bg-[#262C28] border border-[#414A43] rounded-xl overflow-hidden">
            {/* Document Action Toolbar */}
            <div className="px-5 py-3 border-b border-[#343B36] bg-[#202522] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#F1F0E9]">{docResult.title}</h2>
                <div className="text-[11px] text-[#858E86] font-mono">
                  Scope: <span className="text-[#B9D9BE] capitalize">{docResult.scope}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-[#171A19] border border-[#343B36] rounded-lg p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`px-2 py-1 rounded flex items-center space-x-1 transition ${
                      viewMode === 'preview'
                        ? 'bg-[#263A2D] text-[#B9D9BE] font-medium'
                        : 'text-[#858E86] hover:text-[#F1F0E9]'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Formatted</span>
                  </button>
                  <button
                    onClick={() => setViewMode('raw')}
                    className={`px-2 py-1 rounded flex items-center space-x-1 transition ${
                      viewMode === 'raw'
                        ? 'bg-[#263A2D] text-[#B9D9BE] font-medium'
                        : 'text-[#858E86] hover:text-[#F1F0E9]'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Raw MD</span>
                  </button>
                </div>

                <button
                  onClick={handleCopy}
                  className="bg-[#262C28] hover:bg-[#2B322D] text-[#B1B7B1] hover:text-[#F1F0E9] text-xs px-2.5 py-1.5 rounded-lg border border-[#414A43] font-mono flex items-center space-x-1 transition"
                  title="Copy Markdown to Clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#81C995]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="bg-[#262C28] hover:bg-[#2B322D] text-[#B1B7B1] hover:text-[#F1F0E9] text-xs px-2.5 py-1.5 rounded-lg border border-[#414A43] font-mono flex items-center space-x-1 transition"
                  title="Download Markdown File"
                >
                  <Download className="w-3.5 h-3.5 text-[#78A887]" />
                  <span>Export .md</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="bg-[#262C28] hover:bg-[#2B322D] text-[#B1B7B1] hover:text-[#F1F0E9] text-xs px-2.5 py-1.5 rounded-lg border border-[#414A43] font-mono flex items-center space-x-1 transition"
                  title="Print / Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-[#D6A85F]" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Document Content View */}
            <div className="p-6">
              {viewMode === 'preview' ? (
                <div className="prose-dark max-w-none">
                  {renderFormattedMarkdown(docResult.markdown)}
                </div>
              ) : (
                <div className="bg-[#171A19] border border-[#343B36] rounded-lg p-4 text-xs text-[#F1F0E9] font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  {docResult.markdown}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 px-6 text-center bg-[#262C28] border border-[#414A43] rounded-xl space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#202522] border border-[#414A43] mx-auto flex items-center justify-center text-[#858E86]">
            <BookOpen className="w-6 h-6 text-[#78A887]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-semibold text-[#F1F0E9]">Ready to Generate Documentation</h3>
            <p className="text-xs text-[#858E86]">
              Select a scope above (Project, File, or Symbol) and click &ldquo;Generate Documentation&rdquo; to assemble AST symbols and contextual descriptions into a clean technical specification.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-3 text-left">
            <div className="p-3 bg-[#202522] border border-[#343B36] rounded-lg text-xs space-y-1">
              <div className="font-semibold text-[#F1F0E9] flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-[#78A887]" />
                <span>Project Scope</span>
              </div>
              <p className="text-[11px] text-[#858E86]">System architecture overview, module relationships, and overall structure.</p>
            </div>
            <div className="p-3 bg-[#202522] border border-[#343B36] rounded-lg text-xs space-y-1">
              <div className="font-semibold text-[#F1F0E9] flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-[#D6A85F]" />
                <span>File Scope</span>
              </div>
              <p className="text-[11px] text-[#858E86]">Module responsibilities, imported dependencies, exported symbols and logic.</p>
            </div>
            <div className="p-3 bg-[#202522] border border-[#343B36] rounded-lg text-xs space-y-1">
              <div className="font-semibold text-[#F1F0E9] flex items-center gap-1.5">
                <Binary className="w-3.5 h-3.5 text-[#81C995]" />
                <span>Symbol Scope</span>
              </div>
              <p className="text-[11px] text-[#858E86]">Function/Class API contracts, parameter signatures, and return specs.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};