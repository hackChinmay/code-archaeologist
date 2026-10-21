import type {
  Repository,
  RepoFile,
  SymbolItem,
  Dependency,
  SearchResult,
  RAGResponse,
  ArchitectureGraph,
  DocumentationResult,
  EvaluationMetrics,
} from '../types/index.ts';

// Configurable API base URL with environment variable support (Vite convention: VITE_API_BASE_URL).
// Falls back to '/api' for local proxy, with automated failover to direct Render backend if proxy drops.
const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const PRIMARY_BASE = rawBase
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/+$/, '')}/api`)
  : '/api';
const DIRECT_BACKEND = 'https://code-archaeologist-backend.onrender.com/api';

/**
 * Fetch wrapper that automatically fails over to direct Render backend if Vercel proxy experiences network drop.
 */
async function fetchWithFailover(path: string, options?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  try {
    return await fetch(`${PRIMARY_BASE}${cleanPath}`, options);
  } catch (primaryErr: any) {
    const msg = primaryErr.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
      if (!PRIMARY_BASE.includes('code-archaeologist-backend.onrender.com')) {
        try {
          return await fetch(`${DIRECT_BACKEND}${cleanPath}`, options);
        } catch {
          // Both failed, throw original error
        }
      }
    }
    throw primaryErr;
  }
}

/**
 * Robust JSON response handler that extracts backend FastAPI error details (detail/error/message).
 */
async function handleResponse<T>(res: Response, defaultError: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err.detail || err.error || err.message || '';
    } catch {
      // Response wasn't valid JSON
    }
    throw new Error(detail || defaultError);
  }
  return res.json();
}

export const api = {
  async getRepositories(): Promise<Repository[]> {
    const res = await fetchWithFailover('/repositories');
    return handleResponse<Repository[]>(res, 'Failed to fetch repositories');
  },

  async getRepository(id: string): Promise<Repository> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(id)}`);
    return handleResponse<Repository>(res, 'Failed to fetch repository details');
  },

  async getRepositoryStatus(id: string): Promise<{
    id: string;
    status: string;
    progress: number;
    message: string;
    stats: any;
  }> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(id)}/status`);
    return handleResponse(res, 'Failed to fetch repository status');
  },

  async analyzeRepository(params: {
    url?: string;
    sampleId?: string;
    githubToken?: string;
    localFiles?: { path: string; content: string }[];
  }): Promise<Repository> {
    const res = await fetchWithFailover('/repositories/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<Repository>(res, 'Failed to analyze repository');
  },

  async getFiles(repoId: string): Promise<RepoFile[]> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/files`);
    return handleResponse<RepoFile[]>(res, 'Failed to fetch files');
  },

  async getFileDetail(repoId: string, fileId: string): Promise<{ file: RepoFile; symbols: SymbolItem[] }> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/files/${fileId}`);
    const data = await handleResponse<any>(res, 'Failed to fetch file detail');
    return {
      file: data.file || data,
      symbols: data.symbols || (data.file?.symbols ?? []),
    };
  },

  async getSymbols(repoId: string): Promise<SymbolItem[]> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/symbols`);
    return handleResponse<SymbolItem[]>(res, 'Failed to fetch symbols');
  },

  async getDependencies(repoId: string): Promise<Dependency[]> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/dependencies`);
    return handleResponse<Dependency[]>(res, 'Failed to fetch dependencies');
  },

  async getArchitecture(repoId: string): Promise<ArchitectureGraph> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/architecture`);
    return handleResponse<ArchitectureGraph>(res, 'Failed to fetch architecture graph');
  },

  async searchRepository(repoId: string, query: string, topK: number = 5): Promise<SearchResult> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK, top_k: topK }),
    });
    return handleResponse<SearchResult>(res, 'Search failed');
  },

  async askAssistant(repoId: string, question: string): Promise<RAGResponse> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    return handleResponse<RAGResponse>(res, 'RAG assistant query failed');
  },

  async generateDocumentation(
    repoId: string,
    params: { scope: 'project' | 'folder' | 'file' | 'symbol'; targetPath?: string; symbolName?: string },
  ): Promise<DocumentationResult> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/documentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        target_path: params.targetPath,
        symbol_name: params.symbolName,
      }),
    });
    return handleResponse<DocumentationResult>(res, 'Documentation generation failed');
  },

  async getEvaluation(repoId: string): Promise<EvaluationMetrics> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/evaluation`);
    return handleResponse<EvaluationMetrics>(res, 'Failed to fetch evaluation');
  },

  async measureBenchmark(
    repoId: string,
    customQuery: string,
    expectedFile?: string,
  ): Promise<{ query: string; latencyMs: number; hitRank: any; passed: boolean; retrievedChunks: any[] }> {
    const res = await fetchWithFailover(`/repositories/${encodeURIComponent(repoId)}/evaluation/measure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customQuery, expectedFile }),
    });
    return handleResponse(res, 'Benchmark measurement failed');
  },
};
