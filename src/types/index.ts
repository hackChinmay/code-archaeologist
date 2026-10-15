export type AnalysisStatus =
  | 'QUEUED'
  | 'CLONING'
  | 'SCANNING'
  | 'PARSING'
  | 'ANALYZING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'COMPLETED'
  | 'FAILED';

export const SUPPORTED_LANGUAGES = ['Python', 'TypeScript', 'JavaScript', 'Java'] as const;
export const PIPELINE_STAGES = [
  'QUEUED',
  'CLONING',
  'SCANNING',
  'PARSING',
  'ANALYZING',
  'CHUNKING',
  'EMBEDDING',
  'INDEXING',
  'COMPLETED',
  'FAILED',
] as const;

export interface LanguageStat {
  name: string;
  percentage: number;
  filesCount: number;
  color: string;
}

export interface RepositoryStats {
  filesCount: number;
  dirsCount: number;
  classesCount: number;
  functionsCount: number;
  dependenciesCount: number;
  linesOfCode: number;
  chunksCount: number;
  languages: LanguageStat[];
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
  defaultBranch: string;
  description: string;
  status: AnalysisStatus;
  progress: number;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  stats: RepositoryStats;
  summary: string;
  architectureSummary: string;
}

export interface RepoFile {
  id: string;
  repositoryId: string;
  path: string;
  name: string;
  language: string;
  size: number;
  linesCount: number;
  content: string;
  symbolsCount: number;
  imports: string[];
  classes: string[];
  functions: string[];
}

export interface SymbolItem {
  id: string;
  fileId: string;
  filePath: string;
  name: string;
  type: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'import';
  startLine: number;
  endLine: number;
  signature?: string;
  docstring?: string;
  parentSymbol?: string;
  calls?: string[];
  inherits?: string[];
  detectedFrom: 'Tree-sitter AST' | 'Static Analyzer';
}

export interface Dependency {
  id: string;
  source: string;
  target: string;
  relationshipType: 'imports' | 'calls' | 'inherits' | 'depends_on';
  category: 'internal' | 'external';
  sourceLine?: number;
}

export interface CodeChunk {
  id: string;
  repositoryId: string;
  filePath: string;
  language: string;
  symbolType: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  content: string;
  similarity?: number;
}

export interface SearchResult {
  query: string;
  totalResults: number;
  results: {
    chunk: CodeChunk;
    score: number;
    explanation: string;
  }[];
}

export interface EvidenceItem {
  filePath: string;
  symbolName: string;
  symbolType: string;
  startLine: number;
  endLine: number;
  snippet: string;
  retrievalReason: string;
}

export interface RAGResponse {
  question: string;
  answer: string;
  grounded: boolean;
  confidenceStatus: 'Supported by repository evidence' | 'Insufficient repository evidence';
  retrievedChunksCount: number;
  relevantFiles: string[];
  evidence: EvidenceItem[];
  durationMs: number;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'repository' | 'directory' | 'module' | 'file' | 'class' | 'function' | 'external';
  path?: string;
  directory?: string;
  parent?: string;
  language?: string;
  degree?: number;
  inDegree?: number;
  outDegree?: number;
  symbolCount?: number;
  linesCount?: number;
  details?: {
    signature?: string;
    methodsCount?: number;
    docstring?: string;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'imports' | 'calls' | 'inherits' | 'depends_on' | 'contains';
}

export interface ArchitectureSummaryStats {
  totalNodes: number;
  totalEdges: number;
  filesCount: number;
  modulesCount: number;
  classesCount: number;
  functionsCount: number;
  externalDepsCount: number;
  mainEntryPoint: string | null;
  mostConnectedModule: string | null;
  primaryLanguage: string;
  aiSummary: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary?: ArchitectureSummaryStats;
}

export interface DocumentationResult {
  title: string;
  scope: string;
  markdown: string;
  generatedAt: string;
}

export interface BenchmarkQuery {
  id: string;
  query: string;
  expectedFiles: string[];
  retrievedFiles: string[];
  hitRank: number;
  passed: boolean;
}

export interface EvaluationMetrics {
  retrieval: {
    precisionAt1: number;
    precisionAt3: number;
    precisionAt5: number;
    recallAt5: number;
    mrr: number;
  };
  answerQuality: {
    faithfulnessScore: number;
    correctnessScore: number;
    completenessScore: number;
  };
  system: {
    avgRetrievalLatencyMs: number;
    indexingTimeSec: number;
    totalFilesProcessed: number;
    totalChunksIndexed: number;
  };
  usability: {
    taskCompletionRate: number;
    avgComprehensionTimeSec: number;
  };
  benchmarkQueries: BenchmarkQuery[];
}
