import React, { useState } from 'react';
import {
  MessageSquareCode,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Bot,
  User,
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
        'Hello! I am your RepoMind codebase assistant. I answer questions grounded strictly in the parsed AST code chunks and dependency graph of this repository. Every answer includes verifiable citations to exact source files and line ranges.',
      timestamp: 'Ready',
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
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <MessageSquareCode className="w-4 h-4 text-[#78A887]" />
            <h1 className="text-lg font-semibold text-[#F1F0E9] font-mono">
              AI Codebase Assistant &amp; Grounded RAG
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#263A2D] text-[#81C995] border border-[#537B5D] font-medium flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3 text-[#81C995]" />
              <span>ChromaDB Vector Store + Gemini 3.8 Flash</span>
            </span>
          </div>
        </div>
        <p className="text-xs text-[#858E86]">
          Evidence-grounded explanations: claims are cited against real AST symbols and file lines from the analyzed repository.
        </p>
      </div>

      {/* Preset Suggestions */}
      <div className="flex flex-wrap gap-1.5">
        {presetQuestions.map((pq, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleAsk(pq)}
            disabled={isAsking}
            className="text-xs text-[#B1B7B1] bg-[#262C28] hover:bg-[#2B322D] border border-[#343B36] hover:border-[#537B5D] px-2.5 py-1 rounded transition font-mono cursor-pointer"
          >
            {pq}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-4 rounded-lg border transition-colors ${
              msg.role === 'user'
                ? 'bg-[#202522] border-[#414A43] ml-auto max-w-2xl'
                : 'bg-[#262C28] border-[#414A43] space-y-3'
            }`}
          >
            {/* Message Header */}
            <div className="flex items-center justify-between border-b border-[#343B36] pb-2">
              <div className="flex items-center space-x-2">
                {msg.role === 'user' ? (
                  <>
                    <User className="w-3.5 h-3.5 text-[#B9D9BE]" />
                    <span className="text-xs font-mono font-medium text-[#F1F0E9]">Developer Query</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-[#78A887]" />
                    <span className="text-xs font-mono font-medium text-[#B9D9BE]">
                      RepoMind Grounded RAG
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-[#858E86] font-mono">
                {msg.ragResponse && (
                  <span>
                    Latency: {msg.ragResponse.durationMs}ms · Chunks: {msg.ragResponse.retrievedChunksCount}
                  </span>
                )}
                <span>{msg.timestamp}</span>
              </div>
            </div>

            {/* Answer Body */}
            <div className="text-xs text-[#F1F0E9] leading-relaxed font-sans whitespace-pre-wrap">
              {msg.content}
            </div>

            {/* RAG Confidence & Evidence Section */}
            {msg.ragResponse && (
              <div className="pt-3 border-t border-[#343B36] space-y-3">
                {/* Confidence Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border flex items-center space-x-1 ${
                        msg.ragResponse.grounded
                          ? 'bg-[#263A2D] text-[#81C995] border-[#537B5D]'
                          : 'bg-[#202522] text-[#D6A85F] border-[#D6A85F]'
                      }`}
                    >
                      {msg.ragResponse.grounded ? (
                        <CheckCircle2 className="w-3 h-3 text-[#81C995] mr-1" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-[#D6A85F] mr-1" />
                      )}
                      <span>Status: {msg.ragResponse.confidenceStatus}</span>
                    </span>
                  </div>

                  {msg.ragResponse.relevantFiles.length > 0 && (
                    <div className="text-[11px] font-mono text-[#858E86]">
                      Cited Files: <span className="text-[#F1F0E9]">{msg.ragResponse.relevantFiles.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Evidence Cards */}
                {msg.ragResponse.evidence.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono font-semibold text-[#858E86] uppercase tracking-wider flex items-center space-x-1">
                      <FileCode className="w-3 h-3 text-[#78A887]" />
                      <span>Verifiable Supporting Evidence ({msg.ragResponse.evidence.length})</span>
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                      {msg.ragResponse.evidence.map((ev: EvidenceItem, i: number) => (
                        <div
                          key={i}
                          className="bg-[#171A19] border border-[#343B36] hover:border-[#537B5D] rounded p-3 space-y-1.5 transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center space-x-2 truncate">
                              <span className="text-[10px] font-mono text-[#78A887] bg-[#202522] border border-[#343B36] px-1.5 py-0.2 rounded font-medium">
                                #{i + 1}
                              </span>
                              <span className="text-xs font-mono font-medium text-[#F1F0E9] truncate">
                                {ev.filePath}
                              </span>
                              <span className="text-xs font-mono text-[#858E86]">
                                Lines {ev.startLine}–{ev.endLine}
                              </span>
                            </div>

                            <button
                              onClick={() => onNavigateToFileLine(ev.filePath, ev.startLine)}
                              className="text-xs font-mono text-[#F1F0E9] hover:text-[#B9D9BE] flex items-center space-x-1 bg-[#202522] hover:bg-[#262C28] px-2 py-0.5 rounded border border-[#343B36] shrink-0 cursor-pointer"
                            >
                              <span>Jump to Source</span>
                              <ArrowRight className="w-3 h-3 text-[#78A887]" />
                            </button>
                          </div>

                          <div className="text-[11px] font-mono text-[#858E86]">
                            Symbol: <span className="text-[#B9D9BE] font-medium">{ev.symbolName}</span> ({ev.symbolType}) · {ev.retrievalReason}
                          </div>

                          {/* Code Snippet */}
                          <div className="bg-[#171A19] border border-[#202522] p-2 rounded text-[11px] font-mono text-[#B1B7B1] overflow-x-auto">
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
          <div className="p-3 rounded-md bg-[#262C28] border border-[#414A43] flex items-center space-x-2.5 text-xs font-mono text-[#B9D9BE]">
            <div className="w-3.5 h-3.5 border-2 border-[#78A887] border-t-transparent rounded-full animate-spin"></div>
            <span>Querying ChromaDB vector store and synthesizing answer with Gemini...</span>
          </div>
        )}
      </div>

      {/* Query Input Box */}
      <form onSubmit={onSubmit} className="sticky bottom-4 pt-2">
        <div className="bg-[#202522] border border-[#414A43] rounded-lg p-1.5 flex items-center shadow-lg">
          <input
            type="text"
            placeholder="Ask anything about this repository (e.g., 'How are passwords hashed and checked?')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isAsking}
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-[#F1F0E9] placeholder-[#858E86] font-mono focus:outline-none"
          />
          <button
            type="submit"
            disabled={isAsking || !question.trim()}
            className="bg-[#78A887] hover:bg-[#8AB898] disabled:opacity-50 text-[#171A19] font-medium px-4 py-2 rounded-md text-xs font-mono transition flex items-center space-x-1 shrink-0 cursor-pointer"
          >
            <span>Ask</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
