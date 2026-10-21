"""Dense embedding service supporting Google GenAI and ChromaDB ONNX MiniLM models."""
import os
import logging
import gc
from typing import List, Optional

logger = logging.getLogger("code_archaeologist.embeddings")

_SHARED_ONNX_EMBEDDING_FN = None


def get_shared_onnx_embedding_function():
    """Lazily load and cache a single shared ONNX DefaultEmbeddingFunction instance."""
    global _SHARED_ONNX_EMBEDDING_FN
    if _SHARED_ONNX_EMBEDDING_FN is None:
        try:
            from chromadb.utils import embedding_functions
            _SHARED_ONNX_EMBEDDING_FN = embedding_functions.DefaultEmbeddingFunction()
            logger.info("ChromaDB ONNX DefaultEmbeddingFunction loaded and cached as shared singleton.")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB DefaultEmbeddingFunction: {e}")
            raise
    return _SHARED_ONNX_EMBEDDING_FN


class EmbeddingService:
    """Provides dense embedding vectors for code chunks and natural-language queries.
    Reuses model instances and batches requests to minimize memory consumption on restricted environments.
    """

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self._genai_client = None

    def _get_genai_client(self):
        """Lazily initialize or return cached Google GenAI client instance."""
        if not self._genai_client:
            api_key = self.api_key or os.getenv("GEMINI_API_KEY", "").strip()
            if api_key:
                try:
                    from google import genai
                    self._genai_client = genai.Client(api_key=api_key)
                    self.api_key = api_key
                    logger.info("Google GenAI dense embedding client initialized.")
                except Exception as exc:
                    logger.warning(f"Could not initialize Google GenAI embeddings ({exc}); using ChromaDB ONNX embedding.")
        return self._genai_client

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding vector for a single query text."""
        docs = self.embed_documents([text])
        return docs[0] if docs else []

    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Generate dense embeddings for a list of document strings with chunked batching."""
        if not documents:
            return []

        client = self._get_genai_client()
        if client:
            try:
                # Batch in groups of 25 to avoid large request payload memory
                results: List[List[float]] = []
                batch_size = 25
                for i in range(0, len(documents), batch_size):
                    batch = documents[i:i + batch_size]
                    response = client.models.embed_content(
                        model="text-embedding-004",
                        contents=batch,
                    )
                    if hasattr(response, "embeddings") and response.embeddings:
                        results.extend([e.values for e in response.embeddings])
                    del batch
                if len(results) == len(documents):
                    return results
            except Exception as e:
                logger.warning(f"Google GenAI embedding failed ({e}); falling back to local ChromaDB ONNX.")

        # Fallback: ChromaDB's shared built-in ONNX all-MiniLM-L6-v2 embedding function
        try:
            fn = get_shared_onnx_embedding_function()
            # Process in small batches of 16 to prevent ONNX activation memory spikes on 512MB RAM
            all_embeddings: List[List[float]] = []
            onnx_batch = 16
            for i in range(0, len(documents), onnx_batch):
                batch_slice = documents[i:i + onnx_batch]
                emb_slice = fn(batch_slice)
                all_embeddings.extend(emb_slice)
                del batch_slice
            gc.collect()
            return all_embeddings
        except Exception as e:
            logger.warning(f"ONNX embedding failed or timed out ({e}); using fast deterministic pseudo-embeddings.")
            import hashlib
            dim = 384
            fallback_embeddings = []
            for doc in documents:
                vec = [0.0] * dim
                words = doc.split()
                for w in words:
                    h = int(hashlib.md5(w.encode("utf-8", errors="ignore")).hexdigest(), 16)
                    idx = h % dim
                    val = ((h >> 8) % 1000) / 1000.0 - 0.5
                    vec[idx] += val
                norm = sum(x * x for x in vec) ** 0.5 or 1.0
                fallback_embeddings.append([x / norm for x in vec])
            return fallback_embeddings


try:
    from chromadb.api.types import EmbeddingFunction, Documents, Embeddings
except ImportError:
    EmbeddingFunction = object  # type: ignore
    Documents = List[str]  # type: ignore
    Embeddings = List[List[float]]  # type: ignore


class RepoMindEmbeddingFunction(EmbeddingFunction):
    """Adapter allowing ChromaDB collections to reuse EmbeddingService directly.
    When GEMINI_API_KEY is configured, uses remote GenAI API (0MB local model RAM).
    Otherwise, reuses the shared ONNX model instance across all collections.
    """

    def __init__(self, service: EmbeddingService):
        self.service = service

    @staticmethod
    def name() -> str:
        return "default"

    def get_config(self) -> dict:
        return {}

    @classmethod
    def build_from_config(cls, config: dict):
        return cls(EmbeddingService())

    def __call__(self, input: Documents) -> Embeddings:
        return self.service.embed_documents(list(input))

