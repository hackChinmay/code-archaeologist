import React, { useState } from 'react';
import {
  MessageSquareCode,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Clock,
  ExternalLink,
  Bot,
  User,
  Layers,
} from 'lucide-react';
import type { RAGResponse, EvidenceItem, RepoFile } from '../../../types/index.ts';
import { api } from '../../../services/api.ts';

interface AssistantViewProps {
  repoId: string;
  files: RepoFile[];
  onNavigateToFileLine: (filePath: string, line: number) => void;
  initialQuestion?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ragResponse?: RAGResponse;
  timestamp: string;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  repoId,
  files,
  onNavigateToFileLine,
  initialQuestion,
}) => {
  const [question, setQuestion] = useState(initialQuestion || '');
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your RepoMind assistant. I answer questions strictly based on the analyzed code chunks from this repository. Every answer includes verifiable, clickable evidence links to the exact files and lines of code.',
      timestamp: 'Now',
    },
  ]);

  const presetQuestions = [
    'Explain the overall architecture and data flow.',
    'How does authentication and token generation work?',
    'What happens when a user attempts to log in?',
    'Which files are responsible for database connections and sessions?',
    'Where is the main application entry point and router configuration?',
  ];

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsAsking(true);

    try {
      const ragRes = await api.askAssistant(repoId, queryText);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: ragRes.answer,
        ragResponse: ragRes,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error communicating with RAG assistant: ${err.message || 'Failed to retrieve response'}. Please verify repository indexing and environment configuration.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAsk(question);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <MessageSquareCode className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white font-mono">
              AI Codebase Assistant &amp; Grounded RAG
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>ChromaDB Vector Retrieval + Gemini 3.8 Flash</span>
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 font-mono">
          Strict evidence-backed answers: claims cite real file paths and AST line numbers from the repository.
        </p>
      </div>

      {/* Preset Suggestions */}
      <div className="flex flex-wrap gap-2">
        {presetQuestions.map((pq, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleAsk(pq)}
            disabled={isAsking}
            className="text-xs text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition font-mono"
          >
            {pq}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-5 rounded-2xl border transition-all ${
              msg.role === 'user'
                ? 'bg-slate-900/90 border-slate-700 ml-auto max-w-2xl'
                : 'bg-[#0e1422] border-slate-800 space-y-4'
            }`}
          >
            {/* Message Header */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <div className="flex items-center space-x-2">
                {msg.role === 'user' ? (
                  <>
                    <User className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono font-bold text-cyan-300">Developer Query</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-emerald-300">
                      RepoMind RAG
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                {msg.ragResponse && (
                  <span className="text-slate-400">
                    Latency: {msg.ragResponse.durationMs}ms &bull; Chunks: {msg.ragResponse.retrievedChunksCount}
                  </span>
                )}
                <span>{msg.timestamp}</span>
              </div>
            </div>

            {/* Answer Body */}
            <div className="text-xs text-slate-200 leading-relaxed font-sans prose prose-invert max-w-none whitespace-pre-wrap">
              {msg.content}
            </div>

            {/* RAG Confidence & Evidence Section (Screens 8 & 9) */}
            {msg.ragResponse && (
              <div className="pt-4 border-t border-slate-800/80 space-y-4">
                {/* Confidence Status Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded border flex items-center space-x-1 ${
                        msg.ragResponse.grounded
                          ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                          : 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                      }`}
                    >
                      {msg.ragResponse.grounded ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 mr-1" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-400 mr-1" />
                      )}
                      <span>Status: {msg.ragResponse.confidenceStatus}</span>
                    </span>
                  </div>

                  {msg.ragResponse.relevantFiles.length > 0 && (
                    <div className="text-[11px] font-mono text-slate-400">
                      Cited Files: <span className="text-cyan-400">{msg.ragResponse.relevantFiles.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Evidence Cards (Screen 9) */}
                {msg.ragResponse.evidence.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Verifiable Supporting Repository Evidence ({msg.ragResponse.evidence.length})</span>
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                      {msg.ragResponse.evidence.map((ev: EvidenceItem, i: number) => (
                        <div
                          key={i}
                          className="bg-[#070a10] border border-slate-800 hover:border-cyan-500/50 rounded-xl p-3.5 space-y-2 transition group"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center space-x-2 truncate">
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.2 rounded font-bold">
                                #{i + 1}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300 transition truncate">
                                {ev.filePath}
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                Lines {ev.startLine}–{ev.endLine}
                              </span>
                            </div>

                            <button
                              onClick={() => onNavigateToFileLine(ev.filePath, ev.startLine)}
                              className="text-xs font-mono text-cyan-400 hover:text-white flex items-center space-x-1 bg-slate-900 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800 shrink-0"
                            >
                              <span>Jump to Source</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-[11px] font-mono text-slate-400">
                            Symbol: <span className="text-teal-300 font-semibold">{ev.symbolName}</span> ({ev.symbolType}) &bull; {ev.retrievalReason}
                          </div>

                          {/* Code Snippet */}
                          <div className="bg-[#04060a] border border-slate-900 p-2.5 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
                            <pre>{ev.snippet}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isAsking && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center space-x-3 text-xs font-mono text-cyan-300">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Querying ChromaDB vector store &amp; synthesizing grounded response with Gemini 3.8 Flash...</span>
          </div>
        )}
      </div>

      {/* Query Input Box */}
      <form onSubmit={onSubmit} className="sticky bottom-4 pt-2">
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2 flex items-center shadow-2xl backdrop-blur-md">
          <input
            type="text"
            placeholder="Ask anything about this repository (e.g., 'How are passwords hashed and checked?')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isAsking}
            className="flex-1 bg-transparent px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={isAsking || !question.trim()}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-xs font-mono transition flex items-center space-x-1.5 shadow-md shadow-cyan-950/40 shrink-0"
          >
            <span>Ask</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
