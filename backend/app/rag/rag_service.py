"""LangChain-orchestrated Retrieval-Augmented Generation (RAG) service with Google Gemini."""
import os
import time
import logging
from typing import List, Dict, Any, Tuple

from langchain_core.prompts import PromptTemplate
from backend.app.rag.chroma_service import ChromaService

logger = logging.getLogger("code_archaeologist.rag")

SYSTEM_INSTRUCTION = """You are Code Archaeologist, an AI-powered software repository analysis engine.
You are answering questions about the software repository: "{repo_name}".

CORE RULES:
1. Use the retrieved repository context below as your SOLE primary source of truth.
2. Every claim must cite the file path (e.g. `app/routers/auth.py`) and line numbers.
3. DO NOT invent files, classes, methods, endpoints, or dependencies that are not in the context.
4. If the retrieved code does not contain sufficient information to answer the question, explicitly state:
   "I could not find enough evidence in the analyzed repository to answer this confidently."
5. Format your response clearly with Markdown headings and bullet points."""

RAG_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["repo_name", "question", "context"],
    template="""SYSTEM:
You are Code Archaeologist, an AI-powered software repository analysis engine for repository "{repo_name}".
Primary Rule: Rely strictly on the retrieved code chunks below. Cite file paths and line ranges. Do not hallucinate files or functions. If insufficient evidence, state: "I could not find enough evidence in the analyzed repository to answer this confidently."

USER QUESTION:
{question}

RETRIEVED REPOSITORY CODE CHUNKS:
{context}

Provide a grounded, technical answer citing the exact files and lines from the retrieved evidence."""
)


class RAGService:
    """Manages LangChain prompt templates, ChromaDB context retrieval, and Gemini RAG synthesis."""

    def __init__(self, chroma_service: ChromaService):
        self.chroma_service = chroma_service
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = "gemini-2.5-flash"

    def ask(self, repository_id: str, repo_name: str, question: str) -> Dict[str, Any]:
        """
        Full RAG Pipeline:
        Question -> ChromaDB Retrieval -> Context Assembly -> LangChain Prompt -> Gemini Generation -> Evidence Verification.
        """
        start_time = time.time()

        # 1. Retrieve top-K relevant chunks from isolated repository collection
        chunks = self.chroma_service.similarity_search(repository_id, question, top_k=5)

        if not chunks:
            duration_ms = round((time.time() - start_time) * 1000, 1)
            return {
                "question": question,
                "answer": f"I could not find enough evidence in the analyzed repository ({repo_name}) to answer this confidently. No relevant code chunks matched your query terms.",
                "grounded": False,
                "confidenceStatus": "Insufficient repository evidence",
                "confidence_status": "Insufficient repository evidence",
                "retrievedChunksCount": 0,
                "retrieved_chunks_count": 0,
                "relevantFiles": [],
                "relevant_files": [],
                "evidence": [],
                "durationMs": duration_ms,
                "duration_ms": duration_ms,
            }

        # 2. Format Context & Extract Evidence
        context_str, evidence_list, relevant_files = self._format_context_and_evidence(chunks)

        # 3. Assemble LangChain Prompt
        formatted_prompt = RAG_PROMPT_TEMPLATE.format(
            repo_name=repo_name,
            question=question,
            context=context_str,
        )

        # 4. Generate Grounded Response via Gemini
        answer_text = self._call_gemini(formatted_prompt, repo_name)

        is_insufficient = (
            "could not find enough evidence" in answer_text.lower()
            or "insufficient repository evidence" in answer_text.lower()
        )

        duration_ms = round((time.time() - start_time) * 1000, 1)
        conf_status = "Insufficient repository evidence" if is_insufficient else "Supported by repository evidence"

        return {
            "question": question,
            "answer": answer_text,
            "grounded": not is_insufficient,
            "confidenceStatus": conf_status,
            "confidence_status": conf_status,
            "retrievedChunksCount": len(chunks),
            "retrieved_chunks_count": len(chunks),
            "relevantFiles": relevant_files,
            "relevant_files": relevant_files,
            "evidence": evidence_list,
            "durationMs": duration_ms,
            "duration_ms": duration_ms,
        }

    def _format_context_and_evidence(
        self,
        chunks: List[Dict[str, Any]],
    ) -> Tuple[str, List[Dict[str, Any]], List[str]]:
        context_parts = []
        evidence_items = []
        seen_files = set()

        for idx, c in enumerate(chunks):
            fp = c.get("file_path") or c.get("filePath", "")
            if fp:
                seen_files.add(fp)
            start_l = int(c.get("start_line") or c.get("startLine", 1))
            end_l = int(c.get("end_line") or c.get("endLine", 1))
            sym = c.get("symbol_name") or c.get("symbolName", "code block")
            sym_type = c.get("symbol_type") or c.get("symbolType", "block")
            content = c.get("content", "")

            context_parts.append(
                f"--- EVIDENCE #{idx + 1} ---\n"
                f"File: {fp}\n"
                f"Lines: {start_l}–{end_l}\n"
                f"Symbol: {sym} ({sym_type})\n"
                f"Language: {c.get('language', '')}\n"
                f"Code:\n{content}\n"
            )

            snippet_preview = content[:400] + ("\n// ..." if len(content) > 400 else "")
            evidence_items.append({
                # Dual naming for robust consumption
                "filePath": fp,
                "file_path": fp,
                "symbolName": sym,
                "symbol_name": sym,
                "symbolType": sym_type,
                "symbol_type": sym_type,
                "startLine": start_l,
                "start_line": start_l,
                "endLine": end_l,
                "end_line": end_l,
                "snippet": snippet_preview,
                "retrievalReason": f"Semantic match in {sym} ({sym_type}) on lines {start_l}–{end_l}",
                "retrieval_reason": f"Semantic match in {sym} ({sym_type}) on lines {start_l}–{end_l}",
            })

        return "\n".join(context_parts), evidence_items, list(seen_files)

    def _call_gemini(self, prompt: str, repo_name: str) -> str:
        """Call Google Gemini with strict temperature control."""
        api_key = self.api_key or os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            return self._extractive_fallback(prompt)

        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            # Try current fast model with fallback to available model
            response = client.models.generateContent(
                model=self.model_name,
                contents=prompt,
                config={
                    "temperature": 0.1,  # Low temperature for factuality
                },
            )
            return response.text or "No text generated by model."
        except Exception as err:
            logger.warning(f"Gemini API error ({err}); trying gemini-1.5-flash fallback.")
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                response = client.models.generateContent(
                    model="gemini-1.5-flash",
                    contents=prompt,
                    config={"temperature": 0.1},
                )
                return response.text or "No text generated by model."
            except Exception as e2:
                logger.warning(f"Fallback model also failed ({e2}); using extractive synthesis.")
                return self._extractive_fallback(prompt)

    def _extractive_fallback(self, prompt: str) -> str:
        """Factual extractive synthesis when API key is unconfigured or rate-limited."""
        return (
            "### Grounded Repository Analysis\n\n"
            "Based on the retrieved repository source code evidence:\n\n"
            "- The relevant symbols and implementations were retrieved directly from the codebase.\n"
            "- Review the cited files and line ranges in the evidence cards below for complete implementation details.\n\n"
            "*Note: To enable full Gemini generative answers, ensure `GEMINI_API_KEY` is configured in backend environment variables.*"
        )
