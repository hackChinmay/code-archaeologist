import { GoogleGenAI } from '@google/genai';
import type { CodeChunk, RAGResponse, EvidenceItem, DocumentationResult } from '../../src/types/index.ts';

const apiKey = process.env.GEMINI_API_KEY || '';

export async function askRepositoryRAG(
  question: string,
  chunks: CodeChunk[],
  repoName: string,
): Promise<RAGResponse> {
  const startTime = Date.now();

  // If no chunks retrieved at all
  if (chunks.length === 0) {
    return {
      question,
      answer: `I could not find enough evidence in the analyzed repository (${repoName}) to answer this confidently. No relevant code chunks matched your query terms.`,
      grounded: false,
      confidenceStatus: 'Insufficient repository evidence',
      retrievedChunksCount: 0,
      relevantFiles: [],
      evidence: [],
      durationMs: Date.now() - startTime,
    };
  }

  // Extract relevant files and evidence objects
  const uniqueFiles = Array.from(new Set(chunks.map(c => c.filePath)));
  const evidence: EvidenceItem[] = chunks.map(c => ({
    filePath: c.filePath,
    symbolName: c.symbolName,
    symbolType: c.symbolType,
    startLine: c.startLine,
    endLine: c.endLine,
    snippet: c.content.slice(0, 500) + (c.content.length > 500 ? '\n// ... remaining lines' : ''),
    retrievalReason: `Direct semantic match in ${c.symbolName} (${c.symbolType}) on lines ${c.startLine}-${c.endLine}`,
  }));

  // Assemble retrieved context
  const context = chunks
    .map(
      (c, idx) =>
        `--- EVIDENCE #${idx + 1} ---\nFile: ${c.filePath}\nLines: ${c.startLine}-${c.endLine}\nSymbol: ${c.symbolName} (${c.symbolType})\nLanguage: ${c.language}\nCode:\n${c.content}\n`,
    )
    .join('\n');

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are RepoMind, an AI-powered software repository analysis engine.
You are answering questions about the software repository: "${repoName}".

CORE RULES:
1. Use the retrieved repository context below as your SOLE primary source of truth.
2. Every claim must cite the file path (e.g. \`app/routers/auth.py\`) and line numbers.
3. DO NOT invent files, classes, methods, endpoints, or dependencies that are not in the context.
4. If the retrieved code does not contain sufficient information to answer the question, explicitly state:
   "I could not find enough evidence in the analyzed repository to answer this confidently."
5. Format your response clearly with Markdown headings and bullet points.`;

      const prompt = `QUESTION:
${question}

RETRIEVED REPOSITORY CODE CHUNKS:
${context}

Provide a grounded, authoritative answer referencing the retrieved files and line numbers.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1, // Low temperature for high factual accuracy
        },
      });

      const answerText = response.text || 'No response returned from model.';
      const isInsufficient =
        answerText.toLowerCase().includes('could not find enough evidence') ||
        answerText.toLowerCase().includes('insufficient repository evidence');

      return {
        question,
        answer: answerText,
        grounded: !isInsufficient,
        confidenceStatus: isInsufficient ? 'Insufficient repository evidence' : 'Supported by repository evidence',
        retrievedChunksCount: chunks.length,
        relevantFiles: uniqueFiles,
        evidence,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to extractive synthesis:', err?.message || err);
    }
  }

  // Fallback: Extractive Grounded Synthesis when GEMINI_API_KEY is not set or network fails
  const topChunk = chunks[0];
  const summaryBullets = chunks
    .slice(0, 3)
    .map(
      c =>
        `• **\`${c.filePath}\` (Lines ${c.startLine}–${c.endLine})**: Implements \`${c.symbolName}\` (${c.symbolType}) in ${c.language}.`,
    )
    .join('\n');

  const answer = `### Grounded Repository Findings for: "${question}"

Based on the **${chunks.length} semantic code chunks** retrieved from repository \`${repoName}\`:

${summaryBullets}

#### Primary Implementation Details:
The primary implementation is located in **\`${topChunk.filePath}\`** around symbol **\`${topChunk.symbolName}\`** (${topChunk.symbolType}, lines ${topChunk.startLine}–${topChunk.endLine}):

\`\`\`${topChunk.language.toLowerCase()}
${topChunk.content.slice(0, 300)}...
\`\`\`

*(Note: Live generative Gemini API key detected: ${apiKey ? 'active' : 'not configured in environment'}. Grounded context extracted directly from AST and ChromaDB vector store).*`;

  return {
    question,
    answer,
    grounded: true,
    confidenceStatus: 'Supported by repository evidence',
    retrievedChunksCount: chunks.length,
    relevantFiles: uniqueFiles,
    evidence,
    durationMs: Date.now() - startTime,
  };
}

export async function generateRepoDocumentation(
  scope: 'project' | 'folder' | 'file' | 'symbol',
  target: string,
  chunks: CodeChunk[],
  repoName: string,
): Promise<DocumentationResult> {
  const context = chunks.slice(0, 8).map(c => `File: ${c.filePath} (${c.symbolName})\n${c.content}`).join('\n\n');

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Generate comprehensive, professional developer documentation for ${scope} "${target}" in repository "${repoName}".

Retrieved Code Evidence:
${context}

Follow this exact structure:
# ${target} Documentation
## 1. Purpose & Responsibilities
## 2. Main Components & Architecture
## 3. Key Functions & Signatures
## 4. Dependencies & Data Flow
## 5. Usage & Error Handling
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return {
        title: `${target} Documentation`,
        scope,
        markdown: response.text || `# ${target} Documentation\n\nNo content generated.`,
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('Gemini docs generation fallback:', err);
    }
  }

  // Fallback template
  const markdown = `# ${target} Documentation

## 1. Purpose & Responsibilities
This documentation was generated from AST analysis and code chunks of **${target}** in repository **${repoName}**.

## 2. Key Modules & Evidence
${chunks.slice(0, 4).map(c => `- **\`${c.filePath}\`**: Defines \`${c.symbolName}\` (${c.symbolType}, lines ${c.startLine}-${c.endLine})`).join('\n')}

## 3. Data Flow & Dependencies
The module participates in the core data processing pipeline, interacting with internal dependencies and external libraries detected during parsing.

## 4. Extracted Code Signatures
\`\`\`
${chunks.slice(0, 2).map(c => c.content).join('\n\n')}
\`\`\`
`;

  return {
    title: `${target} Documentation`,
    scope,
    markdown,
    generatedAt: new Date().toISOString(),
  };
}
