"""Dense embedding service supporting Google GenAI and ChromaDB ONNX MiniLM models."""
import os
import logging
from typing import List

logger = logging.getLogger("code_archaeologist.embeddings")

class EmbeddingService:
    """Provides dense embedding vectors for code chunks and natural-language queries."""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self._genai_client = None

        if self.api_key:
            try:
                from google import genai
                self._genai_client = genai.Client(api_key=self.api_key)
                logger.info("Google GenAI dense embedding client initialized.")
            except Exception as exc:
                logger.warning(f"Could not initialize Google GenAI embeddings ({exc}); using ChromaDB ONNX embedding.")

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding vector for a single query text."""
        docs = self.embed_documents([text])
        return docs[0] if docs else []

    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Generate dense embeddings for a list of document strings."""
        if self._genai_client:
            try:
                response = self._genai_client.models.embed_content(
                    model="text-embedding-004",
                    contents=documents,
                )
                if hasattr(response, "embeddings") and response.embeddings:
                    return [e.values for e in response.embeddings]
            except Exception as e:
                logger.warning(f"Google GenAI embedding failed ({e}); falling back to local ChromaDB ONNX.")

        # Fallback: ChromaDB's built-in ONNX all-MiniLM-L6-v2 embedding function
        try:
            from chromadb.utils import embedding_functions
            fn = embedding_functions.DefaultEmbeddingFunction()
            return fn(documents)
        except Exception as e:
            logger.error(f"Failed to generate dense embeddings via default function: {e}")
            raise RuntimeError("Dense embedding generation failed. Check GEMINI_API_KEY or ChromaDB ONNX configuration.")
