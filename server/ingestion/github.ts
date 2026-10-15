import type { RepoFile } from '../../src/types/index.ts';
import { detectLanguage } from '../analysis/analyzer.ts';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.github',
  'build',
  'dist',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  'coverage',
  '.next',
  '.turbo',
  'target',
]);

const ALLOWED_EXTENSIONS = new Set([
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'java',
  'go',
  'rs',
  'cpp',
  'c',
  'h',
  'html',
  'css',
  'csv',
  'txt',
  'sh',
  'toml',
  'json',
  'md',
  'xml',
  'sql',
  'yaml',
  'yml',
]);

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const clean = url.trim().replace(/\/$/, '');
  const match = clean.match(/(?:https?:\/\/github\.com\/|git@github\.com:)?([^/]+)\/([^/]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

export async function fetchGitHubRepository(
  url: string,
  githubToken?: string,
): Promise<{ info: GitHubRepoInfo; files: RepoFile[] }> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error('Invalid GitHub repository URL. Expected format: https://github.com/owner/repository');
  }

  const { owner, repo } = parsed;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'RepoMind-AnalysisEngine/1.0',
  };

  const token = githubToken || process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  // 1. Fetch Repository Details
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found. Please verify the URL or ensure the repository is public.`);
    }
    if (repoRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded or access forbidden. Please supply a GITHUB_TOKEN or try an example repository.');
    }
    throw new Error(`GitHub API error: ${repoRes.status} ${repoRes.statusText}`);
  }

  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch || 'main';

  // 2. Fetch Git Tree recursively
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    throw new Error(`Failed to fetch file tree for repository "${owner}/${repo}": ${treeRes.statusText}`);
  }

  const treeData = await treeRes.json();
  const treeItems: any[] = treeData.tree || [];

  // Filter out ignored dirs, non-blobs, and non-source files
  const candidateItems = treeItems.filter(item => {
    if (item.type !== 'blob') return false;
    const parts = item.path.split('/');
    if (parts.some((p: string) => IGNORED_DIRS.has(p))) return false;
    const ext = item.path.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return false;
    // Don't ingest files larger than 100KB to stay within limits
    if (item.size && item.size > 100 * 1024) return false;
    return true;
  });

  // Limit to first 25 files for fast analysis
  const selectedItems = candidateItems.slice(0, 25);
  const repoId = `repo-${owner}-${repo}`.toLowerCase();

  const filePromises = selectedItems.map(async (item, i) => {
    try {
      let content = '';
      
      // Try raw CDN with clean headers first
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`;
      const rawHeaders: Record<string, string> = { 'User-Agent': 'RepoMind-AnalysisEngine/1.0' };
      if (token) rawHeaders['Authorization'] = `token ${token}`;

      const fileRes = await fetch(rawUrl, { headers: rawHeaders, signal: AbortSignal.timeout(6000) }).catch(() => null);
      if (fileRes && fileRes.ok) {
        content = await fileRes.text();
      } else if (item.sha) {
        // Fallback to GitHub REST API blob endpoint
        const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
        const blobRes = await fetch(blobUrl, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
        if (blobRes && blobRes.ok) {
          const blobData = await blobRes.json();
          if (blobData.encoding === 'base64' && blobData.content) {
            content = Buffer.from(blobData.content, 'base64').toString('utf-8');
          }
        }
      }

      if (!content && content !== '') return null;

      const lang = detectLanguage(item.path);
      const lines = content.split('\n');

      return {
        id: `f-${repoId}-${i + 1}`,
        repositoryId: repoId,
        path: item.path,
        name: item.path.split('/').pop() || item.path,
        language: lang,
        size: item.size || content.length,
        linesCount: lines.length,
        content,
        symbolsCount: 0,
        imports: [],
        classes: [],
        functions: [],
      } as RepoFile;
    } catch (e) {
      console.warn(`Could not fetch content for ${item.path}:`, e);
      return null;
    }
  });

  const resolved = await Promise.all(filePromises);
  const files = resolved.filter((f): f is RepoFile => f !== null);

  return {
    info: {
      owner,
      repo,
      defaultBranch,
      description: repoData.description || 'Public GitHub repository analyzed by RepoMind.',
    },
    files,
  };
}
