import React, { useState } from 'react';
import {
  ArrowRight,
  FolderUp,
  Cpu,
  KeyRound,
  ExternalLink,
  Lock,
  AlertCircle,
  ShieldCheck,
  Code2,
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

  React.useEffect(() => {
    if (
      error &&
      (error.toLowerCase().includes('private') ||
        error.toLowerCase().includes('404') ||
        error.toLowerCase().includes('access denied'))
    ) {
      setShowAdvanced(true);
    }
  }, [error]);

  const isPrivateRepo =
    Boolean(error) &&
    (error!.toLowerCase().includes('private') ||
      error!.toLowerCase().includes('404') ||
      error!.toLowerCase().includes('access denied'));

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
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Product Introduction */}
      <div className="space-y-2 border-b border-[#343B36] pb-6">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-[#78A887] font-medium uppercase tracking-wider bg-[#263A2D] px-2 py-0.5 rounded border border-[#537B5D]">
            Static Analysis &amp; Vector Index
          </span>
          <span className="text-xs text-[#858E86] font-mono">BITE308L Platform</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F0E9]">
          RepoMind Codebase Ingestion
        </h1>
        <p className="text-sm text-[#B1B7B1] max-w-3xl leading-relaxed">
          Analyze and index GitHub repositories or local directories with Tree-sitter AST parsing, dependency graph derivation, isolated ChromaDB vector indexing, and grounded Gemini RAG.
        </p>
      </div>

      {/* Main Ingestion Form Panel */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 sm:p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-[#B1B7B1] mb-2 uppercase tracking-wide">
              Repository URL (GitHub)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                placeholder="https://github.com/fastapi/fastapi or https://github.com/expressjs/express"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded-md px-3.5 py-2.5 text-xs text-[#F1F0E9] placeholder-[#858E86] font-mono focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={isLoading || !repoUrl.trim()}
                className="bg-[#78A887] hover:bg-[#8AB898] disabled:opacity-50 text-[#171A19] font-medium px-5 py-2.5 rounded-md text-xs font-mono transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#171A19]/30 border-t-[#171A19] rounded-full animate-spin"></div>
                    <span>Analyzing Codebase...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Repository</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[#78A887] hover:underline cursor-pointer"
            >
              {showAdvanced ? '− Hide GitHub Token option' : '+ Configure GitHub Token (Optional for private repos)'}
            </button>
            <span className="text-[#858E86]">
              Supported: Python, TypeScript, JavaScript, Java
            </span>
          </div>

          {showAdvanced && (
            <div className="p-3.5 bg-[#202522] border border-[#343B36] rounded-md space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="flex items-center space-x-1.5 text-[#B1B7B1] font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-[#78A887]" />
                  <span>GitHub Personal Access Token</span>
                </span>
                <span className="text-[#D6A85F]">Required for private repositories or rate limits</span>
              </div>
              <input
                type="password"
                placeholder="Paste token (ghp_... or github_pat_...)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded-md px-3 py-1.5 text-xs text-[#F1F0E9] placeholder-[#858E86] font-mono focus:outline-none"
              />
            </div>
          )}
        </form>

        {error && (
          isPrivateRepo ? (
            <div className="p-3.5 bg-[#202522] border border-[#E6B566] rounded-md text-[#E6B566] text-xs space-y-2 font-mono">
              <div className="flex items-center space-x-2 font-semibold">
                <Lock className="w-4 h-4 shrink-0 text-[#E6B566]" />
                <span>Private Repository or Authorization Required</span>
              </div>
              <p className="text-[#B1B7B1] leading-relaxed font-sans text-xs">
                {error}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=RepoMind-Code-Archaeologist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2B322D] hover:bg-[#343B36] text-[#E6B566] border border-[#E6B566]/50 transition text-xs font-mono"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Generate Token on GitHub</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#202522] border border-[#E58C83] rounded-md text-[#E58C83] text-xs flex items-start space-x-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )
        )}

        <div className="pt-4 border-t border-[#343B36] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-[#858E86]">
            <FolderUp className="w-4 h-4 text-[#78A887]" />
            <span>Or analyze a local repository folder:</span>
          </div>
          <label className="cursor-pointer bg-[#2B322D] hover:bg-[#343B36] text-[#F1F0E9] border border-[#414A43] px-3 py-1.5 rounded-md text-xs font-mono transition flex items-center space-x-2">
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

      {/* Curated Benchmark Codebases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#F1F0E9] flex items-center space-x-2">
            <span>Curated Benchmark Repositories</span>
          </h2>
          <span className="text-[11px] text-[#858E86] font-mono">Pre-indexed with AST &amp; ChromaDB</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Sample 1: Python FastAPI */}
          <div
            onClick={() => handleSelectSample('repo-python-fastapi')}
            className="group cursor-pointer bg-[#262C28] hover:bg-[#2B322D] border border-[#414A43] hover:border-[#537B5D] rounded-lg p-4 transition space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-[#91B8D2] px-2 py-0.5 rounded bg-[#202522] border border-[#343B36]">
                Python
              </span>
              <span className="text-[10px] font-mono text-[#858E86]">8 Files · 19 Symbols</span>
            </div>
            <h3 className="font-semibold text-xs text-[#F1F0E9] group-hover:text-[#B9D9BE] transition font-mono">
              fastapi-jwt-auth-service
            </h3>
            <p className="text-xs text-[#B1B7B1] leading-relaxed line-clamp-2">
              FastAPI authentication microservice with async SQLAlchemy sessions, OAuth2 scopes, and bcrypt hashing.
            </p>
            <div className="flex items-center text-xs text-[#78A887] font-mono pt-1">
              <span>Load repository</span>
              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Sample 2: TypeScript Core Engine */}
          <div
            onClick={() => handleSelectSample('repo-ts-code-archaeologist')}
            className="group cursor-pointer bg-[#262C28] hover:bg-[#2B322D] border border-[#414A43] hover:border-[#537B5D] rounded-lg p-4 transition space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-[#78A887] px-2 py-0.5 rounded bg-[#263A2D] border border-[#537B5D]">
                TypeScript
              </span>
              <span className="text-[10px] font-mono text-[#858E86]">6 Files · 18 Symbols</span>
            </div>
            <h3 className="font-semibold text-xs text-[#F1F0E9] group-hover:text-[#B9D9BE] transition font-mono">
              repomind-core-engine
            </h3>
            <p className="text-xs text-[#B1B7B1] leading-relaxed line-clamp-2">
              Multi-language Tree-sitter parser, semantic code chunker, ChromaDB vector store, and Gemini RAG orchestrator.
            </p>
            <div className="flex items-center text-xs text-[#78A887] font-mono pt-1">
              <span>Load repository</span>
              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Sample 3: Java Spring Boot */}
          <div
            onClick={() => handleSelectSample('repo-java-spring-microservice')}
            className="group cursor-pointer bg-[#262C28] hover:bg-[#2B322D] border border-[#414A43] hover:border-[#537B5D] rounded-lg p-4 transition space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-[#D6A85F] px-2 py-0.5 rounded bg-[#202522] border border-[#343B36]">
                Java
              </span>
              <span className="text-[10px] font-mono text-[#858E86]">5 Files · 14 Symbols</span>
            </div>
            <h3 className="font-semibold text-xs text-[#F1F0E9] group-hover:text-[#B9D9BE] transition font-mono">
              spring-boot-inventory-service
            </h3>
            <p className="text-xs text-[#B1B7B1] leading-relaxed line-clamp-2">
              Enterprise Spring Boot REST API for inventory management with JPA repositories and JWT security filters.
            </p>
            <div className="flex items-center text-xs text-[#78A887] font-mono pt-1">
              <span>Load repository</span>
              <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Pipeline Steps */}
      <div className="border border-[#343B36] bg-[#202522] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[#F1F0E9] flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-[#78A887]" />
              <span>Static Analysis &amp; RAG Architecture Pipeline</span>
            </h2>
            <p className="text-xs text-[#858E86]">
              End-to-end execution flow from raw source code to verified citations.
            </p>
          </div>
          <span className="text-[10px] font-mono text-[#81C995] bg-[#263A2D] border border-[#537B5D] px-2 py-0.5 rounded hidden sm:inline">
            Deterministic Pipeline
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
          {[
            { step: '01', title: 'Ingestion', desc: 'Sanitize & filter' },
            { step: '02', title: 'Tree-sitter', desc: 'AST parsing' },
            { step: '03', title: 'Static Graph', desc: 'Call & imports' },
            { step: '04', title: 'Chunking', desc: 'AST boundaries' },
            { step: '05', title: 'Embeddings', desc: 'Dense vectors' },
            { step: '06', title: 'ChromaDB', desc: 'Vector store' },
            { step: '07', title: 'Context RAG', desc: 'Retrieved chunks' },
            { step: '08', title: 'Gemini RAG', desc: 'Citations' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-[#262C28] border border-[#343B36] rounded-md p-2.5 flex flex-col items-center justify-center space-y-1"
            >
              <span className="text-[10px] font-mono font-medium text-[#78A887]">{item.step}</span>
              <p className="text-[11px] font-medium text-[#F1F0E9] truncate w-full">{item.title}</p>
              <p className="text-[9px] text-[#858E86] font-mono truncate w-full">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Notice */}
      <div className="border border-[#343B36] bg-[#262C28] rounded-md p-3.5 flex items-start space-x-3 text-xs text-[#B1B7B1] leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-[#81C995] shrink-0 mt-0.5" />
        <div>
          <span className="text-[#F1F0E9] font-medium">Verifiable Citation Principle: </span>
          RepoMind grounds every answer strictly on AST code chunks retrieved from the vector index. When repository context is insufficient, the system explicitly acknowledges missing evidence rather than guessing.
        </div>
      </div>
    </div>
  );
};
