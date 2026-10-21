import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { LandingView } from './components/views/ingestion/LandingView.tsx';
import { AnalysisPipelineView } from './components/views/ingestion/AnalysisPipelineView.tsx';
import { OverviewView } from './components/views/exploration/OverviewView.tsx';
import { FileExplorerView } from './components/views/exploration/FileExplorerView.tsx';
import { CodeAnalysisView } from './components/views/exploration/CodeAnalysisView.tsx';
import { ArchitectureView } from './components/views/exploration/ArchitectureView.tsx';
import { DependencyView } from './components/views/exploration/DependencyView.tsx';
import { SemanticSearchView } from './components/views/intelligence/SemanticSearchView.tsx';
import { AssistantView } from './components/views/intelligence/AssistantView.tsx';
import { DocumentationView } from './components/views/intelligence/DocumentationView.tsx';
import { EvaluationView } from './components/views/evaluation/EvaluationView.tsx';

import type { Repository, RepoFile, SymbolItem, Dependency, ArchitectureGraph } from './types/index.ts';
import { api } from './services/api.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [currentRepo, setCurrentRepo] = useState<Repository | null>(null);

  const [files, setFiles] = useState<RepoFile[]>([]);
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [architecture, setArchitecture] = useState<ArchitectureGraph>({ nodes: [], edges: [] });

  const [selectedFile, setSelectedFile] = useState<RepoFile | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | undefined>(undefined);
  const [initialQuestion, setInitialQuestion] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial repositories on mount
  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      const repos = await api.getRepositories();
      setRepositories(repos);
      if (repos.length > 0 && !currentRepo) {
        selectRepository(repos[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load repositories:', err);
    }
  };

  const selectRepository = async (repoId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const repo = await api.getRepository(repoId);
      setCurrentRepo(repo);

      const [repoFiles, repoSymbols, repoDeps, repoArch] = await Promise.all([
        api.getFiles(repoId),
        api.getSymbols(repoId),
        api.getDependencies(repoId),
        api.getArchitecture(repoId),
      ]);

      setFiles(repoFiles);
      setSymbols(repoSymbols);
      setDependencies(repoDeps);
      setArchitecture(repoArch);

      if (repoFiles.length > 0) {
        setSelectedFile(repoFiles[0]);
      }
    } catch (err: any) {
      console.error('Error selecting repository:', err);
      setError(err.message || 'Failed to load repository data');
    } finally {
      setIsLoading(false);
    }
  };

  // Ingestion handler
  const handleAnalyze = async (params: {
    url?: string;
    sampleId?: string;
    githubToken?: string;
    localFiles?: any[];
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const newRepo = await api.analyzeRepository(params);
      await loadRepositories();
      await selectRepository(newRepo.id);
      setActiveTab('pipeline');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        setError(
          'Unable to reach backend service (Failed to fetch). On Render Free Tier, the backend spins down after inactivity and requires ~50 seconds to wake up. Please wait 30 seconds and click Analyze again.'
        );
      } else {
        setError(msg || 'Analysis failed. Please check repository URL or rate limits.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation handlers
  const handleNavigateToFileLine = (filePath: string, line: number) => {
    const file = files.find((f) => f.path === filePath);
    if (file) {
      setSelectedFile(file);
      setHighlightedLine(line);
      setActiveTab('files');
      // Scroll to line
      setTimeout(() => {
        const el = document.getElementById(`L${line}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  };

  const handleAskAIAboutFile = (filePath: string) => {
    setInitialQuestion(`Explain the purpose, key functions, and dependencies in file ${filePath}`);
    setActiveTab('assistant');
  };

  const handleAskAI = (question: string) => {
    setInitialQuestion(question);
    setActiveTab('assistant');
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Navbar
        currentRepo={currentRepo}
        repositories={repositories}
        onSelectRepo={selectRepository}
        onOpenSearch={() => setActiveTab('search')}
        onNewAnalysis={() => setActiveTab('landing')}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          repoLoaded={!!currentRepo}
          repoStatus={currentRepo?.status}
        />

        {/* Dynamic Main Workspace Screen */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'landing' && (
            <LandingView
              onAnalyze={handleAnalyze}
              isLoading={isLoading}
              error={error}
              onSelectTab={setActiveTab}
              repositories={repositories}
            />
          )}

          {activeTab === 'pipeline' && currentRepo && (
            <AnalysisPipelineView
              repo={currentRepo}
              onExploreCode={() => setActiveTab('files')}
              onAskAI={() => setActiveTab('assistant')}
            />
          )}

          {activeTab === 'overview' && currentRepo && (
            <OverviewView
              repo={currentRepo}
              files={files}
              onNavigate={setActiveTab}
              onSelectFile={(f) => {
                setSelectedFile(f);
                setActiveTab('files');
              }}
            />
          )}

          {activeTab === 'files' && (
            <FileExplorerView
              files={files}
              symbols={symbols}
              selectedFile={selectedFile}
              onSelectFile={(f) => {
                setSelectedFile(f);
                setHighlightedLine(undefined);
              }}
              onAskAIAboutFile={handleAskAIAboutFile}
              highlightedLine={highlightedLine}
            />
          )}

          {activeTab === 'analysis' && (
            <CodeAnalysisView
              symbols={symbols}
              files={files}
              onSelectFileSymbol={(f, line) => {
                handleNavigateToFileLine(f.path, line);
              }}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitectureView
              architecture={architecture}
              files={files}
              symbols={symbols}
              currentRepo={currentRepo}
              onSelectFile={(f) => {
                setSelectedFile(f);
                setActiveTab('files');
              }}
              onInspectAST={() => setActiveTab('analysis')}
              onAskAI={handleAskAI}
            />
          )}

          {activeTab === 'search' && currentRepo && (
            <SemanticSearchView
              repoId={currentRepo.id}
              files={files}
              onSelectFileChunk={handleNavigateToFileLine}
              onAskAI={handleAskAI}
            />
          )}

          {activeTab === 'assistant' && currentRepo && (
            <AssistantView
              repoId={currentRepo.id}
              files={files}
              onNavigateToFileLine={handleNavigateToFileLine}
              initialQuestion={initialQuestion}
            />
          )}

          {activeTab === 'documentation' && currentRepo && (
            <DocumentationView
              repoId={currentRepo.id}
              files={files}
              symbols={symbols}
            />
          )}

          {activeTab === 'dependencies' && (
            <DependencyView dependencies={dependencies} />
          )}

          {activeTab === 'evaluation' && currentRepo && (
            <EvaluationView repoId={currentRepo.id} />
          )}
        </main>
      </div>
    </div>
  );
}
