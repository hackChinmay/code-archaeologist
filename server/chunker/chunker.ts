import type { RepoFile, SymbolItem, CodeChunk } from '../../src/types/index.ts';

/**
 * Splits source code files into smaller, meaningful pieces ("chunks")
 * so they can be easily searched and understood by AI.
 * 
 * Step 1: Group code symbols (functions, classes) by their file path.
 * Step 2: Extract the exact lines of each function or class as a chunk.
 * Step 3: For files without functions (like configs or HTML), split them into 40-line blocks.
 */
export function chunkCodebase(
  repositoryId: string,
  files: RepoFile[],
  symbols: SymbolItem[],
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const symbolsByFile = new Map<string, SymbolItem[]>();

  // Organize symbols under each file
  for (const sym of symbols) {
    const list = symbolsByFile.get(sym.filePath) || [];
    list.push(sym);
    symbolsByFile.set(sym.filePath, list);
  }

  // Process every file in the repository
  for (const file of files) {
    const fileSymbols = symbolsByFile.get(file.path) || [];
    const lines = file.content.split('\n');

    // Case A: The file has functions or classes
    if (fileSymbols.length > 0) {
      for (const sym of fileSymbols) {
        const start = Math.max(1, sym.startLine);
        const end = Math.min(lines.length, sym.endLine);
        const chunkLines = lines.slice(start - 1, end);
        const content = chunkLines.join('\n');

        if (content.trim().length > 0) {
          chunks.push({
            id: `chk-${repositoryId}-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}-${sym.name}-${start}`,
            repositoryId,
            filePath: file.path,
            language: file.language,
            symbolType: sym.type,
            symbolName: sym.name,
            startLine: start,
            endLine: end,
            content,
          });
        }
      }
    } else {
      // Case B: Simple text, HTML, or configs — slice into 40-line windows
      const windowSize = 40;
      for (let i = 0; i < lines.length; i += windowSize) {
        const end = Math.min(lines.length, i + windowSize);
        const chunkLines = lines.slice(i, end);
        const content = chunkLines.join('\n');
        
        if (content.trim().length > 0) {
          chunks.push({
            id: `chk-${repositoryId}-${file.path.replace(/[^a-zA-Z0-9]/g, '_')}-block-${i + 1}`,
            repositoryId,
            filePath: file.path,
            language: file.language,
            symbolType: 'module_block',
            symbolName: file.name,
            startLine: i + 1,
            endLine: end,
            content,
          });
        }
      }
    }
  }

  return chunks;
}
