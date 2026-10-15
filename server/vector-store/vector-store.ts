import type { CodeChunk, SearchResult } from '../../src/types/index.ts';

/**
 * Stores code chunks as word-frequency vectors (TF-IDF style)
 * to perform fast, semantic similarity searches without needing external databases.
 */
export interface VectorEntry {
  chunk: CodeChunk;
  tokens: Map<string, number>;
  magnitude: number;
}

export class MemoryChromaStore {
  // Key: Repository ID, Value: List of vector entries
  private collections = new Map<string, VectorEntry[]>();

  /**
   * Indexes all code chunks for a given repository.
   * Calculates word frequencies and vector lengths for cosine math.
   */
  public indexRepository(repositoryId: string, chunks: CodeChunk[]): void {
    const entries: VectorEntry[] = [];

    for (const chunk of chunks) {
      // Combine file path, function name, type, and source code
      const textToEmbed = `${chunk.filePath} ${chunk.symbolName} ${chunk.symbolType} ${chunk.language} ${chunk.content}`.toLowerCase();
      const rawTokens = textToEmbed.split(/[^a-z0-9_]+/).filter(t => t.length > 1);
      
      // Count frequency of each word
      const freqMap = new Map<string, number>();
      for (const t of rawTokens) {
        freqMap.set(t, (freqMap.get(t) || 0) + 1);
      }

      // Calculate vector length (magnitude) for cosine similarity
      let sumSq = 0;
      for (const count of freqMap.values()) {
        sumSq += count * count;
      }
      const magnitude = Math.sqrt(sumSq) || 1;

      entries.push({
        chunk,
        tokens: freqMap,
        magnitude,
      });
    }

    this.collections.set(repositoryId, entries);
  }

  public similaritySearch(
    repositoryId: string,
    query: string,
    topK: number = 5,
  ): SearchResult {
    const entries = this.collections.get(repositoryId) || [];
    if (entries.length === 0) {
      return { query, totalResults: 0, results: [] };
    }

    const STOPWORDS = new Set([
      'how', 'does', 'what', 'where', 'which', 'who', 'why', 'when',
      'the', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
      'a', 'an', 'with', 'by', 'from', 'this', 'that', 'it', 'or', 'be',
    ]);

    const queryTokens = query
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t));

    // Fallback if all tokens were stopwords
    const activeTokens = queryTokens.length > 0 ? queryTokens : query.toLowerCase().split(/[^a-z0-9_]+/).filter(t => t.length > 1);

    const queryFreq = new Map<string, number>();
    for (const t of activeTokens) {
      queryFreq.set(t, (queryFreq.get(t) || 0) + 1);
    }

    let qSumSq = 0;
    for (const count of queryFreq.values()) {
      qSumSq += count * count;
    }
    const qMagnitude = Math.sqrt(qSumSq) || 1;

    const scored: { chunk: CodeChunk; score: number; explanation: string }[] = [];

    for (const entry of entries) {
      let dotProduct = 0;
      const matchedTerms: string[] = [];

      for (const [token, qCount] of queryFreq.entries()) {
        let termMatchScore = 0;

        // Exact token match
        if (entry.tokens.has(token)) {
          termMatchScore = entry.tokens.get(token)!;
          matchedTerms.push(token);
        } else {
          // Substring / stem match for words >= 4 chars (e.g. auth/authenticate, pass/password, token/tokens)
          for (const [docToken, docCount] of entry.tokens.entries()) {
            if (
              (token.length >= 4 && docToken.startsWith(token.slice(0, 4))) ||
              (docToken.length >= 4 && token.startsWith(docToken.slice(0, 4))) ||
              (token.length >= 4 && docToken.includes(token)) ||
              (docToken.length >= 4 && token.includes(docToken))
            ) {
              termMatchScore = Math.max(termMatchScore, docCount * 0.85);
              matchedTerms.push(`${docToken}~`);
              break;
            }
          }
        }

        if (termMatchScore > 0) {
          // Boost matches in symbol name or file path
          let weight = 1.0;
          if (entry.chunk.symbolName.toLowerCase().includes(token) || token.includes(entry.chunk.symbolName.toLowerCase())) {
            weight += 2.5;
          }
          if (entry.chunk.filePath.toLowerCase().includes(token) || token.includes(entry.chunk.filePath.toLowerCase())) {
            weight += 2.0;
          }

          dotProduct += qCount * termMatchScore * weight;
        }
      }

      if (dotProduct > 0) {
        const cosineSim = dotProduct / (qMagnitude * entry.magnitude);
        const normalizedScore = Math.min(0.99, parseFloat(cosineSim.toFixed(3)));

        scored.push({
          chunk: { ...entry.chunk, similarity: normalizedScore },
          score: normalizedScore,
          explanation: `Matched semantic terms: [${matchedTerms.slice(0, 4).join(', ')}] in ${entry.chunk.symbolName} (${entry.chunk.filePath})`,
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, topK);

    return {
      query,
      totalResults: scored.length,
      results,
    };
  }

  public getChunksCount(repositoryId: string): number {
    return (this.collections.get(repositoryId) || []).length;
  }
}

export const globalChromaStore = new MemoryChromaStore();
