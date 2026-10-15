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

const API_BASE = '/api';

export const api = {
  async getRepositories(): Promise<Repository[]> {
    const res = await fetch(`${API_BASE}/repositories`);
    if (!res.ok) throw new Error('Failed to fetch repositories');
    return res.json();
  },

  async getRepository(id: string): Promise<Repository> {
    const res = await fetch(`${API_BASE}/repositories/${id}`);
    if (!res.ok) throw new Error('Failed to fetch repository details');
    return res.json();
  },

  async getRepositoryStatus(id: string): Promise<{
    id: string;
    status: string;
    progress: number;
    message: string;
    stats: any;
  }> {
    const res = await fetch(`${API_BASE}/repositories/${id}/status`);
    if (!res.ok) throw new Error('Failed to fetch repository status');
    return res.json();
  },

  async analyzeRepository(params: {
    url?: string;
    sampleId?: string;
    githubToken?: string;
    localFiles?: { path: string; content: string }[];
  }): Promise<Repository> {
    const res = await fetch(`${API_BASE}/repositories/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
      throw new Error(err.error || 'Failed to analyze repository');
    }
    return res.json();
  },

  async getFiles(repoId: string): Promise<RepoFile[]> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/files`);
    if (!res.ok) throw new Error('Failed to fetch files');
    return res.json();
  },

  async getFileDetail(repoId: string, fileId: string): Promise<{ file: RepoFile; symbols: SymbolItem[] }> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/files/${fileId}`);
    if (!res.ok) throw new Error('Failed to fetch file detail');
    return res.json();
  },

  async getSymbols(repoId: string): Promise<SymbolItem[]> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/symbols`);
    if (!res.ok) throw new Error('Failed to fetch symbols');
    return res.json();
  },

  async getDependencies(repoId: string): Promise<Dependency[]> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/dependencies`);
    if (!res.ok) throw new Error('Failed to fetch dependencies');
    return res.json();
  },

  async getArchitecture(repoId: string): Promise<ArchitectureGraph> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/architecture`);
    if (!res.ok) throw new Error('Failed to fetch architecture graph');
    return res.json();
  },

  async searchRepository(repoId: string, query: string, topK: number = 5): Promise<SearchResult> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK }),
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async askAssistant(repoId: string, question: string): Promise<RAGResponse> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error('RAG assistant query failed');
    return res.json();
  },

  async generateDocumentation(
    repoId: string,
    params: { scope: 'project' | 'folder' | 'file' | 'symbol'; targetPath?: string; symbolName?: string },
  ): Promise<DocumentationResult> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/documentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Documentation generation failed');
    return res.json();
  },

  async getEvaluation(repoId: string): Promise<EvaluationMetrics> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/evaluation`);
    if (!res.ok) throw new Error('Failed to fetch evaluation');
    return res.json();
  },

  async measureBenchmark(
    repoId: string,
    customQuery: string,
    expectedFile?: string,
  ): Promise<{ query: string; latencyMs: number; hitRank: any; passed: boolean; retrievedChunks: any[] }> {
    const res = await fetch(`${API_BASE}/repositories/${repoId}/evaluation/measure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customQuery, expectedFile }),
    });
    if (!res.ok) throw new Error('Benchmark measurement failed');
    return res.json();
  },
};
