import React, { useState } from 'react';
import {
  GitPullRequest,
  Sparkles,
  ArrowRight,
  FolderUp,
  Cpu,
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { Repository } from '../../../types/index.ts';

interface LandingViewProps {
  onAnalyze: (params: { url?: string; sampleId?: string; githubToken?: string; localFiles?: any[] }) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onSelectTab: (tab: any) => void;
  repositories: Repository[];
}

export const LandingView: React.FC<LandingViewProps> = ({
  onAnalyze,
  isLoading,
  error,
  onSelectTab,
  repositories,
}) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    onAnalyze({ url: repoUrl.trim(), githubToken: githubToken.trim() || undefined });
  };

  const handleSelectSample = (sampleId: string) => {
    onAnalyze({ sampleId });
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filePromises: Promise<{ path: string; content: string }>[] = [];
    for (let i = 0; i < Math.min(files.length, 25); i++) {
      const file = files[i];
      // Skip node_modules or binary
      if (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.ico')) continue;

      filePromises.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              path: (file as any).webkitRelativePath || file.name,
              content: reader.result as string,
            });
          };
          reader.readAsText(file);
        }),
      );
    }

    Promise.all(filePromises).then((uploaded) => {
      if (uploaded.length > 0) {
        onAnalyze({ localFiles: uploaded });
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI-Powered Code Intelligence Engine</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          RepoMind
        </h1>
        <p className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
          AI-Powered Codebase Understanding and Software Analysis Platform
        </p>
        <p className="max-w-2xl mx-auto text-base text-slate-400 leading-relaxed">
          Understand unfamiliar codebases faster with repository analysis,
          semantic search, RAG-powered answers, architecture visualization,
          and AI-generated documentation.
        </p>
      </div>

      {/* Main Analysis Input Box */}
      <div className="max-w-3xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-mono font-medium text-slate-300">
            ENTER PUBLIC GITHUB REPOSITORY URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="https://github.com/fastapi/fastapi or https://github.com/expressjs/express"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono transition"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !repoUrl.trim()}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-cyan-900/40 shrink-0"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Analyze Repository</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] font-mono text-cyan-400 hover:underline"
            >
              {showAdvanced ? '- Hide GitHub Token option' : '+ Add GitHub Token (optional, for higher rate limits)'}
            </button>
            <span className="text-[11px] text-slate-500 font-mono">
              Parses Python, TypeScript, JavaScript, Java
            </span>
          </div>

          {showAdvanced && (
            <div className="pt-2">
              <input
                type="password"
                placeholder="GitHub Personal Access Token (ghp_...)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-start space-x-2 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <FolderUp className="w-4 h-4 text-cyan-400" />
            <span>Or analyze a local project folder:</span>
          </div>
          <label className="cursor-pointer bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center space-x-2">
            <span>Upload Directory</span>
            <input
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              onChange={handleLocalUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Curated Sample Repositories (1-Click Test) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Curated Benchmark Codebases (1-Click Instant Analysis)</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Pre-indexed with AST &amp; ChromaDB</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sample 1: Python FastAPI */}
          <div
            onClick={() => handleSelectSample('repo-python-fastapi')}
            className="group cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 transition space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/50">
                Python / FastAPI
              </span>
              <span className="text-[11px] font-mono text-slate-500">8 Files &bull; 19 Symbols</span>
            </div>
            <h3 className="font-semibold text-sm text-slate-100 group-hover:text-cyan-300 transition">
              fastapi-jwt-auth-service
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              Production JWT authentication service with SQLAlchemy async sessions, OAuth2 password flow, and bcrypt.
            </p>
            <div className="flex items-center text-xs text-cyan-400 font-mono pt-1">
              <span>Inspect codebase</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Sample 2: TypeScript Core Engine */}
          <div
            onClick={() => handleSelectSample('repo-ts-code-archaeologist')}
            className="group cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 transition space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50">
                TypeScript / AST
              </span>
              <span className="text-[11px] font-mono text-slate-500">6 Files &bull; 18 Symbols</span>
            </div>
            <h3 className="font-semibold text-sm text-slate-100 group-hover:text-cyan-300 transition">
              repomind-core-engine
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              Multi-language AST parser, semantic code chunker, ChromaDB vector storage, and Gemini RAG orchestrator.
            </p>
            <div className="flex items-center text-xs text-cyan-400 font-mono pt-1">
              <span>Inspect codebase</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Sample 3: Java Spring Boot */}
          <div
            onClick={() => handleSelectSample('repo-java-spring-microservice')}
            className="group cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 transition space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50">
                Java / Spring Boot
              </span>
              <span className="text-[11px] font-mono text-slate-500">5 Files &bull; 14 Symbols</span>
            </div>
            <h3 className="font-semibold text-sm text-slate-100 group-hover:text-cyan-300 transition">
              spring-boot-inventory-service
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
              Spring Boot microservice with REST controllers, transactional services, and Spring Data JPA repositories.
            </p>
            <div className="flex items-center text-xs text-cyan-400 font-mono pt-1">
              <span>Inspect codebase</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Overview Diagram (As specified in Section 2) */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Full Analysis &amp; RAG Architecture Pipeline</span>
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic code analysis married with vector retrieval and Google Gemini synthesis.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
            Section 2 Workflow
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
          {[
            { step: '01', title: 'Repository Ingestion', desc: 'Sanitize & filter' },
            { step: '02', title: 'Tree-sitter Parsing', desc: 'AST extraction' },
            { step: '03', title: 'Static Analysis', desc: 'Dependencies & calls' },
            { step: '04', title: 'Code Chunking', desc: 'Logical boundaries' },
            { step: '05', title: 'Embeddings', desc: 'Semantic vectors' },
            { step: '06', title: 'ChromaDB', desc: 'Isolated collections' },
            { step: '07', title: 'LangChain RAG', desc: 'Grounded retrieval' },
            { step: '08', title: 'Gemini 3.8 Flash', desc: 'Synthesized evidence' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center space-y-1.5 hover:border-cyan-500/40 transition"
            >
              <span className="text-[10px] font-mono font-bold text-cyan-400">{item.step}</span>
              <p className="text-[11px] font-semibold text-slate-200">{item.title}</p>
              <p className="text-[9px] text-slate-500 font-mono">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Anti-Hallucination & Academic Scope Disclaimer */}
      <div className="border border-slate-800/80 bg-slate-900/20 rounded-xl p-4 flex items-start space-x-3 text-xs text-slate-400 leading-relaxed font-mono">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-200 font-semibold">Strict Anti-Hallucination Principle: </span>
          RepoMind grounds every LLM answer on retrieved AST code chunks. If evidence is insufficient,
          the system explicitly states so rather than guessing. No claims of &ldquo;100% accuracy&rdquo; are made;
          transparent evidence citations are provided for every claim.
        </div>
      </div>
    </div>
  );
};
